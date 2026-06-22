-- Phase 4: optional advanced analytics scan metadata.
-- All columns are additive and nullable so existing scan history is preserved.

alter table public.qr_scans
  add column if not exists device_type text,
  add column if not exists browser text,
  add column if not exists operating_system text,
  add column if not exists referrer_source text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists qr_scans_device_type_idx on public.qr_scans(device_type);
create index if not exists qr_scans_browser_idx on public.qr_scans(browser);
create index if not exists qr_scans_operating_system_idx on public.qr_scans(operating_system);
create index if not exists qr_scans_referrer_source_idx on public.qr_scans(referrer_source);
create index if not exists qr_scans_location_idx on public.qr_scans(country, region, city);
