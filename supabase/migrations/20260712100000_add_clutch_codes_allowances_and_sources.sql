-- Clutch Codes subscription entitlements and durable Shopify event/email idempotency.

alter table public.customers
  add column if not exists included_qr_allowance integer not null default 0,
  add column if not exists subscription_qr_limit integer not null default 0,
  add column if not exists clutch_codes_plan_code text,
  add column if not exists clutch_codes_subscription_status text not null default 'inactive',
  add column if not exists clutch_codes_welcome_email_sent_at timestamptz,
  add column if not exists clutch_codes_welcome_email_event_key text,
  add column if not exists shopify_line_item_id text;

-- Preserve every pre-migration QR allowance as an included allowance. The application
-- writes qr_limit as a compatibility mirror after this migration.
update public.customers
set included_qr_allowance = greatest(coalesce(qr_limit, 0), 0)
where included_qr_allowance = 0
  and subscription_qr_limit = 0
  and coalesce(qr_limit, 0) > 0;

alter table public.customers
  drop constraint if exists customers_included_qr_allowance_check,
  drop constraint if exists customers_subscription_qr_limit_check,
  drop constraint if exists customers_clutch_codes_plan_code_check,
  drop constraint if exists customers_clutch_codes_subscription_status_check;

alter table public.customers
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
