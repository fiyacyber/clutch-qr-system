# Staging service-role SELECT reconciliation

## Scope

Staging was missing `service_role` table privileges needed by authenticated
admin QA. Production already had `service_role` SELECT access. This forward
migration grants only SELECT to `service_role` on the fourteen expected public
tables. It does not change application-role grants, RLS, policies, functions,
ownership, sequences, or data.

`public.customer_groups` remains the responsibility of the separate PR #17
migration and is intentionally absent here.

## Target tables

- `public.card_orders`
- `public.clutch_codes_allowance_migration_audit`
- `public.connect_events`
- `public.profile_click_events`
- `public.profile_leads`
- `public.profile_links`
- `public.profiles`
- `public.qr_scan_events`
- `public.qr_scans`
- `public.shopify_entitlement_events`
- `public.shopify_orders`
- `public.shopify_webhooks`
- `public.wallet_events`
- `public.webhook_events`

## Verification

Before application, all fourteen tables existed in both projects and had RLS
enabled. Production had effective `service_role` SELECT on all fourteen;
staging had it on none.

The migration was applied only to staging project
`ijqahrvbqttvvkmclbxk`. Supabase recorded it as
`20260718211056_reconcile_service_role_read_privileges`. Production project
`rxmabeieluysgtpcqvom` received read-only verification queries and no changes.

| Table | Production before | Staging before | Staging after | RLS before/after |
| --- | --- | --- | --- | --- |
| `card_orders` | SELECT | none | SELECT | enabled |
| `clutch_codes_allowance_migration_audit` | SELECT | none | SELECT | enabled |
| `connect_events` | SELECT | none | SELECT | enabled |
| `profile_click_events` | SELECT | none | SELECT | enabled |
| `profile_leads` | SELECT | none | SELECT | enabled |
| `profile_links` | SELECT | none | SELECT | enabled |
| `profiles` | SELECT | none | SELECT | enabled |
| `qr_scan_events` | SELECT | none | SELECT | enabled |
| `qr_scans` | SELECT | none | SELECT | enabled |
| `shopify_entitlement_events` | SELECT | none | SELECT | enabled |
| `shopify_orders` | SELECT | none | SELECT | enabled |
| `shopify_webhooks` | SELECT | none | SELECT | enabled |
| `wallet_events` | SELECT | none | SELECT | enabled |
| `webhook_events` | SELECT | none | SELECT | enabled |

The direct `anon` and `authenticated` privilege arrays were captured before and
after application and were unchanged for every target table. Staging
`service_role` retained SELECT on `public.customer_groups`.

All fourteen target tables remained at zero rows with identical content
fingerprints. `auth.users` remained at 3 rows with fingerprint
`3ac18fdd4d19a9c981e4a1dc622cdc7e`; `storage.objects` remained at 3 rows with
fingerprint `46b14cfe88247097dfe54810a78b135e`. The migration contains only one
schema-qualified `GRANT SELECT`, so it cannot insert, update, or delete
application records.

## PR #17 observational QA

PR #17 remained a draft at exact head
`6209073e98fbbe9a51d0d453b3aad82b99166eb4`. Its preferred preview deployment
was READY. A read-only transaction using `SET LOCAL ROLE service_role` queried
all required customer-management evidence without a permission error and
returned 3 customers, 2 QR codes, and 3 customer detail join rows. The remaining
evidence tables were legitimately empty in staging.

Authenticated browser QA at 1280px and 1440px could not be completed because
the existing preview session was signed out and the existing staging login
attempt returned `Invalid login credentials`. No Auth user or credential was
changed. Vercel logs contained no `42501` or permission-denied entries; the only
observed error was the expected `Auth session missing!` redirect from the
signed-out `/admin` request.
