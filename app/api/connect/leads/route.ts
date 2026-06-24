import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { extractIpHash } from "@/lib/connect";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const profile_id = String(form.get("profile_id") || "").trim();
  const slug = String(form.get("slug") || "").trim();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const message = String(form.get("message") || "").trim();
  const honeypot = String(form.get("company_website") || "").trim();

  if (!profile_id || !slug) {
    return NextResponse.json({ error: "Missing profile." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, is_active")
    .eq("id", profile_id)
    .eq("slug", slug)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Profile is not available." }, { status: 404 });
  }

  // Honeypot: silently succeed for bots.
  if (honeypot) {
    return NextResponse.redirect(new URL(`/u/${slug}?sent=1`, req.url));
  }

  const ip_hash = extractIpHash(req.headers);
  const user_agent = req.headers.get("user-agent") || null;

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from("profile_leads")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile_id)
    .eq("ip_hash", ip_hash)
    .gte("created_at", oneMinuteAgo);

  if ((recentCount || 0) >= 5) {
    return NextResponse.redirect(new URL(`/u/${slug}?rate_limited=1`, req.url));
  }

  const { error: insertError } = await admin.from("profile_leads").insert({
    profile_id,
    name,
    email,
    phone,
    message,
    honeypot: null,
    ip_hash,
    user_agent,
  });

  if (insertError) {
    console.error("CONNECT LEAD INSERT ERROR", insertError);
    return NextResponse.redirect(new URL(`/u/${slug}?error=1`, req.url));
  }

  await admin.from("profile_click_events").insert({
    profile_id,
    event_type: "lead_submit",
    ip_hash,
    user_agent,
    metadata: { source: "public_form" },
  });

  await admin.from("connect_events").insert({
    profile_id,
    qr_code_id: null,
    event_type: "lead_submit",
    link_id: null,
    link_label: null,
    link_url: null,
    visitor_id: ip_hash,
    ip_hash,
    user_agent,
    device_type: getDeviceType(user_agent),
    browser: getBrowser(user_agent),
    os: getOperatingSystem(user_agent),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    referrer: getReferrerSource(req.headers.get("referer")),
  });

  return NextResponse.redirect(new URL(`/u/${slug}?sent=1`, req.url));
}
