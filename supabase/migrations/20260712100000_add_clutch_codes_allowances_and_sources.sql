-- Clutch Codes subscription entitlements and durable Shopify event/email idempotency.
-- Run supabase/preflight/20260712100000_classify_clutch_codes_allowances.sql first
-- and resolve every review_required row before relying on migrated capacity.

alter table public.customers
  add column if not exists included_qr_allowance integer not null default 0,
  add column if not exists subscription_qr_limit integer not null default 0,
  add column if not exists clutch_codes_plan_code text,
  add column if not exists clutch_codes_subscription_status text not null default 'inactive',
  add column if not exists clutch_codes_welcome_email_sent_at timestamptz,
  add column if not exists clutch_codes_welcome_email_event_key text,
  add column if not exists shopify_line_item_id text;

alter table public.customers
  drop constraint if exists customers_plan_check,
  drop constraint if exists customers_plan_code_check,
  drop constraint if exists customers_included_qr_allowance_check,
  drop constraint if exists customers_subscription_qr_limit_check,
  drop constraint if exists customers_clutch_codes_plan_code_check,
  drop constraint if exists customers_clutch_codes_subscription_status_check;

alter table public.customers
  add constraint customers_plan_check
    check (plan in ('free_qr', 'connect_basic', 'connect_plus', 'qr_pro', 'qr_pro_plus', 'agency', 'admin')) not valid,
  add constraint customers_plan_code_check
    check (plan_code in ('free_qr', 'connect_basic', 'connect_plus', 'qr_pro', 'qr_pro_plus', 'agency', 'admin')) not valid,
  add constraint customers_included_qr_allowance_check
    check (included_qr_allowance >= 0),
  add constraint customers_subscription_qr_limit_check
    check (subscription_qr_limit >= 0),
  add constraint customers_clutch_codes_plan_code_check
    check (
      clutch_codes_plan_code is null
      or clutch_codes_plan_code in ('clutch_codes_starter', 'clutch_codes_growth', 'clutch_codes_pro')
    ),
  add constraint customers_clutch_codes_subscription_status_check
    check (clutch_codes_subscription_status in ('inactive', 'active', 'past_due', 'unpaid', 'paused', 'cancelled', 'expired'));

alter table public.customers validate constraint customers_plan_check;
alter table public.customers validate constraint customers_plan_code_check;

-- Constraint smoke test: this row is inserted and deleted inside the migration and
-- proves the authoritative new-customer values are accepted without persisting data.
do $$
declare
  validation_customer_id uuid;
begin
  insert into public.customers (email, plan, plan_code, included_qr_allowance, subscription_qr_limit)
  values (
    'clutch-codes-migration-validation+' || gen_random_uuid()::text || '@invalid.example',
    'connect_basic',
    'connect_basic',
    0,
    0
  )
  returning id into validation_customer_id;

  delete from public.customers where id = validation_customer_id;
end;
$$;

comment on column public.customers.qr_limit is
  'Legacy compatibility mirror/fallback only. Authoritative capacity is included_qr_allowance + subscription_qr_limit.';

create table if not exists public.clutch_codes_allowance_migration_audit (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  classification text not null,
  review_required boolean not null,
  proposed_included_qr_allowance integer not null default 0 check (proposed_included_qr_allowance >= 0),
  proposed_subscription_qr_limit integer not null default 0 check (proposed_subscription_qr_limit >= 0),
  evidence jsonb not null default '{}'::jsonb,
  classified_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_notes text
);

alter table public.clutch_codes_allowance_migration_audit enable row level security;
revoke all on table public.clutch_codes_allowance_migration_audit from anon, authenticated;
create index if not exists clutch_codes_allowance_migration_audit_review_idx
  on public.clutch_codes_allowance_migration_audit(review_required, classification);

-- Classify and persist evidence before changing either authoritative allowance.
with evidence as (
  select
    c.id as customer_id,
    c.is_admin,
    c.plan,
    c.plan_code,
    c.subscription_status,
    c.shopify_subscription_id,
    c.shopify_order_id,
    greatest(coalesce(c.qr_limit, 0), 0) as legacy_qr_limit,
    coalesce(qr.qr_count, 0) as existing_qr_count,
    coalesce(cards.card_order_count, 0) as confirmed_card_order_count,
    coalesce(orders.has_paid_clutch_codes_order, false) as has_paid_clutch_codes_order
  from public.customers c
  left join lateral (
    select count(*)::integer as qr_count
    from public.qr_codes q
    where q.customer_id = c.id
  ) qr on true
  left join lateral (
    select count(*)::integer as card_order_count
    from public.card_orders co
    where co.customer_id = c.id
  ) cards on true
  left join lateral (
    select bool_or(
      so.financial_status in ('paid', 'partially_paid')
      and exists (
        select 1
        from jsonb_array_elements(coalesce(so.raw_payload->'line_items', '[]'::jsonb)) li
        where upper(coalesce(li->>'sku', '')) in (
          'CLUTCH-CODES-STARTER', 'CLUTCH-CODES-GROWTH', 'CLUTCH-CODES-PRO'
        )
      )
    ) as has_paid_clutch_codes_order
    from public.shopify_orders so
    where so.customer_id = c.id
       or (c.shopify_order_id is not null and so.shopify_order_id = c.shopify_order_id)
  ) orders on true
), classified as (
  select
    evidence.*,
    (
      shopify_subscription_id is not null
      and lower(coalesce(subscription_status, '')) = 'active'
      and lower(coalesce(plan_code, plan, '')) in ('qr_pro', 'qr_pro_plus', 'agency')
    ) as has_active_paid_subscription_evidence
  from evidence
)
insert into public.clutch_codes_allowance_migration_audit (
  customer_id,
  classification,
  review_required,
  proposed_included_qr_allowance,
  proposed_subscription_qr_limit,
  evidence
)
select
  customer_id,
  case
    when is_admin then 'admin_preserve'
    when has_active_paid_subscription_evidence and confirmed_card_order_count > 0
      then 'active_paid_subscription_plus_confirmed_card'
    when has_active_paid_subscription_evidence then 'active_paid_subscription'
    when confirmed_card_order_count > 0 then 'confirmed_card_allowance'
    when has_paid_clutch_codes_order then 'manual_review_paid_order_without_contract'
    when existing_qr_count > 0 then 'manual_review_existing_qr_without_source'
    when lower(coalesce(plan_code, plan, '')) in ('qr_pro', 'qr_pro_plus', 'agency')
      then 'manual_review_legacy_paid_plan_without_subscription_id'
    else 'manual_review_no_entitlement_source'
  end,
  not (
    is_admin
    or has_active_paid_subscription_evidence
    or confirmed_card_order_count > 0
  ),
  case when not is_admin then confirmed_card_order_count else 0 end,
  case when not is_admin and has_active_paid_subscription_evidence then legacy_qr_limit else 0 end,
  jsonb_build_object(
    'is_admin', is_admin,
    'plan', plan,
    'plan_code', plan_code,
    'subscription_status', subscription_status,
    'has_shopify_subscription_id', shopify_subscription_id is not null,
    'shopify_order_id', shopify_order_id,
    'legacy_qr_limit', legacy_qr_limit,
    'existing_qr_count', existing_qr_count,
    'confirmed_card_order_count', confirmed_card_order_count,
    'has_paid_clutch_codes_order', has_paid_clutch_codes_order
  )
from classified
on conflict (customer_id) do update set
  classification = excluded.classification,
  review_required = excluded.review_required,
  proposed_included_qr_allowance = excluded.proposed_included_qr_allowance,
  proposed_subscription_qr_limit = excluded.proposed_subscription_qr_limit,
  evidence = excluded.evidence,
  classified_at = now();

-- Apply only evidence-backed classifications. Ambiguous rows remain at zero and
-- are visible in clutch_codes_allowance_migration_audit for manual review.
update public.customers c
set
  included_qr_allowance = audit.proposed_included_qr_allowance,
  subscription_qr_limit = audit.proposed_subscription_qr_limit
from public.clutch_codes_allowance_migration_audit audit
where audit.customer_id = c.id
  and audit.review_required = false
  and audit.classification <> 'admin_preserve';

create unique index if not exists customers_clutch_codes_welcome_email_event_key
  on public.customers(clutch_codes_welcome_email_event_key)
  where clutch_codes_welcome_email_event_key is not null;

create index if not exists customers_clutch_codes_plan_code_idx
  on public.customers(clutch_codes_plan_code);

create index if not exists customers_shopify_line_item_id_idx
  on public.customers(shopify_line_item_id);

create table if not exists public.shopify_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  shopify_event_id text not null,
  topic text not null,
  shopify_order_id text,
  shopify_line_item_id text,
  shopify_subscription_contract_id text,
  customer_id uuid references public.customers(id) on delete set null,
  action text not null,
  plan_code text,
  subscription_qr_limit integer,
  status text not null default 'processing',
  email_sent_at timestamptz,
  error_message text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_entitlement_events_status_check
    check (status in ('processing', 'completed', 'skipped', 'failed')),
  constraint shopify_entitlement_events_plan_code_check
    check (
      plan_code is null
      or plan_code in ('clutch_codes_starter', 'clutch_codes_growth', 'clutch_codes_pro')
    ),
  constraint shopify_entitlement_events_subscription_qr_limit_check
    check (subscription_qr_limit is null or subscription_qr_limit >= 0)
);

create index if not exists shopify_entitlement_events_shopify_event_id_idx
  on public.shopify_entitlement_events(shopify_event_id);

create index if not exists shopify_entitlement_events_shopify_order_id_idx
  on public.shopify_entitlement_events(shopify_order_id);

create index if not exists shopify_entitlement_events_subscription_contract_id_idx
  on public.shopify_entitlement_events(shopify_subscription_contract_id);

create index if not exists shopify_entitlement_events_customer_id_idx
  on public.shopify_entitlement_events(customer_id);

alter table public.shopify_entitlement_events enable row level security;
revoke all on table public.shopify_entitlement_events from anon, authenticated;

create or replace function public.enforce_qr_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  qr_total integer;
  allowed_qrs integer;
  customer_admin boolean;
begin
  select
    greatest(coalesce(c.included_qr_allowance, 0), 0)
      + greatest(coalesce(c.subscription_qr_limit, 0), 0),
    c.is_admin
  into allowed_qrs, customer_admin
  from public.customers c
  where c.id = new.customer_id;

  if customer_admin = true then
    return new;
  end if;

  select count(*) into qr_total
  from public.qr_codes q
  where q.customer_id = new.customer_id;

  if qr_total >= allowed_qrs then
    raise exception 'Maximum QR code limit reached for this customer';
  end if;

  return new;
end;
$$;
