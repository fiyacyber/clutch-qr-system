# Tracked Print Provisioning

Phase 2 adds normalized, order-linked print records and one permanent included Clutch Code per eligible Shopify line item—not per physical quantity. A quantity of 500 identical postcards therefore produces one print item and at most one QR.

## Trusted classification

Eligibility is server-controlled by `TRACKED_PRINT_PRODUCT_REGISTRY_JSON`. The value is a JSON array of objects with `sku` and/or `productId`, `materialType`, and optional `defaultTrackingAvailable`. With no registry, no product is eligible. Product titles and customer properties never establish eligibility or override the trusted material type.

Example configuration (identifiers are placeholders and must be replaced with verified Shopify production identifiers):

```json
[
  {"sku":"VERIFIED-POSTCARD-SKU","materialType":"Postcard","defaultTrackingAvailable":true},
  {"productId":"VERIFIED-SHOPIFY-PRODUCT-ID","materialType":"Flyer","defaultTrackingAvailable":true}
]
```

## Line-item property contract

Canonical properties are `Tracking Mode`, `Campaign Name`, `Destination URL`, `Existing QR Code ID`, `Artwork Method`, `Artwork Upload URL`, `Artwork Instructions`, and `QR Placement Instructions`. Reasonable spacing, case, underscore, and legacy aliases are normalized centrally. Tracking modes are `none`, `new_included_code`, and `existing_code`. Only HTTP(S) destinations are accepted. Stored properties are a sanitized allowlist; raw webhook payloads, unrelated checkout data, tokens, and secrets are excluded.

## Provisioning and idempotency

The canonical `orders/paid` handler retains HMAC verification and webhook-ID replay protection. Stable line-item uniqueness is `(shopify_order_id, shopify_line_item_id)`. The provisioning key is `tracked-print:{order}:{line}:{mode}`. Database uniqueness protects the item, provisioning, QR-to-included relationship, and activity event even when Shopify supplies a different webhook ID or a process retries after a timeout.

Plain print creates only `print_order_items` and does not create Auth, customer, profile, QR, or capacity. A new included code creates/reuses a neutral `free_qr` customer and Auth user but never creates Connect profiles or grants Connect+/Clutch Codes. Existing-code mode verifies customer ownership and rejects Smart Card system QRs without revealing another customer's records.

`provision_tracked_print_qr` is a service-role-only, fixed-search-path transaction covering QR creation/linking, provisioning, activity, item completion, and capacity reconciliation. Execution is revoked from `anon` and `authenticated`.

## Capacity

Completed `included_permanent` provisionings are authoritative for `included_qr_allowance`. Reconciliation counts those records, then mirrors `qr_limit = included_qr_allowance + subscription_qr_limit`. Used capacity counts `qr_codes.counts_toward_capacity=true`. Smart Card and other system-exempt QRs do not count. Admin remains unlimited through `is_admin=true`.

Tracked QRs use `is_system=true`, `qr_type=tracked_print`, `capacity_source=included_print`, `counts_toward_capacity=true`, `customer_can_delete=false`, and `customer_can_edit_destination=true`. They never satisfy Smart Card evidence, which still requires `qr_type=smart_card`.

## Access and security

Customers have RLS-protected read access only to their own print items, provisionings, and activity. They cannot directly mutate workflow, provisioning, allowance, or ownership data. Server admin pages use the server-only service-role client after an `is_admin` authorization check.

Tracked-print-only customers can view/export their owned QR, edit only its destination, and see basic campaign analytics. They cannot create unrelated QRs, delete the included QR, customize advanced style/logo fields, access campaign heatmaps, or receive Connect features.

## Database relationships and Business Kit

`print_order_items` owns normalized commerce/workflow state. `print_qr_provisionings` links one item to one QR and identifies `tracked_print` or future `business_kit` source plus included/existing access. `order_activity` provides sanitized idempotent history. Business Kit values exist only for future schema reuse; no Business Kit detection or provisioning is enabled in Phase 2.

## Required next Shopify work

Before enabling production processing, verify every eligible production SKU/product ID and configure `TRACKED_PRINT_PRODUCT_REGISTRY_JSON` in the intended Vercel environments. The next Shopify/theme phase must add product-page controls that emit the canonical properties, restrict choices to eligible variants, provide destination/existing-code selection UX, and upload artwork through an approved mechanism. This PR does not change Shopify, the theme, webhook registrations, or environment variables.

Phase 3 remains responsible for proof approval, artwork mutations, production handoff/status changes, fulfillment/tracking updates, and the Shopify product-page controls.
