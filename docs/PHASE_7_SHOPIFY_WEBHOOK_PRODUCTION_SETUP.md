# Phase 7: Shopify Webhook Production Setup

## Purpose
Configure Shopify Admin to send paid-order events to the production endpoint for Smart Business Card fulfillment.

## Production Endpoint
- URL: `https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid`
- Method: `POST`
- Content type: `application/json`
- Source topic: `orders/paid` (Shopify Admin label: `Order payment`)

## Shopify Admin Steps
1. Open Shopify Admin.
2. Go to `Settings -> Notifications`.
3. In `Webhooks`, click `Create webhook`.
4. Event: `Order payment`.
5. Format: `JSON`.
6. URL: `https://qr.clutchprintshop.com/api/webhooks/shopify/orders-paid`.
7. API version: select the current stable version offered in Shopify Admin.
8. Save webhook.

## Signing Secret Guidance
- In Shopify Admin webhook settings, copy the webhook signing secret.
- Set that same value in Vercel as `SHOPIFY_WEBHOOK_SECRET` for Production.
- Do not hardcode webhook secrets in code or commit them to the repository.

## Verification
After deployment and env setup, verify:
1. `GET /api/webhooks/shopify/health` reports all required booleans as expected.
2. Shopify test delivery to `orders-paid` returns HTTP `200` for valid signed payloads.
3. Supabase tables receive rows in `shopify_webhooks`, `shopify_orders`, and `card_orders`.