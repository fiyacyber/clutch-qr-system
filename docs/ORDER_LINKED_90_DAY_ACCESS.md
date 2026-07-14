# Order-linked 90-day Clutch Codes access

This release adds an optional, per-provisioning management window for eligible physical print orders. It is not a subscription, account-wide allowance, Clutch Connect entitlement, renewal, or additional Shopify charge.

## Trusted contract

- Shopify submits the exact scalar property names `Tracking Mode` and `Clutch Codes Access`. Entitlement authorization does not trim or normalize their names or values and rejects missing, duplicated, aliased, case-modified, whitespace-modified, array, object, and null values.
- Only exact `Tracking Mode=new_included_code` plus exact `Clutch Codes Access=included_90_days` authorizes an opt-in. The permissive print-display parser is never entitlement authority.
- The paid-order service must also match the existing trusted `TRACKED_PRINT_PRODUCT_REGISTRY_JSON`. Storefront metafields and customer properties cannot establish eligibility.
- Business Kits additionally require both feature flags and an exact `BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON` contract containing product ID, SKU, kit type, unique component IDs/material types, `codeCount` of zero or one, and a unique exact customer-selection property name per component. Component properties must appear exactly once with an exact canonical scalar value. Invalid contracts and selections fail closed. The registry is parsed even while the Kit flag is disabled so a known Kit can never fall through to generic tracked-print provisioning.

## Access lifecycle

`clutch_codes_access_opt_in` records the normalized order decision. A database trigger sets `platform_access_started_at` on the first successful completed included provisioning and sets expiry to exactly 2,160 UTC hours (90 × 24 hours) later. Existing-code links receive no grant. The original timestamps are retained on replay and cannot be extended by an update.

The server resolver validates both timestamps, their exact UTC-millisecond duration, and `start <= now < expiry`. At the exact expiry timestamp, access is expired. A timed row is any row with either timestamp present; it never falls back to legacy access, including when the feature flag is disabled or its timestamps are malformed. Only a genuine both-null pre-migration row may use legacy editable metadata. Paid and administrator overrides remain independent.

Redirect and scan collection do not use the management resolver and continue after expiry or while the feature flag is disabled. Destination mutation, analytics loaders, routes, and CSV exports do use it. Included access can update only a credential-free HTTP(S) destination. It cannot update names, themes, styles, logos, ownership, linkage, capacity, or deletion metadata.

## Basic analytics boundary

Included access receives the explicit `basic_code` scope for each currently active owned included code. Its projection contains only code ID/name, total scans, first and last scan timestamps, and UTC-day aggregate counts. It does not fetch or return raw scans, IP-related data, geography, technology, referrer/UTM data, heatmaps, comparisons, profile/Connect events, clicks, or leads. Basic CSV uses the same aggregate projection and neutralizes spreadsheet formula prefixes before CSV escaping. Paid accounts retain `full_account`; administrators retain `admin`.

An active paid Starter, Growth, or Pro subscription restores permitted management without changing `capacity_source`, the order relationship, deletion policy, or the timed timestamps. Included codes remain non-deletable.

## Feature flags

Keep these false during initial deployment:

```text
ENABLE_ORDER_LINKED_90_DAY_ACCESS=false
ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS=false
```

Enable the global flag first only after the migration, application deployment, trusted registry configuration, storefront metafields, and controlled purchase plan are approved. It controls individual eligible print access. Business Kit access additionally requires the Kit flag; either flag being false prevents a Kit grant without generic fallback. Both flags default false.

Disabling the global flag immediately removes timed included management but does not alter redirects, scan ingestion, stored timestamps, or a paid/admin override. It never reactivates an expired timed row.

## Migration and replay

Normal Supabase migration history applies each migration once. Direct raw SQL replay is unsupported. The forward migration preserves immutable timestamps, changes the database duration expression to exactly 2,160 hours, and adds a source-aware atomic provisioning overload for trusted Business Kit components. Rolling back application code while retaining the new database objects is compatible with the older seven-argument RPC, but rolling back the database migration would remove source-aware Kit provisioning and exact-duration enforcement and therefore requires both flags to remain false. Webhook replay reuses the existing print item/provisioning and never moves its start or expiry.

## Controlled rollout

1. Review and merge the application independently.
2. Back up Production, apply `20260714142802_add_order_linked_90_day_access.sql`, deploy with both flags false, and verify current behavior.
3. Review and merge the theme, but do not publish the customer promise yet.
4. Create product metafield definition `custom.clutch_codes_90_day_access_enabled` (`boolean`) and leave values false.
5. Configure exact print and Business Kit registries.
6. Enable one controlled print product in both trusted layers and run a paid test, replay, and injected-clock expiration verification.
7. Expand physical print products, then Starter and Growth Kits only after their explicit component contracts pass.
8. Publish global messaging last.
