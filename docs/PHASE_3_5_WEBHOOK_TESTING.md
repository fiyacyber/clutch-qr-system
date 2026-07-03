# Phase 3.5: Local Webhook Testing

## Purpose
This adds a local test fixture and signed sender script for the Shopify orders/paid webhook endpoint.

## Files
- Fixture: fixtures/shopify/orders-paid.sample.json
- Sender script: scripts/test-shopify-orders-paid-webhook.mjs

## Run Locally
1. Start the app locally.
2. Set required env vars in your shell:
   - SHOPIFY_WEBHOOK_SECRET
3. Optional env vars:
   - SHOPIFY_WEBHOOK_TEST_URL (default: http://localhost:3000/api/webhooks/shopify/orders-paid)
   - SHOPIFY_WEBHOOK_TEST_ID (default: generated unique local id)
   - SHOPIFY_SHOP_DOMAIN (default: clutchprintshop.myshopify.com)
4. Send the signed test webhook:

```bash
npm run test:webhook:orders-paid
```

You can pass a custom fixture path:

```bash
npm run test:webhook:orders-paid -- fixtures/shopify/orders-paid.sample.json
```

The script logs response status and response body.

## Verify Supabase Rows
After a successful run, verify inserts/upserts in:
- shopify_webhooks:
  - New row with webhook_id matching the script output
  - topic = orders/paid
- shopify_orders:
  - Upserted row where shopify_order_id matches fixture id/order_id
  - raw_payload populated
- card_orders:
  - Inserted row for the Smart Business Card line item
  - Engraving fields populated from line item properties
  - raw_line_item and raw_order_payload populated
