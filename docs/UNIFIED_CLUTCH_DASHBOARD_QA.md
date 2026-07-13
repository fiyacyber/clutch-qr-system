# Unified Dashboard QA Checklist

## Desktop

- Product-aware navigation shows only relevant modules.
- Create Clutch Code is the primary sidebar action for accounts with capacity.
- New-customer onboarding tabs change content without navigation.
- Returning-customer home prioritizes proofs, artwork, and attention states.
- Business Kit cards group all matching print items under one campaign.
- Clutch Code Studio keeps the preview visible beside the active step.
- Circular presentation does not crop the QR finder patterns or quiet zone.

## Mobile

- Bottom navigation remains visible above the safe area.
- The center Create button opens and closes the create sheet.
- The sheet prevents background scrolling.
- Home, Codes, Analytics, and Orders routes highlight correctly.
- Business Kit and print-order cards stack without horizontal overflow.
- Studio preview moves above the configuration panel.
- Sticky Studio action bar does not conflict with bottom navigation.

## Access control

- A Business Kit account can open Business Kits and linked Print Orders.
- A Business Kit account cannot create unrelated subscription codes.
- A Clutch Codes subscriber can create codes but does not gain Connect+.
- A print-only account can manage included codes and print orders.
- Admin remains unrestricted.
- Customer routes continue to enforce server-side ownership.

## Regression

- Clutch Codes checkout and webhook logic are unchanged.
- Tracked-print provisioning is unchanged.
- Print operations workflow is unchanged.
- Clutch Connect guided setup and builder routes remain functional.
- Email feature flags are unchanged.
- No Shopify theme files are included.
- No migration is included.
