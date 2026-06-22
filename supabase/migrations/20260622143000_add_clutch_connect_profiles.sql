-- Clutch Connect compatibility migration.
-- Canonical schema and policies are defined in:
--   20260622142000_add_clutch_connect.sql
-- This migration is intentionally minimal so later runs do not override the
-- canonical qr_type values or duplicate policies/triggers.

alter table public.qr_codes
  add column if not exists qr_type text not null default 'url',
  add column if not exists profile_id uuid;

alter table public.qr_codes
  drop constraint if exists qr_codes_qr_type_check;

alter table public.qr_codes
  add constraint qr_codes_qr_type_check
  check (qr_type in ('url', 'connect_profile'));

create index if not exists qr_codes_qr_type_idx on public.qr_codes(qr_type);
create index if not exists qr_codes_profile_id_idx on public.qr_codes(profile_id);
