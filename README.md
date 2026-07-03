# Clutch Connect Portal

Next.js + Supabase + Vercel portal for Clutch Connect QR, NFC, profile, lead, and campaign analytics.

## Customer flow

1. Customer buys Clutch Connect, a Smart Business Card, or a qualifying Business Kit on Shopify.
2. Shopify sends an `orders/paid` webhook to `/api/webhooks/shopify/orders-paid`.
3. The webhook verifies the Shopify HMAC, creates or updates the Supabase Auth user and customer record, and assigns the matching portal plan.
4. New customers receive a branded Clutch Connect onboarding email with a temporary password.
5. On first login, customers are forced to change the temporary password before entering `/portal`.
6. QR codes redirect through `/qr/[slug]`, log scans, and then forward to the destination URL.

## Admin flow

1. Create your own Supabase Auth user.
2. Add a matching row in `customers` with `is_admin = true`.
3. Visit `/admin`.
4. Create customers and edit QR limits.

## Required Vercel env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CLUTCH_QR_BASE_URL=https://qr.clutchprintshop.com
SHOPIFY_WEBHOOK_SECRET=
SHOPIFY_SMART_CARD_PRODUCT_IDS=
SHOPIFY_SMART_CARD_VARIANT_IDS=
SHOPIFY_SMART_CARD_PRODUCT_TITLES=
SHOPIFY_SMART_CARD_PRODUCT_HANDLES=
RESEND_API_KEY=
RESEND_FROM_EMAIL=welcome@clutchprintshop.com
CLUTCH_APP_BASE_URL=https://qr.clutchprintshop.com
SEND_ONBOARDING_EMAILS=true
```

## Shopify webhook setup

In Shopify Admin, create a webhook for `Order payment` / `orders/paid`:

```
https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid
```

Use the webhook signing secret as `SHOPIFY_WEBHOOK_SECRET` in Vercel. The same handler also accepts Shopify subscription topics when those are configured.

## Important

If you already ran the SQL in Supabase, do not rerun `supabase/schema.sql` unless the project is clean.
