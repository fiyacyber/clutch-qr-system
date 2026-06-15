# Clutch QR System

Dynamic QR backend for Clutch Print Shop.

## What it includes
- Admin login
- Create/update QR campaigns
- Dynamic redirect links: `/r/your-slug`
- Scan logging
- QR PNG download
- Supabase database schema
- Vercel-ready Next.js app

## Required accounts
- Supabase
- Vercel
- Squarespace Domains DNS access

## Setup

### 1. Create Supabase project
Create a new Supabase project. Open SQL Editor and run `supabase/schema.sql`.

### 2. Get Supabase environment values
In Supabase Project Settings > API, copy:
- Project URL
- Service role key

### 3. Deploy to Vercel
Import this folder/repo as a new Vercel project.
Set these environment variables:

```
NEXT_PUBLIC_APP_URL=https://qr.clutchprintshop.com
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
ADMIN_PASSWORD=make-a-strong-password
```

Deploy.

### 4. Add custom domain in Vercel
Project > Settings > Domains > Add:

`qr.clutchprintshop.com`

Vercel will show the required DNS record, usually:

Type: CNAME
Name: qr
Value: cname.vercel-dns.com.

Copy exactly what Vercel displays.

### 5. Add DNS in Squarespace
Squarespace Domains > clutchprintshop.com > DNS Settings > Custom Records > Add Record:

Type: CNAME
Host: qr
Data/Value: cname.vercel-dns.com.

Save. Return to Vercel and click Verify.

### 6. Use it
Open:

`https://qr.clutchprintshop.com/admin`

Create a campaign:
- Business: John's Landscaping
- Slug: johns-landscaping
- Destination URL: https://johnslandscaping.com

Generate the QR. The QR points to:

`https://qr.clutchprintshop.com/r/johns-landscaping`

You can change the destination later without changing the printed QR code.
