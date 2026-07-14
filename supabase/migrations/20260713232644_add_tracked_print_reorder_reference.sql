-- Preserve the customer-supplied prior-order reference as a normalized operational field.
alter table public.print_order_items
  add column reorder_reference text;

alter table public.print_order_items
  add constraint print_order_items_reorder_reference_length_check
  check (reorder_reference is null or char_length(reorder_reference) <= 200);
