-- Phase 9: internal fulfillment workflow metadata for Smart Business Card orders.

alter table public.card_orders
  add column if not exists internal_notes text,
  add column if not exists proof_url text,
  add column if not exists proof_sent_at timestamptz,
  add column if not exists customer_approved_at timestamptz,
  add column if not exists supplier_ordered_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists card_orders_proof_sent_at_idx
  on public.card_orders(proof_sent_at);

create index if not exists card_orders_customer_approved_at_idx
  on public.card_orders(customer_approved_at);

create index if not exists card_orders_supplier_ordered_at_idx
  on public.card_orders(supplier_ordered_at);

create index if not exists card_orders_fulfilled_at_idx
  on public.card_orders(fulfilled_at);

create index if not exists card_orders_setup_completed_at_idx
  on public.card_orders(setup_completed_at);