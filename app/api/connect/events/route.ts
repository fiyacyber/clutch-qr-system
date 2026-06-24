import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { CONNECT_EVENT_TYPES, extractIpHash } from "@/lib/connect";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";

function toLegacyEventType(eventType: string) {
  switch (eventType) {
    case "save_contact":
      return "vcard_download";
    case "wallet_click":
      return "link_click";
    case "apple_wallet_download":
    case "google_wallet_add":
      return "link_click";
    case "directions_click":
    case "quote_cta_click":
      return "link_click";
    default:
      return eventType;
  }
}

function toUnifiedEventType(eventType: string) {
  switch (eventType) {
    case "profile_view":
      return "profile_view";
    case "lead_submit":
      return "lead_submit";
    case "vcard_download":
    case "save_contact":
      return "save_contact";
    case "apple_wallet_download":
    case "google_wallet_add":
    case "wallet_click":
      return "wallet_click";
    case "link_click":
    case "call_click":
    case "text_click":
    case "email_click":
    case "website_click":
    case "directions_click":
    case "quote_cta_click":
      return "link_click";
    default:
      return "link_click";
  }
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdminClient();

  const body = await req.json().catch(() => null);
  const profile_id = String(body?.profile_id || "").trim();
  const profile_link_id = String(body?.profile_link_id || "").trim() || null;
  const event_type = String(body?.event_type || "").trim();
  const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : null;
  const qr_code_id = String(body?.qr_code_id || metadata?.qr_code_id || "").trim() || null;

  if (!profile_id || !CONNECT_EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("id", profile_id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Profile unavailable" }, { status: 404 });
  }

  const ip_hash = extractIpHash(req.headers);
  const user_agent = req.headers.get("user-agent") || null;
  const referrer = req.headers.get("referer") || null;

  let link_label: string | null = String(body?.link_label || metadata?.link_label || "").trim() || null;
  let link_url: string | null = String(body?.link_url || metadata?.link_url || "").trim() || null;

  if (profile_link_id && (!link_label || !link_url)) {
    const { data: linkRow } = await admin
      .from("profile_links")
      .select("id, label, url")
      .eq("id", profile_link_id)
      .maybeSingle();

    link_label = link_label || linkRow?.label || null;
    link_url = link_url || linkRow?.url || null;
  }

  const { error } = await admin.from("profile_click_events").insert({
    profile_id,
    profile_link_id,
    event_type: toLegacyEventType(event_type),
    ip_hash,
    user_agent,
    metadata: {
      ...(metadata || {}),
      qr_code_id,
      link_label,
      link_url,
      referrer,
    },
  });

  if (error) {
    console.error("CONNECT EVENT INSERT ERROR", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }

  await admin.from("connect_events").insert({
    profile_id,
    qr_code_id,
    event_type: toUnifiedEventType(event_type),
    link_id: profile_link_id,
    link_label,
    link_url,
    visitor_id: ip_hash,
    ip_hash,
    user_agent,
    device_type: getDeviceType(user_agent),
    browser: getBrowser(user_agent),
    os: getOperatingSystem(user_agent),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    referrer: getReferrerSource(referrer),
  });

  return NextResponse.json({ ok: true });
}
