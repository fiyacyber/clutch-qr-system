import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { extractIpHash } from "@/lib/connect";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";
import { buildConnectPublicProfileUrl } from "@/lib/connect-urls";

function leadRedirect(req: NextRequest, slug: string, state: "sent" | "rate_limited" | "error") {
  const referrer = req.headers.get("referer");
  const fallbackUrl = buildConnectPublicProfileUrl(slug);
  let redirectUrl = fallbackUrl;

  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const expectedPath = `/u/${encodeURIComponent(slug)}`;

      if (referrerUrl.pathname === expectedPath) {
        referrerUrl.search = "";
        referrerUrl.hash = "";
        redirectUrl = referrerUrl.toString();
      }
    } catch {
      redirectUrl = fallbackUrl;
    }
  }

  const url = new URL(redirectUrl);
  url.searchParams.set(state, "1");
  return url;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const profile_id = String(form.get("profile_id") || "").trim();
  const slug = String(form.get("slug") || "").trim();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const message = String(form.get("message") || "").trim();
  const honeypot = String(form.get("company_website") || "").trim();
  const primary_action_type = String(form.get("primary_action_type") || "").trim();
  const primary_action_label = String(form.get("primary_action_label") || "").trim();
  const form_type = String(form.get("form_type") || "").trim();
  const source = String(form.get("source") || "clutch_connect_profile").trim() || "clutch_connect_profile";

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
    return NextResponse.redirect(leadRedirect(req, slug, "sent"));
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
    return NextResponse.redirect(leadRedirect(req, slug, "rate_limited"));
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
    return NextResponse.redirect(leadRedirect(req, slug, "error"));
  }

  await admin.from("profile_click_events").insert({
    profile_id,
    event_type: "lead_submit",
    ip_hash,
    user_agent,
    metadata: {
      source,
      profileId: profile_id,
      profileSlug: slug,
      primaryActionType: primary_action_type || null,
      primaryActionLabel: primary_action_label || null,
      formType: form_type || null,
      visitorName: name || null,
      visitorEmail: email || null,
      visitorPhone: phone || null,
      visitorMessage: message || null,
      timestamp: new Date().toISOString(),
    },
  });

  await admin.from("connect_events").insert({
    profile_id,
    qr_code_id: null,
    event_type: "lead_submit",
    link_id: null,
    link_label: primary_action_label || "Lead capture",
    link_url: primary_action_type ? `lead:${primary_action_type}` : null,
    visitor_id: ip_hash,
    ip_hash,
    user_agent,
    device_type: getDeviceType(user_agent),
    browser: getBrowser(user_agent),
    os: getOperatingSystem(user_agent),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    referrer: getReferrerSource(req.headers.get("referer")) || source,
  });

  return NextResponse.redirect(leadRedirect(req, slug, "sent"));
}
