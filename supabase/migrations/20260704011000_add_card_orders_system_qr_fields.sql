-- Additive Smart Card Link fields on card_orders for downstream fulfillment/diagnostics.

alter table public.card_orders
  add column if not exists system_qr_code_id uuid,
  add column if not exists system_qr_slug text,
  add column if not exists system_qr_url text,
  add column if not exists system_qr_png_url text,
  add column if not exists system_qr_svg_url text,
  add column if not exists nfc_url text;

do $$
begin
  if exists (select 1 from pg_class where relname = 'qr_codes' and relnamespace = 'public'::regnamespace)
     and not exists (
       select 1
       from pg_constraint
       where conname = 'card_orders_system_qr_code_id_fkey'
         and conrelid = 'public.card_orders'::regclass
     ) then
    alter table public.card_orders
      add constraint card_orders_system_qr_code_id_fkey
      foreign key (system_qr_code_id) references public.qr_codes(id) on delete set null;
  end if;
end
$$;

create index if not exists card_orders_system_qr_code_id_idx on public.card_orders(system_qr_code_id);
create index if not exists card_orders_system_qr_slug_idx on public.card_orders(system_qr_slug);
