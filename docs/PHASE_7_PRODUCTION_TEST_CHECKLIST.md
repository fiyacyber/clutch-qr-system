# Phase 7: Production Webhook and Environment Verification Checklist

Use this checklist after deploying the latest build to Production.

## 1) Deploy
- [ ] Deploy latest commit to Vercel Production.
- [ ] Confirm production domain serves the latest build.

## 2) Health endpoint
- [ ] Open `https://qr.clutchprintshop.com/api/webhooks/shopify/health`.
- [ ] Confirm response includes:
  - `ok`
  - `environment`
  - `has_supabase_url`
  - `has_service_role_key`
  - `has_shopify_webhook_secret`
  - `has_resend_api_key`

## 3) Supabase preflight
- [ ] Run `npm run preflight:webhook:tables`.
- [ ] Confirm PASS for:
  - `public.shopify_webhooks`
  - `public.shopify_orders`
  - `public.card_orders`

## 4) Paid order webhook flow
- [ ] Ensure Shopify webhook is configured to:
  - Event: `Order payment`
  - Format: `JSON`
  - URL: `https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid`
- [ ] Place a real or test paid order containing a Smart Business Card line item.

## 5) Database verification
- [ ] Confirm a row exists in `shopify_webhooks` for the webhook id.
- [ ] Confirm order upsert exists in `shopify_orders` for the Shopify order id.
- [ ] Confirm at least one inserted row exists in `card_orders` for the matching line item.

## 6) Customer account and profile verification
- [ ] Confirm customer auth account exists (new or previously existing).
- [ ] Confirm `customers` row is linked to auth user id.
- [ ] Confirm a draft `profiles` row exists for the linked customer.

## 7) Email and login verification
- [ ] If `SEND_ONBOARDING_EMAILS=true`, confirm branded welcome/setup email is sent via Resend.
- [ ] Log in as the customer and confirm routing enters the Guided Setup flow.

## 8) Admin dashboard verification
- [ ] Open `/admin/card-orders`.
- [ ] Confirm the new order is visible with expected order/customer/status details.

## Current Phase 7 findings (this workspace)
- [ ] Production endpoint currently returns `404` for `https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid` until latest webhook route deployment is live.
- [ ] Vercel Production env vars currently missing:
  - `SHOPIFY_SMART_CARD_PRODUCT_IDS`
  - `SHOPIFY_SMART_CARD_VARIANT_IDS`
  - `SHOPIFY_SMART_CARD_PRODUCT_TITLES`
  - `SHOPIFY_SMART_CARD_PRODUCT_HANDLES`
  - `CLUTCH_APP_BASE_URL`
  - `SEND_ONBOARDING_EMAILS`