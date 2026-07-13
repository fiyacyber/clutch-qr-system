-- Restore every historical QR type and tighten existing-code eligibility.
alter table public.qr_codes drop constraint if exists qr_codes_qr_type_check;
alter table public.qr_codes add constraint qr_codes_qr_type_check check (
  qr_type in (
    'url','connect_profile','text','wifi','email','sms','image','pdf','vcard',
    'smart_card','tracked_print','business_kit'
  )
);

create or replace function public.provision_tracked_print_qr(
  p_print_order_item_id uuid,
  p_customer_id uuid,
  p_destination_url text,
  p_campaign_name text,
  p_material_type text,
  p_idempotency_key text,
  p_existing_qr_code_id uuid default null
) returns table(qr_code_id uuid, included_qr_allowance integer)
language plpgsql security definer set search_path = ''
as $$
declare v_item public.print_order_items%rowtype; v_qr uuid; v_included integer; v_access text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_customer_id is null or p_print_order_item_id is null or coalesce(trim(p_idempotency_key),'') = '' then raise exception 'invalid provisioning input'; end if;
  select * into v_item from public.print_order_items where id = p_print_order_item_id for update;
  if not found or v_item.customer_id is distinct from p_customer_id then raise exception 'print item unavailable'; end if;
  select p.qr_code_id into v_qr from public.print_qr_provisionings p where p.print_order_item_id = p_print_order_item_id;
  if v_qr is not null then
    v_included := public.reconcile_included_qr_allowance(p_customer_id);
    return query select v_qr, v_included; return;
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
    insert into public.qr_codes (
      customer_id, name, slug, destination_url, is_system, qr_type, print_order_item_id,
      capacity_source, counts_toward_capacity, customer_can_delete, customer_can_edit_destination
    ) values (
      p_customer_id, coalesce(nullif(trim(p_campaign_name),''), 'Tracked print campaign'),
      'tracked-' || replace(gen_random_uuid()::text, '-', ''), p_destination_url, true, 'tracked_print',
      p_print_order_item_id, 'included_print', true, false, true
    ) returning id into v_qr;
    v_access := 'included_permanent';
  end if;
  insert into public.print_qr_provisionings (
    print_order_item_id, customer_id, qr_code_id, source_type, access_type, material_type,
    provisioning_status, idempotency_key, destination_url_snapshot, campaign_name_snapshot
  ) values (
    p_print_order_item_id, p_customer_id, v_qr, 'tracked_print', v_access, p_material_type,
    'completed', p_idempotency_key, p_destination_url, p_campaign_name
  );
  update public.print_order_items set provisioning_status = 'completed', attention_reason = null
  where id = p_print_order_item_id;
  insert into public.order_activity(order_type, order_id, action, actor_type, new_value, idempotency_key)
  values ('print_order', p_print_order_item_id, 'qr_provisioned', 'system',
    jsonb_build_object('access_type',v_access,'qr_code_id',v_qr), p_idempotency_key || ':activity')
  on conflict (idempotency_key) where idempotency_key is not null do nothing;
  v_included := public.reconcile_included_qr_allowance(p_customer_id);
  return query select v_qr, v_included;
end $$;

revoke all on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) to service_role;
