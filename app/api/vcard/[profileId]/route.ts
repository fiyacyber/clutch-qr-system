import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { extractIpHash } from "@/lib/connect";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";

function escapeVCard(value?: string | null) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await context.params;
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, is_active, business_name, contact_name, title, phone, email, website")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const fullName = escapeVCard(profile.contact_name || profile.business_name || "Clutch Connect");
  const org = escapeVCard(profile.business_name);
  const title = escapeVCard(profile.title);
  const phone = escapeVCard(profile.phone);
  const email = escapeVCard(profile.email);
  const website = escapeVCard(profile.website);

  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fullName}`,
    org ? `ORG:${org}` : "",
    title ? `TITLE:${title}` : "",
    phone ? `TEL;TYPE=CELL:${phone}` : "",
    email ? `EMAIL;TYPE=INTERNET:${email}` : "",
    website ? `URL:${website}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");

  const ip_hash = extractIpHash(req.headers);
  const user_agent = req.headers.get("user-agent") || null;

  await admin.from("profile_click_events").insert({
    profile_id: profile.id,
    event_type: "vcard_download",
    ip_hash,
    user_agent,
    metadata: { slug: profile.slug },
  });

  await admin.from("connect_events").insert({
    profile_id: profile.id,
    qr_code_id: null,
    event_type: "save_contact",
    link_id: null,
    link_label: "Save Contact",
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

  const filename = `${(profile.slug || "clutch-connect").replace(/[^a-z0-9-]/gi, "-")}.vcf`;

  return new NextResponse(vcf, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
