/**
 * Clutch Connect Builder Configuration Types
 * Defines the structure for the block-based profile builder
 */

export type BlockType =
  | "profile-hero"
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
  settings: Record<string, any>;
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

export interface BuilderTheme {
  accentColor: string;
  layout: "default" | "minimal" | "compact";
  showProfilePicture: boolean;
  showBio: boolean;
  showFooter: boolean;
}

export interface BuilderConfig {
  version: number; // For future migrations
  theme: BuilderTheme;
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
  },
  "contact-buttons": {
    style: "grid", // grid | row
  },
  "phone-button": {
    label: "Call",
    showIcon: true,
  },
  "email-button": {
    label: "Email",
    showIcon: true,
  },
  "website-button": {
    label: "Website",
    showIcon: true,
  },
  "directions-button": {
    label: "Directions",
    showIcon: true,
  },
  "request-quote-button": {
    label: "Request Quote",
    showIcon: true,
    formId: null,
  },
  "social-media-links": {
    layout: "grid", // grid | row | badges
    showNames: false,
  },
  "custom-link-button": {
    label: "Custom Link",
    url: "",
    icon: "🔗",
  },
  "image-banner": {
    imageUrl: "",
    altText: "",
    height: "200px",
    caption: "",
  },
  "text-section": {
    heading: "",
    content: "",
    alignment: "center", // left | center | right
  },
  "business-hours": {
    title: "Hours",
    showDays: true,
  },
  "services-list": {
    title: "Services",
    items: [],
  },
  "form-block": {
    formId: null,
  },
  "apple-wallet-button": {
    label: "Add to Apple Wallet",
    showIcon: true,
  },
  "google-wallet-button": {
    label: "Save to Google Wallet",
    showIcon: true,
  },
  "qr-code-block": {
    size: "medium", // small | medium | large
    caption: "",
  },
};

/**
 * Block order for default profile layout
 */
export const defaultBlockOrder: BlockType[] = [
  "profile-hero",
  "contact-buttons",
  "social-media-links",
  "text-section",
  "services-list",
  "business-hours",
];
