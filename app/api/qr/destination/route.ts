import { NextRequest, NextResponse } from "next/server";

function buildSmsHref(phone: string, message: string) {
  const cleanPhone = phone.trim();
  const cleanMessage = message.trim();
  if (!cleanPhone) return "";

  if (!cleanMessage) return `sms:${cleanPhone}`;

  const separator = cleanPhone.includes("?") ? "&" : "?";
  return `sms:${cleanPhone}${separator}body=${encodeURIComponent(cleanMessage)}`;
}

function buildWifiPayload(ssid: string, password: string, security: string) {
  const safeSsid = ssid.trim().replace(/([;,:\\])/g, "\\$1");
  const safePassword = password.trim().replace(/([;,:\\])/g, "\\$1");
  const auth = security.trim().toUpperCase();

  if (!safeSsid) return "";
  return `WIFI:T:${auth};S:${safeSsid};P:${safePassword};;`;
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") || "website").trim();
  const fallback = "https://clutchprintshop.com";

  if (type === "phone") {
    const phone = req.nextUrl.searchParams.get("phone") || "";
    const target = phone.trim() ? `tel:${phone.trim()}` : fallback;
    return NextResponse.redirect(target);
  }

  if (type === "email") {
    const email = req.nextUrl.searchParams.get("email") || "";
    const subject = req.nextUrl.searchParams.get("subject") || "";
    const body = req.nextUrl.searchParams.get("body") || "";
    if (!email.trim()) return NextResponse.redirect(fallback);

    const search = new URLSearchParams();
    if (subject.trim()) search.set("subject", subject.trim());
    if (body.trim()) search.set("body", body.trim());

    const suffix = search.toString();
    const target = suffix ? `mailto:${email.trim()}?${suffix}` : `mailto:${email.trim()}`;
    return NextResponse.redirect(target);
  }

  if (type === "sms") {
    const phone = req.nextUrl.searchParams.get("phone") || "";
    const message = req.nextUrl.searchParams.get("message") || "";
    const target = buildSmsHref(phone, message) || fallback;
    return NextResponse.redirect(target);
  }

  if (type === "location") {
    const query = req.nextUrl.searchParams.get("query") || "";
    const target = query.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`
      : fallback;
    return NextResponse.redirect(target);
  }

  if (type === "wifi") {
    const ssid = req.nextUrl.searchParams.get("ssid") || "";
    const password = req.nextUrl.searchParams.get("password") || "";
    const security = req.nextUrl.searchParams.get("security") || "WPA";
    const payload = buildWifiPayload(ssid, password, security);
    if (!payload) return NextResponse.redirect(fallback);

    // Redirects to a data URL payload so scanner apps can parse WiFi credentials.
    const target = `data:text/plain,${encodeURIComponent(payload)}`;
    return NextResponse.redirect(target);
  }

  if (type === "vcard") {
    const profileId = req.nextUrl.searchParams.get("profileId") || "";
    if (!profileId.trim()) return NextResponse.redirect(fallback);

    const origin = req.nextUrl.origin;
    return NextResponse.redirect(`${origin}/api/vcard/${profileId.trim()}`);
  }

  const target = req.nextUrl.searchParams.get("target") || fallback;
  try {
    const parsed = new URL(target);
    return NextResponse.redirect(parsed.toString());
  } catch {
    return NextResponse.redirect(fallback);
  }
}
