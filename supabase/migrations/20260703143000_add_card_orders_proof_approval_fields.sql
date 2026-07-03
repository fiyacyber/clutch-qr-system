-- Final phase: proof approval workflow metadata for Smart Business Card orders.

alter table public.card_orders
  add column if not exists approver_name text,
  add column if not exists approver_email text,
  add column if not exists proof_url text,
  add column if not exists proof_token text,
  add column if not exists proof_sent_at timestamptz,
  add column if not exists proof_viewed_at timestamptz,
  add column if not exists customer_approved_at timestamptz,
  add column if not exists changes_requested_at timestamptz,
  add column if not exists approval_notes text,
  add column if not exists approval_status text not null default 'not_ready';

create unique index if not exists card_orders_proof_token_key
  on public.card_orders(proof_token)
  where proof_token is not null;

create index if not exists card_orders_approval_status_idx
  on public.card_orders(approval_status);

create index if not exists card_orders_proof_viewed_at_idx
  on public.card_orders(proof_viewed_at);

create index if not exists card_orders_changes_requested_at_idx
  on public.card_orders(changes_requested_at);