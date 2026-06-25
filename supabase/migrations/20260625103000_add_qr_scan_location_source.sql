-- Additive migration for QR scan GeoIP metadata.
-- Existing scan rows remain unchanged; new rows can default to geoip when the app supplies coordinates.

alter table public.qr_scans
  add column if not exists location_source text;

alter table public.qr_scans
  alter column location_source set default 'geoip';