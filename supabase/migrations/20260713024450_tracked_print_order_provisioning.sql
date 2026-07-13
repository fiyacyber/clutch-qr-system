-- Normalized tracked-print orders and atomic included QR provisioning.
create extension if not exists "pgcrypto";

create table public.print_order_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  shopify_order_id text not null,
  shopify_order_number text,
  shopify_line_item_id text not null,
  shopify_customer_id text,
  customer_email text,
  customer_name text,
  product_id text,
  variant_id text,
  sku text,
  product_title text not null,
  variant_title text,
  material_type text not null,
  quantity integer not null check (quantity > 0),
  tracking_mode text not null check (tracking_mode in ('none', 'new_included_code', 'existing_code')),
  campaign_name text,
  destination_url text,
  existing_qr_code_id uuid references public.qr_codes(id) on delete set null,
  artwork_method text,
  artwork_file_url text,
  artwork_instructions text,
  qr_placement_instructions text,
  artwork_status text not null default 'not_received' check (artwork_status in ('not_received','received','reviewing','changes_requested','approved')),
  proof_status text not null default 'not_started' check (proof_status in ('not_started','preparing','sent','changes_requested','approved')),
  production_status text not null default 'not_started' check (production_status in ('not_started','ready','submitted','in_production','completed','cancelled')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','partial','fulfilled','delivered','cancelled')),
  supplier text,
  tracking_number text,
  tracking_url text,
  provisioning_status text not null default 'pending' check (provisioning_status in ('not_required','pending','completed','needs_attention','failed')),
  attention_reason text,
  normalized_properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shopify_order_id, shopify_line_item_id)
);

alter table public.qr_codes
  add column print_order_item_id uuid references public.print_order_items(id) on delete restrict,
  add column capacity_source text not null default 'subscription',
  add column counts_toward_capacity boolean not null default true,
  add column customer_can_delete boolean not null default true,
  add column customer_can_edit_destination boolean not null default true;

alter table public.qr_codes
  add constraint qr_codes_capacity_source_check check (capacity_source in ('subscription','included_print','system_exempt'));

update public.qr_codes
set capacity_source = case when is_system then 'system_exempt' else 'subscription' end,
    counts_toward_capacity = not is_system,
    customer_can_delete = not is_system,
    customer_can_edit_destination = case when is_system then false else true end;

alter table public.qr_codes drop constraint if exists qr_codes_qr_type_check;
alter table public.qr_codes add constraint qr_codes_qr_type_check
  check (qr_type in ('url','connect_profile','smart_card','tracked_print','business_kit'));

create table public.print_qr_provisionings (
  id uuid primary key default gen_random_uuid(),
  print_order_item_id uuid not null references public.print_order_items(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  qr_code_id uuid not null references public.qr_codes(id) on delete restrict,
  source_type text not null check (source_type in ('tracked_print','business_kit')),
  access_type text not null check (access_type in ('included_permanent','existing_customer_code')),
  material_type text not null,
  provisioning_status text not null check (provisioning_status in ('pending','completed','failed')),
  idempotency_key text not null unique,
  destination_url_snapshot text,
  campaign_name_snapshot text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (print_order_item_id)
);

create unique index print_qr_provisionings_included_qr_unique
  on public.print_qr_provisionings(qr_code_id)
  where access_type = 'included_permanent';

create table public.order_activity (
  id uuid primary key default gen_random_uuid(),
  order_type text not null check (order_type in ('print_order','card_order')),
  order_id uuid not null,
  action text not null,
  actor_type text not null check (actor_type in ('system','admin','customer')),
  actor_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index order_activity_idempotency_unique on public.order_activity(idempotency_key) where idempotency_key is not null;
create index print_order_items_customer_idx on public.print_order_items(customer_id);
create index print_order_items_shopify_order_idx on public.print_order_items(shopify_order_id);
create index print_order_items_order_number_idx on public.print_order_items(shopify_order_number);
create index print_order_items_provisioning_idx on public.print_order_items(provisioning_status);
create index print_order_items_artwork_idx on public.print_order_items(artwork_status);
create index print_order_items_proof_idx on public.print_order_items(proof_status);
create index print_order_items_production_idx on public.print_order_items(production_status);
create index print_order_items_fulfillment_idx on public.print_order_items(fulfillment_status);
create index print_order_items_created_idx on public.print_order_items(created_at desc);
create index print_qr_provisionings_customer_idx on public.print_qr_provisionings(customer_id);
create index print_qr_provisionings_qr_idx on public.print_qr_provisionings(qr_code_id);
create index qr_codes_capacity_count_idx on public.qr_codes(customer_id, counts_toward_capacity);
create unique index qr_codes_print_order_item_unique on public.qr_codes(print_order_item_id) where print_order_item_id is not null;

create trigger set_print_order_items_updated_at before update on public.print_order_items
for each row execute function public.set_updated_at();
create trigger set_print_qr_provisionings_updated_at before update on public.print_qr_provisionings
for each row execute function public.set_updated_at();

alter table public.print_order_items enable row level security;
alter table public.print_qr_provisionings enable row level security;
alter table public.order_activity enable row level security;

create policy print_order_items_customer_read on public.print_order_items for select to authenticated
using (customer_id in (select c.id from public.customers c where c.auth_user_id = (select auth.uid())) or public.current_user_is_admin());
create policy print_qr_provisionings_customer_read on public.print_qr_provisionings for select to authenticated
using (customer_id in (select c.id from public.customers c where c.auth_user_id = (select auth.uid())) or public.current_user_is_admin());
create policy order_activity_customer_read on public.order_activity for select to authenticated
using (
  (order_type = 'print_order' and exists (
    select 1 from public.print_order_items poi join public.customers c on c.id = poi.customer_id
    where poi.id = order_activity.order_id and c.auth_user_id = (select auth.uid())
  )) or public.current_user_is_admin()
);

grant select on public.print_order_items, public.print_qr_provisionings, public.order_activity to authenticated;
revoke insert, update, delete on public.print_order_items, public.print_qr_provisionings, public.order_activity from anon, authenticated;

create or replace function public.reconcile_included_qr_allowance(p_customer_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_included integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'service role required'; end if;
  select count(*)::integer into v_included
  from public.print_qr_provisionings p
  where p.customer_id = p_customer_id and p.access_type = 'included_permanent' and p.provisioning_status = 'completed';
  update public.customers c
  set included_qr_allowance = v_included,
      qr_limit = v_included + greatest(coalesce(c.subscription_qr_limit, 0), 0)
  where c.id = p_customer_id and not c.is_admin;
  return v_included;
end $$;

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
    where q.id = p_existing_qr_code_id and q.customer_id = p_customer_id
      and not (q.is_system and q.qr_type = 'smart_card');
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
  update public.print_order_items set provisioning_status = 'completed', attention_reason = null,
    existing_qr_code_id = case when v_access = 'existing_customer_code' then v_qr else existing_qr_code_id end
  where id = p_print_order_item_id;
  insert into public.order_activity(order_type, order_id, action, actor_type, new_value, idempotency_key)
  values ('print_order', p_print_order_item_id, 'qr_provisioned', 'system',
    jsonb_build_object('access_type',v_access,'qr_code_id',v_qr), p_idempotency_key || ':activity')
  on conflict (idempotency_key) where idempotency_key is not null do nothing;
  v_included := public.reconcile_included_qr_allowance(p_customer_id);
  return query select v_qr, v_included;
exception when others then
  raise;
end $$;

revoke all on function public.reconcile_included_qr_allowance(uuid) from public, anon, authenticated;
revoke all on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.reconcile_included_qr_allowance(uuid) to service_role;
grant execute on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) to service_role;

create or replace function public.enforce_qr_limit()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare qr_total integer; allowed_qrs integer; customer_admin boolean;
begin
  select greatest(coalesce(c.included_qr_allowance,0),0) + greatest(coalesce(c.subscription_qr_limit,0),0), c.is_admin
  into allowed_qrs, customer_admin from public.customers c where c.id = new.customer_id;
  if customer_admin then return new; end if;
  if new.capacity_source = 'included_print' and new.print_order_item_id is not null then return new; end if;
  select count(*) into qr_total from public.qr_codes q where q.customer_id = new.customer_id and q.counts_toward_capacity;
  if qr_total >= allowed_qrs then raise exception 'Maximum QR code limit reached for this customer'; end if;
  return new;
end $$;

comment on function public.provision_tracked_print_qr is 'Service-only atomic QR/link/provisioning/activity/capacity operation.';
