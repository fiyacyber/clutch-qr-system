-- Add UTM tracking columns for advanced QR analytics.
-- Safe to run multiple times.

alter table public.qr_scans
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text;

create index if not exists qr_scans_utm_source_idx on public.qr_scans(utm_source);
create index if not exists qr_scans_utm_medium_idx on public.qr_scans(utm_medium);
create index if not exists qr_scans_utm_campaign_idx on public.qr_scans(utm_campaign);
