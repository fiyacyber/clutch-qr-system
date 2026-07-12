# Clutch Codes release-readiness checklist

This document prepares draft PR #4 for human approval. It does not authorize a merge, deployment, migration, Shopify change, email send, or production database mutation.

## Read-only configuration audit on 2026-07-12

- Production alias `https://qr.clutchprintshop.com` currently resolves to Vercel project `clutch-qr-system-1k9f` (`prj_lbRGDbTAWcRDLbITvl4odC0gC8Cv`).
- The production project contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLUTCH_APP_BASE_URL`, and `CLUTCH_QR_BASE_URL`. Values were not retrieved or displayed.
- `ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS` is currently absent. The application safely defaults it to false, but release approval should require an explicit Production value of `false` so intent is visible.
- A read-only Admin GraphQL query returned zero `ORDERS_PAID` webhook subscriptions owned by the currently connected app. This cannot rule out a merchant-created webhook in Shopify Admin, so a human must confirm the store has exactly one canonical registration before release.
- The canonical production webhook URL is `https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid`.
- The current Shopify Subscriptions architecture does not support registering `subscription_contracts/*` topics to this custom app.

## Local manual-review artifacts

The following files are under gitignored `work/` and must never be committed because the report contains customer information and the SQL is human-specific remediation:

- `work/clutch-codes-entitlement-review-2026-07-12.md`
- `work/clutch-codes-entitlement-remediation.sql`

The review report contains nine rows. Every row lacks authoritative subscription, paid Clutch Codes order, QR, and card evidence and therefore remains a human approval decision. The remediation template defaults to `ROLLBACK`, requires explicit values and evidence notes for all nine UUIDs, refuses admin rows, updates authoritative allowances separately, and sets `qr_limit` only to their sum.

## Production configuration approval checklist

### Vercel environment variables

In Vercel project `clutch-qr-system-1k9f`, scope each required variable to **Production** and verify the displayed value fingerprint/date with a second reviewer:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` points to the intended production Supabase project. This is public configuration.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the production public/anonymous client key, never the service role.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is Production-only, server-side, and not prefixed with `NEXT_PUBLIC_`.
- [ ] `SHOPIFY_WEBHOOK_SECRET` exactly matches the secret used by the one approved `orders/paid` registration.
- [ ] `RESEND_API_KEY` belongs to the approved Clutch Print Shop Resend account.
- [ ] `RESEND_FROM_EMAIL` is a verified sender address for transactional mail.
- [ ] `CLUTCH_APP_BASE_URL=https://qr.clutchprintshop.com`.
- [ ] `CLUTCH_QR_BASE_URL=https://qr.clutchprintshop.com`.
- [ ] `ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS=false` is set explicitly in Production.
- [ ] No secret appears in a `NEXT_PUBLIC_` variable.
- [ ] Preview deployments do not receive production-only Supabase service-role or Resend credentials unless a separately approved isolated test environment is used.

### Supabase Auth URL configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

- [ ] Site URL is exactly `https://qr.clutchprintshop.com`.
- [ ] Redirect allowlist contains the exact production recovery destination `https://qr.clutchprintshop.com/change-password`.
- [ ] A generated recovery link with `redirectTo=https://qr.clutchprintshop.com/change-password?next=/portal` is accepted and returns to `/portal` after password setup.
- [ ] No broad production wildcard such as `https://**` is used. Exact production paths are preferred; preview/local wildcards, if retained, are separately reviewed.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never used by a browser client or placed in an email URL.

### Shopify `orders/paid` webhook

In **Shopify Admin → Settings → Notifications → Webhooks** and in every installed app that can register webhooks:

- [ ] Find every webhook whose event/topic is **Order payment** / `orders/paid`.
- [ ] Confirm exactly one registration targets `https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid`.
- [ ] Confirm no second registration targets the same URL with a trailing slash, alternate hostname, legacy route, or another app-owned subscription.
- [ ] Confirm no `orders/paid` registration targets `/api/shopify/webhook`; that shared route intentionally skips this topic.
- [ ] Confirm the one registration uses the same signing secret as Production `SHOPIFY_WEBHOOK_SECRET`.
- [ ] Send only a Shopify development/test delivery during release testing and require HTTP 200 plus one idempotent entitlement event.
- [ ] Keep `ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS=false`.
- [ ] Do not register `subscription_contracts/activate`, `update`, `pause`, `fail`, `cancel`, or `expire` for the custom app.

## End-to-end approval matrix

Run against an isolated development/staging store and database unless the step explicitly says production smoke test. Record order ID, webhook ID, entitlement-event key, customer UUID, result, reviewer, and timestamp for every case.

### Plan provisioning

- [ ] **Starter, new customer:** buy SKU `CLUTCH-CODES-STARTER`; verify a single customer/auth user, `plan=connect_basic`, `plan_code=connect_basic`, included allowance unchanged at zero, subscription allowance 10, effective capacity 10, and one welcome email.
- [ ] **Starter, existing customer:** buy Starter with an existing customer email; verify the same customer UUID/auth user is updated, existing included allowance and Connect entitlements are preserved, and subscription allowance becomes 10.
- [ ] **Growth:** buy `CLUTCH-CODES-GROWTH`; verify canonical plan `clutch_codes_growth`, subscription allowance 30, correct email plan/price, and effective capacity equal to included plus 30.
- [ ] **Pro:** buy `CLUTCH-CODES-PRO`; verify canonical plan `clutch_codes_pro`, subscription allowance 100, correct email plan/price, and effective capacity equal to included plus 100.

### Idempotency and lifecycle

- [ ] **Duplicate webhook:** replay the same Shopify webhook ID, then replay the same paid order with a different webhook ID. Verify one semantic entitlement event, no additive capacity, one auth user, and no duplicate email.
- [ ] **Recurring paid order:** deliver a new paid renewal order for the same SKU. Verify the existing customer remains active at the same plan limit, a new paid-order event is recorded, and the welcome email is not resent.
- [ ] **Upgrade:** deliver the first reliable paid order for the higher SKU. Verify `subscription_qr_limit` is replaced—not added—and included allowance remains unchanged.
- [ ] **Downgrade:** deliver the first reliable paid order at the actual lower-plan effective time. Verify the subscription limit is replaced by the lower allowance and QR records are not deleted.
- [ ] **Manual cancellation reconciliation:** with contract webhooks disabled, execute the separately approved manual process in a transaction. Verify subscription allowance becomes zero, `qr_limit` mirrors included allowance, included capacity and QR records survive, and no Connect entitlement changes.

### Regression, email, and authentication

- [ ] **Smart Business Card regression:** buy a Smart Business Card without a Clutch Codes SKU. Verify the existing card-order/onboarding flow still runs and no Clutch Codes plan or subscription allowance is granted.
- [ ] **Access-email idempotency:** verify the welcome marker and Resend idempotency key prevent a second delivery across webhook retries.
- [ ] **Failed-email retry:** in isolated testing, force the Resend call to fail. Verify the event is marked failed and the email reservation is released; restore email transport and retry the same semantic event, then verify exactly one successful delivery and a completed event.
- [ ] **Secure recovery link:** inspect the received link. It must be a Supabase one-time recovery link, contain no service-role credential, keep its one-time token inside the Supabase action URL rather than public page HTML, land on the approved change-password route, and establish access only after Supabase verifies it.
- [ ] **Effective QR capacity:** test creation at `included_qr_allowance + subscription_qr_limit`; creation succeeds below the limit and is rejected at the limit. `qr_limit` equals the same sum for non-admins.
- [ ] **No Connect+ entitlement:** verify Clutch Codes provisioning does not change `plan` or `plan_code` to `connect_plus`, create a Connect+ profile, or write a Connect+ entitlement event.

## Database release verification

After the migration and approved remediation are applied in staging, run:

`supabase/verification/20260712_verify_clutch_codes_release.sql`

The script is SELECT-only. Every `passed` value must be true, every `violating_count` must be zero, the mismatch/detail result sets must be empty or explicitly explained, and any customer holding both Connect+ and Clutch Codes must have independent Connect+ provenance.

## Clean-install migration baseline

The executable chain now begins with `20260618000000_initial_application_schema.sql`, reconstructed from repository history immediately before the first production-recorded migration. It is followed by the existing production migration history, the timestamped reconciliation of previously undated profile fields, QR style configuration, and the Clutch Codes entitlement migration.

Existing production already contains the foundational objects. Therefore the baseline must be recorded in production migration history without executing its SQL:

1. Create and verify a restorable production backup.
2. Run `supabase migration list` against the explicitly linked production project and confirm the existing twenty versions from `20260619090000` through `20260704011000` are present.
3. Review a migration dry run and confirm `20260618000000` is the only historical version missing before the new forward migrations.
4. Run `supabase migration repair 20260618000000 --status applied` against production. This changes migration history only; it does not execute the baseline SQL.
5. Run `supabase migration list` again and require the local and remote timestamp columns to agree.
6. Run another dry run. It must propose only `20260704012000`, `20260706123000`, and `20260712100000` as unapplied migrations.

Stop if any earlier production-recorded migration is missing, if the dry run proposes creating foundational tables, or if the linked project reference is not the approved production reference. Never run `20260618000000_initial_application_schema.sql` directly against production.

## Recommended production rollout order

1. Human reviewers decide all nine ambiguous customer entitlements and record authoritative evidence, reviewer, classification, included allowance, and subscription allowance for every UUID.
2. Populate the local remediation template with those approved values; run it against staging with its default `ROLLBACK`, inspect before/after output, and obtain database-owner approval before any commit run.
3. Verify the Vercel Production variables, add explicit `ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS=false`, and verify the Supabase Auth Site URL and exact recovery redirect allowlist.
4. Inspect Shopify Admin and installed apps; retain exactly one canonical `orders/paid` registration and no `subscription_contracts/*` registrations for the custom app.
5. Create and verify a restorable production Supabase backup. Freeze unrelated entitlement/schema changes for the release window.
6. Apply the allowance migration to staging, apply the approved remediation to staging, run the read-only release verification SQL, and resolve every failure.
7. Complete the full end-to-end approval matrix in the isolated store/database and attach evidence to the release approval.
8. Obtain explicit product owner, database owner, Shopify owner, and application release owner approvals.
9. During the approved production window, create a fresh backup, apply the migration, then run only the UUID-keyed, human-approved remediation transaction. Inspect before/after results before committing it.
10. Run the read-only verification SQL in production. Stop the rollout on any false result, nonzero violation, unexpected QR-count change, or unresolved audit row.
11. Deploy the approved application commit through the normal release process. Do not enable contract lifecycle processing.
12. Confirm the canonical `orders/paid` delivery returns HTTP 200 and produces one idempotent event, then execute one controlled Starter smoke purchase.
13. Publish/place the already validated Thank-you and Order-status extension blocks through the Checkout and Accounts editor only after provisioning smoke tests pass.
14. Monitor structured provisioning/email logs, entitlement-event failures, duplicate deliveries, and support reports through the agreed observation window. Roll back the application independently from the database; never delete customer QR records.
