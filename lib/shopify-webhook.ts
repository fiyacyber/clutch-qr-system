import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getShopifyIds,
  getWebhookEventId,
  provisionCustomerFromShopify,
  verifyShopifyWebhook,
  type ShopifyWebhookTopic,
} from "@/lib/shopify-provisioning";

const SUPPORTED_TOPICS = new Set([
  "orders/paid",
  "checkouts/create",
  "checkouts/update",
  "subscriptions/create",
  "subscriptions/update",
  "subscriptions/cancelled",
  "app_subscriptions/create",
  "app_subscriptions/update",
  "app_subscriptions/cancelled",
]);

function normalizeTopic(req: NextRequest) {
  return (
    req.headers.get("x-shopify-topic") ||
    req.headers.get("x-shopify-webhook-topic") ||
    "orders/paid"
  ).toLowerCase();
}

async function recordWebhookEvent({
  eventId,
  topic,
  payload,
  status,
  errorMessage,
}: {
  eventId: string;
  topic: ShopifyWebhookTopic;
  payload: any;
  status: "processing" | "completed" | "skipped" | "duplicate" | "error";
  errorMessage?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const ids = getShopifyIds(payload);

  return admin.from("webhook_events").upsert(
    {
      shopify_event_id: eventId,
      topic,
      shopify_order_id: ids.orderId,
      shopify_subscription_id: ids.subscriptionId,
      status,
      error_message: errorMessage || null,
    },
    { onConflict: "shopify_event_id" }
  );
}

export async function handleShopifyWebhook(req: NextRequest) {
  const rawBody = await req.text();

  let validSignature = false;
  try {
    validSignature = verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"));
  } catch (error) {
    console.error("Shopify webhook configuration error", error);
    return NextResponse.json({ ok: false, error: "Webhook secret not configured." }, { status: 500 });
  }

  if (!validSignature) {
    console.error("Invalid Shopify webhook signature");
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("Invalid Shopify webhook JSON", error);
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const topic = normalizeTopic(req);
  const eventId = getWebhookEventId(req, payload);
  const admin = createSupabaseAdminClient();
  const ids = getShopifyIds(payload);

  const { data: existingEvent, error: lookupError } = await admin
    .from("webhook_events")
    .select("id, status")
    .eq("shopify_event_id", eventId)
    .maybeSingle();

  if (lookupError) {
    console.error("Shopify webhook event lookup failed", lookupError.message);
    return NextResponse.json({ ok: false, error: "Webhook logging failed." }, { status: 500 });
  }

  if (existingEvent?.status === "completed" || existingEvent?.status === "skipped") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error: insertError } = await admin.from("webhook_events").insert({
    shopify_event_id: eventId,
    topic,
    shopify_order_id: ids.orderId,
    shopify_subscription_id: ids.subscriptionId,
    status: "processing",
  });

  if (insertError && insertError.code !== "23505") {
    console.error("Shopify webhook event insert failed", insertError.message);
    return NextResponse.json({ ok: false, error: "Webhook logging failed." }, { status: 500 });
  }

  if (!SUPPORTED_TOPICS.has(topic)) {
    await recordWebhookEvent({
      eventId,
      topic,
      payload,
      status: "skipped",
      errorMessage: `Unsupported topic: ${topic}`,
    });
    return NextResponse.json({ ok: true, skipped: true, topic });
  }

  try {
    const result = await provisionCustomerFromShopify({
      admin,
      topic,
      payload,
    });

    await recordWebhookEvent({
      eventId,
      topic,
      payload,
      status: result.qualified ? "completed" : "skipped",
      errorMessage: result.skippedReason,
    });

    console.log("Shopify webhook processed", {
      eventId,
      topic,
      qualified: result.qualified,
      email: result.email,
      planCode: result.planCode,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook processing error.";
    console.error("Shopify webhook processing failed", message);
    await recordWebhookEvent({ eventId, topic, payload, status: "error", errorMessage: message });
    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
