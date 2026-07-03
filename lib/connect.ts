import crypto from "crypto";
import {
  createDefaultBuilderConfig,
  sanitizeBuilderConfig,
  validateBuilderConfig,
} from "@/lib/builder-config";
import { buildConnectPublicProfileUrl, getConnectPublicBaseUrl } from "@/lib/connect-urls";

export const RESERVED_CONNECT_SLUGS = new Set([
  "admin",
  "analytics",
  "api",
  "auth",
  "build",
  "clutch-connect",
  "clutchconnect",
  "connect",
  "create",
  "dashboard",
  "help",
  "leads",
  "login",
  "portal",
  "pricing",
  "qr",
  "settings",
  "signup",
  "setup",
  "support",
  "u",
  "wallet",
  "clutch",
  "clutchprintshop",
]);

export type BeginnerConnectLinkType =
  | "website"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "google_business"
  | "yelp"
  | "booking"
  | "email"
  | "phone"
  | "custom";

export type BeginnerConnectLinkDraft = {
  id?: string;
  type?: BeginnerConnectLinkType | string;
  label?: string;
  value?: string;
  visible?: boolean;
};

export type NormalizedBeginnerConnectLink = {
  id: string;
  type: BeginnerConnectLinkType;
  label: string;
  value: string;
  href: string;
  visible: boolean;
};

type BeginnerConnectLinkSpec = {
  type: BeginnerConnectLinkType;
  label: string;
  placeholder: string;
  helperText: string;
};

export const BEGINNER_CONNECT_LINK_TYPES: BeginnerConnectLinkSpec[] = [
  { type: "website", label: "Website", placeholder: "clutchprintshop.com", helperText: "Adds https:// if you leave it off." },
  { type: "facebook", label: "Facebook", placeholder: "facebook.com/yourpage or @yourpage", helperText: "Paste a page URL or a page handle." },
  { type: "instagram", label: "Instagram", placeholder: "@yourhandle", helperText: "Handles become instagram.com/yourhandle." },
  { type: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/your-name", helperText: "Paste the full LinkedIn profile or page URL." },
  { type: "tiktok", label: "TikTok", placeholder: "@yourhandle", helperText: "Handles become tiktok.com/@yourhandle." },
  { type: "youtube", label: "YouTube", placeholder: "youtube.com/@yourchannel", helperText: "Pastes full URLs or channel handles." },
  { type: "google_business", label: "Google Business Profile", placeholder: "maps.app.goo.gl/...", helperText: "Paste the share link to your business profile." },
  { type: "yelp", label: "Yelp", placeholder: "yelp.com/biz/your-business", helperText: "Paste the Yelp listing URL." },
  { type: "booking", label: "Calendly / Booking", placeholder: "calendly.com/yourname", helperText: "Paste your booking or scheduling link." },
  { type: "email", label: "Email", placeholder: "hello@clutchprintshop.com", helperText: "Email links turn into mailto: automatically." },
  { type: "phone", label: "Phone", placeholder: "+1 555 555 5555", helperText: "Phone links turn into tel: automatically." },
  { type: "custom", label: "Custom Link", placeholder: "https://example.com", helperText: "Any other destination you want to feature." },
];

export function normalizeBeginnerConnectLinkType(type?: BeginnerConnectLinkType | string): BeginnerConnectLinkType {
  const raw = String(type || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "google" || raw === "google_business_profile" || raw === "google_business" || raw === "googlebusiness") {
    return "google_business";
  }
  if (raw === "calendar" || raw === "calendly" || raw === "booking_link" || raw === "book") {
    return "booking";
  }
  if (raw === "website" || raw === "facebook" || raw === "instagram" || raw === "linkedin" || raw === "tiktok" || raw === "youtube" || raw === "yelp" || raw === "booking" || raw === "email" || raw === "phone" || raw === "custom") {
    return raw as BeginnerConnectLinkType;
  }
  return "custom";
}

function stripSchemePrefix(value: string) {
  return value.replace(/^https?:\/\//i, "");
}

function stripUnsafeScheme(value: string) {
  return /^(javascript|data|vbscript):/i.test(value);
}

function normalizeWebsiteLikeHref(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  if (stripUnsafeScheme(trimmed)) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname || url.hostname.includes("@")) return "";
    const host = url.hostname.toLowerCase();
    const isLocalhost = host === "localhost";
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const hasDomainDot = host.includes(".");
    if (!isLocalhost && !isIp && !hasDomainDot) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeFacebookHref(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  if (stripUnsafeScheme(trimmed)) return "";
  if (/^https?:\/\//i.test(trimmed)) return normalizeWebsiteLikeHref(trimmed);
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "";
  const cleaned = stripSchemePrefix(trimmed).replace(/^@+/, "");
  return `https://facebook.com/${encodeURIComponent(cleaned)}`;
}

function isValidEmailAddress(value: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value) && !value.includes("..") && value.length <= 254;
}

function normalizeEmailValue(rawValue: string) {
  const trimmed = rawValue.trim().replace(/^mailto:/i, "");
  if (!trimmed) return "";
  if (!isValidEmailAddress(trimmed)) return "";
  return trimmed;
}

function normalizePhoneValue(rawValue: string) {
  const trimmed = rawValue.trim().replace(/^tel:/i, "");
  if (!trimmed) return "";
  const safe = trimmed.replace(/[^\d+]/g, "");
  const normalized = safe.replace(/(?!^)\+/g, "");
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 ? normalized : "";
}

export function formatPhoneDisplay(rawValue: unknown) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  const normalizedDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (normalizedDigits.length === 10) {
    return `${normalizedDigits.slice(0, 3)}-${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6)}`;
  }

  return raw;
}

export function getBeginnerConnectLinkSpec(type?: BeginnerConnectLinkType | string) {
  const normalizedType = normalizeBeginnerConnectLinkType(type);
  return BEGINNER_CONNECT_LINK_TYPES.find((spec) => spec.type === normalizedType) || BEGINNER_CONNECT_LINK_TYPES[BEGINNER_CONNECT_LINK_TYPES.length - 1];
}

export function normalizeBeginnerConnectLinkHref(type: BeginnerConnectLinkType | string, value: string) {
  const normalizedType = normalizeBeginnerConnectLinkType(type);
  const raw = String(value || "").trim();

  if (!raw) return "";
  if (stripUnsafeScheme(raw)) return "";

  switch (normalizedType) {
    case "email":
      return normalizeEmailValue(raw) ? `mailto:${normalizeEmailValue(raw)}` : "";
    case "phone": {
      const phone = normalizePhoneValue(raw);
      return phone ? `tel:${phone}` : "";
    }
    case "instagram":
      return /^https?:\/\//i.test(raw)
        ? normalizeWebsiteLikeHref(raw)
        : /^(instagram\.com|www\.instagram\.com)\//i.test(stripSchemePrefix(raw))
          ? `https://${stripSchemePrefix(raw)}`
          : `https://instagram.com/${encodeURIComponent(raw.replace(/^@+/, ""))}`;
    case "tiktok":
      return /^https?:\/\//i.test(raw)
        ? normalizeWebsiteLikeHref(raw)
        : /^(tiktok\.com|www\.tiktok\.com)\//i.test(stripSchemePrefix(raw))
          ? `https://${stripSchemePrefix(raw)}`
          : `https://tiktok.com/@${encodeURIComponent(raw.replace(/^@+/, ""))}`;
    case "youtube":
      return /^https?:\/\//i.test(raw) ? normalizeWebsiteLikeHref(raw) : raw.includes("youtube.com") || raw.includes("youtu.be") ? normalizeWebsiteLikeHref(`https://${stripSchemePrefix(raw)}`) : `https://youtube.com/@${encodeURIComponent(raw.replace(/^@+/, ""))}`;
    case "linkedin":
      return /^https?:\/\//i.test(raw) ? normalizeWebsiteLikeHref(raw) : raw.includes("linkedin.com") ? normalizeWebsiteLikeHref(`https://${stripSchemePrefix(raw)}`) : `https://linkedin.com/in/${encodeURIComponent(raw.replace(/^@+/, ""))}`;
    case "facebook":
      return /^https?:\/\//i.test(raw)
        ? raw
        : /^(facebook\.com|fb\.com|www\.facebook\.com|m\.facebook\.com)\//i.test(stripSchemePrefix(raw))
          ? `https://${stripSchemePrefix(raw)}`
          : normalizeFacebookHref(raw);
    case "google_business":
    case "yelp":
    case "booking":
    case "custom":
    case "website":
    default:
      return normalizeWebsiteLikeHref(raw);
  }
}

export function normalizeBeginnerConnectLinkValue(type: BeginnerConnectLinkType | string, value: string) {
  const normalizedType = normalizeBeginnerConnectLinkType(type);
  const raw = String(value || "").trim();

  if (!raw) return "";

  switch (normalizedType) {
    case "email":
      return normalizeEmailValue(raw);
    case "phone":
      return normalizePhoneValue(raw);
    default:
      return raw;
  }
}

export function normalizeBeginnerConnectLinkDraft(
  draft: BeginnerConnectLinkDraft,
  options?: { index?: number }
): { link: NormalizedBeginnerConnectLink | null; error: string } {
  const type = normalizeBeginnerConnectLinkType(draft.type);
  const label = String(draft.label || getBeginnerConnectLinkSpec(type).label).trim() || getBeginnerConnectLinkSpec(type).label;
  const rawValue = String(draft.value || "").trim();
  const visible = draft.visible !== false;
  const value = normalizeBeginnerConnectLinkValue(type, rawValue);
  const href = normalizeBeginnerConnectLinkHref(type, rawValue);

  if (!value || !href) {
    return {
      link: null,
      error: `Enter a valid ${getBeginnerConnectLinkSpec(type).label.toLowerCase()} link.`,
    };
  }

  return {
    link: {
      id: String(draft.id || `setup-link-${options?.index ?? 0}`),
      type,
      label,
      value,
      href,
      visible,
    },
    error: "",
  };
}

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

export function validateConnectSlug(input: string, options?: { allowEmpty?: boolean }) {
  const raw = String(input || "").trim();
  const slug = normalizeSlug(raw);

  if (!slug) {
    return {
      slug: "",
      valid: Boolean(options?.allowEmpty),
      message: options?.allowEmpty ? "" : "Choose a public slug.",
    };
  }

  if (slug.length < 3) {
    return {
      slug,
      valid: false,
      message: "Use at least 3 characters.",
    };
  }

  if (RESERVED_CONNECT_SLUGS.has(slug)) {
    return {
      slug,
      valid: false,
      message: "That slug is reserved. Pick a different one.",
    };
  }

  return {
    slug,
    valid: true,
    message: "",
  };
}

export function buildConnectSlugPreview(slug: string) {
  const cleanSlug = normalizeSlug(slug);
  const base = getConnectPublicBaseUrl().replace(/^https?:\/\//, "");
  return cleanSlug
    ? buildConnectPublicProfileUrl(cleanSlug).replace(/^https?:\/\//, "")
    : `${base}/u/your-slug`;
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

type ConnectSetupCustomer = {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  is_admin?: boolean | null;
};

type ConnectSetupProfile = {
  business_name?: string | null;
  contact_name?: string | null;
  title?: string | null;
  slug?: string | null;
  is_active?: boolean | null;
  setup_completed?: boolean | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  builder_config?: unknown;
  theme_color?: string | null;
};

type ConnectSetupLink = {
  is_active?: boolean | null;
  url?: string | null;
};

function hasVisibleContactMethod(profile: ConnectSetupProfile | null | undefined) {
  if (!profile) return false;

  const hasAnyValue = Boolean(
    String(profile.phone || "").trim() ||
    String(profile.email || "").trim() ||
    String(profile.website || "").trim()
  );

  if (!hasAnyValue) return false;

  const config = sanitizeBuilderConfig(
    profile.builder_config || createDefaultBuilderConfig(profile.theme_color || "#FFA665")
  );

  const phoneVisible = config.blocks.find((block) => block.type === "phone-button")?.visible !== false;
  const emailVisible = config.blocks.find((block) => block.type === "email-button")?.visible !== false;
  const websiteVisible = config.blocks.find((block) => block.type === "website-button")?.visible !== false;

  if (phoneVisible && String(profile.phone || "").trim()) return true;
  if (emailVisible && String(profile.email || "").trim()) return true;
  if (websiteVisible && String(profile.website || "").trim()) return true;

  return false;
}

function hasVisibleLinks(profile: ConnectSetupProfile | null | undefined, links?: ConnectSetupLink[]) {
  const activeLinks = (links || []).filter((link) => link.is_active !== false && String(link.url || "").trim());
  if (activeLinks.length > 0) return true;

  if (!profile) return false;

  const config = sanitizeBuilderConfig(
    profile.builder_config || createDefaultBuilderConfig(profile.theme_color || "#FFA665")
  );

  const socialBlock = config.blocks.find((block) => block.type === "social-media-links");
  if (!socialBlock || !socialBlock.data || typeof socialBlock.data !== "object") return false;

  const rawLinks = Array.isArray((socialBlock.data as { links?: unknown }).links)
    ? ((socialBlock.data as { links?: unknown[] }).links || [])
    : [];

  return rawLinks.some((rawLink) => {
    if (!rawLink || typeof rawLink !== "object") return false;
    const link = rawLink as { visible?: boolean; value?: string; href?: string; url?: string };
    if (link.visible === false) return false;
    return Boolean(String(link.value || link.href || link.url || "").trim());
  });
}

export function isConnectSetupComplete(
  customer?: ConnectSetupCustomer | null,
  profile?: ConnectSetupProfile | null,
  options?: { links?: ConnectSetupLink[]; requirePublished?: boolean }
) {
  if (!customer || !profile) return false;
  if (customer.is_admin) return true;

  if (options?.requirePublished && (profile.is_active === false || profile.setup_completed === false)) {
    return false;
  }

  const slugCheck = validateConnectSlug(String(profile.slug || ""), { allowEmpty: false });
  if (!slugCheck.valid) return false;

  const displayName = String(profile.contact_name || "").trim();
  const companyName = String(profile.business_name || customer.company_name || "").trim();
  const personalName = [customer.first_name, customer.last_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  const title = String(profile.title || "").trim();

  if (!displayName && !companyName && !personalName && !title) return false;

  const config = sanitizeBuilderConfig(
    profile.builder_config || createDefaultBuilderConfig(profile.theme_color || "#FFA665")
  );
  if (!validateBuilderConfig(config)) return false;

  if (hasVisibleContactMethod(profile)) return true;
  return hasVisibleLinks(profile, options?.links);
}

export function isConnectProfilePublished(profile?: Pick<ConnectSetupProfile, "is_active" | "setup_completed"> | null) {
  if (!profile) return false;
  return profile.is_active === true && profile.setup_completed !== false;
}
