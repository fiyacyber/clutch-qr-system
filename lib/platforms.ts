export type PlatformType =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "twitter"
  | "snapchat"
  | "pinterest"
  | "yelp"
  | "google_business"
  | "website"
  | "phone"
  | "email"
  | "booking"
  | "menu"
  | "portfolio"
  | "reviews"
  | "custom";

export interface Platform {
  id: PlatformType;
  name: string;
  icon: string;
  placeholder: string;
  buildUrl: (value: string) => string;
  validate?: (value: string) => boolean;
}

export const PLATFORMS: Record<PlatformType, Platform> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    icon: "instagram",
    placeholder: "@username or username",
    buildUrl: (value: string) => {
      const handle = value.replace(/^@/, "").trim();
      return `https://instagram.com/${handle}`;
    },
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    icon: "facebook",
    placeholder: "page-name or profile-url",
    buildUrl: (value: string) => {
      const handle = value.replace("https://facebook.com/", "").trim();
      return `https://facebook.com/${handle}`;
    },
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    icon: "tiktok",
    placeholder: "@username or username",
    buildUrl: (value: string) => {
      const handle = value.replace(/^@/, "").trim();
      return `https://www.tiktok.com/@${handle}`;
    },
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    icon: "youtube",
    placeholder: "channel-name or @channel-handle",
    buildUrl: (value: string) => {
      const handle = value.replace(/^@/, "").trim();
      if (value.includes("youtube.com")) return value;
      return `https://youtube.com/@${handle}`;
    },
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    icon: "linkedin",
    placeholder: "Full LinkedIn URL",
    buildUrl: (value: string) => value.trim(),
  },
  twitter: {
    id: "twitter",
    name: "X / Twitter",
    icon: "twitter",
    placeholder: "@username or username",
    buildUrl: (value: string) => {
      const handle = value.replace(/^@/, "").trim();
      return `https://x.com/${handle}`;
    },
  },
  snapchat: {
    id: "snapchat",
    name: "Snapchat",
    icon: "snapchat",
    placeholder: "username",
    buildUrl: (value: string) => {
      const handle = value.trim();
      return `https://snapchat.com/add/${handle}`;
    },
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    icon: "pinterest",
    placeholder: "username or profile-url",
    buildUrl: (value: string) => {
      if (value.includes("pinterest.com")) return value;
      const handle = value.trim();
      return `https://pinterest.com/${handle}`;
    },
  },
  yelp: {
    id: "yelp",
    name: "Yelp",
    icon: "yelp",
    placeholder: "Business URL or profile-url",
    buildUrl: (value: string) => {
      if (value.includes("yelp.com")) return value;
      return value.trim();
    },
  },
  google_business: {
    id: "google_business",
    name: "Google Business",
    icon: "google",
    placeholder: "Full Google Business URL",
    buildUrl: (value: string) => value.trim(),
  },
  website: {
    id: "website",
    name: "Website",
    icon: "globe",
    placeholder: "https://yourwebsite.com",
    buildUrl: (value: string) => {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `https://${trimmed}`;
    },
  },
  phone: {
    id: "phone",
    name: "Phone",
    icon: "phone",
    placeholder: "+1 555 555 5555 or 5555555555",
    buildUrl: (value: string) => {
      const cleaned = value.replace(/\D/g, "");
      return `tel:${cleaned}`;
    },
  },
  email: {
    id: "email",
    name: "Email",
    icon: "mail",
    placeholder: "you@example.com",
    buildUrl: (value: string) => {
      return `mailto:${value.trim()}`;
    },
  },
  booking: {
    id: "booking",
    name: "Booking Link",
    icon: "calendar",
    placeholder: "https://calendly.com/... or booking URL",
    buildUrl: (value: string) => {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `https://${trimmed}`;
    },
  },
  menu: {
    id: "menu",
    name: "Menu",
    icon: "menu",
    placeholder: "https://menu-url.com or full URL",
    buildUrl: (value: string) => {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `https://${trimmed}`;
    },
  },
  portfolio: {
    id: "portfolio",
    name: "Portfolio",
    icon: "briefcase",
    placeholder: "https://yourportfolio.com",
    buildUrl: (value: string) => {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `https://${trimmed}`;
    },
  },
  reviews: {
    id: "reviews",
    name: "Reviews",
    icon: "star",
    placeholder: "Google Reviews, Trustpilot, or other URL",
    buildUrl: (value: string) => {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `https://${trimmed}`;
    },
  },
  custom: {
    id: "custom",
    name: "Custom Link",
    icon: "link",
    placeholder: "https://example.com",
    buildUrl: (value: string) => {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `https://${trimmed}`;
    },
  },
};

export const POPULAR_PLATFORMS: PlatformType[] = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "linkedin",
  "twitter",
  "snapchat",
  "pinterest",
  "yelp",
  "google_business",
  "website",
  "phone",
  "email",
  "booking",
  "menu",
  "portfolio",
  "reviews",
];

export function getPlatform(id: string): Platform | null {
  return PLATFORMS[id as PlatformType] || null;
}

export function buildUrlForPlatform(platform: string, value: string): string {
  const p = getPlatform(platform);
  if (!p) return value;
  return p.buildUrl(value);
}
