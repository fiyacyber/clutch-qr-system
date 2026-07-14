# Order-linked 90-day Clutch Codes access

This release adds an optional, per-provisioning management window for eligible physical print orders. It is not a subscription, account-wide allowance, Clutch Connect entitlement, renewal, or additional Shopify charge.

## Trusted contract

- Shopify submits the exact scalar property names `Tracking Mode` and `Clutch Codes Access`. Entitlement authorization does not trim or normalize their names or values and rejects missing, duplicated, aliased, case-modified, whitespace-modified, array, object, and null values.
- When the global feature is enabled, the strict parser is the sole authority for both entitlement and operational QR decisions. Invalid or missing canonical pairs are skipped before customer lookup, print-item persistence, existing-code attachment, or QR provisioning. When the feature is disabled, the established permissive parser remains in use for legacy tracked-print compatibility.
- Only exact `Tracking Mode=new_included_code` plus exact `Clutch Codes Access=included_90_days` authorizes a new included code and timed opt-in. Exact `existing_code`/`none` authorizes an existing-code link, and exact `none`/`none` authorizes no tracking.
- The paid-order service must also match the existing trusted `TRACKED_PRINT_PRODUCT_REGISTRY_JSON`. Storefront metafields and customer properties cannot establish eligibility. This registry independently classifies every product as `tracked_print` or `business_kit`; legacy individual-print entries may omit `sourceType` and default only to `tracked_print`, while every Business Kit must explicitly declare `sourceType=business_kit` with exact product ID and SKU.
- Business Kit identity is resolved before and independently of component parsing. An identified Kit never enters generic tracked-print provisioning. It additionally requires both feature flags and an exact `BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON` contract containing the same product ID/SKU, kit type, unique component IDs/material types, `codeCount` of zero or one, and a unique exact customer-selection property name per component. Missing, malformed, structurally invalid, unmatched, or colliding contracts and invalid selections fail closed without a print item, QR, provisioning, or timed grant.
- Entitlement-critical aliases are defined once for both parsers. The strict parser rejects every critical alias or spoofed case/whitespace variant whether it appears before or after a canonical property. Internally synthesized Kit properties are added only after the trusted identity, component contract, exact selections, and original-property spoof checks pass.

### Business Kit component property contract

Starter and Growth Kits use one Shopify cart line and twelve exact component properties. The registry owns these names; customer properties cannot define or alter the contract.

| Component | Tracking mode | Campaign | Destination | Existing code |
| --- | --- | --- | --- | --- |
| Business cards | `Business Cards Tracking Mode` | `Business Cards Campaign Name` | `Business Cards Destination URL` | `Business Cards Existing Clutch Code` |
| Door hangers | `Door Hangers Tracking Mode` | `Door Hangers Campaign Name` | `Door Hangers Destination URL` | `Door Hangers Existing Clutch Code` |
| Flyers | `Flyers Tracking Mode` | `Flyers Campaign Name` | `Flyers Destination URL` | `Flyers Existing Clutch Code` |

Each tracking property must appear exactly once with `new_included_code`, `existing_code`, or `none`. New-code selections require only their matching campaign and credential-free HTTP(S) destination. Existing-code selections require only their matching owned-code reference. `none` permits no component details. A missing, duplicated, aliased, conflicting, or malformed property invalidates the whole Kit before customer lookup or persistence.

After atomic validation, the service removes all twelve component properties and canonical generic entitlement properties from each copied line. It then creates one internal component item per selected material and synthesizes the established canonical properties for the existing provisioning pipeline. New components receive `Tracking Mode=new_included_code`, `Clutch Codes Access=included_90_days`, and their isolated campaign/destination. Existing components receive `Tracking Mode=existing_code`, `Clutch Codes Access=none`, and their isolated owned-code reference. These synthesized values never create additional Shopify cart lines.

## Access lifecycle

`clutch_codes_access_opt_in` records the normalized order decision. A database trigger sets `platform_access_started_at` on the first successful completed included provisioning and sets expiry to exactly 2,160 UTC hours (90 × 24 hours) later. Existing-code links receive no grant. The original timestamps are retained on replay and cannot be extended by an update.

The server resolver validates both timestamps, their exact UTC-millisecond duration, and `start <= now < expiry`. At the exact expiry timestamp, access is expired. A timed row is any row with either timestamp present; it never falls back to legacy access, including when the feature flag is disabled or its timestamps are malformed. Only a genuine both-null pre-migration row may use legacy editable metadata. Paid and administrator overrides remain independent.

Redirect and scan collection do not use the management resolver and continue after expiry or while the feature flag is disabled. Destination mutation, analytics loaders, routes, and CSV exports do use it. Included access can update only a credential-free HTTP(S) destination. It cannot update names, themes, styles, logos, ownership, linkage, capacity, or deletion metadata.

## Basic analytics boundary

Included access receives the explicit `basic_code` scope for each currently active owned included code. Its projection contains only code ID/name, total scans, first and last scan timestamps, and UTC-day aggregate counts. It does not fetch or return raw scans, IP-related data, geography, technology, referrer/UTM data, heatmaps, comparisons, profile/Connect events, clicks, or leads. Basic CSV uses the same aggregate projection and neutralizes spreadsheet formula prefixes before CSV escaping. Paid accounts retain `full_account`; administrators retain `admin`.

The analytics page independently classifies administrator, full campaign, full profile/Connect, included-only, and unentitled capabilities before any analytics fetch. Included-only access is a terminal basic branch: success, zero-active-code, candidate-query failure, resolver failure, and scan-query failure all return a basic-only response and can never invoke the unified full-account analytics loader. Entering the full loader does not combine products: campaign and profile data are projected only when their independent capabilities permit them.

The QR library first queries only rows owned by the authenticated customer, then applies the centralized per-code resolver. Active and expired included-print codes remain visible for both individual print and Business Kit components. Expired rows retain metadata and redirect/download access but expose no scan counts, last-scan data, editing, or analytics links. Unrelated profile/internal system codes and other customers' codes remain excluded.

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
