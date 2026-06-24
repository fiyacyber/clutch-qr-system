import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";
import crypto from "crypto";

export type WalletType = "apple" | "google";

// Centralized event write path for wallet actions so NFC-linked passes can reuse it later.
export async function trackWalletEvent(profileId: string, walletType: WalletType, requestHeaders?: Headers) {
  const admin = createSupabaseAdminClient();
  const userAgent = requestHeaders?.get("user-agent") || null;
  const referrer = requestHeaders?.get("referer") || null;
  const ipRaw = requestHeaders?.get("x-forwarded-for") || requestHeaders?.get("x-real-ip") || null;
  const ipHash = ipRaw ? crypto.createHash("sha256").update(ipRaw).digest("hex") : null;

  await admin.from("wallet_events").insert({
    profile_id: profileId,
    wallet_type: walletType,
    ip_hash: ipHash,
    user_agent: userAgent,
  });

  await admin.from("connect_events").insert({
    profile_id: profileId,
    qr_code_id: null,
    event_type: "wallet_click",
    link_id: null,
    link_label: walletType === "apple" ? "Apple Wallet" : "Google Wallet",
    link_url: null,
    visitor_id: ipHash,
    ip_hash: ipHash,
    user_agent: userAgent,
    device_type: getDeviceType(userAgent),
    browser: getBrowser(userAgent),
    os: getOperatingSystem(userAgent),
    country: requestHeaders?.get("x-vercel-ip-country") || null,
    region: requestHeaders?.get("x-vercel-ip-country-region") || null,
    city: requestHeaders?.get("x-vercel-ip-city") || null,
    referrer: getReferrerSource(referrer),
  });
}
