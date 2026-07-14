# Order-linked 90-day Clutch Codes access

This release adds an optional, per-provisioning management window for eligible physical print orders. It is not a subscription, account-wide allowance, Clutch Connect entitlement, renewal, or additional Shopify charge.

## Trusted contract

- Shopify submits `Tracking Mode` unchanged (`new_included_code`, `existing_code`, or `none`).
- Shopify may submit the visible `Clutch Codes Access` property. Only `included_90_days` paired with `new_included_code` normalizes to an opt-in. Missing, blank, `none`, and unknown values fail closed.
- The paid-order service must also match the existing trusted `TRACKED_PRINT_PRODUCT_REGISTRY_JSON`. Storefront metafields and customer properties cannot establish eligibility.
- Business Kits additionally require `ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS=true` and an exact `BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON` contract containing product ID, SKU, kit type, explicit component IDs/material types, `codeCount` of zero or one, and the exact customer-selection property name for each unique component. Selection values are limited to the canonical tracking modes; unknown values become `none`. No title, collection, tag, or submitted-property inference is permitted.

## Access lifecycle

`clutch_codes_access_opt_in` records the normalized order decision. A database trigger sets `platform_access_started_at` on the first successful completed included provisioning and sets expiry to exactly 90 days later. Existing-code links receive no grant. The original timestamps are retained on replay and cannot be extended by an update.

The server resolver derives `active_included_access`, `expired_included_access`, `paid_subscription_access`, `view_only`, `denied`, or `admin`. At the exact expiry timestamp, access is expired. Redirect and scan collection do not use this resolver and continue. Destination mutation, basic analytics loaders, per-code analytics routes, and CSV exports do use it. Expired responses never include scan values.

An active paid Starter, Growth, or Pro subscription restores permitted management without changing `capacity_source`, the order relationship, deletion policy, or the timed timestamps. Included codes remain non-deletable.

## Feature flags

Keep these false during initial deployment:

```text
ENABLE_ORDER_LINKED_90_DAY_ACCESS=false
ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS=false
```

With the order-linked flag false, current order-linked behavior is preserved and new timed grants are not reserved. Enabling the flag is safe only after the migration, application deployment, trusted registry configuration, storefront metafields, and controlled purchase plan are approved.

## Controlled rollout

1. Review and merge the application independently.
2. Back up Production, apply `20260714142802_add_order_linked_90_day_access.sql`, deploy with both flags false, and verify current behavior.
3. Review and merge the theme, but do not publish the customer promise yet.
4. Create product metafield definition `custom.clutch_codes_90_day_access_enabled` (`boolean`) and leave values false.
5. Configure exact print and Business Kit registries.
6. Enable one controlled print product in both trusted layers and run a paid test, replay, and injected-clock expiration verification.
7. Expand physical print products, then Starter and Growth Kits only after their explicit component contracts pass.
8. Publish global messaging last.
