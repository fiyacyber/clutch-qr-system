import { NextResponse } from "next/server";

export const runtime = "nodejs";

function hasValue(name: string) {
  return Boolean(String(process.env[name] || "").trim());
}

export async function GET() {
  const hasSupabaseUrl = hasValue("NEXT_PUBLIC_SUPABASE_URL");
  const hasServiceRoleKey = hasValue("SUPABASE_SERVICE_ROLE_KEY");
  const hasShopifyWebhookSecret = hasValue("SHOPIFY_WEBHOOK_SECRET");
  const hasResendApiKey = hasValue("RESEND_API_KEY");

  const ok = hasSupabaseUrl && hasServiceRoleKey && hasShopifyWebhookSecret;

  return NextResponse.json(
    {
      ok,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      has_supabase_url: hasSupabaseUrl,
      has_service_role_key: hasServiceRoleKey,
      has_shopify_webhook_secret: hasShopifyWebhookSecret,
      has_resend_api_key: hasResendApiKey,
    },
    { status: ok ? 200 : 503 }
  );
}