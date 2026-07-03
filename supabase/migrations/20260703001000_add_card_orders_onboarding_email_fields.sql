-- Phase 5: onboarding email idempotency fields for Smart Card orders.

alter table public.card_orders
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists onboarding_email_type text;

create index if not exists card_orders_welcome_email_sent_at_idx
  on public.card_orders(welcome_email_sent_at);
