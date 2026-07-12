# Clutch Codes subscription onboarding runbook

## Architecture and audit result

The application already had a dedicated paid-order route at `app/api/webhooks/shopify/orders-paid/route.ts`, shared legacy Shopify provisioning helpers, Supabase admin clients, secure recovery/setup links, Resend transport, and Smart Business Card onboarding. Clutch Codes is consolidated into the dedicated `orders/paid` route; the Smart Business Card loop remains in place.

Clutch Codes is a separate entitlement dimension from Clutch Connect. `clutch_codes_plan_code` stores the canonical subscription plan, while the existing `plan` and `plan_code` fields continue to represent Clutch Connect access. This prevents a Clutch Codes purchase from granting Clutch Connect+.

Effective QR capacity is:

`included_qr_allowance + subscription_qr_limit`

`qr_limit` is maintained only as a compatibility mirror/fallback. Cancellation sets `subscription_qr_limit` to zero, preserves `included_qr_allowance`, and never deletes QR records.

## Database migration

Apply `supabase/migrations/20260712100000_add_clutch_codes_allowances_and_sources.sql` before enabling the webhook code. It:

- adds the two allowance columns and Clutch Codes subscription source fields;
- expands the `plan` and `plan_code` checks without changing existing values, and validates that `connect_basic` can be inserted in both columns;
- classifies legacy allowance evidence before changing data instead of treating every historical `qr_limit` as permanent included capacity;
- moves only verified active paid subscription capacity to `subscription_qr_limit`, counts confirmed card/print orders as included capacity, preserves admin rows, and records ambiguous rows for manual review;
- adds `shopify_entitlement_events` for durable provisioning and email idempotency;
- adds the private `clutch_codes_allowance_migration_audit` table so every classification and its evidence remains reviewable;
- keeps the entitlement-event table inaccessible to `anon` and `authenticated` roles;
- updates the QR insertion guard to use the combined allowance.

Before applying the migration, run the read-only preflight query at `supabase/preflight/20260712100000_classify_clutch_codes_allowances.sql`. It returns exactly one classification per existing customer, the proposed included/subscription allowances, whether manual review is required, and the evidence used. Resolve every `review_required = true` row before assigning permanent included capacity. The migration deliberately leaves ambiguous authoritative allowances at zero and records them in the audit table; it does not silently convert the legacy compatibility value.

On a clean install, both authoritative allowance columns default to zero. `qr_limit` remains only for older application/database compatibility and is recalculated as the effective sum where the migration's entitlement functions write capacity.

Run Supabase database/security advisors after applying the migration in staging. No production database mutation is performed by this repository change.

## Required application environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL. Public client configuration only.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only provisioning key. Never prefix with `NEXT_PUBLIC_`.
- `SHOPIFY_WEBHOOK_SECRET`: validates Shopify HMAC signatures.
- `RESEND_API_KEY`: sends the transactional access email.
- `RESEND_FROM_EMAIL`: verified sender address; the Clutch Codes message overrides only the display name.
- `CLUTCH_APP_BASE_URL` or `CLUTCH_QR_BASE_URL`: defaults to `https://qr.clutchprintshop.com` and is used for auth redirects.
- `ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS`: optional, default `false`. Keep it `false` in the current Shopify Subscriptions architecture. It gates **all** `subscription_contracts/*` handling, including cancellation and expiry, until the linked app owns the contracts and a real development-store payload proves the contract and plan mapping.

Existing Smart Card email flags and product allowlists remain unchanged.

Supabase Auth must allow the exact production redirect URL used by `buildPasswordResetRedirectUrl`, including `https://qr.clutchprintshop.com/change-password`.

## Shopify scopes and protected data

The current paid selling plans are owned by Shopify's first-party **Subscriptions** app (`gid://shopify/App/66228322305`, handle `subscriptions-remix`), not by a future custom Clutch Codes app. This was verified against all three canonical SKUs. Shopify restricts `read_own_subscription_contracts` to contracts owned by the querying app, so that scope does not give the custom app access to these existing contracts. Likewise, the custom app cannot receive `subscription_contracts/*` events for contracts owned by Shopify Subscriptions.

Current minimum app scopes:

- `read_orders` for paid-order webhook access;
- `read_customers` if the linked app reads the customer or a future cancellation-bridge metafield outside the webhook payload.

Do not request `read_own_subscription_contracts` or `write_own_subscription_contracts` as a solution for the current Shopify Subscriptions contracts. Those scopes become relevant only if a future version of the same custom app creates and owns its own contracts.

The extension's checkout-email row requires Shopify approval/access for protected customer data. Without it, the panel still renders and simply omits the email row.

## Webhook topics and routes

Production-ready registration for the current architecture:

- `orders/paid` → `/api/webhooks/shopify/orders-paid` (required; activation, renewals, and paid effective plan changes when the renewal order contains a canonical SKU).

Do **not** register or list `subscription_contracts/activate`, `update`, `pause`, `fail`, `cancel`, or `expire` as production requirements for the current custom app. It does not own the contracts and cannot rely on receiving those events. Their code path remains entirely disabled behind `ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS=false` for future development-store proof only.

Read-only inspection of the three real paid Clutch Codes `orders/paid` payloads currently stored by the application found no top-level contract ID and no `selling_plan_allocation`. An order payload's `subscription_contract_id`, `subscription_id`, or nested selling-plan fields must not be assumed to contain a contract ID. The current paid-order implementation therefore persists no contract linkage; a future verified enrichment must introduce an explicit trusted boundary and development-store regression evidence first.

For Shopify Subscriptions, Shopify Flow currently provides the supported cross-app synchronization path: use its **Subscription contract updated** trigger to write a dedicated customer metafield, then let the custom app read/process that bridge with `read_customers`. This bridge must be implemented and proven with a real development-store cancellation before enabling automatic entitlement removal. Until then, cancellation requires manual entitlement reconciliation that clears only `subscription_qr_limit`; the application must not claim automatic cancellation synchronization.

`app_subscriptions/*` topics are Shopify app-billing events and must not be treated as customer Clutch Codes subscriptions.

## Email preview

Run:

```bash
npm run preview:clutch-codes-email
open work/clutch-codes-subscription-email.html
```

The production subject is dynamic, for example `Your Clutch Codes Growth subscription is active`. Resend receives both a persistent database marker and the deterministic `idempotency-key` header.

## Shopify app and extension setup status

No `shopify.app.toml`, linked app client ID, or extension UID existed during implementation. The isolated source is in `shopify-extensions/clutch-codes-onboarding`; it is not deployable until an app is created or linked.

Manual setup:

1. In the Shopify Dev Dashboard, create/select the app that owns the Clutch Codes subscription integration and install it on the development store.
2. In a separate app shell (do not initialize over the Next.js root), run `shopify app init` or check out the existing app repository, then `shopify app config link`.
3. Run `shopify app generate extension --template checkout_ui --name clutch-codes-onboarding --flavor typescript-react` from that linked app shell.
4. Preserve the CLI-generated app client ID and extension UID. Merge the two targets and source files from `shopify-extensions/clutch-codes-onboarding` into the generated extension; do not replace identity fields with guessed values.
5. Run `shopify app dev`. Complete a test checkout and use the CLI's Thank-you URL with `?placement-reference=ORDER_STATUS1` to preview the Thank-you target. Open the same order in the new customer account to preview the Order-status target.
6. In Shopify Admin, open **Settings → Checkout → Customize**, select the Thank-you page, add the **Clutch Codes onboarding** app block, and save.
7. In the Checkout and Accounts editor, select the Order-status page, add the same app block, and save.
8. Leave `subscription_management_url` blank until the installed subscription app supplies a verified customer management URL.

## Test subscription purchase

1. Use a Shopify development store with test payments and the real selling plans for the three canonical variants.
2. Confirm the variant SKU is exactly `CLUTCH-CODES-STARTER`, `CLUTCH-CODES-GROWTH`, or `CLUTCH-CODES-PRO`.
3. Purchase with a unique test email and complete payment. A draft/unpaid checkout must not provision access.
4. Confirm one completed row in `shopify_entitlement_events`, the customer allowance fields, one Supabase auth user, and one Resend delivery.
5. Replay the same webhook ID and then deliver the same order with a different webhook ID. Capacity and the welcome email must remain unchanged.
6. Buy an upgrade/downgrade and confirm the next reliable paid order replaces `subscription_qr_limit` at that effective time.
7. Cancel the Shopify Subscriptions contract and verify the real development-store behavior. Until the documented Flow bridge is implemented, manually reconcile the entitlement by clearing only `subscription_qr_limit`; included allowance and QR rows must remain.
8. Confirm the stored paid-order payload does not create `shopify_subscription_id` unless a separately verified contract enrichment exists.

## Deployment sequence

1. Apply the migration in staging and run Supabase advisors.
2. Configure server-only secrets and the Supabase Auth redirect allowlist.
3. Register and verify only the supported `orders/paid` webhook in a development store.
4. Link and preview the Shopify extension, then add both blocks in the editor.
5. Execute the test purchase matrix.
6. Promote the application and publish the extension through the normal reviewed release process. Do not deploy from this branch directly.

## Shopify ownership references

- [Subscription contracts and app ownership](https://shopify.dev/docs/apps/build/purchase-options/subscriptions/contracts)
- [Admin API access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Shopify Subscriptions setup and management](https://help.shopify.com/en/manual/products/purchase-options/subscriptions/setup)
- [Shopify staff: contract webhooks are delivered only to the owning app](https://community.shopify.dev/t/subscription-contracts-create-webhook-not-triggered-for-checkout-created-subscriptions/28167/15)
- [Shopify staff: use Shopify Flow as a cross-app bridge for first-party subscription status](https://community.shopify.dev/t/recommended-pattern-for-non-subscription-apps-to-detect-active-subscriptions-created-by-shopify-subscriptions/32590/2)
