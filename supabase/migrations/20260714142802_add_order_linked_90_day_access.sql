-- Per-provisioning, order-linked Clutch Codes access. This is intentionally
-- additive and does not create an account-wide allowance or subscription.
alter table public.print_order_items
  add column clutch_codes_access_opt_in boolean not null default false;

alter table public.print_qr_provisionings
  add column platform_access_started_at timestamptz,
  add column platform_access_expires_at timestamptz;

alter table public.print_qr_provisionings
  add constraint print_qr_provisionings_access_timestamp_pair_check check (
    (platform_access_started_at is null and platform_access_expires_at is null)
    or (
      platform_access_started_at is not null
      and platform_access_expires_at = platform_access_started_at + interval '90 days'
      and provisioning_status = 'completed'
      and access_type = 'included_permanent'
      and source_type in ('tracked_print', 'business_kit')
    )
  );

create index print_qr_provisionings_platform_access_expiry_idx
  on public.print_qr_provisionings(customer_id, platform_access_expires_at)
  where platform_access_expires_at is not null;

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

  if new.provisioning_status <> 'completed' or new.access_type <> 'included_permanent' then
    return new;
  end if;

  select poi.clutch_codes_access_opt_in
    into v_opted_in
  from public.print_order_items poi
  where poi.id = new.print_order_item_id;

  if coalesce(v_opted_in, false) and new.platform_access_started_at is null then
    new.platform_access_started_at := coalesce(new.created_at, now());
    new.platform_access_expires_at := new.platform_access_started_at + interval '90 days';
  end if;
  return new;
end
$$;

create trigger set_order_linked_platform_access_before_write
before insert or update of provisioning_status, access_type, platform_access_started_at, platform_access_expires_at
on public.print_qr_provisionings
for each row execute function public.set_order_linked_platform_access();

revoke all on function public.set_order_linked_platform_access() from public, anon, authenticated;
grant execute on function public.set_order_linked_platform_access() to service_role;

comment on column public.print_order_items.clutch_codes_access_opt_in is
  'Trusted normalized decision from Clutch Codes Access=included_90_days on a new_included_code line.';
comment on column public.print_qr_provisionings.platform_access_started_at is
  'Immutable first successful provisioning timestamp for optional order-linked access.';
comment on column public.print_qr_provisionings.platform_access_expires_at is
  'Exactly 90 days after platform_access_started_at; status is derived, never stored.';
