import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return true; // Allows initial testing before Shopify secret is added.
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }
  const order = JSON.parse(rawBody);
  const qrPurchased = order.line_items?.some((item: any) => String(item.title || "").toLowerCase().includes("qr pro"));
  if (!qrPurchased) return NextResponse.json({ skipped: true });

  const email = String(order.email || order.customer?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "No email on order" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("customers").select("*").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, existing: true });

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { error } = await admin.from("customers").insert({
    auth_user_id: authUser.user.id,
    email,
    first_name: order.customer?.first_name || null,
    last_name: order.customer?.last_name || null,
    company_name: order.billing_address?.company || null,
    shopify_customer_id: order.customer?.id ? String(order.customer.id) : null,
    qr_limit: 10
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, email, qr_limit: 10 });
}
