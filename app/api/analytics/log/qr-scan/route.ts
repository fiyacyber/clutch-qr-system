import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getBrowser, getDeviceType, getOperatingSystem } from "@/lib/analytics";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const qrCodeId = String(payload?.qr_code_id || "").trim();
  const connectProfileId = String(payload?.connect_profile_id || "").trim() || null;

  if (!qrCodeId) {
    return NextResponse.json({ error: "qr_code_id is required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const ipRaw = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const ipHash = crypto.createHash("sha256").update(ipRaw).digest("hex");
  const userAgent = req.headers.get("user-agent");

  await admin.from("qr_scan_events").insert({
    qr_code_id: qrCodeId,
    connect_profile_id: connectProfileId,
    event_type: "scan",
    visitor_id: ipHash,
    ip_hash: ipHash,
    user_agent: userAgent,
    device_type: getDeviceType(userAgent),
    browser: getBrowser(userAgent),
    os: getOperatingSystem(userAgent),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    referrer: req.headers.get("referer"),
  });

  return NextResponse.json({ ok: true });
}
