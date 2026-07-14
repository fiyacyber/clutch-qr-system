-- Preserve atomic print provisioning while allowing an explicitly trusted
-- Business Kit component to retain its source. The existing seven-argument
-- tracked-print RPC remains available for compatibility; application code in
-- this release uses this source-aware overload.
alter table public.print_qr_provisionings
  drop constraint print_qr_provisionings_access_timestamp_pair_check;

alter table public.print_qr_provisionings
  add constraint print_qr_provisionings_access_timestamp_pair_check check (
    (platform_access_started_at is null and platform_access_expires_at is null)
    or (
      platform_access_started_at is not null
      and platform_access_expires_at = platform_access_started_at + interval '2160 hours'
      and provisioning_status = 'completed'
      and access_type = 'included_permanent'
      and source_type in ('tracked_print', 'business_kit')
    )
  );

create or replace function public.set_order_linked_platform_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opted_in boolean;
begin
  if tg_op = 'UPDATE' and old.platform_access_started_at is not null then
    new.platform_access_started_at := old.platform_access_started_at;
    new.platform_access_expires_at := old.platform_access_expires_at;
    return new;
  end if;
  if tg_op = 'UPDATE' and (
    new.platform_access_started_at is distinct from old.platform_access_started_at
    or new.platform_access_expires_at is distinct from old.platform_access_expires_at
  ) then
    new.platform_access_started_at := null;
    new.platform_access_expires_at := null;
  end if;
  if new.provisioning_status <> 'completed' or new.access_type <> 'included_permanent' then return new; end if;
  select poi.clutch_codes_access_opt_in into v_opted_in
  from public.print_order_items poi where poi.id = new.print_order_item_id;
  if coalesce(v_opted_in, false) and new.platform_access_started_at is null then
    new.platform_access_started_at := coalesce(new.created_at, now());
    new.platform_access_expires_at := new.platform_access_started_at + interval '2160 hours';
  end if;
  return new;
end
$$;

revoke all on function public.set_order_linked_platform_access() from public, anon, authenticated;
grant execute on function public.set_order_linked_platform_access() to service_role;

create function public.provision_tracked_print_qr(
  p_print_order_item_id uuid,
  p_customer_id uuid,
  p_destination_url text,
  p_campaign_name text,
  p_material_type text,
  p_idempotency_key text,
  p_existing_qr_code_id uuid,
  p_source_type text
) returns table(qr_code_id uuid, included_qr_allowance integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.print_order_items%rowtype;
  v_qr uuid;
  v_included integer;
  v_access text;
  v_qr_type text;
begin
  if p_customer_id is null or p_print_order_item_id is null or coalesce(trim(p_idempotency_key),'') = '' then
    raise exception 'invalid provisioning input';
  end if;
  if p_source_type not in ('tracked_print', 'business_kit') then
    raise exception 'invalid print source type';
  end if;
  select * into v_item from public.print_order_items where id = p_print_order_item_id for update;
  if not found or v_item.customer_id is distinct from p_customer_id then raise exception 'print item unavailable'; end if;
  select p.qr_code_id into v_qr from public.print_qr_provisionings p where p.print_order_item_id = p_print_order_item_id;
  if v_qr is not null then
    v_included := public.reconcile_included_qr_allowance(p_customer_id);
    return query select v_qr, v_included;
    return;
  end if;
  if p_existing_qr_code_id is not null then
    select q.id into v_qr from public.qr_codes q
    where q.id = p_existing_qr_code_id
      and q.customer_id = p_customer_id
      and q.is_system = false
      and q.capacity_source = 'subscription'
      and q.counts_toward_capacity = true
      and q.customer_can_edit_destination = true
      and q.is_active = true
      and q.qr_type not in ('smart_card','tracked_print','business_kit');
    if v_qr is null then raise exception 'selected QR is unavailable'; end if;
    v_access := 'existing_customer_code';
  else
    if p_destination_url !~* '^https?://' then raise exception 'valid destination required'; end if;
    v_qr_type := case when p_source_type = 'business_kit' then 'business_kit' else 'tracked_print' end;
    insert into public.qr_codes (
      customer_id, name, slug, destination_url, is_system, qr_type, print_order_item_id,
      capacity_source, counts_toward_capacity, customer_can_delete, customer_can_edit_destination
    ) values (
      p_customer_id, coalesce(nullif(trim(p_campaign_name),''), 'Tracked print campaign'),
      'tracked-' || replace(gen_random_uuid()::text, '-', ''), p_destination_url, true, v_qr_type,
      p_print_order_item_id, 'included_print', true, false, true
    ) returning id into v_qr;
    v_access := 'included_permanent';
  end if;
  insert into public.print_qr_provisionings (
    print_order_item_id, customer_id, qr_code_id, source_type, access_type, material_type,
    provisioning_status, idempotency_key, destination_url_snapshot, campaign_name_snapshot
  ) values (
    p_print_order_item_id, p_customer_id, v_qr, p_source_type, v_access, p_material_type,
    'completed', p_idempotency_key, p_destination_url, p_campaign_name
  );
  update public.print_order_items set provisioning_status = 'completed', attention_reason = null
  where id = p_print_order_item_id;
  insert into public.order_activity(order_type, order_id, action, actor_type, new_value, idempotency_key)
  values ('print_order', p_print_order_item_id, 'qr_provisioned', 'system',
    jsonb_build_object('access_type',v_access,'qr_code_id',v_qr,'source_type',p_source_type), p_idempotency_key || ':activity')
  on conflict (idempotency_key) do nothing;
  v_included := public.reconcile_included_qr_allowance(p_customer_id);
  return query select v_qr, v_included;
end
$$;

revoke all on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid,text) to service_role;

comment on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid,text) is
  'Service-only atomic QR/link/provisioning/activity/capacity operation with a validated print source.';
