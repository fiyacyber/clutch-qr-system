# Clutch QR Portal v2

Next.js + Supabase + Vercel portal for Clutch QR.

## Customer flow

1. Customer buys QR Pro on Shopify.
2. Shopify webhook creates a Supabase Auth user and customer record.
3. Customer logs in with magic link at `/login`.
4. Customer can create QR codes up to their `qr_limit`, default `10`.
5. QR codes redirect through `/qr/[slug]`, log scans, and then forward to the destination URL.

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
```

## Important

If you already ran the SQL in Supabase, do not rerun `supabase/schema.sql` unless the project is clean.
