-- Smart Business Card order tracking tables, indexes, and RLS policies.

create extension if not exists "pgcrypto";

-- Ensure shared helper exists for updated_at triggers.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- card_orders
-- -----------------------------------------------------------------------------
create table if not exists public.card_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  shopify_order_id text not null,
  shopify_order_number text,
  shopify_customer_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  product_title text,
  variant_title text,
  engraving_requested boolean not null default false,
  engraving_business_name text,
  engraving_title text,
  engraving_phone text,
  engraving_email text,
  custom_details text,
  logo_file_url text,
  status text not null default 'setup_pending',
  raw_line_item jsonb,
  raw_order_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists shopify_order_id text,
  add column if not exists shopify_order_number text,
  add column if not exists shopify_customer_id text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists product_title text,
  add column if not exists variant_title text,
  add column if not exists engraving_requested boolean not null default false,
  add column if not exists engraving_business_name text,
  add column if not exists engraving_title text,
  add column if not exists engraving_phone text,
  add column if not exists engraving_email text,
  add column if not exists custom_details text,
  add column if not exists logo_file_url text,
  add column if not exists status text not null default 'setup_pending',
  add column if not exists raw_line_item jsonb,
  add column if not exists raw_order_payload jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- shopify_orders
-- -----------------------------------------------------------------------------
create table if not exists public.shopify_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  shopify_order_number text,
  customer_id uuid references public.customers(id) on delete set null,
  customer_email text,
  total_price numeric,
  financial_status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.shopify_orders
  add column if not exists shopify_order_id text,
  add column if not exists shopify_order_number text,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists total_price numeric,
  add column if not exists financial_status text,
  add column if not exists raw_payload jsonb,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists shopify_orders_shopify_order_id_key
  on public.shopify_orders(shopify_order_id);

-- -----------------------------------------------------------------------------
-- shopify_webhooks
-- -----------------------------------------------------------------------------
create table if not exists public.shopify_webhooks (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  topic text not null,
  shop_domain text,
  processed_at timestamptz not null default now()
);

alter table public.shopify_webhooks
  add column if not exists webhook_id text,
  add column if not exists topic text,
  add column if not exists shop_domain text,
  add column if not exists processed_at timestamptz not null default now();

create unique index if not exists shopify_webhooks_webhook_id_key
  on public.shopify_webhooks(webhook_id);

-- -----------------------------------------------------------------------------
-- Required indexes
-- -----------------------------------------------------------------------------
create index if not exists card_orders_shopify_order_id_idx
  on public.card_orders(shopify_order_id);
create index if not exists card_orders_shopify_order_number_idx
  on public.card_orders(shopify_order_number);
create index if not exists card_orders_customer_email_idx
  on public.card_orders(customer_email);
create index if not exists card_orders_status_idx
  on public.card_orders(status);
create index if not exists card_orders_created_at_idx
  on public.card_orders(created_at);

create index if not exists shopify_orders_shopify_order_number_idx
  on public.shopify_orders(shopify_order_number);
create index if not exists shopify_orders_customer_email_idx
  on public.shopify_orders(customer_email);
create index if not exists shopify_orders_created_at_idx
  on public.shopify_orders(created_at);

create index if not exists shopify_webhooks_created_at_idx
  on public.shopify_webhooks(processed_at);

-- -----------------------------------------------------------------------------
-- updated_at trigger for card_orders
-- -----------------------------------------------------------------------------
drop trigger if exists set_card_orders_updated_at on public.card_orders;
create trigger set_card_orders_updated_at
before update on public.card_orders
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.card_orders enable row level security;
alter table public.shopify_orders enable row level security;
alter table public.shopify_webhooks enable row level security;

-- card_orders: admin can read/update all.
drop policy if exists "card_orders_admin_read_all" on public.card_orders;
create policy "card_orders_admin_read_all"
on public.card_orders
for select
using (public.current_user_is_admin());

drop policy if exists "card_orders_admin_update_all" on public.card_orders;
create policy "card_orders_admin_update_all"
on public.card_orders
for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- card_orders: customers can read only their own records.
drop policy if exists "card_orders_customer_read_own" on public.card_orders;
create policy "card_orders_customer_read_own"
on public.card_orders
for select
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

-- shopify_orders visibility mirrors ownership/admin.
drop policy if exists "shopify_orders_admin_read_all" on public.shopify_orders;
create policy "shopify_orders_admin_read_all"
on public.shopify_orders
for select
using (public.current_user_is_admin());

drop policy if exists "shopify_orders_customer_read_own" on public.shopify_orders;
create policy "shopify_orders_customer_read_own"
on public.shopify_orders
for select
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

-- webhook logs are admin-readable.
drop policy if exists "shopify_webhooks_admin_read_all" on public.shopify_webhooks;
create policy "shopify_webhooks_admin_read_all"
on public.shopify_webhooks
for select
using (public.current_user_is_admin());

-- Service role server routes can write.
drop policy if exists "card_orders_service_role_insert" on public.card_orders;
create policy "card_orders_service_role_insert"
on public.card_orders
as permissive
for insert
to service_role
with check (true);

drop policy if exists "card_orders_service_role_update" on public.card_orders;
create policy "card_orders_service_role_update"
on public.card_orders
as permissive
for update
to service_role
using (true)
with check (true);

drop policy if exists "shopify_orders_service_role_insert" on public.shopify_orders;
create policy "shopify_orders_service_role_insert"
on public.shopify_orders
as permissive
for insert
to service_role
with check (true);

drop policy if exists "shopify_orders_service_role_update" on public.shopify_orders;
create policy "shopify_orders_service_role_update"
on public.shopify_orders
as permissive
for update
to service_role
using (true)
with check (true);

drop policy if exists "shopify_webhooks_service_role_insert" on public.shopify_webhooks;
create policy "shopify_webhooks_service_role_insert"
on public.shopify_webhooks
as permissive
for insert
to service_role
with check (true);

drop policy if exists "shopify_webhooks_service_role_update" on public.shopify_webhooks;
create policy "shopify_webhooks_service_role_update"
on public.shopify_webhooks
as permissive
for update
to service_role
using (true)
with check (true);

-- Grants (RLS still applies).
grant select on public.card_orders to authenticated;
grant select on public.shopify_orders to authenticated;
grant select on public.shopify_webhooks to authenticated;
