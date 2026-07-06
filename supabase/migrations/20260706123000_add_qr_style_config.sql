alter table public.qr_codes
  add column if not exists style_config jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
