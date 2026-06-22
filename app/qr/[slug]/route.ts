import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getBrowser,
  getDeviceType,
  getOperatingSystem,
  getReferrerSource,
} from "@/lib/analytics";

// Reserved paths that should not be treated as QR slugs
const RESERVED_PATHS = new Set([
  "portal",
  "admin",
  "login",
  "api",
  "_next",
  "favicon.ico",
  "auth",
  "change-password",
  "logout",
  "signout",
]);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  // Check if slug is a reserved path
  if (RESERVED_PATHS.has(slug)) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: qrCode, error } = await admin
    .from("qr_codes")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !qrCode) {
    // QR not found - return 404 instead of redirecting
    return NextResponse.json(
      { error: "QR code not found" },
      { status: 404 }
    );
  }

  let redirectTarget = qrCode.destination_url;

  if (qrCode.qr_type === "connect_profile" && qrCode.profile_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("slug, is_active")
      .eq("id", qrCode.profile_id)
      .maybeSingle();

    if (profile?.slug && profile.is_active) {
      const base = (process.env.CLUTCH_QR_BASE_URL || "https://connect.clutchprintshop.com").replace(/\/$/, "");
      redirectTarget = `${base}/u/${profile.slug}`;
    }
  }

  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  const userAgent = req.headers.get("user-agent");
  const referrer = req.headers.get("referer");
  const latitude = Number(req.headers.get("x-vercel-ip-latitude"));
  const longitude = Number(req.headers.get("x-vercel-ip-longitude"));

  // Extract UTM parameters from destination URL if present
  const urlObj = new URL(redirectTarget);
  const utm_source = urlObj.searchParams.get("utm_source") || null;
  const utm_medium = urlObj.searchParams.get("utm_medium") || null;
  const utm_campaign = urlObj.searchParams.get("utm_campaign") || null;
  const utm_content = urlObj.searchParams.get("utm_content") || null;
  const utm_term = urlObj.searchParams.get("utm_term") || null;

  await admin.from("qr_scans").insert({
    qr_code_id: qrCode.id,
    slug,
    ip_hash: ipHash,
    user_agent: userAgent,
    referrer,
    device_type: getDeviceType(userAgent),
    browser: getBrowser(userAgent),
    operating_system: getOperatingSystem(userAgent),
    referrer_source: getReferrerSource(referrer),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
  });

  await admin
    .from("qr_codes")
    .update({ scan_count: Number(qrCode.scan_count || 0) + 1 })
    .eq("id", qrCode.id);

  return NextResponse.redirect(redirectTarget);
}
