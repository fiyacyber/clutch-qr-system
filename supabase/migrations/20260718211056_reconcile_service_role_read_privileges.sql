-- Reconcile staging-only privilege drift without broadening application roles.
-- PostgreSQL GRANT is idempotent and fails if any expected relation is absent.
grant select on table
  public.card_orders,
  public.clutch_codes_allowance_migration_audit,
  public.connect_events,
  public.profile_click_events,
  public.profile_leads,
  public.profile_links,
  public.profiles,
  public.qr_scan_events,
  public.qr_scans,
  public.shopify_entitlement_events,
  public.shopify_orders,
  public.shopify_webhooks,
  public.wallet_events,
  public.webhook_events
to service_role;
