/**
 * Standardized icon system for Clutch Connect
 * Uses Lucide React for app UI and social platform brand colors
 */

export const ICON_SIZES = {
  small: 16,
  default: 24,
  large: 32,
  mobile: 20,
};

export const SOCIAL_ICONS = {
  instagram: {
    name: "Instagram",
    color: "#E4405F",
    hoverColor: "#d63447",
    handle: true,
    url: (handle: string) => `https://instagram.com/${handle}`,
  },
  facebook: {
    name: "Facebook",
    color: "#1877F2",
    hoverColor: "#0a66c2",
    handle: true,
    url: (handle: string) => `https://facebook.com/${handle}`,
  },
  twitter: {
    name: "X (Twitter)",
    color: "#000000",
    hoverColor: "#333333",
    handle: true,
    url: (handle: string) => `https://twitter.com/${handle}`,
  },
  tiktok: {
    name: "TikTok",
    color: "#000000",
    hoverColor: "#25F4EE",
    handle: true,
    url: (handle: string) => `https://tiktok.com/@${handle}`,
  },
  linkedin: {
    name: "LinkedIn",
    color: "#0A66C2",
    hoverColor: "#004182",
    handle: true,
    url: (handle: string) => `https://linkedin.com/in/${handle}`,
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    hoverColor: "#cc0000",
    handle: true,
    url: (handle: string) => `https://youtube.com/@${handle}`,
  },
  tiktok_2: {
    name: "TikTok",
    color: "#000000",
    hoverColor: "#25F4EE",
  },
  threads: {
    name: "Threads",
    color: "#000000",
    hoverColor: "#333333",
    handle: true,
    url: (handle: string) => `https://threads.net/@${handle}`,
  },
  snapchat: {
    name: "Snapchat",
    color: "#FFFC00",
    hoverColor: "#f0f400",
    handle: true,
    url: (handle: string) => `https://snapchat.com/add/${handle}`,
  },
  pinterest: {
    name: "Pinterest",
    color: "#E60023",
    hoverColor: "#ad081b",
    handle: true,
    url: (handle: string) => `https://pinterest.com/${handle}`,
  },
  whatsapp: {
    name: "WhatsApp",
    color: "#25D366",
    hoverColor: "#1ea952",
    handle: false,
    url: (handle: string) => `https://wa.me/${handle}`,
  },
  phone: {
    name: "Phone",
    color: "#34C759",
    hoverColor: "#30b0ff",
    handle: false,
    url: (handle: string) => `tel:${handle}`,
  },
  email: {
    name: "Email",
    color: "#007AFF",
    hoverColor: "#0051d5",
    handle: false,
    url: (handle: string) => `mailto:${handle}`,
  },
};

export const CUSTOM_LINK_ICONS = [
  "🔗",
  "🌐",
  "📱",
  "💼",
  "🎨",
  "🎬",
  "🎵",
  "📚",
  "📸",
  "🎮",
  "🏪",
  "🎁",
  "📝",
  "🎯",
  "💎",
  "🏆",
  "🚀",
  "⭐",
  "❤️",
  "💬",
];

export function getSocialColor(platform: string, hover = false): string {
  const socialIcon = SOCIAL_ICONS[platform as keyof typeof SOCIAL_ICONS];
  if (!socialIcon) return "#666666";
  return hover ? socialIcon.hoverColor : socialIcon.color;
}

export function getSocialUrl(
  platform: string,
  handle: string
): string | null {
  const socialIcon = SOCIAL_ICONS[platform as keyof typeof SOCIAL_ICONS];
  if (!socialIcon) return null;
  if (!("url" in socialIcon) || typeof socialIcon.url !== "function") return null;
  return socialIcon.url(handle);
}

export function getSocialName(platform: string): string {
  const socialIcon = SOCIAL_ICONS[platform as keyof typeof SOCIAL_ICONS];
  return socialIcon?.name || platform;
}

export const LUCIDE_ICONS = {
  // Navigation
  menu: "Menu",
  home: "Home",
  settings: "Settings",
  search: "Search",
  x: "X",
  chevronDown: "ChevronDown",
  chevronUp: "ChevronUp",
  chevronRight: "ChevronRight",
  chevronLeft: "ChevronLeft",

  // Actions
  plus: "Plus",
  trash2: "Trash2",
  edit: "Edit",
  copy: "Copy",
  check: "Check",
  alertCircle: "AlertCircle",
  info: "Info",
  eye: "Eye",
  eyeOff: "EyeOff",
  download: "Download",
  share2: "Share2",

  // Communications
  phone: "Phone",
  mail: "Mail",
  messageSquare: "MessageSquare",
  map: "MapPin",

  // Business
  briefcase: "Briefcase",
  creditCard: "CreditCard",
  shoppingCart: "ShoppingCart",
  calendar: "Calendar",
  clock: "Clock",

  // Media
  image: "Image",
  video: "Video",
  camera: "Camera",

  // Social (use emoji or lucide)
  share: "Share2",
  users: "Users",
  heart: "Heart",
  star: "Star",
};
