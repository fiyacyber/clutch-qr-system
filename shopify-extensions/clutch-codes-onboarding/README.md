# Clutch Codes onboarding extension source

This source package targets:

- `purchase.thank-you.block.render`
- `customer-account.order-status.block.render`

The repository is not currently linked to a Shopify app. No app client ID or extension UID is stored here. Follow the root onboarding runbook to create or link an app, generate a Checkout UI extension with Shopify CLI, and copy these source modules and targeting settings into the CLI-generated extension.

The optional `subscription_management_url` setting must remain blank until a verified Shopify or subscription-app customer portal URL is available. The extension never invents this URL.
