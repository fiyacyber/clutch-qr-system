import crypto from "crypto";

export const CONNECT_EVENT_TYPES = new Set([
  "profile_view",
  "call_click",
  "text_click",
  "email_click",
  "website_click",
  "directions_click",
  "quote_cta_click",
  "vcard_download",
  "save_contact",
  "wallet_click",
  "apple_wallet_download",
  "google_wallet_add",
  "link_click",
  "lead_submit",
]);

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function buildDefaultProfileSlug(value: string) {
  const base = normalizeSlug(value);
  if (base) return base;
  return `clutch-connect-${crypto.randomBytes(3).toString("hex")}`;
}

export function extractIpHash(headers: Headers) {
  const ip = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export function asPublicWebsite(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
