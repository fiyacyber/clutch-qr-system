-- Phase 2: account plan entitlements for QR Pro and QR Pro+.
-- Existing customer data is preserved. Existing admins become the admin plan.

alter table public.customers
  add column if not exists plan_code text not null default 'qr_pro';

alter table public.customers
  add column if not exists plan_status text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_plan_code_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_plan_code_check
      check (plan_code in ('qr_pro', 'qr_pro_plus', 'admin'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_plan_status_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_plan_status_check
      check (plan_status in ('active', 'past_due', 'canceled'));
  end if;
end $$;

update public.customers
set plan_code = 'admin'
where is_admin = true;

update public.customers
set plan_code = 'qr_pro_plus'
where is_admin = false
  and coalesce(qr_limit, 10) >= 60;

update public.customers
set qr_limit = case
  when plan_code = 'qr_pro_plus' then 60
  when plan_code = 'admin' then greatest(qr_limit, 60)
  else 10
end
where plan_code in ('qr_pro', 'qr_pro_plus', 'admin');
