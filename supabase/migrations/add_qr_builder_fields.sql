-- Add new optional fields to qr_codes table for the redesigned QR builder
-- These fields support the new 3-column layout UI

-- Add qr_type field if it doesn't exist
alter table public.qr_codes 
add column if not exists qr_type text default 'url' check (qr_type in ('url', 'text', 'wifi', 'email', 'sms', 'image', 'pdf', 'vcard', 'connect_profile'));

-- Add profile_id reference for connect_profile QR type
alter table public.qr_codes 
add column if not exists profile_id uuid references public.profiles(id) on delete set null;

-- Add theme field for theme presets
alter table public.qr_codes 
add column if not exists theme text default 'default' check (theme in ('default', 'paper', 'midnight', 'pastel'));

-- Add download_size field for export preferences
alter table public.qr_codes 
add column if not exists download_size text default 'print' check (download_size in ('social', 'card', 'print'));

-- Create index on profile_id for faster queries
create index if not exists qr_codes_profile_id_idx on public.qr_codes(profile_id);
