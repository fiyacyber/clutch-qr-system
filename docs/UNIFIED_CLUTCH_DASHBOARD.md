# Unified Clutch Dashboard

## Product model

The customer dashboard presents Clutch Codes™, tracked print, Business Kits, and Clutch Connect as parts of one workflow:

1. Create
2. Customize
3. Distribute
4. Track

The interface is unified, but entitlements remain additive and source-specific.

- Clutch Codes subscriptions provide general code-creation capacity.
- Print-included codes stay linked to their eligible print-order item.
- Business Kit codes stay linked to items inside the purchased kit.
- Clutch Connect controls digital profile and Smart Business Card features.
- Admin access remains unrestricted.

## Navigation

Desktop navigation is product-aware and hides modules that do not apply to the account. The primary customer labels are:

- Home
- Clutch Codes
- Analytics
- Print Orders
- Business Kits
- Clutch Connect
- Subscription
- Settings

Mobile uses a persistent bottom navigation with a central Create action. The Create sheet can route the customer to:

- Clutch Code Studio
- Artwork and print-order tasks
- Business Kit setup
- Clutch Connect guided setup

## Home experience

New accounts see interactive onboarding for:

- choosing a destination
- customizing a scan-safe design
- selecting a distribution use case

Returning accounts see an action-first dashboard. Proof approvals, artwork requests, and order attention states appear before generic metrics.

## Business Kits

Business Kits are grouped from trusted commerce evidence:

- `print_qr_provisionings.source_type = business_kit`
- explicit normalized kit identifiers or names on print-order items
- compatibility detection for historical kit product titles

A kit is a parent campaign containing multiple print-order items. Each item retains its own artwork, proof, production, fulfillment, and Clutch Code state.

The UI never converts a Business Kit allowance into unrelated subscription creation capacity.

## Clutch Code Studio

The Studio uses a three-step interface with a persistent live preview:

1. Create — select Website or Clutch Connect and name the code.
2. Customize — select colors, pattern, corners, output size, and logo.
3. Distribute — choose the use case and optionally add campaign UTM tags.

The circular treatment is a presentation frame around the existing standards-compatible QR area. Finder patterns and the QR quiet zone remain inside the validated code surface.

## Customer-facing terminology

The dashboard avoids exposing internal terms such as:

- `capacity_source`
- `included_print`
- `provisioning_status`
- `source_type`

Codes are described as originating from:

- Clutch Codes subscription
- Print order
- Business Kit

## Scope boundary

This UI branch does not:

- change Shopify products or theme files
- configure the tracked-print product registry
- change production environment variables
- alter subscription prices or entitlement rules
- add or apply a database migration
- deploy to production
