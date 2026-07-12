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
- backfills existing `qr_limit` values into `included_qr_allowance`;
- adds `shopify_entitlement_events` for durable provisioning and email idempotency;
- keeps the entitlement-event table inaccessible to `anon` and `authenticated` roles;
- updates the QR insertion guard to use the combined allowance.

Run Supabase database/security advisors after applying the migration in staging. No production database mutation is performed by this repository change.

## Required application environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL. Public client configuration only.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only provisioning key. Never prefix with `NEXT_PUBLIC_`.
- `SHOPIFY_WEBHOOK_SECRET`: validates Shopify HMAC signatures.
- `RESEND_API_KEY`: sends the transactional access email.
- `RESEND_FROM_EMAIL`: verified sender address; the Clutch Codes message overrides only the display name.
- `CLUTCH_APP_BASE_URL` or `CLUTCH_QR_BASE_URL`: defaults to `https://qr.clutchprintshop.com` and is used for auth redirects.
- `ENABLE_CLUTCH_CODES_CONTRACT_UPDATES`: optional, default `false`. Enables non-cancellation subscription-contract status/update handling only after the installed subscription app's payloads are verified to identify the same contract and, for plan changes, include line SKU data.

Existing Smart Card email flags and product allowlists remain unchanged.

Supabase Auth must allow the exact production redirect URL used by `buildPasswordResetRedirectUrl`, including `https://qr.clutchprintshop.com/change-password`.

## Shopify scopes and protected data

Minimum app scopes depend on how subscriptions are owned and registered:

- `read_orders` for paid-order webhook access;
- `read_customers` if the linked app needs customer data outside the webhook payload;
- `read_own_subscription_contracts` for contracts owned by this app;
- `write_own_subscription_contracts` only if the app will actually mutate its own contracts (not required by this implementation).

The extension's checkout-email row requires Shopify approval/access for protected customer data. Without it, the panel still renders and simply omits the email row.

## Webhook topics and routes

Register these against the application webhook endpoints:

- `orders/paid` → `/api/webhooks/shopify/orders-paid` (required; activation, renewals, and paid effective plan changes when the renewal order contains a canonical SKU).
- `subscription_contracts/cancel` → `/api/shopify/webhook` (required for cancellation).
- `subscription_contracts/expire` → `/api/shopify/webhook` (required for expiry).
- `subscription_contracts/activate`, `subscription_contracts/update`, `subscription_contracts/pause`, and `subscription_contracts/fail` → `/api/shopify/webhook` only after setting `ENABLE_CLUTCH_CODES_CONTRACT_UPDATES=true` and verifying the subscription app's contract ownership/payloads.

`app_subscriptions/*` topics are Shopify app-billing events and must not be treated as customer Clutch Codes subscriptions.

## Email preview

Run:

```bash
npm run preview:clutch-codes-email
open work/clutch-codes-subscription-email.html
```

The production subject is dynamic, for example `Your Clutch Codes Growth dashboard is ready`. Resend receives both a persistent database marker and the deterministic `idempotency-key` header.

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
7. Cancel the contract and confirm only `subscription_qr_limit` becomes zero; included allowance and QR rows remain.

## Deployment sequence

1. Apply the migration in staging and run Supabase advisors.
2. Configure server-only secrets and the Supabase Auth redirect allowlist.
3. Register/verify webhooks in a development store.
4. Link and preview the Shopify extension, then add both blocks in the editor.
5. Execute the test purchase matrix.
6. Promote the application and publish the extension through the normal reviewed release process. Do not deploy from this branch directly.
