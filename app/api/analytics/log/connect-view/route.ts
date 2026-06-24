import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const profileId = String(payload?.profile_id || "").trim();
  const qrCodeId = String(payload?.qr_code_id || "").trim() || null;

  if (!profileId) {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const ipRaw = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const ipHash = crypto.createHash("sha256").update(ipRaw).digest("hex");
  const userAgent = req.headers.get("user-agent");
  const referrer = req.headers.get("referer");

  await admin.from("connect_events").insert({
    profile_id: profileId,
    qr_code_id: qrCodeId,
    event_type: "profile_view",
    visitor_id: ipHash,
    ip_hash: ipHash,
    user_agent: userAgent,
    device_type: getDeviceType(userAgent),
    browser: getBrowser(userAgent),
    os: getOperatingSystem(userAgent),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    referrer: getReferrerSource(referrer),
  });

  return NextResponse.json({ ok: true });
}
