\set ON_ERROR_STOP on
begin;

-- Reconstruct the schema state after 20260714142802 and before the forward
-- corrective migration. This transaction never persists outside local test DB.
drop function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid,text);
alter table public.print_qr_provisionings drop constraint print_qr_provisionings_access_timestamp_pair_check;
alter table public.print_qr_provisionings add constraint print_qr_provisionings_access_timestamp_pair_check check (
  (platform_access_started_at is null and platform_access_expires_at is null)
  or (
    platform_access_started_at is not null
    and platform_access_expires_at = platform_access_started_at + interval '90 days'
    and provisioning_status = 'completed'
    and access_type = 'included_permanent'
    and source_type in ('tracked_print', 'business_kit')
  )
);

create or replace function public.set_order_linked_platform_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_opted_in boolean;
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
  if new.provisioning_status <> 'completed' or new.access_type <> 'included_permanent' then return new; end if;
  select poi.clutch_codes_access_opt_in into v_opted_in from public.print_order_items poi where poi.id = new.print_order_item_id;
  if coalesce(v_opted_in, false) and new.platform_access_started_at is null then
    new.platform_access_started_at := coalesce(new.created_at, now());
    new.platform_access_expires_at := new.platform_access_started_at + interval '90 days';
  end if;
  return new;
end $$;

\ir ../supabase/migrations/20260714190244_add_order_linked_print_source_type.sql

do $verify$
begin
  if to_regprocedure('public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid,text)') is null then
    raise exception 'source-aware overload missing after upgrade';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'print_qr_provisionings_access_timestamp_pair_check')) not like '%2160:00:00%' then
    raise exception 'exact-hour constraint missing after upgrade';
  end if;
end
$verify$;

rollback;
