# Figma Unified Customer Portal Implementation Audit

Date: 2026-07-15

Baseline: `main` at `98cd16f` (`Add Business Kit component property contract`)

Implementation branch: `feature/figma-unified-customer-portal`

This is the required pre-implementation audit. It records the production architecture before application code is changed. The approved Figma Make file (`bWJAoxU376B9Tb7Gq2srUN`) is a presentation reference only: its demo customers, notifications, orders, metrics, and chart points must not enter production code.

## 1. Existing authenticated route map

Authentication and account activation:

- `/login` signs in with Supabase password auth and passes a sanitized `next` value into `resolvePostLoginRedirect`.
- `/forgot-password`, `/update-password`, `/change-password`, and `/auth/callback` implement reset/recovery and required-password-change flows.
- `/portal` is the normal post-login landing route.

Customer portal routes:

- `/portal` — current product-variant overview.
- `/portal/qr` and `/portal/qr/[qrId]/edit` — QR library and owned-code editor.
- `/portal/create` — subscription-capacity QR creation.
- `/portal/analytics` and `/portal/analytics/[qrId]` — campaign/profile and per-code analytics.
- `/portal/heatmap` — plan-gated campaign heatmap.
- `/portal/connect`, `/portal/connect/setup`, `/portal/connect/build`, `/portal/connect/edit`, `/portal/connect/links`, and `/portal/connect/leads` — Smart Card/Connect profile, guided setup, builder, links, and leads.
- `/portal/print-orders` and `/portal/print-orders/[id]` — customer-owned tracked-print/Business Kit items, private files, proofs, production, fulfillment, and order-linked QR access.
- `/portal/subscription`, `/portal/pricing`, and `/portal/settings` — plan, upgrade, and account settings.

Administrator routes remain separate from customer primary navigation:

- `/admin` and existing admin tools.
- `/admin/print-orders` and `/admin/print-orders/[id]` — production operations workspace.

The implementation should retain these URLs and group them visually under five parent sections instead of creating parallel prototype routes. Proposed primary links are Dashboard `/portal`, Marketing `/portal/qr`, Contacts `/portal/connect/leads`, Orders `/portal/print-orders`, and Account `/portal/settings`. Existing child routes remain reachable through section-local actions and tabs.

## 2. Existing customer shell and navigation components

- `components/dashboard/DashboardShell.tsx` is the shared authenticated wrapper and currently delegates navigation to `SidebarNav`.
- `components/dashboard/SidebarNav.tsx` renders product/module-specific entries from `accountAccess.modules`; it can expose QR Codes, Analytics, Heatmap, Smart Card, Clutch Connect, Business Kits/print orders, Subscription, and Settings as peer items. It also owns the current mobile drawer.
- `lib/account-navigation.ts` maps URLs to product-specific module keys for active state and access decisions.
- `app/portal/page.tsx` currently selects materially different dashboard content for Connect/Smart Card versus campaign customers. `dashboardVariant` and `dashboardTitle` therefore influence presentation, not only capability.
- Branding tokens and fonts already exist in `app/globals.css` and the root font setup: navy `#384862`, orange `#FFA665`, Exo 2 headings, and Montserrat body.

Required presentation change: one desktop sidebar and one mobile bottom navigation with exactly Dashboard, Marketing, Contacts, Orders, and Account. Admin access must be a separate utility link. `accountAccess` continues to enable, lock, or hide child capabilities, but must no longer choose a different shell.

## 3. Existing data sources for every dashboard metric

No metric requires demo data. Existing or directly calculable sources are:

| Portal value | Production source |
| --- | --- |
| Total Scans & Taps | `qr_scans` rows for customer-owned `qr_codes`; `qr_codes.scan_count` is the existing lifetime fallback. Smart Card taps are the owned system Smart Card subset. |
| Active Marketing Assets | Customer-owned active `qr_codes`, active `profiles`, and linked Smart Card/NFC records available through `card_orders`; the UI must label only asset types actually represented by existing records. |
| Leads Captured | Customer-owned `profile_leads`; `profile_click_events` supplies profile interaction context, not lead totals. |
| Current Orders | Customer-owned `print_order_items` plus `card_orders`; Shopify order-status URLs are resolved from owned `shopify_orders.raw_payload`. |
| Performance chart | Time-bucketed owned `qr_scans`; profile interaction series can use owned `profile_click_events`. Date range and QR/NFC filters are calculated from those rows. |
| Action Required | Derived from owned `print_order_items` provisioning/QR setup/artwork/proof states, `card_orders` approval/setup states, required onboarding state, and capability locks. |
| Active Campaigns | Active, non-Smart-Card customer-owned campaign/order-linked `qr_codes`; names, destinations, type, status, and scan totals come from the record. |
| Recent Leads | Latest customer-owned `profile_leads`. |
| Recent Activity | Latest owned `qr_scans`, `profile_click_events`, and customer-readable `order_activity`, normalized into a shared view model. |
| Allowance/usage | `customers.included_qr_allowance`, `customers.subscription_qr_limit`, canonical Clutch Codes plan, and count of `qr_codes.counts_toward_capacity`; included and subscription capacity remain separate inputs. |

Current `app/portal/page.tsx` already queries `profiles`, `qr_codes`, `card_orders`, `shopify_orders`, `qr_scans`, `profile_leads`, and `profile_click_events`. Print task/activity queries need to be added to the unified overview through the existing ownership model.

## 4. Existing entitlement and capability model

`lib/account-access.ts` and `lib/account-access-server.ts` are the authoritative account-wide capability layer.

- Product evidence is resolved from the canonical customer plan fields, Smart Card orders/system codes, active profiles, tracked `print_order_items`, and completed `print_qr_provisionings` with `source_type` `tracked_print` or `business_kit`.
- Clutch Codes plans are explicit: Starter 10, Growth 30, Pro 100, and only an active canonical `clutch_codes_*` subscription enables account-wide code creation.
- Connect+ comes from an active Connect plan. A Clutch Codes purchase does not imply Connect+.
- Included-print allowance and subscription allowance are stored/calculated separately. Included order-linked codes do not become general subscription capacity.
- Order-linked ownership permits management/analytics of owned linked codes, while `canCreateQr` remains subscription/admin-only.
- `lib/order-linked-access.ts` derives active, expired, paid/customer-owned, view-only, denied, and admin states per QR. Its 90-day interval is exact; expiration blocks protected editing/analytics but not the redirect or order/code visibility.
- Capability checks (`canPerformAccountAction`, per-module state, per-record ownership) should be retained. `dashboardVariant`/`dashboardTitle` may remain temporarily for compatibility but must stop selecting the portal shell or information architecture.

## 5. Existing print-order and Business Kit workflows

Paid Shopify order handling is centralized in `app/api/webhooks/shopify/orders-paid/route.ts`, with shared provisioning helpers in `lib/shopify-provisioning.ts`, `lib/tracked-print.ts`, and `lib/tracked-print-supabase.ts`.

- The webhook validates Shopify HMAC before mutation and records webhook/order identifiers for replay-safe handling.
- Trusted product/property contracts decide eligibility. Browser-supplied titles or arbitrary values do not establish tracked-print or Business Kit eligibility.
- Each Shopify line item is persisted as an immutable `print_order_items` row keyed by Shopify order and line-item IDs.
- Tracking begins only for the normalized opt-in modes. `none` does not provision a QR.
- The service-role-only `provision_tracked_print_qr` RPC atomically creates/reuses the QR, links the item/provisioning, records source type and activity, and reconciles included allowance.
- A new included code receives an immutable `tracked-<uuid>` slug before customer configuration. An existing-code choice is accepted only when the code is active, subscription-owned by the same customer, editable, and not a system/order-linked code.
- Business Kit components use the strict trusted registry/property contract in `lib/business-kit-contracts.ts`. Each eligible component gets its own `print_order_items` row, provisioning record, QR relationship, material type, and print workflow. `source_type = business_kit` is preserved.
- `/portal/print-orders/[id]` enforces `customer_id`, shows signed private file links, and exposes the existing customer artwork/proof actions.
- `PrintOrderWorkflowActions.tsx` treats `customer_artwork` as the primary artwork upload and manages proof approval/change requests.
- `/admin/print-orders/[id]` uses the same authorized order loader and supports artwork review, proofs, production files, supplier submission, production, and shipping.

Missing workflow: there is no independent order-linked QR design draft/submission/version state or admin-visible frozen QR asset. It must be added without conflating it with `customer_artwork`.

## 6. Existing QR design fields and export capabilities

`qr_codes` contains:

- Immutable unique `slug` (not accepted by update endpoints).
- Customer-facing `name` and editable `destination_url` subject to ownership/access.
- `foreground_color`, `background_color`, `dot_style`, `corner_style`, logo flags/URL/path, and `theme`.
- `style_config` JSONB added by `20260706123000_add_qr_style_config.sql`. The Smart Card style endpoint currently sanitizes `preset`, `dotStyle`, `cornerStyle`, `finderEyes`, `frameStyle`, `frameColor`, `accentColor`, `logoUrl`, `logoPath`, and bounded `logoSize`.
- Order linkage and protection fields: `print_order_item_id`, `capacity_source`, `counts_toward_capacity`, `customer_can_delete`, and `customer_can_edit_destination`.

`components/QRLivePreview.tsx` and the editor provide live preview. `lib/qrExport.ts` exports 1024px, error-correction-H PNG/JPEG, SVG, and PDF using the immutable short URL. The current exporter is browser-based and uses a generic black/white QR configuration; it does not create a server-stored, versioned rendering of the submitted production style. A server-safe deterministic SVG/PNG generator is therefore needed for artwork submission.

The generic update route enforces user/customer ownership and strict HTTP(S) destinations. During active included access it intentionally returns after destination update, so order-linked style changes are not currently supported. The Smart Card style route only permits the included Smart Card code. The new order-specific draft/submission endpoint must authorize the print item and linked QR together and expose only entitlement-permitted style fields.

## 7. Existing account provisioning and login process

- Supabase Auth remains authoritative. `lib/auth.ts` calls `auth.getUser`, then resolves the customer by `customers.auth_user_id`; `requireCustomer` is the server guard.
- Login uses `signInWithPassword`, sanitizes `next`, and re-resolves the post-login destination server-side.
- Paid-order provisioning reuses a matching existing customer/auth user when safe, creates a confirmed Supabase auth user when needed, generates a recovery/setup link, sets `must_change_password`/`onboarding_status`, and optionally sends the onboarding email when configured.
- Forgot-password uses `resetPasswordForEmail`; the callback and password endpoints clear the required-password state after a successful secure change.
- Shopify/customer identity conflicts are surfaced instead of silently joining accounts.
- `resolvePostLoginRedirect` currently respects password-required state and admin routing. Its profile fallback can route an ordinary customer with `profiles.setup_completed = false` into Connect setup even without explicit guided-setup evidence. This must be narrowed so only `guided_setup_required` (new Smart Card/Connect onboarding) forces Guided Setup; ordinary Clutch Codes and tracked-print customers return to `/portal`, where incomplete print tasks appear in Action Required.

## 8. Exact files that should be modified

Expected existing-file changes:

- `app/portal/page.tsx` — unified, production-data dashboard and Action Required.
- `components/dashboard/DashboardShell.tsx`, `components/dashboard/SidebarNav.tsx`, and their CSS modules — shared five-item shell, admin utility access, responsive behavior.
- `lib/account-navigation.ts` and `lib/account-access.ts` — five-section active mapping and presentation/capability separation without changing allowance semantics.
- `lib/onboarding-routing.ts` — prevent unrelated customers being forced into Connect setup.
- `app/portal/qr/page.tsx`, `app/portal/analytics/page.tsx`, `app/portal/connect/leads/page.tsx`, `app/portal/print-orders/page.tsx`, `app/portal/print-orders/[id]/page.tsx`, and `app/portal/settings/page.tsx` — section-local organization and unified visual treatment.
- `components/print-orders/PrintOrderWorkflowActions.tsx` and `app/admin/print-orders/[id]/page.tsx` — show the separate QR setup/submission workflow and submitted production asset.
- `lib/print-operations.ts` / `lib/print-operations-server.ts` only where needed to load, sign, and present the new QR asset safely.
- Focused new components/helpers/API routes under the existing dashboard, print-order, and API directories for Create New, mobile bottom nav, dashboard states, QR setup draft/submission, deterministic rendering, and notifications.
- One additive Supabase migration for QR setup/submission versions and RLS/grants.
- Existing and new focused tests under `tests/`.

This list may shrink if a route already supplies the required section UI. It must not expand into a second portal.

## 9. Files that should not be modified

- Any file in `fiyacyber/clutch-shopify-theme` (out of repository and scope).
- Shopify eligibility contracts in `lib/tracked-print.ts` and `lib/business-kit-contracts.ts`, except a narrowly required test-compatible integration change; their strict trusted registries must not be weakened.
- Existing applied migrations must never be edited. Any schema change must be a new forward-only migration.
- QR redirect/scan ingestion routes must not be coupled to subscription/order-access expiration.
- Shopify HMAC and webhook idempotency primitives must not be replaced.
- Supabase service-role credentials must not move into browser code.
- The Figma Make prototype source and its placeholder data are references, not files to copy into the application.

## 10. Potential conflicts with draft PR #10

Draft PR #10 (`feature/unified-clutch-dashboard`, head `5574638`) is based on an older main and is not mergeable with the current branch as-is. It changes 28 files, including the same portal home, shell, sidebar, QR/create pages, account-access server loader, and package manifest targeted here.

Specific conflicts/risks:

- It predates current tracked-print/Business Kit/90-day work and would overwrite stronger current-main behavior.
- Its navigation remains product-oriented rather than the required five parent sections.
- It replaces substantial account-navigation/access presentation logic and may regress current entitlement handling.
- Its Business Kit grouping relies partly on product-title/property heuristics. Current main's strict trusted component contract and `source_type` are authoritative.
- It adds Business Kit pages and visual patterns but no QR submission/versioning migration or workflow.
- Its `UnifiedMobileNav` and some Business Kit presentation may be selectively reimplemented, not cherry-picked wholesale.

## 11. Minimal database additions that may be required

The existing schema cannot safely represent all required QR submission facts. The smallest safe addition is:

1. Add `qr_setup_status` to `print_order_items` (`not_required`, `setup_required`, `draft`, `submitted`) plus current submission/revision timestamps or derive the current state from the version table.
2. Add an append-only `print_qr_artwork_versions` table keyed to `print_order_item_id`, `qr_code_id`, and `customer_id`, containing positive `revision`, a frozen JSONB design/destination snapshot, private `print_order_files` reference, status/artwork-use state, submitter, and timestamps. A partial unique index should identify one current revision per item and a unique `(print_order_item_id, revision)` should prevent duplicates.
3. Extend `print_order_files.file_kind` with a distinct `qr_artwork_asset` value. It must remain separate from `customer_artwork` and be customer/admin readable through the same order ownership boundary.
4. Add a service-role-only transactional RPC (or equivalent single server transaction) to supersede the prior current revision, register the private file/version, set item state, and insert an idempotent `order_activity` event.

All new tables require RLS enabled, authenticated `SELECT` only through customer-owned order relationships (or admin), no authenticated mutations, explicit grants/revokes, indexes on foreign keys/query paths, and a private storage path rooted by customer/order/item. The application server uploads using service role only after authenticating the user and verifying item + QR ownership.

## 12. Security and idempotency risks

- **Cross-customer access:** every item, QR, version, file, and proof read/write must join back to the authenticated customer's `auth_user_id`; never trust a submitted customer ID or QR ID alone.
- **Slug mutation:** submission snapshots the short URL but never accepts or updates `slug`. QR redirect and scan ingestion remain active after access expiry.
- **Destination safety:** accept only HTTP(S), reject credentials and malformed URLs, and validate again server-side before draft/save/submit.
- **Eligibility trust:** Shopify line-item contracts and normalized server data establish tracked-print/Business Kit eligibility; browser payloads cannot create a QR setup task or access grant.
- **Allowance leakage:** order-linked codes and Business Kit components remain `included_print`; they do not increment subscription creation rights or imply Connect+.
- **Expiration:** draft/save/submit and protected analytics must use the per-code order-linked access result. Expired users retain read-only order/submitted-asset visibility.
- **Frozen artwork:** a mutable `qr_codes.style_config` cannot be the submitted source of truth. Each submission must capture an immutable snapshot and immutable private file. Later edits do not alter that revision.
- **Revision races:** submission must lock/check the print item, allocate the next revision transactionally, use a unique idempotency key, and reject/supersede revisions after proof approval according to workflow rules.
- **Storage:** use the private `print-order-files` bucket, non-overwriting versioned paths, checksum/size/type validation, and short-lived signed URLs. Logo reads used during rendering must be server-authorized and scan-safe.
- **Webhook replay:** retain HMAC verification, immutable Shopify keys, unique order/line-item constraints, provisioning idempotency keys, and `order_activity` uniqueness. Portal work must not change paid-order eligibility semantics.
- **Service role:** provisioning, version registration, and private storage writes stay server-only. Client code receives no service key.
- **Notifications:** customer/internal notification failures must not roll back a committed QR submission; delivery should use an idempotency key/outbox-compatible event and be retryable.
- **RLS/Data API:** new public-schema tables must explicitly enable RLS and use least-privilege grants. Current Supabase behavior no longer implies that every public table should be exposed; exposure and grants must be deliberate.
- **Accessibility/integrity:** interactive cards, drawers, sheets, menus, and toasts require keyboard/focus handling, 44px targets, reduced-motion support, and non-color status labels so capability locks cannot be misunderstood.
