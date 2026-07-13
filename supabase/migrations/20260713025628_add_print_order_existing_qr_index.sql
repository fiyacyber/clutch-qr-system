-- Follow-up from isolated staging advisor validation. Kept separate because
-- 20260713024450 was already applied to staging and must remain immutable.
create index if not exists print_order_items_existing_qr_idx
  on public.print_order_items(existing_qr_code_id)
  where existing_qr_code_id is not null;
