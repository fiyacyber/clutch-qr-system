# Shopify Paid Add-On Charging Audit

Phase: 4.8.5
Date: 2026-07-01

## Scope

Audited the newer Shopify theme checkout at `shopify-theme/` inside `clutch-qr-system` and the app-side Shopify provisioning code in `lib/shopify-provisioning.ts`.

The standalone checkout at `/Users/zach/clutch-shopify-theme` is clean but does not contain the newer Clutch theme files audited here.

## Files Inspected

- `shopify-theme/snippets/clutch-print-product-options.liquid`
- `shopify-theme/snippets/clutch-storefront-enhancements.liquid`
- `shopify-theme/sections/clutch-connect-card-product.liquid`
- `shopify-theme/sections/clutch-business-kits-collection.liquid`
- `shopify-theme/sections/clutch-business-kits.liquid`
- `shopify-theme/sections/clutch-business-kit-tracking-product.liquid`
- `shopify-theme/snippets/clutch-product-overview.liquid`
- `shopify-theme/sections/main-product-options.liquid`
- `shopify-theme/templates/product.json`
- `shopify-theme/templates/cart.json`
- `shopify-theme/snippets/cart-products.liquid`
- `shopify-theme/snippets/cart-summary.liquid`
- `shopify-theme/assets/product-form.js`
- `shopify-theme/snippets/clutch-storefront-enhancements.liquid`
- `lib/shopify-provisioning.ts`

## Current Charging Findings

| Add-on | Customer-facing UI found | Current charging path | Status |
| --- | --- | --- | --- |
| Professional Design Add-On - $200 | Checkbox in `clutch-print-product-options.liquid` on non-kit print products | Confirmed product `professional-design` has variant `44481017970730` priced at `$200.00`. The checkbox now adds that real Shopify variant as a separate cart line item and no longer submits paid pricing as a line item property. | Backed by real add-on product; cart test still required |
| Clutch Connect Hosting - $14.99/month | Select option in `clutch-print-product-options.liquid`; product forms in `clutch-qr-pro-page.liquid` | The dedicated `/products/qr-pro` form can charge if the product variant and selling plan are valid. The print-product upsell select is only a line item property and does not add hosting to cart. | Partially blocked |
| Smart card engraving - +$19.99 | Checkbox injected by `clutch-storefront-enhancements.liquid` with `name="properties[Engraving Add-on]"` | The checkbox only toggles display fields and a displayed total. It does not add a paid engraving variant/product to cart. | Launch blocker |
| Additional Smart Cards - $49.99 each | Display copy in `clutch-connect-card-product.liquid` and `clutch-product-overview.liquid` | No audited selector, quantity model, add-on product, variant, or cart logic specifically charges additional cards beyond normal product quantity/variant behavior. | Needs Shopify product/variant confirmation |
| Yard sign add-on for Business Kits - $399 | Display copy in `clutch-business-kits.liquid`, `clutch-business-kits-collection.liquid`, homepage kit copy, and a checkbox on the Growth Kit product options panel | Confirmed offer is one add-on only: 100 yard signs, 1-color, 2-sided, customer-facing add-on price $399. The Growth Kit product option now adds real Shopify variant `44493905559594` from product `growth-kit-yard-sign-add-on`. No paid yard sign line item property is used. | Backed by real add-on product; cart test still required |
| QR/hosting upsell options | `properties[QR Package]` select in `clutch-print-product-options.liquid`; Clutch Connect landing product form | The landing product form can charge if configured. The print-product select is only a property and does not add a subscription product. | Partially blocked |

## Live Shopify Variant Check

- `Growth Kit` currently has one default `$649` variant in the connected Shopify catalog.
- A separate active product named `Growth Kit Yard Sign Add-On` exists with variant `44493905559594`, title `100 1-Color, 2-Sided Yard Signs`, SKU `GK-YS-100-2S-1C`, and price `$399.00`.
- The Growth Kit product options panel now adds that real add-on variant when the customer selects the yard sign option.
- A separate active product named `Professional Design` exists with variant `44481017970730` and price `$200.00`.
- Non-kit print product pages now add the Professional Design variant when the customer selects the Professional Design checkbox.
- Required Shopify Admin setup remaining: verify the add-on product is active on the Online Store sales channel and complete a real cart/checkout test.

## Why These Are Blocked

Shopify line item properties collect customer instructions, but they do not change price. The active theme submit path in `assets/product-form.js` sends the selected product variant and now inspects `data-clutch-addon-variant-id` controls for approved real add-on variants.

The Growth Kit yard sign checkbox and Professional Design checkbox now feed real add-on variants into the active cart add flow. Print-product QR hosting, engraving, and additional cards still need real product/variant/selling-plan charging paths before they are launch-safe.

## Safe Launch Recommendations

- Professional Design: currently backed by real add-on product `professional-design`, variant `44481017970730`, priced at $200. Keep design notes, artwork instructions, and file uploads as properties on the main print product only.
- Clutch Connect Hosting: sell through the existing `qr-pro` product with a valid subscription selling plan for $14.99/month. For print-product upsells, use a separate subscription add-on flow, bundle/app logic, or direct users to the hosting product.
- Engraving: model as a paid variant on the Smart Business Card product when personalization affects the card, or as a separate engraving add-on product if it must be a separate line item.
- Additional Smart Cards: model as quantity of the Smart Business Card product when all cards share the same configuration, or as variants/add-on products when personalized cards differ.
- Yard signs for Business Kits: currently backed by real add-on product `growth-kit-yard-sign-add-on`, variant `44493905559594`, priced at $399. Do not sell it as copy-only pricing or a line item property.
- QR/hosting upsells: use real subscription products/selling plans or app-based add-on logic. Keep QR destination/artwork instructions as line item properties only.

## Manual Shopify Admin Setup Required

1. Confirm `qr-pro` product has the correct $14.99/month subscription selling plan.
2. Confirm Professional Design checkbox adds variant `44481017970730` to cart and increases the total by $200.
3. Decide engraving model: Smart Business Card paid variant vs separate engraving add-on product.
4. Decide additional smart card model: quantity, variant, or separate add-on product.
5. Confirm Growth Kit yard sign checkbox adds variant `44493905559594` to cart and increases the total by $399.
6. Confirm products/variants are active on the Online Store sales channel.
7. Confirm cart/checkout shows each add-on as a priced line item or priced variant before launch.

## Cart/Checkout Test Checklist

Do not mark paid add-on charging complete until these are proven in a real Shopify cart/checkout:

1. Add a normal print product without Professional Design; confirm base total only.
2. Add the same print product with Professional Design; confirm `Professional Design` appears as a separate line item and cart total increases by $200.
3. Add a print product with Clutch Connect hosting; confirm $14.99/month subscription appears as a priced item or selling plan.
4. Add Smart Business Card without engraving; confirm base card price only.
5. Add Smart Business Card with engraving; confirm cart total increases by $19.99 or selects a higher-priced engraving variant.
6. Add additional smart cards; confirm total increases by $49.99 per additional card or correct variant quantity.
7. Add Growth Kit without yard signs; confirm base kit total.
8. Add Growth Kit with the yard sign checkbox selected; confirm `Growth Kit Yard Sign Add-On` appears as a separate line item and cart total increases by $399.
9. Confirm all file uploads, artwork notes, engraving details, and QR destination instructions remain as line item properties.
10. Complete a test checkout and confirm Shopify order line items match the storefront total.

## Current Launch Blockers

- Professional Design Add-On is backed by a real Shopify add-on variant, but still requires a real cart/checkout test before launch-complete.
- Smart card engraving is not proven to charge.
- Print-product Clutch Connect hosting upsell is not proven to charge.
- Growth Kit Yard Sign Add-On is backed by a real Shopify add-on variant, but it is not launch-complete until cart and checkout totals are manually verified.
- Additional Smart Cards charging depends on product quantity/variant setup and needs manual confirmation.
