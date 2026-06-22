-- Phase 3: private admin dashboard support.
-- Adds customer groups and admin-managed onboarding fields without deleting data.

create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

alter table public.customers
  add column if not exists customer_group_id uuid references public.customer_groups(id) on delete set null;

alter table public.customers
  add column if not exists onboarding_status text not null default 'not_started';

alter table public.customers
  add column if not exists onboarding_note text;

alter table public.customers
  add column if not exists internal_notes text;

alter table public.customers
  add column if not exists last_admin_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_onboarding_status_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_onboarding_status_check
      check (onboarding_status in ('not_started', 'invited', 'active', 'needs_help', 'blocked'));
  end if;
end $$;

create index if not exists customers_customer_group_id_idx on public.customers(customer_group_id);
create index if not exists customers_onboarding_status_idx on public.customers(onboarding_status);
create index if not exists customers_plan_code_idx on public.customers(plan_code);

alter table public.customer_groups enable row level security;

drop policy if exists "Admins can view customer groups" on public.customer_groups;
drop policy if exists "Admins can insert customer groups" on public.customer_groups;
drop policy if exists "Admins can update customer groups" on public.customer_groups;

create policy "Admins can view customer groups"
on public.customer_groups
for select
using (public.current_user_is_admin());

create policy "Admins can insert customer groups"
on public.customer_groups
for insert
with check (public.current_user_is_admin());

create policy "Admins can update customer groups"
on public.customer_groups
for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

grant select, insert, update on public.customer_groups to authenticated;
