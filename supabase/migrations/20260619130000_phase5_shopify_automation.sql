-- Phase 5: Shopify automation, customer provisioning, subscription status, and webhook idempotency.

alter table public.customers
  add column if not exists plan text not null default 'qr_pro',
  add column if not exists plan_code text not null default 'qr_pro',
  add column if not exists qr_limit integer not null default 10,
  add column if not exists shopify_customer_id text,
  add column if not exists shopify_order_id text,
  add column if not exists shopify_subscription_id text,
  add column if not exists subscription_status text not null default 'active',
  add column if not exists plan_status text not null default 'active',
  add column if not exists must_change_password boolean not null default false,
  add column if not exists temp_password_created_at timestamptz,
  add column if not exists onboarding_email_sent_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.customers
set plan = coalesce(nullif(plan, ''), plan_code, 'qr_pro'),
    plan_code = coalesce(nullif(plan_code, ''), plan, 'qr_pro'),
    subscription_status = coalesce(nullif(subscription_status, ''), plan_status, 'active'),
    plan_status = coalesce(nullif(plan_status, ''), subscription_status, 'active');

update public.customers
set plan = 'admin',
    plan_code = 'admin'
where is_admin = true;

do $$
begin
  alter table public.customers drop constraint if exists customers_plan_code_check;
  alter table public.customers drop constraint if exists customers_plan_check;
  alter table public.customers drop constraint if exists customers_plan_status_check;
  alter table public.customers drop constraint if exists customers_subscription_status_check;

  alter table public.customers
    add constraint customers_plan_code_check
    check (plan_code in ('free_qr', 'qr_pro', 'qr_pro_plus', 'admin'));

  alter table public.customers
    add constraint customers_plan_check
    check (plan in ('free_qr', 'qr_pro', 'qr_pro_plus', 'admin'));

  alter table public.customers
    add constraint customers_subscription_status_check
    check (subscription_status in ('active', 'past_due', 'unpaid', 'cancelled', 'canceled'));

  alter table public.customers
    add constraint customers_plan_status_check
    check (plan_status in ('active', 'past_due', 'unpaid', 'cancelled', 'canceled'));
end $$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

create index if not exists customers_plan_idx on public.customers(plan);
create index if not exists customers_plan_code_idx on public.customers(plan_code);
create index if not exists customers_subscription_status_idx on public.customers(subscription_status);
create index if not exists customers_shopify_customer_id_idx on public.customers(shopify_customer_id);
create index if not exists customers_shopify_order_id_idx on public.customers(shopify_order_id);
create index if not exists customers_shopify_subscription_id_idx on public.customers(shopify_subscription_id);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  shopify_event_id text not null unique,
  topic text not null,
  shopify_order_id text,
  shopify_subscription_id text,
  status text not null default 'processing' check (status in ('processing', 'completed', 'skipped', 'duplicate', 'error')),
  error_message text,
  created_at timestamptz default now()
);

create index if not exists webhook_events_topic_idx on public.webhook_events(topic);
create index if not exists webhook_events_shopify_order_id_idx on public.webhook_events(shopify_order_id);
create index if not exists webhook_events_shopify_subscription_id_idx on public.webhook_events(shopify_subscription_id);
create index if not exists webhook_events_status_idx on public.webhook_events(status);
create index if not exists webhook_events_created_at_idx on public.webhook_events(created_at);

alter table public.webhook_events enable row level security;

drop policy if exists "Admins can view webhook events" on public.webhook_events;
create policy "Admins can view webhook events"
on public.webhook_events
for select
using (public.current_user_is_admin());

grant select on public.webhook_events to authenticated;
