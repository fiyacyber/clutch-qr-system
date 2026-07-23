-- Customer-managed brand colors used as optional presets in the QR color picker.
-- This is additive and does not change existing QR artwork or defaults.

alter table public.customers
  add column if not exists brand_colors jsonb not null default '[]'::jsonb;

alter table public.customers
  drop constraint if exists customers_brand_colors_array_check;

alter table public.customers
  add constraint customers_brand_colors_array_check
  check (
    jsonb_typeof(brand_colors) = 'array'
    and jsonb_array_length(brand_colors) <= 8
  );

comment on column public.customers.brand_colors is
  'Up to eight customer-selected hex colors shown as optional presets in QR creation color pickers.';
