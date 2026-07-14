# Tracked Print Provisioning

Phase 2 adds normalized, order-linked print records and one permanent included Clutch Code per eligible Shopify line item—not per physical quantity. A quantity of 500 identical postcards therefore produces one print item and at most one QR.

## Trusted classification

Eligibility is server-controlled by `TRACKED_PRINT_PRODUCT_REGISTRY_JSON`. The value is a JSON array of objects with `sku` and/or numeric `productId`, `materialType`, and an explicit boolean `defaultTrackingAvailable`. With no valid registry, no product is eligible. Invalid JSON or any invalid/ambiguous entry fails the whole registry closed. Product titles, tags, metafields, and customer properties never establish server eligibility or override the trusted material type.

Example configuration (identifiers are placeholders and must be replaced with verified Shopify production identifiers):

```json
[
  {"sku":"VERIFIED-POSTCARD-SKU","materialType":"postcard","defaultTrackingAvailable":true},
  {"productId":"VERIFIED-SHOPIFY-PRODUCT-ID","materialType":"flyer","defaultTrackingAvailable":true}
]
```

## Line-item property contract

Canonical visible properties are `Tracking Mode`, `Campaign Name`, `Destination URL`, `Existing Clutch Code`, `Artwork Method`, `Artwork Upload URL`, `Artwork Instructions`, `Reorder Reference`, and `QR Placement Instructions`. Reasonable spacing, case, underscore, and legacy aliases including `Existing QR Code ID` are normalized centrally. Tracking modes are `none`, `new_included_code`, and `existing_code`; artwork methods are `upload_now`, `upload_later`, `request_design`, and `reorder_existing`. Only HTTP(S) destinations are accepted. Stored properties are a sanitized, length-limited allowlist; raw webhook payloads, material claims, unrelated checkout data, tokens, and secrets are excluded.

`Existing Clutch Code` accepts a UUID, slug, or canonical `https://qr.clutchprintshop.com/qr/{slug}` URL. Resolution occurs only after customer identity is unambiguous. The selected row must be owned by that customer, active, non-system, subscription-capacity-counting, editable, and not a Smart Card, tracked-print, Business Kit, or system-exempt code. Failure produces one sanitized needs-attention result without a new QR, provisioning, or allowance change.

For `upload_now`, the application accepts only HTTPS Shopify-controlled hosts, rejects credentials/ports and private or reserved DNS results, follows at most three allowlisted redirects, times out, streams at most 25 MB, and validates MIME, extension, and file signature. PDF, PNG, JPEG, TIFF, and EPS are supported; SVG, HTML/script, and executable signatures are rejected. A validated file is copied to a deterministic private path in `print-order-files`, registered as version 1/current customer artwork through the Phase 3 RPC, and removed if database registration fails. An import failure preserves the paid order item in `needs_attention` and does not fail the entire webhook.

`upload_later` leaves artwork unreceived for the secure portal uploader. `request_design` stores sanitized instructions and creates no file. `reorder_existing` stores its length-constrained reference in the normalized `reorder_reference` field but never reuses a prior file without administrator review. The admin queue and order detail surface the artwork method, instructions, placement notes, and reorder reference.

## Provisioning and idempotency

The canonical `orders/paid` handler retains HMAC verification and webhook-ID replay protection. Stable line-item uniqueness is `(shopify_order_id, shopify_line_item_id)`. The provisioning key is `tracked-print:{order}:{line}:{mode}`. Database uniqueness protects the item, provisioning, QR-to-included relationship, and activity event even when Shopify supplies a different webhook ID or a process retries after a timeout.

Plain print creates only `print_order_items` and does not create Auth, customer, profile, QR, or capacity. A new included code creates/reuses a neutral `free_qr` customer and Auth user but never creates Connect profiles or grants Connect+/Clutch Codes. Existing-code mode verifies customer ownership and rejects Smart Card system QRs without revealing another customer's records.

`provision_tracked_print_qr` is a service-role-only, fixed-search-path transaction covering QR creation/linking, provisioning, activity, item completion, and capacity reconciliation. Execution is revoked from `anon` and `authenticated`.

The first accepted `(shopify_order_id, shopify_line_item_id)` record owns its immutable provisioning inputs. Replays use insert-and-select rather than a broad upsert. Materially different replays preserve completed/not-required work, create one sanitized discrepancy activity, and only place unfinished work into attention state. Identical pending records resume safely. An immutable replay may also resume the exact checkout-artwork import failure; identity conflicts, disabled tracking, invalid inputs, payload discrepancies, and all other `needs_attention` states remain blocked for review.

Neutral customer creation searches Auth users page-by-page and performs independent exact customer lookups by normalized email and Shopify customer ID. Existing accounts receive only missing Auth/Shopify linkage; plan, admin, entitlement, allowance, subscription, onboarding, and status fields are never overwritten. New neutral rows use insert-plus-unique-conflict reuse.

Email and Shopify customer identity are resolved together as `found`, `not_found`, or `conflict`; neither identifier wins by lookup order. Differing customer rows, or an email account already linked to a different Shopify customer, produce a sanitized needs-attention print item with no customer link, Auth creation, QR, provisioning, allowance change, or customer mutation. Unique-conflict recovery reruns the same full resolver before any Auth user is created.

## Capacity

Completed `included_permanent` provisionings are authoritative for `included_qr_allowance`. Reconciliation counts those records, then mirrors `qr_limit = included_qr_allowance + subscription_qr_limit`. Used capacity counts `qr_codes.counts_toward_capacity=true`. Smart Card and other system-exempt QRs do not count. Admin remains unlimited through `is_admin=true`.

Tracked QRs use `is_system=true`, `qr_type=tracked_print`, `capacity_source=included_print`, `counts_toward_capacity=true`, `customer_can_delete=false`, and `customer_can_edit_destination=true`. They never satisfy Smart Card evidence, which still requires `qr_type=smart_card`.

## Access and security

Customers have RLS-protected read access only to their own print items, provisionings, and activity. They cannot directly mutate workflow, provisioning, allowance, or ownership data. Server admin pages use the server-only service-role client after an `is_admin` authorization check.

Tracked-print-only customers can view/export their owned QR, edit only its destination, and see basic campaign analytics. They cannot create unrelated QRs, delete the included QR, customize advanced style/logo fields, access campaign heatmaps, or receive Connect features.

Existing-code selection accepts only an active, editable, non-system, capacity-counting subscription QR owned by the same customer. Smart Card, tracked-print, Business Kit, system-exempt, inactive, non-editable, and other-customer QRs are rejected with a generic message.

## Database relationships and Business Kit

`print_order_items` owns normalized commerce/workflow state. `print_qr_provisionings` links one item to one QR and identifies `tracked_print` or future `business_kit` source plus included/existing access. `order_activity` provides sanitized idempotent history. Business Kit values exist only for future schema reuse; no Business Kit detection or provisioning is enabled in Phase 2.

## Required next Shopify work

The storefront renders controls only when the merchant-owned product boolean `custom.tracked_print_enabled` is true. The optional `custom.tracked_print_material_type` single-line text value is for merchant review/display consistency only and is never submitted or trusted by the server. Define both metafield definitions for products in Shopify Admin, then set them only after the theme and application PRs are reviewed. Recommended material values are `postcard`, `flyer`, `door_hanger`, `business_card`, `brochure`, `rack_card`, `mailer`, `yard_sign`, `banner`, and `other_print`.

Deployment order is: merge and deploy the application while the production registry remains empty; validate its migration; publish the reviewed theme while all tracked-print metafields remain unset; create the two merchant-owned metafield definitions; set values on an explicitly approved test product; configure the reviewed exact registry in a non-production environment; run the controlled purchase procedure; then separately approve production registry configuration. Rollback is fail-closed: remove/unset the product display boolean to hide controls and remove/empty the server registry to stop ingestion. Existing paid order records and private artwork must be preserved.

The controlled test must cover each tracking/artwork method, malformed input, quantity 500/one QR, duplicate webhook delivery, private artwork import, cart drawer/page presentation, mobile/keyboard behavior, unchanged variants/selling plans/engraving, and a deliberate import failure. Do not enable application email sending during that test.

The reviewed product inventory and proposed value are in `TRACKED_PRINT_PRODUCT_REGISTRY_CANDIDATE.md`. Production remains empty throughout Phase 4; this PR does not change Shopify, Vercel, webhook registrations, email flags, or production data.

The application-side Phase 3 artwork, proof, production, and fulfillment workflow is documented in `PRINT_OPERATIONS_WORKFLOW.md`. Shopify product-page controls remain separate and are not part of that application workflow.

## Workflow RPC authorization hotfix

Migration `20260714015753_fix_tracked_print_service_rpc_authorization_and_activity_idempotency.sql` removes the redundant legacy `request.jwt.claim.role` body check from the four service-only tracked-print RPCs. Their `SECURITY DEFINER`, empty search path, actor and ownership validation, and service-role-only execute grants remain unchanged. The migration also replaces the partial `order_activity.idempotency_key` index with a normal unique index so PostgREST can infer the application's existing `on_conflict=idempotency_key` request. It aborts without changing the index if duplicate non-null keys require manual review.
