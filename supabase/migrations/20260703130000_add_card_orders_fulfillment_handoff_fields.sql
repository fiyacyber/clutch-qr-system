-- Phase 9A: Smart Business Card order handler handoff metadata.

alter table public.card_orders
  add column if not exists fulfillment_handler_email text,
  add column if not exists fulfillment_sent_at timestamptz,
  add column if not exists fulfillment_status text not null default 'not_sent',
  add column if not exists fulfillment_notes text,
  add column if not exists supplier_order_id text;

create index if not exists card_orders_fulfillment_status_idx
  on public.card_orders(fulfillment_status);

create index if not exists card_orders_fulfillment_sent_at_idx
  on public.card_orders(fulfillment_sent_at);