-- Provide one complete, customer-scoped, read-only activity stream for admin
-- operations without exposing raw Shopify payloads or broadening client roles.
create index if not exists order_activity_print_order_lookup_idx
  on public.order_activity(order_type, order_id, created_at desc, id desc);

create index if not exists shopify_entitlement_events_customer_activity_idx
  on public.shopify_entitlement_events(customer_id, created_at desc, id desc);

create view public.admin_customer_activity
with (security_invoker = true)
as
  select
    'print_order:' || activity.id::text as id,
    item.customer_id,
    'print_order'::text as source,
    activity.action,
    activity.actor_type,
    activity.reason,
    null::text as status,
    null::text as error_message,
    activity.created_at
  from public.order_activity as activity
  inner join public.print_order_items as item
    on item.id = activity.order_id
  where activity.order_type = 'print_order'

  union all

  select
    'shopify_entitlement:' || entitlement.id::text as id,
    entitlement.customer_id,
    'shopify_entitlement'::text as source,
    entitlement.action,
    'system'::text as actor_type,
    null::text as reason,
    entitlement.status,
    entitlement.error_message,
    entitlement.created_at
  from public.shopify_entitlement_events as entitlement
  where entitlement.customer_id is not null;

revoke all privileges on table public.admin_customer_activity
  from public, anon, authenticated;
grant select on table public.admin_customer_activity to service_role;
