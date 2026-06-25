-- Add Clutch Connect 30-day trial tracking for Shopify product purchases.

alter table public.customers
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_status text not null default 'none';

do $$
begin
  alter table public.customers drop constraint if exists customers_trial_status_check;

  alter table public.customers
    add constraint customers_trial_status_check
    check (trial_status in ('none', 'active', 'expired', 'converted', 'cancelled'));
end $$;

create index if not exists customers_trial_status_idx on public.customers(trial_status);
create index if not exists customers_trial_ends_at_idx on public.customers(trial_ends_at);