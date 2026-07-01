/**
 * Clutch Connect Builder Configuration Types
 * Defines the structure for the block-based profile builder
 */

export type BlockType =
  | "profile-hero"
  | "avatar-block"
  | "business-name-block"
  | "subheader-block"
  | "contact-buttons"
  | "phone-button"
  | "email-button"
  | "website-button"
  | "directions-button"
  | "request-quote-button"
  | "social-media-links"
  | "custom-link-button"
  | "image-banner"
  | "text-section"
  | "business-hours"
  | "services-list"
  | "form-block"
  | "apple-wallet-button"
  | "google-wallet-button"
  | "qr-code-block";

export interface BuilderBlock {
  id: string;
  type: BlockType;
  order: number;
  visible: boolean;
  sectionId?: string;
  data?: Record<string, any>;
  settings?: Record<string, any>; // Backward compatibility
}

export interface ProfileSectionStyle {
  alignment: "left" | "center" | "right";
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  textTransform: "none" | "uppercase";
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  marginTop: number;
  marginBottom: number;
}

export interface ProfileSection {
  id: string;
  label: string;
  blockIds: string[];
  visible: boolean;
  order: number;
  style: ProfileSectionStyle;
}

export interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "textarea" | "dropdown" | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[]; // For dropdown/checkbox types
}

export interface FormConfig {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
}

export type BuilderBackgroundType = "solid" | "soft" | "gradient";
export type BuilderButtonStyle = "rounded" | "pill" | "square";
export type BuilderBannerType = "none" | "solid" | "gradient" | "image" | "glass";
export type BuilderImagePosition = "center" | "top" | "bottom";
export type BuilderTextAlign = "left" | "center" | "right";

export interface BuilderBackgroundSettings {
  type: BuilderBackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface BuilderButtonSettings {
  style: BuilderButtonStyle;
  color: string;
  textColor: string;
}

export interface BuilderAvatarSettings {
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  glowEnabled: boolean;
  glowColor: string;
  glowOpacity: number;
  verifiedBadgeEnabled: boolean;
  verifiedBadgeColor: string;
}

export interface BuilderBannerSettings {
  enabled: boolean;
  type: BuilderBannerType;
  height: number;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  imageUrl: string | null;
  imagePosition: BuilderImagePosition;
  overlayEnabled: boolean;
  overlayOpacity: number;
  borderRadius: number;
  avatarOverlap: boolean;
  textAlign: BuilderTextAlign;
}

export interface BuilderTheme {
  accentColor: string;
  buttonColor: string;
  textColor: string;
  themeMode: "light" | "dark" | "system";
  profileStyle: "clutch" | "minimal" | "executive" | "glass";
  fontFamily:
    | "exo2"
    | "sans"
    | "serif"
    | "display"
    | "mono"
    | "rounded"
    | "editorial"
    | "grotesk"
    | "humanist"
    | "condensed"
    | "geometric"
    | "elegant"
    | "newspaper"
    | "slab"
    | "clean"
    | "system"
    | "ui-sans"
    | "ui-serif"
    | "ui-mono"
    | "humanist-alt"
    | "neo-grotesk"
    | "book"
    | "modern-serif"
    | "tech"
    | "narrow"
    | "poster"
    | "friendly"
    | "signature"
    | "luxury"
    | "slab-alt";
  fontScale: "normal" | "large";
  layout: "default" | "minimal" | "compact";
  showProfilePicture: boolean;
  showBio: boolean;
  showFooter: boolean;
  showSaveShareSection: boolean;
  saveSharePosition: "top" | "bottom";
  saveShareAlignment: "left" | "center" | "right";
  saveShareShowSaveContact: boolean;
  saveShareShowAppleWallet: boolean;
  saveShareShowGoogleWallet: boolean;
  saveShareShowShareProfile: boolean;
  saveShareShowCopyLink: boolean;
  saveShareShowDownloadQr: boolean;
  background: BuilderBackgroundSettings;
  buttons: BuilderButtonSettings;
  avatar: BuilderAvatarSettings;
  banner: BuilderBannerSettings;
  darkMode?: boolean;
}

export interface BuilderConfig {
  version: number; // For future migrations
  theme: BuilderTheme;
  sections: ProfileSection[];
  blocks: BuilderBlock[];
  forms: FormConfig[];
}

/**
 * Default block settings by type
 */
export const defaultBlockSettings: Record<BlockType, Record<string, any>> = {
  "profile-hero": {
    showProfilePicture: true,
    showName: true,
    showTitle: true,
    showBio: true,
    avatarGlowEnabled: true,
    avatarGlowColor: "#FF6B2C",
    avatarGlowOpacity: 0.35,
    avatarGlowBlur: 18,
    avatarGlowSpread: 10,
    verifiedBadgeEnabled: false,
    verifiedBadgeColor: "#f59e0b",
    verifiedBadgeIconColor: "#0f172a",
    verifiedBadgeIcon: "checkmark",
    verifiedBadgePosition: "bottom-right",
    verifiedBadgeSize: 24,
  },
  "avatar-block": {
    avatarUrl: "",
    avatarRemoved: false,
    avatarBorderEnabled: false,
    avatarBorderColor: "#FFFFFF",
    avatarBorderWidth: 4,
    avatarBorderRadius: 999,
    avatarGlowEnabled: true,
    avatarGlowColor: "#FF6B2C",
    avatarGlowOpacity: 0.35,
    avatarGlowBlur: 18,
    avatarGlowSpread: 10,
    verifiedBadgeEnabled: false,
    verifiedBadgeColor: "#f59e0b",
    verifiedBadgeIconColor: "#0f172a",
    verifiedBadgeIcon: "checkmark",
    verifiedBadgePosition: "bottom-right",
    verifiedBadgeSize: 24,
  },
  "business-name-block": {
    text: "",
    color: "",
    fontSize: 40,
    fontWeight: 800,
    fontFamily: "inherit",
    alignment: "center",
  },
  "subheader-block": {
    text: "",
    color: "",
    fontSize: 22,
    fontWeight: 600,
    fontFamily: "inherit",
    alignment: "center",
  },
  "contact-buttons": {
    style: "grid", // grid | row
    alignment: "center",
  },
  "phone-button": {
    label: "Call",
    showIcon: true,
    alignment: "center",
  },
  "email-button": {
    label: "Email",
    showIcon: true,
    alignment: "center",
  },
  "website-button": {
    label: "Website",
    showIcon: true,
    alignment: "center",
  },
  "directions-button": {
    label: "Directions",
    showIcon: true,
    alignment: "center",
  },
  "request-quote-button": {
    label: "Request Quote",
    showIcon: true,
    formId: null,
    alignment: "center",
  },
  "social-media-links": {
    layout: "grid", // grid | row | badges
    showNames: false,
    iconColorMode: "mono",
    links: [],
    alignment: "center",
  },
  "custom-link-button": {
    label: "Custom Link",
    url: "",
    icon: "🔗",
    alignment: "center",
  },
  "image-banner": {
    imageUrl: "",
    altText: "",
    height: "200px",
    caption: "",
    alignment: "center",
  },
  "text-section": {
    heading: "",
    content: "",
    alignment: "center", // left | center | right
  },
  "business-hours": {
    title: "Hours",
    showDays: true,
    alignment: "center",
  },
  "services-list": {
    title: "Services",
    items: [],
    alignment: "center",
  },
  "form-block": {
    formId: null,
    alignment: "center",
  },
  "apple-wallet-button": {
    label: "Add to Apple Wallet",
    showIcon: true,
    alignment: "center",
  },
  "google-wallet-button": {
    label: "Save to Google Wallet",
    showIcon: true,
    alignment: "center",
  },
  "qr-code-block": {
    size: "medium", // small | medium | large
    caption: "",
    showLabel: true,
    alignment: "center",
  },
};

/**
 * Block order for default profile layout
 */
export const defaultBlockOrder: BlockType[] = [
  "avatar-block",
  "business-name-block",
  "subheader-block",
  "phone-button",
  "email-button",
  "website-button",
  "social-media-links",
  "text-section",
  "services-list",
  "business-hours",
];
