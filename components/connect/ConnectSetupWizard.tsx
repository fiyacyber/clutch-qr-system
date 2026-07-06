"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  FaEnvelope,
  FaFacebook,
  FaGlobe,
  FaInstagram,
  FaLinkedin,
  FaLink,
  FaPhone,
  FaTiktok,
  FaYoutube,
  FaYelp,
} from "react-icons/fa6";
import { FaCalendarAlt, FaGoogle } from "react-icons/fa";
import ConnectProfileView from "@/components/connect/ConnectProfileView";
import { BuilderConfig } from "@/lib/builder-types";
import {
  BeginnerConnectLinkType,
  buildConnectSlugPreview,
  buildDefaultProfileSlug,
  getBeginnerConnectLinkSpec,
  normalizeBeginnerConnectLinkHref,
  normalizeBeginnerConnectLinkDraft,
  normalizeBeginnerConnectLinkType,
  normalizeSlug,
  validateConnectSlug,
} from "@/lib/connect";
import { createBlock, sanitizeBuilderConfig } from "@/lib/builder-config";

type SetupLinkDraft = {
  id: string;
  type: BeginnerConnectLinkType;
  label: string;
  value: string;
  visible: boolean;
};

type SetupDraft = {
  basic: {
    firstName: string;
    lastName: string;
    displayName: string;
    organization: string;
    role: string;
    avatarUrl: string;
    businessName: string;
    contactName: string;
    title: string;
    slug: string;
    bannerTheme: "clean-studio" | "clutch-navy" | "executive-dark" | "warm-gradient" | "soft-slate" | "orange-edge";
    bannerMode: "theme" | "image";
    bannerImageUrl: string;
    bannerImageAlt: string;
    bannerEnabled: boolean;
  };
  contact: {
    phone: string;
    email: string;
    website: string;
    bio: string;
    serviceArea: string;
    showPhone: boolean;
    showEmail: boolean;
    showWebsite: boolean;
  };
  links: SetupLinkDraft[];
  action: {
    primaryActionType:
      | "request_quote"
      | "get_estimate"
      | "book_appointment"
      | "schedule_consultation"
      | "request_info"
      | "contact_me"
      | "place_order"
      | "custom";
    primaryActionLabel: string;
    primaryActionLeadCaptureEnabled: boolean;
    primaryActionFormType: "basic_contact" | "quote_request" | "appointment_request" | "general_inquiry";
    primaryActionUrl: string;
  };
  advanced: {
    accentColor: string;
    buttonColor: string;
    textColor: string;
    themeMode: "light" | "dark" | "system";
    profileStyle: "clutch" | "minimal" | "executive" | "glass";
    layout: "grid" | "stack" | "buttons";
    globalAlignment: "left" | "center" | "right";
    showCardShowcase: boolean;
    showLeadForm: boolean;
  };
};

const GLOBAL_ALIGNMENT_OPTIONS: Array<{ value: SetupDraft["advanced"]["globalAlignment"]; label: string; Icon: typeof AlignLeft }> = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
];

type WizardStepId = "basic" | "contact" | "links";

type SetupWizardProps = {
  customer: Record<string, any>;
  profile: Record<string, any> | null;
  links: Array<Record<string, any>>;
  builderConfig: BuilderConfig;
  starterLocked?: boolean;
};

const STORAGE_PREFIX = "clutch-connect-setup-draft";
const MAX_LINKS = 6;

const BEGINNER_LINK_ICON_MAP: Record<BeginnerConnectLinkType, typeof FaGlobe> = {
  website: FaGlobe,
  facebook: FaFacebook,
  instagram: FaInstagram,
  linkedin: FaLinkedin,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  google_business: FaGoogle,
  yelp: FaYelp,
  booking: FaCalendarAlt,
  email: FaEnvelope,
  phone: FaPhone,
  custom: FaLink,
};

const BEGINNER_LINK_TYPE_ORDER: BeginnerConnectLinkType[] = [
  "website",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "google_business",
  "yelp",
  "booking",
  "email",
  "phone",
  "custom",
];

const STEP_ORDER: Array<{ id: WizardStepId; label: string; note: string }> = [
  { id: "basic", label: "Basic Info + Banner", note: "Name, profile photo, first impression" },
  { id: "contact", label: "Contact Info", note: "Phone, email, website" },
  { id: "links", label: "Actions & Links", note: "Main button and quick links" },
];

const BANNER_THEME_OPTIONS: Array<{
  value: SetupDraft["basic"]["bannerTheme"];
  label: string;
  preview: string;
  accent: string;
  tone: string;
}> = [
  {
    value: "clean-studio",
    label: "Clean Studio",
    preview: "radial-gradient(120% 100% at 8% 4%, rgba(255,166,101,.28), transparent 58%), radial-gradient(95% 95% at 88% 10%, rgba(255,255,255,.62), transparent 60%), linear-gradient(140deg, #fffdf8 0%, #edf2f8 54%, #dbe5f0 100%)",
    accent: "#FFA665",
    tone: "Light, polished studio backdrop",
  },
  {
    value: "clutch-navy",
    label: "Clutch Navy",
    preview: "radial-gradient(110% 96% at 14% 8%, rgba(255,166,101,.26), transparent 56%), radial-gradient(88% 86% at 82% 10%, rgba(226,235,255,.12), transparent 62%), linear-gradient(136deg, #314760 0%, #1b2b3d 52%, #101b2a 100%)",
    accent: "#FFA665",
    tone: "Signature navy with warm highlight",
  },
  {
    value: "executive-dark",
    label: "Executive Dark",
    preview: "radial-gradient(116% 96% at 88% 8%, rgba(255,166,101,.18), transparent 52%), radial-gradient(94% 100% at 18% 18%, rgba(88,102,126,.18), transparent 58%), linear-gradient(140deg, #0f1724 0%, #161f2f 45%, #0a111d 100%)",
    accent: "#F6B06B",
    tone: "Premium dark boardroom feel",
  },
  {
    value: "warm-gradient",
    label: "Warm Gradient",
    preview: "radial-gradient(108% 92% at 16% 8%, rgba(244,248,255,.34), transparent 54%), radial-gradient(102% 96% at 82% 14%, rgba(255,194,138,.28), transparent 58%), linear-gradient(136deg, #2d4159 0%, #4f5f74 36%, #a46d4c 62%, #dd8a4d 100%)",
    accent: "#FF8A3A",
    tone: "High-contrast Clutch warmth",
  },
  {
    value: "soft-slate",
    label: "Soft Slate",
    preview: "radial-gradient(112% 96% at 84% 10%, rgba(255,178,120,.2), transparent 56%), radial-gradient(88% 90% at 24% 12%, rgba(255,255,255,.52), transparent 62%), linear-gradient(138deg, #eef3f8 0%, #dce4ee 52%, #c1cddc 100%)",
    accent: "#384862",
    tone: "Calm slate for clean brands",
  },
  {
    value: "orange-edge",
    label: "Orange Edge",
    preview: "radial-gradient(110% 94% at 8% 14%, rgba(255,214,182,.3), transparent 52%), radial-gradient(96% 88% at 86% 14%, rgba(183,206,242,.16), transparent 58%), linear-gradient(136deg, #f2964f 0%, #cf7a3f 35%, #6b4d4e 62%, #2a3d57 100%)",
    accent: "#FF7A1A",
    tone: "Bold orange edge with navy depth",
  },
];

const PRIMARY_ACTION_OPTIONS: Array<{ value: SetupDraft["action"]["primaryActionType"]; label: string; defaultLabel: string }> = [
  { value: "request_quote", label: "Request Quote", defaultLabel: "Request a Quote" },
  { value: "get_estimate", label: "Get Estimate", defaultLabel: "Get an Estimate" },
  { value: "book_appointment", label: "Book Appointment", defaultLabel: "Book an Appointment" },
  { value: "schedule_consultation", label: "Schedule Consultation", defaultLabel: "Schedule a Consultation" },
  { value: "request_info", label: "Request Info", defaultLabel: "Request Info" },
  { value: "contact_me", label: "Contact Me", defaultLabel: "Contact Me" },
  { value: "place_order", label: "Place an Order", defaultLabel: "Place an Order" },
  { value: "custom", label: "Custom", defaultLabel: "Contact Us" },
];

const QUICK_ADD_LINKS: Array<{ key: string; label: string; type: BeginnerConnectLinkType; defaultValue?: string }> = [
  { key: "website", label: "Website", type: "website" },
  { key: "instagram", label: "Instagram", type: "instagram" },
  { key: "facebook", label: "Facebook", type: "facebook" },
  { key: "quote", label: "Quote Request", type: "custom", defaultValue: "https://" },
  { key: "book", label: "Book Now", type: "booking", defaultValue: "https://" },
  { key: "custom", label: "Custom Link", type: "custom" },
];

function createLinkId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `link-${Math.random().toString(36).slice(2, 9)}`;
}

function createLinkDraft(type: BeginnerConnectLinkType = "website"): SetupLinkDraft {
  return {
    id: createLinkId(),
    type,
    label: getBeginnerConnectLinkSpec(type).label,
    value: "",
    visible: true,
  };
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function isValidOptionalHttpUrl(value: string) {
  return Boolean(normalizeOptionalHttpUrl(value) || !safeText(value));
}

function normalizeOptionalHttpUrl(value: string) {
  const raw = safeText(value);
  if (!raw) return "";
  if (/^(javascript|data|vbscript):/i.test(raw)) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function stripProtocolAndTrailingSlash(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function formatPreviewLinkDisplayValue(type: BeginnerConnectLinkType, value: string, href: string) {
  const raw = safeText(value) || safeText(href);
  if (!raw) return "";

  const normalized = stripProtocolAndTrailingSlash(raw);

  if (type === "instagram") return normalized.replace(/^www\./i, "").replace(/^instagram\.com\//i, "");
  if (type === "facebook") return normalized.replace(/^www\./i, "").replace(/^facebook\.com\//i, "");
  if (type === "linkedin") return normalized.replace(/^www\./i, "").replace(/^linkedin\.com\//i, "");
  if (type === "tiktok") return normalized.replace(/^www\./i, "").replace(/^tiktok\.com\//i, "");
  if (type === "youtube") return normalized.replace(/^www\./i, "").replace(/^youtube\.com\//i, "");
  if (type === "google_business") return normalized.replace(/^www\./i, "").replace(/^maps\.google\.com\/?/i, "");
  if (type === "yelp") return normalized.replace(/^www\./i, "").replace(/^yelp\.com\//i, "");

  return normalized;
}

function joinName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function getDefaultPrimaryActionLabel(type: SetupDraft["action"]["primaryActionType"]) {
  return PRIMARY_ACTION_OPTIONS.find((option) => option.value === type)?.defaultLabel || "Request a Quote";
}

function getBannerThemeSettings(theme: SetupDraft["basic"]["bannerTheme"]) {
  if (theme === "clean-studio") {
    return {
      type: "gradient" as const,
      theme,
      backgroundColor: "#edf2f8",
      gradientFrom: "#fffdf8",
      gradientTo: "#dbe5f0",
      overlayEnabled: false,
      overlayOpacity: 0,
    };
  }

  if (theme === "clutch-navy") {
    return {
      type: "gradient" as const,
      theme,
      backgroundColor: "#314760",
      gradientFrom: "#314760",
      gradientTo: "#101b2a",
      overlayEnabled: false,
      overlayOpacity: 0,
    };
  }

  if (theme === "executive-dark") {
    return {
      type: "gradient" as const,
      theme,
      backgroundColor: "#0f1724",
      gradientFrom: "#0f1724",
      gradientTo: "#0a111d",
      overlayEnabled: true,
      overlayOpacity: 0.1,
    };
  }

  if (theme === "warm-gradient") {
    return {
      type: "gradient" as const,
      theme,
      backgroundColor: "#3b4e66",
      gradientFrom: "#2d4159",
      gradientTo: "#dd8a4d",
      overlayEnabled: false,
      overlayOpacity: 0,
    };
  }

  if (theme === "soft-slate") {
    return {
      type: "gradient" as const,
      theme,
      backgroundColor: "#dce4ee",
      gradientFrom: "#eef3f8",
      gradientTo: "#c1cddc",
      overlayEnabled: false,
      overlayOpacity: 0,
    };
  }

  return {
    type: "gradient" as const,
    theme,
    backgroundColor: "#d88645",
    gradientFrom: "#f2964f",
    gradientTo: "#2a3d57",
    overlayEnabled: false,
    overlayOpacity: 0,
  };
}

function isBannerThemeValue(value: unknown): value is SetupDraft["basic"]["bannerTheme"] {
  return BANNER_THEME_OPTIONS.some((option) => option.value === value);
}

function normalizeBannerThemeValue(value: unknown): SetupDraft["basic"]["bannerTheme"] {
  if (isBannerThemeValue(value)) return value;
  if (value === "clean-light" || value === "minimal-gray") return "clean-studio";
  if (value === "modern-dark") return "executive-dark";
  return "clean-studio";
}

function getDraftPreviewName(draft: SetupDraft) {
  return safeText(draft.basic.displayName || joinName(draft.basic.firstName, draft.basic.lastName));
}

function getDraftPreviewOrganization(draft: SetupDraft) {
  return safeText(draft.basic.organization || draft.basic.businessName);
}

function getDraftPreviewRole(draft: SetupDraft) {
  return safeText(draft.basic.role || draft.basic.title);
}

function hasPreviewContent(draft: SetupDraft) {
  return Boolean(
    safeText(draft.basic.firstName) ||
    safeText(draft.basic.lastName) ||
    safeText(draft.basic.displayName) ||
    safeText(draft.basic.organization) ||
    safeText(draft.basic.role) ||
    normalizeOptionalHttpUrl(draft.basic.avatarUrl) ||
    safeText(draft.contact.phone) ||
    safeText(draft.contact.email) ||
    normalizeBeginnerConnectLinkHref("website", draft.contact.website) ||
    safeText(draft.contact.serviceArea) ||
    safeText(draft.action.primaryActionLabel) ||
    draft.links.some((link) => link.visible !== false && Boolean(normalizeBeginnerConnectLinkDraft(link).link))
  );
}

function toPreviewSlug(draft: SetupDraft, profile: Record<string, any> | null, customer: Record<string, any>) {
  const typedSlug = validateConnectSlug(draft.basic.slug, { allowEmpty: true }).slug;
  if (typedSlug) return typedSlug;

  const fallback = normalizeSlug(
    [
      draft.basic.organization,
      draft.basic.displayName,
      joinName(draft.basic.firstName, draft.basic.lastName),
      draft.basic.businessName,
      draft.basic.contactName,
      profile?.business_name,
      customer.company_name,
      customer.email,
    ]
      .filter(Boolean)
      .join("-")
  );

  if (fallback) return fallback;

  return buildDefaultProfileSlug(String(customer.company_name || customer.email || "Clutch Connect"));
}

function cloneConfig(config: BuilderConfig): BuilderConfig {
  return {
    ...config,
    theme: { ...config.theme },
    sections: config.sections.map((section) => ({
      ...section,
      blockIds: [...section.blockIds],
      style: { ...section.style },
    })),
    blocks: config.blocks.map((block) => ({
      ...block,
      data: block.data ? { ...block.data } : undefined,
      settings: block.settings ? { ...block.settings } : undefined,
    })),
    forms: config.forms.map((form) => ({
      ...form,
      fields: form.fields.map((field) => ({ ...field, options: field.options ? [...field.options] : undefined })),
    })),
  };
}

function updateBlockData(config: BuilderConfig, type: string, updater: (data: Record<string, any>) => Record<string, any>) {
  const hasBlock = config.blocks.some((block) => block.type === type);
  const blocks = hasBlock
    ? config.blocks.map((block) => {
        if (block.type !== type) return block;
        const nextData = updater({ ...(block.data || {}) });
        return {
          ...block,
          data: nextData,
          settings: nextData,
        };
      })
    : (() => {
        const nextData = updater({});
        return [
          ...config.blocks,
          {
            ...createBlock(type as any, config.blocks.length),
            data: nextData,
            settings: nextData,
          },
        ];
      })();

  return sanitizeBuilderConfig({
    ...config,
    blocks,
  });
}

function buildPreviewConfig(draft: SetupDraft, baseConfig: BuilderConfig) {
  const guidedPreviewBlockTypes = new Set([
    "avatar-block",
    "business-name-block",
    "subheader-block",
    "request-quote-button",
    "form-block",
    "phone-button",
    "email-button",
    "website-button",
    "directions-button",
    "social-media-links",
  ]);

  const nextConfig = cloneConfig(baseConfig);
  const previewName = getDraftPreviewName(draft);
  const previewOrganization = getDraftPreviewOrganization(draft);
  const previewRole = getDraftPreviewRole(draft);
  const previewAvatarUrl = normalizeOptionalHttpUrl(draft.basic.avatarUrl);
  const previewWebsite = normalizeBeginnerConnectLinkHref("website", draft.contact.website);
  const bannerThemeSettings = getBannerThemeSettings(draft.basic.bannerTheme);
  const normalizedBannerImageUrl = normalizeOptionalHttpUrl(draft.basic.bannerImageUrl);
  const useBannerImage = draft.basic.bannerMode === "image" && Boolean(normalizedBannerImageUrl);
  const primaryActionUrl = draft.action.primaryActionLeadCaptureEnabled
    ? "#lead-form"
    : normalizeOptionalHttpUrl(draft.action.primaryActionUrl);
  const linkData = draft.links
    .filter((link) => link.visible !== false)
    .map((link, index) => {
      const normalizedLink = normalizeBeginnerConnectLinkDraft(link, { index });
      if (!normalizedLink.link) return null;

      return {
        id: normalizedLink.link.id,
        label: normalizedLink.link.label,
        platform: normalizedLink.link.type,
        value: formatPreviewLinkDisplayValue(
          normalizedLink.link.type,
          normalizedLink.link.value,
          normalizedLink.link.href
        ),
        iconTreatment: "brand",
        visible: normalizedLink.link.visible,
        order: index,
      };
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  const updatedConfig = updateBlockData(nextConfig, "avatar-block", (data) => ({
    ...data,
    avatarUrl: previewAvatarUrl,
    avatarGlowEnabled: false,
    avatarGlowOpacity: 0,
    verifiedBadgeEnabled: false,
    avatarBorderEnabled: false,
    alignment: "center",
  }));

  const withBasicFields = updateBlockData(updatedConfig, "business-name-block", (data) => ({
    ...data,
    text: previewName || previewOrganization,
    alignment: "center",
  }));

  const withSubheader = updateBlockData(withBasicFields, "subheader-block", (data) => ({
    ...data,
    text: previewRole,
    alignment: "center",
  }));

  const withPrimaryAction = updateBlockData(withSubheader, "request-quote-button", (data) => ({
    ...data,
    label: draft.action.primaryActionLabel || getDefaultPrimaryActionLabel(draft.action.primaryActionType),
    url: primaryActionUrl,
    description: draft.action.primaryActionLeadCaptureEnabled
      ? "Tell us what you need"
      : "Opens your custom action URL.",
    icon: "bolt",
    isPrimaryAction: true,
    primaryActionType: draft.action.primaryActionType,
    primaryActionFormType: draft.action.primaryActionFormType,
    primaryActionLeadCaptureEnabled: draft.action.primaryActionLeadCaptureEnabled,
  }));

  const withLeadForm = updateBlockData(withPrimaryAction, "form-block", (data) => ({
    ...data,
    formLabel: draft.action.primaryActionLeadCaptureEnabled
      ? draft.action.primaryActionLabel || getDefaultPrimaryActionLabel(draft.action.primaryActionType)
      : "Contact Form",
    description: draft.action.primaryActionLeadCaptureEnabled
      ? "Tell us what you need"
      : "Lead capture is currently disabled.",
    submitText: draft.action.primaryActionLabel || getDefaultPrimaryActionLabel(draft.action.primaryActionType),
    leadCaptureEnabled: draft.action.primaryActionLeadCaptureEnabled,
    formType: draft.action.primaryActionFormType,
    source: "clutch_connect_profile",
    guidedLeadCapture: true,
  }));

  const withPhone = updateBlockData(withLeadForm, "phone-button", (data) => ({
    ...data,
    phone: draft.contact.phone,
    value: draft.contact.phone,
    label: data.label || "Call",
  }));

  const withEmail = updateBlockData(withPhone, "email-button", (data) => ({
    ...data,
    email: draft.contact.email,
    value: draft.contact.email,
    label: data.label || "Email",
  }));

  const withWebsite = updateBlockData(withEmail, "website-button", (data) => ({
    ...data,
    website: previewWebsite,
    url: previewWebsite,
    label: data.label || "Website",
  }));

  const withLinks = updateBlockData(withWebsite, "social-media-links", (data) => ({
    ...data,
    links: linkData,
    iconColorMode: "brand",
  }));

  const withDirections = updateBlockData(withLinks, "directions-button", (data) => ({
    ...data,
    label: data.label || "Directions",
      address: draft.contact.serviceArea,
    url: draft.contact.serviceArea
      ? `https://maps.google.com/?q=${encodeURIComponent(draft.contact.serviceArea)}`
        : "",
  }));

  const withContactVisibility = {
    ...withDirections,
    blocks: withDirections.blocks.map((block) => {
      if (block.type === "phone-button") {
        return { ...block, visible: draft.contact.showPhone };
      }
      if (block.type === "email-button") {
        return { ...block, visible: draft.contact.showEmail };
      }
      if (block.type === "website-button") {
        return { ...block, visible: draft.contact.showWebsite };
      }
      return block;
    }),
  };

  const guidedBlocks = withContactVisibility.blocks.filter((block) => guidedPreviewBlockTypes.has(String(block.type)));
  const guidedBlockIds = new Set(guidedBlocks.map((block) => block.id));

  const guidedSections = withContactVisibility.sections.map((section) => ({
    ...section,
    blockIds: section.blockIds.filter((id) => guidedBlockIds.has(id)),
  }));

  return sanitizeBuilderConfig({
    ...withContactVisibility,
    blocks: guidedBlocks,
    sections: guidedSections,
    theme: {
      ...withContactVisibility.theme,
      accentColor: "#111111",
      buttonColor: "#FFFFFF",
      textColor: "#111111",
      themeMode: "light",
      profileStyle: "minimal",
      layout: "compact",
      globalAlignment: draft.advanced.globalAlignment || "center",
      textAlign: draft.advanced.globalAlignment || "center",
      alignment: draft.advanced.globalAlignment || "center",
      banner: {
        ...withContactVisibility.theme.banner,
        enabled: draft.basic.bannerEnabled,
        type: useBannerImage ? "image" : bannerThemeSettings.type,
        theme: draft.basic.bannerTheme,
        imageUrl: useBannerImage ? normalizedBannerImageUrl : null,
        backgroundColor: bannerThemeSettings.backgroundColor,
        gradientFrom: bannerThemeSettings.gradientFrom,
        gradientTo: bannerThemeSettings.gradientTo,
        starterTheme: draft.basic.bannerTheme,
        sourceMode: draft.basic.bannerMode,
        uploadedImageUrl: normalizedBannerImageUrl || null,
        overlayEnabled: useBannerImage ? true : bannerThemeSettings.overlayEnabled,
        overlayOpacity: useBannerImage ? 0.2 : bannerThemeSettings.overlayOpacity,
        imagePosition: "center",
        height: 176,
        avatarOverlap: true,
        textAlign: "center",
      },
    },
  });
}

function buildInitialDraft(profile: Record<string, any> | null, customer: Record<string, any>, links: Array<Record<string, any>>, builderConfig: BuilderConfig): SetupDraft {
  const theme = builderConfig.theme;
  const rawGlobalAlignment = String((theme as any).globalAlignment || (theme as any).textAlign || (theme as any).alignment || "").toLowerCase();
  const initialGlobalAlignment: SetupDraft["advanced"]["globalAlignment"] =
    rawGlobalAlignment === "left" || rawGlobalAlignment === "right" ? (rawGlobalAlignment as SetupDraft["advanced"]["globalAlignment"]) : "center";
  const phoneBlock = builderConfig.blocks.find((block) => block.type === "phone-button");
  const emailBlock = builderConfig.blocks.find((block) => block.type === "email-button");
  const websiteBlock = builderConfig.blocks.find((block) => block.type === "website-button");
  const primaryActionBlock = builderConfig.blocks.find((block) => block.type === "request-quote-button" || block.type === "custom-link-button");
  const primaryActionData = (primaryActionBlock?.data || {}) as Record<string, any>;
  const formBlock = builderConfig.blocks.find((block) => block.type === "form-block");
  const formData = (formBlock?.data || {}) as Record<string, any>;
  const themeBanner = theme.banner || {};
  const hasProfile = Boolean(profile?.id);
  const defaultAccentColor = "#111111";
  const defaultButtonColor = "#FFFFFF";

  const initialBannerTheme: SetupDraft["basic"]["bannerTheme"] = (() => {
    const storedTheme = (themeBanner as any).theme || (themeBanner as any).starterTheme || (themeBanner as any).themeKey;
    if (isBannerThemeValue(storedTheme)) return storedTheme;

    const gradientFrom = safeText(themeBanner.gradientFrom).toLowerCase();
    const gradientTo = safeText(themeBanner.gradientTo).toLowerCase();
    const backgroundColor = safeText(themeBanner.backgroundColor).toLowerCase();

    if ((gradientFrom === "#fffdf8" && gradientTo === "#dbe5f0") || (gradientFrom === "#ffffff" && (gradientTo === "#edf2f8" || gradientTo === "#f1f3f7"))) {
      return "clean-studio";
    }
    if ((gradientFrom === "#314760" && gradientTo === "#101b2a") || (gradientFrom === "#384862" && (gradientTo === "#182638" || gradientTo === "#2f3c53"))) {
      return "clutch-navy";
    }
    if (gradientFrom === "#0f1724" || gradientTo === "#0a111d" || gradientFrom === "#101827" || gradientFrom === "#1d2634" || backgroundColor === "#1d2634" || backgroundColor === "#161f2d") {
      return "executive-dark";
    }
    if (themeBanner.type === "gradient" && (gradientTo.includes("ffa665") || gradientTo === "#ff8a3a" || gradientTo === "#dd8a4d")) {
      return "warm-gradient";
    }
    if (gradientFrom === "#eef3f8" || gradientTo === "#c1cddc" || backgroundColor === "#d8e1eb" || backgroundColor === "#dce4ee" || backgroundColor === "#dfe4eb" || backgroundColor === "#cfd6e0") {
      return "soft-slate";
    }
    if (gradientFrom === "#f2964f" || gradientTo === "#2a3d57" || gradientFrom === "#ff7a1a" || backgroundColor === "#ff7a1a") {
      return "orange-edge";
    }
    return "clean-studio";
  })();
  const initialBannerImageUrl = safeText((themeBanner as any).uploadedImageUrl || themeBanner.imageUrl || profile?.cover_url || "");
  const initialBannerMode: SetupDraft["basic"]["bannerMode"] = (themeBanner as any).sourceMode === "image" && initialBannerImageUrl
    ? "image"
    : "theme";

  const actionType = String(primaryActionData.primaryActionType || "request_quote").toLowerCase() as SetupDraft["action"]["primaryActionType"];
  const actionLabel = safeText(primaryActionData.label || formData.submitText || "") || getDefaultPrimaryActionLabel(actionType);
  const leadCaptureEnabled = primaryActionData.primaryActionLeadCaptureEnabled !== false && profile?.show_lead_form !== false;
  const formTypeRaw = String(primaryActionData.primaryActionFormType || formData.formType || "quote_request").toLowerCase();
  const formType: SetupDraft["action"]["primaryActionFormType"] =
    formTypeRaw === "basic_contact" || formTypeRaw === "appointment_request" || formTypeRaw === "general_inquiry"
      ? (formTypeRaw as SetupDraft["action"]["primaryActionFormType"])
      : "quote_request";

  return {
    basic: {
      firstName: safeText(hasProfile ? customer.first_name || "" : ""),
      lastName: safeText(hasProfile ? customer.last_name || "" : ""),
      displayName: safeText(profile?.contact_name || ""),
      organization: safeText(profile?.business_name || ""),
      role: safeText(profile?.title || ""),
      avatarUrl: safeText(profile?.avatar_url || ""),
      businessName: safeText(profile?.business_name || ""),
      contactName: safeText(profile?.contact_name || ""),
      title: safeText(profile?.title || ""),
      slug: safeText(profile?.slug || ""),
      bannerTheme: initialBannerTheme,
      bannerMode: initialBannerMode,
      bannerImageUrl: initialBannerImageUrl,
      bannerImageAlt: safeText(primaryActionData.bannerImageAlt || "Profile banner"),
      bannerEnabled: themeBanner.enabled !== false,
    },
    contact: {
      phone: safeText(profile?.phone || ""),
      email: safeText(profile?.email || ""),
      website: safeText(profile?.website || ""),
      bio: safeText(profile?.bio || ""),
      serviceArea: safeText(profile?.location || profile?.address || ""),
      showPhone: phoneBlock?.visible !== false,
      showEmail: emailBlock?.visible !== false,
      showWebsite: websiteBlock?.visible !== false,
    },
    links: links.length
      ? links.map((link) => ({
          id: safeText(link.id) || createLinkId(),
          type: normalizeBeginnerConnectLinkType(link.platform || link.type || link.icon || "custom"),
          label: safeText(link.label || getBeginnerConnectLinkSpec(normalizeBeginnerConnectLinkType(link.platform || link.type || link.icon || "custom")).label),
          value: safeText(link.url || link.value || ""),
          visible: link.is_active !== false,
        }))
      : [],
    action: {
      primaryActionType: actionType,
      primaryActionLabel: actionLabel,
      primaryActionLeadCaptureEnabled: leadCaptureEnabled,
      primaryActionFormType: formType,
      primaryActionUrl: safeText(primaryActionData.url || ""),
    },
    advanced: {
      accentColor: defaultAccentColor,
      buttonColor: defaultButtonColor,
      textColor: "#111111",
      themeMode: "light",
      profileStyle: "minimal",
      layout: "buttons",
      globalAlignment: initialGlobalAlignment,
      showCardShowcase: profile?.show_card_showcase ?? false,
      showLeadForm: profile?.show_lead_form ?? true,
    },
  };
}

function normalizeRecoveredDraft(rawDraft: unknown, fallbackDraft: SetupDraft): SetupDraft {
  const raw = rawDraft && typeof rawDraft === "object" ? (rawDraft as Record<string, any>) : {};
  const rawBasic = raw.basic && typeof raw.basic === "object" ? (raw.basic as Record<string, any>) : {};
  const rawContact = raw.contact && typeof raw.contact === "object" ? (raw.contact as Record<string, any>) : {};
  const rawAction = raw.action && typeof raw.action === "object" ? (raw.action as Record<string, any>) : {};
  const rawAdvanced = raw.advanced && typeof raw.advanced === "object" ? (raw.advanced as Record<string, any>) : {};

  const normalizedLinks = Array.isArray(raw.links)
    ? raw.links
      .map((link, index) => {
        const rawLink = link && typeof link === "object" ? (link as Record<string, any>) : null;
        if (!rawLink) return null;
        const type = normalizeBeginnerConnectLinkType(rawLink.type);
        return {
          id: safeText(rawLink.id) || createLinkId(),
          type,
          label: safeText(rawLink.label) || getBeginnerConnectLinkSpec(type).label,
          value: safeText(rawLink.value || rawLink.url),
          visible: rawLink.visible !== false,
          order: index,
        };
      })
      .filter((link): link is SetupLinkDraft & { order: number } => Boolean(link))
      .sort((a, b) => a.order - b.order)
      .map((link) => ({
        id: link.id,
        type: link.type,
        label: link.label,
        value: link.value,
        visible: link.visible,
      }))
    : [];

  const fallbackName = joinName(fallbackDraft.basic.firstName, fallbackDraft.basic.lastName);

  return {
    basic: {
      firstName: safeText(rawBasic.firstName || fallbackDraft.basic.firstName),
      lastName: safeText(rawBasic.lastName || fallbackDraft.basic.lastName),
      displayName: safeText(rawBasic.displayName || rawBasic.contactName || fallbackDraft.basic.displayName),
      organization: safeText(rawBasic.organization || rawBasic.businessName || fallbackDraft.basic.organization),
      role: safeText(rawBasic.role || rawBasic.title || fallbackDraft.basic.role),
      avatarUrl: safeText(rawBasic.avatarUrl || fallbackDraft.basic.avatarUrl),
      businessName: safeText(rawBasic.businessName || rawBasic.organization || fallbackDraft.basic.businessName),
      contactName: safeText(rawBasic.contactName || rawBasic.displayName || fallbackName || fallbackDraft.basic.contactName),
      title: safeText(rawBasic.title || rawBasic.role || fallbackDraft.basic.title),
      slug: safeText(rawBasic.slug || fallbackDraft.basic.slug),
      bannerTheme: isBannerThemeValue(rawBasic.bannerTheme) || rawBasic.bannerTheme === "clean-light" || rawBasic.bannerTheme === "modern-dark" || rawBasic.bannerTheme === "minimal-gray"
        ? normalizeBannerThemeValue(rawBasic.bannerTheme)
        : fallbackDraft.basic.bannerTheme,
      bannerMode: rawBasic.bannerMode === "image" || rawBasic.bannerMode === "theme"
        ? rawBasic.bannerMode
        : fallbackDraft.basic.bannerMode,
      bannerImageUrl: safeText(rawBasic.bannerImageUrl || fallbackDraft.basic.bannerImageUrl),
      bannerImageAlt: safeText(rawBasic.bannerImageAlt || fallbackDraft.basic.bannerImageAlt),
      bannerEnabled: rawBasic.bannerEnabled !== false,
    },
    contact: {
      phone: safeText(rawContact.phone || fallbackDraft.contact.phone),
      email: safeText(rawContact.email || fallbackDraft.contact.email),
      website: safeText(rawContact.website || fallbackDraft.contact.website),
      bio: safeText(rawContact.bio || fallbackDraft.contact.bio),
      serviceArea: safeText(rawContact.serviceArea || fallbackDraft.contact.serviceArea),
      showPhone: rawContact.showPhone !== false,
      showEmail: rawContact.showEmail !== false,
      showWebsite: rawContact.showWebsite !== false,
    },
    links: normalizedLinks.length ? normalizedLinks : fallbackDraft.links,
    action: {
      primaryActionType:
        rawAction.primaryActionType === "request_quote" ||
        rawAction.primaryActionType === "get_estimate" ||
        rawAction.primaryActionType === "book_appointment" ||
        rawAction.primaryActionType === "schedule_consultation" ||
        rawAction.primaryActionType === "request_info" ||
        rawAction.primaryActionType === "contact_me" ||
        rawAction.primaryActionType === "place_order" ||
        rawAction.primaryActionType === "custom"
          ? rawAction.primaryActionType
          : fallbackDraft.action.primaryActionType,
      primaryActionLabel: safeText(rawAction.primaryActionLabel || fallbackDraft.action.primaryActionLabel),
      primaryActionLeadCaptureEnabled: rawAction.primaryActionLeadCaptureEnabled !== false,
      primaryActionFormType:
        rawAction.primaryActionFormType === "basic_contact" ||
        rawAction.primaryActionFormType === "quote_request" ||
        rawAction.primaryActionFormType === "appointment_request" ||
        rawAction.primaryActionFormType === "general_inquiry"
          ? rawAction.primaryActionFormType
          : fallbackDraft.action.primaryActionFormType,
      primaryActionUrl: safeText(rawAction.primaryActionUrl || fallbackDraft.action.primaryActionUrl),
    },
    advanced: {
      accentColor: safeText(rawAdvanced.accentColor || fallbackDraft.advanced.accentColor) || fallbackDraft.advanced.accentColor,
      buttonColor: safeText(rawAdvanced.buttonColor || fallbackDraft.advanced.buttonColor) || fallbackDraft.advanced.buttonColor,
      textColor: safeText(rawAdvanced.textColor || fallbackDraft.advanced.textColor) || fallbackDraft.advanced.textColor,
      themeMode: rawAdvanced.themeMode === "light" || rawAdvanced.themeMode === "dark" ? rawAdvanced.themeMode : fallbackDraft.advanced.themeMode,
      profileStyle: rawAdvanced.profileStyle === "minimal" || rawAdvanced.profileStyle === "executive" || rawAdvanced.profileStyle === "glass" || rawAdvanced.profileStyle === "clutch"
        ? rawAdvanced.profileStyle
        : fallbackDraft.advanced.profileStyle,
      layout: rawAdvanced.layout === "stack" || rawAdvanced.layout === "buttons" || rawAdvanced.layout === "grid"
        ? rawAdvanced.layout
        : fallbackDraft.advanced.layout,
      globalAlignment: rawAdvanced.globalAlignment === "left" || rawAdvanced.globalAlignment === "right" || rawAdvanced.globalAlignment === "center"
        ? rawAdvanced.globalAlignment
        : fallbackDraft.advanced.globalAlignment,
      showCardShowcase: rawAdvanced.showCardShowcase !== false,
      showLeadForm: rawAdvanced.showLeadForm !== false,
    },
  };
}

function makeStepErrors(step: WizardStepId, draft: SetupDraft) {
  const errors: Record<string, string> = {};
  if (step === "basic") {
    const slugDraft = safeText(draft.basic.slug);
    const slugCheck = validateConnectSlug(slugDraft, { allowEmpty: true });
    if (slugDraft && !slugCheck.valid) {
      errors.slug = slugCheck.message;
    }
    const hasOrganization = safeText(draft.basic.organization || draft.basic.businessName);
    const hasPerson = safeText(draft.basic.displayName || joinName(draft.basic.firstName, draft.basic.lastName) || draft.basic.contactName);
    if (!hasOrganization && !hasPerson) {
      errors.businessName = "Add a business name or contact name.";
    }
    if (!isValidOptionalHttpUrl(draft.basic.avatarUrl)) {
      errors.avatarUrl = "Use a valid http or https image URL.";
    }
    if (!isValidOptionalHttpUrl(draft.basic.bannerImageUrl)) {
      errors.bannerImageUrl = "Use a valid banner image URL.";
    }
  }

  if (step === "contact") {
    if (draft.contact.email && !/^\S+@\S+\.\S+$/.test(draft.contact.email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!isValidOptionalHttpUrl(draft.contact.website)) {
      errors.website = "Use a valid website URL.";
    }
  }

  if (step === "links") {
    if (!draft.action.primaryActionLabel.trim()) {
      errors.primaryActionLabel = "Add a primary action button label.";
    }

    if (!draft.action.primaryActionLeadCaptureEnabled && draft.action.primaryActionUrl.trim() && !isValidOptionalHttpUrl(draft.action.primaryActionUrl)) {
      errors.primaryActionUrl = "Use a valid action URL.";
    }

    if (!draft.action.primaryActionLeadCaptureEnabled && !draft.action.primaryActionUrl.trim()) {
      errors.primaryActionUrl = "Add an action URL when lead capture is turned off.";
    }

    draft.links.forEach((link, index) => {
      if (link.visible === false && !link.label.trim() && !link.value.trim()) {
        return;
      }

      if (link.visible !== false && (!link.label.trim() || !link.value.trim())) {
        errors[`link-${index}`] = "Each visible link needs a label and a destination.";
        return;
      }

      if (link.value.trim()) {
        const normalized = normalizeBeginnerConnectLinkDraft(link, { index });
        if (!normalized.link) {
          errors[`link-${index}`] = normalized.error;
        }
      }
    });
  }

  return errors;
}

function makePublishErrors(draft: SetupDraft) {
  return {
    ...makeStepErrors("basic", draft),
    ...makeStepErrors("contact", draft),
    ...makeStepErrors("links", draft),
  };
}

function useDebouncedValue<T>(value: T, delayMs = 160) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

export default function ConnectSetupWizard({ customer, profile, links, builderConfig, starterLocked = false }: SetupWizardProps) {
  const router = useRouter();
  const storageKey = `${STORAGE_PREFIX}:${profile?.id || customer.id}`;
  const [draft, setDraft] = useState<SetupDraft>(() => buildInitialDraft(profile, customer, links, builderConfig));
  const [currentStep, setCurrentStep] = useState<WizardStepId>("basic");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);
  const [showMoreLinkTypes, setShowMoreLinkTypes] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const debouncedPreviewDraft = useDebouncedValue(draft, 160);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setHydratedFromStorage(true);
        return;
      }

      const parsed = JSON.parse(raw) as { draft?: SetupDraft };
      if (parsed?.draft) {
        setDraft((current) => normalizeRecoveredDraft(parsed.draft, current));
        setSaveMessage("Recovered your last unsaved draft.");
      }
    } catch {
      // Ignore local draft parse errors.
    } finally {
      setHydratedFromStorage(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydratedFromStorage || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ draft }));
    } catch {
      // Ignore storage write failures.
    }
  }, [draft, hydratedFromStorage, storageKey]);

  const previewSlug = useMemo(() => toPreviewSlug(debouncedPreviewDraft, profile, customer), [debouncedPreviewDraft, profile, customer]);
  const previewHasContent = useMemo(() => hasPreviewContent(debouncedPreviewDraft), [debouncedPreviewDraft]);
  const previewProfile = useMemo(() => ({
    ...profile,
    business_name: getDraftPreviewOrganization(debouncedPreviewDraft),
    contact_name: getDraftPreviewName(debouncedPreviewDraft),
    title: getDraftPreviewRole(debouncedPreviewDraft),
    phone: debouncedPreviewDraft.contact.phone,
    email: debouncedPreviewDraft.contact.email,
    website: normalizeBeginnerConnectLinkHref("website", debouncedPreviewDraft.contact.website),
    bio: debouncedPreviewDraft.contact.bio,
    avatar_url: normalizeOptionalHttpUrl(debouncedPreviewDraft.basic.avatarUrl),
    cover_url: debouncedPreviewDraft.basic.bannerMode === "image" ? normalizeOptionalHttpUrl(debouncedPreviewDraft.basic.bannerImageUrl) : null,
    location: debouncedPreviewDraft.contact.serviceArea,
    slug: previewSlug,
    theme_color: debouncedPreviewDraft.advanced.accentColor,
    builder_config: buildPreviewConfig(debouncedPreviewDraft, builderConfig),
    is_active: profile?.is_active ?? true,
  }), [builderConfig, debouncedPreviewDraft, previewSlug, profile]);

  const previewConfig = useMemo(() => buildPreviewConfig(debouncedPreviewDraft, builderConfig), [builderConfig, debouncedPreviewDraft]);

  const currentStepIndex = STEP_ORDER.findIndex((step) => step.id === currentStep);
  const progress = Math.round(((currentStepIndex + 1) / STEP_ORDER.length) * 100);

  const updateDraft = (patch: Partial<SetupDraft>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
      basic: { ...current.basic, ...(patch.basic || {}) },
      contact: { ...current.contact, ...(patch.contact || {}) },
      action: { ...current.action, ...(patch.action || {}) },
      advanced: { ...current.advanced, ...(patch.advanced || {}) },
      links: patch.links || current.links,
    }));
    setSaveState("idle");
    setSaveMessage(null);
    setFieldErrors({});
  };

  const updateLink = (index: number, key: "type" | "label" | "value" | "visible", value: string | boolean) => {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link, linkIndex) => (linkIndex === index ? { ...link, [key]: value } : link)),
    }));
    setSaveState("idle");
    setSaveMessage(null);
    setFieldErrors({});
  };

  const addLink = (type: BeginnerConnectLinkType = "website") => {
    setDraft((current) => {
      if (current.links.length >= MAX_LINKS) return current;
      return {
        ...current,
        links: [...current.links, createLinkDraft(type)],
      };
    });
    setSaveState("idle");
    setSaveMessage(null);
  };

  const addPresetLink = (type: BeginnerConnectLinkType, label?: string, value?: string) => {
    setDraft((current) => {
      if (current.links.length >= MAX_LINKS) return current;
      const base = createLinkDraft(type);
      return {
        ...current,
        links: [
          ...current.links,
          {
            ...base,
            label: label || base.label,
            value: value || base.value,
          },
        ],
      };
    });
    setSaveState("idle");
    setSaveMessage(null);
  };

  const removeLink = (index: number) => {
    setDraft((current) => ({
      ...current,
      links: current.links.filter((_, linkIndex) => linkIndex !== index),
    }));
    setSaveState("idle");
    setSaveMessage(null);
  };

  const persistDraft = async (nextRoute?: "builder" | "complete") => {
    const stepErrors = nextRoute === "complete" ? makePublishErrors(draft) : makeStepErrors(currentStep, draft);
    setFieldErrors(stepErrors);

    if (Object.keys(stepErrors).length) {
      setSaveState("error");
      setSaveMessage("Please fix the highlighted fields before continuing.");
      return false;
    }

    setSaveState("saving");
    setSaveMessage("Saving your draft...");

    const payloadLinks = draft.links
      .filter((link) => link.visible !== false || link.label.trim() || link.value.trim())
      .map((link) => ({
        id: link.id,
        type: normalizeBeginnerConnectLinkType(link.type),
        label: link.label,
        value: link.value,
        visible: link.visible !== false,
      }));

    const response = await fetch("/api/connect/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-clutch-fetch": "true",
      },
      body: JSON.stringify({
        profile: {
          firstName: draft.basic.firstName,
          lastName: draft.basic.lastName,
          displayName: draft.basic.displayName,
          organization: draft.basic.organization,
          role: draft.basic.role,
          avatarUrl: draft.basic.avatarUrl,
          bannerTheme: draft.basic.bannerTheme,
          bannerMode: draft.basic.bannerMode,
          bannerImageUrl: draft.basic.bannerImageUrl,
          bannerImageAlt: draft.basic.bannerImageAlt,
          bannerEnabled: draft.basic.bannerEnabled,
          businessName: draft.basic.organization || draft.basic.businessName,
          contactName: draft.basic.displayName || joinName(draft.basic.firstName, draft.basic.lastName) || draft.basic.contactName,
          title: draft.basic.role || draft.basic.title,
          slug: draft.basic.slug,
          phone: draft.contact.phone,
          email: draft.contact.email,
          website: draft.contact.website,
          bio: draft.contact.bio,
          serviceArea: draft.contact.serviceArea,
          showPhone: draft.contact.showPhone,
          showEmail: draft.contact.showEmail,
          showWebsite: draft.contact.showWebsite,
          primaryActionType: draft.action.primaryActionType,
          primaryActionLabel: draft.action.primaryActionLabel,
          primaryActionLeadCaptureEnabled: draft.action.primaryActionLeadCaptureEnabled,
          primaryActionFormType: draft.action.primaryActionFormType,
          primaryActionUrl: draft.action.primaryActionUrl,
        },
        advanced: {
          ...draft.advanced,
          showLeadForm: draft.action.primaryActionLeadCaptureEnabled,
          globalAlignment: draft.advanced.globalAlignment,
        },
        links: payloadLinks,
        publish: nextRoute === "complete",
        completeSetup: nextRoute === "complete",
        nextRoute: nextRoute || null,
        publishRequested: nextRoute === "complete",
        validateLinks: currentStep === "links" || nextRoute === "complete",
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (nextRoute === "complete") {
        console.error("Guided setup publish failed", payload);
      }
      setSaveState("error");
      setFieldErrors(payload.fieldErrors || {});
      setSaveMessage(payload.detail || payload.error || "We could not save the draft.");
      return false;
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ draft }));
      } catch {
        // Ignore write failures.
      }
    }

    setSaveState("saved");
    setSaveMessage("Draft saved.");
    setFieldErrors({});

    if (nextRoute === "builder") {
      router.push("/portal/connect/build?saved=1");
      return true;
    }

    if (nextRoute === "complete") {
      router.push(payload.redirectTo || "/portal/connect");
      return true;
    }

    return true;
  };

  const continueToNextStep = async () => {
    const saved = await persistDraft();
    if (!saved) return;

    const currentIndex = STEP_ORDER.findIndex((step) => step.id === currentStep);
    const nextStep = STEP_ORDER[Math.min(currentIndex + 1, STEP_ORDER.length - 1)]?.id || currentStep;
    setCurrentStep(nextStep);
  };

  const previousStep = () => {
    const currentIndex = STEP_ORDER.findIndex((step) => step.id === currentStep);
    const nextStep = STEP_ORDER[Math.max(currentIndex - 1, 0)]?.id || currentStep;
    setCurrentStep(nextStep);
  };

  const saveAndExit = async () => {
    const saved = await persistDraft();
    if (!saved) return;
    router.push("/portal/connect");
  };

  const uploadAvatarFile = async (file: File) => {
    if (!file) return;

    const heicTypes = ["image/heic", "image/heif"];
    if (heicTypes.includes(file.type)) {
      setAvatarUploadError("HEIC photos are not supported yet. Please upload PNG, JPG, or WebP.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarUploadError("Profile photo must be PNG, JPG, WebP, or SVG.");
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAvatarUploadError("Profile photo must be 2MB or smaller.");
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarUploadError(null);

    try {
      const form = new FormData();
      form.append("avatar", file);
      const response = await fetch("/api/connect/avatar", {
        method: "POST",
        body: form,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Avatar upload failed.");
      }

      const avatarUrl = result.avatar_url;
      if (!avatarUrl) {
        throw new Error("Avatar upload did not return a public image URL.");
      }

      updateDraft({ basic: { ...draft.basic, avatarUrl } });
      setSaveMessage("Profile photo uploaded.");
    } catch (error) {
      setAvatarUploadError(error instanceof Error ? error.message : "Avatar upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAvatarFile(file);
    event.target.value = "";
  };

  const uploadBannerFile = async (file: File) => {
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setBannerUploadError("Banner image must be PNG, JPG, WebP, or SVG.");
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setBannerUploadError("Banner image must be 2MB or smaller.");
      return;
    }

    setIsUploadingBanner(true);
    setBannerUploadError(null);

    try {
      const formData = new FormData();
      formData.append("banner", file);

      const response = await fetch("/api/connect/banner-image", {
        method: "POST",
        body: formData,
        headers: {
          accept: "application/json",
          "x-clutch-fetch": "true",
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to upload banner image.");
      }

      updateDraft({
        basic: {
          ...draft.basic,
          bannerImageUrl: safeText(result.imageUrl || ""),
          bannerMode: "image",
          bannerEnabled: true,
        },
      });
      setSaveMessage("Banner image uploaded.");
    } catch (error) {
      setBannerUploadError(error instanceof Error ? error.message : "Banner upload failed.");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleBannerFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadBannerFile(file);
    event.target.value = "";
  };

  const finalStep = currentStep === "links";

  return (
    <section className="connect-setup-shell">
      <header className="connect-setup-header-card">
        <div className="connect-setup-header-copy">
          <h1>Clutch Connect Setup</h1>
          <p>Complete the basics and publish your profile.</p>
        </div>
        <div className="connect-setup-header-actions">
          <span className="connect-setup-save-badge">{saveState === "saving" ? "Saving draft..." : saveState === "saved" ? "Draft saved" : "Draft auto-saved"}</span>
          <button type="button" className="btn secondary connect-setup-save-exit-btn" onClick={saveAndExit} disabled={saveState === "saving"}>
            Save & Exit
          </button>
        </div>
      </header>

      <div className="connect-setup-progress-wrap">
        <div className="connect-setup-stepper-mobile" aria-live="polite">
          <div className="connect-setup-stepper-mobile-top">
            <span>Step {currentStepIndex + 1} of {STEP_ORDER.length}</span>
            <strong>{STEP_ORDER[currentStepIndex]?.label}</strong>
          </div>
          <div className="connect-setup-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="connect-setup-stepper" role="tablist" aria-label="Setup steps">
          {STEP_ORDER.map((step, index) => {
            const isActive = step.id === currentStep;
            const isComplete = currentStepIndex > index;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`connect-setup-step${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
                onClick={async () => {
                  if (step.id === currentStep) return;
                  if (index > currentStepIndex) {
                    const saved = await persistDraft();
                    if (!saved) return;
                  }
                  setCurrentStep(step.id);
                }}
              >
                <span>{isComplete ? <Check size={13} /> : index + 1}</span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
          <div className={`connect-setup-step connect-setup-step-publish${finalStep ? " is-active" : ""}`} aria-hidden="true">
            <span>4</span>
            <strong>Publish</strong>
          </div>
        </div>
      </div>

      <div className="connect-setup-layout">
        <div className="connect-setup-form-column">
          <div className="connect-setup-card" data-current-step={currentStep}>
            {currentStep === "basic" ? (
              <div className="connect-setup-panel">
                <div className="connect-setup-panel-head">
                  <p className="eyebrow">Step 1</p>
                  <h3>Basic Info + Banner</h3>
                  <p>Name, profile photo, and first impression.</p>
                </div>

                <div className="connect-setup-grid">
                  <section className="connect-setup-section-group connect-setup-span-2" aria-label="Profile Basics section">
                    <div className="connect-setup-section-head">
                      <h4>Profile Basics</h4>
                    </div>
                    <div className="connect-setup-section-grid">
                      <label className="label connect-setup-span-2">
                        Display name
                        <input
                          className="input"
                          value={draft.basic.displayName}
                          onChange={(event) => updateDraft({ basic: { ...draft.basic, displayName: event.target.value } })}
                          placeholder="Jordan Smith"
                        />
                      </label>

                      <label className="label">
                        Organization
                        <input
                          className="input"
                          value={draft.basic.organization}
                          onChange={(event) => updateDraft({ basic: { ...draft.basic, organization: event.target.value } })}
                          placeholder="Clutch Print Shop"
                        />
                        {fieldErrors.businessName ? <span className="helper-text connect-setup-error-text">{fieldErrors.businessName}</span> : null}
                      </label>

                      <label className="label">
                        Role or headline
                        <input
                          className="input"
                          value={draft.basic.role}
                          onChange={(event) => updateDraft({ basic: { ...draft.basic, role: event.target.value } })}
                          placeholder="Founder, Sales lead, Brand strategist"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="connect-setup-section-group connect-setup-span-2" aria-label="Profile Photo section">
                    <div className="connect-setup-section-head">
                      <h4>Profile Photo</h4>
                    </div>
                    <label className="label connect-setup-span-2">
                      Profile photo
                      <div className="connect-setup-avatar-row">
                        <div className="connect-setup-avatar-preview">
                          {normalizeOptionalHttpUrl(draft.basic.avatarUrl)
                            ? <img src={normalizeOptionalHttpUrl(draft.basic.avatarUrl)} alt="Profile preview" />
                            : <span>{safeText(draft.basic.displayName).slice(0, 1).toUpperCase() || "C"}</span>}
                        </div>
                        <div className="connect-setup-avatar-actions">
                          <label className="btn secondary connect-setup-upload-btn" aria-disabled={isUploadingAvatar}>
                            <ImagePlus size={14} />
                            {isUploadingAvatar ? "Uploading..." : "Upload photo"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                              onChange={handleAvatarFile}
                              disabled={isUploadingAvatar}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => updateDraft({ basic: { ...draft.basic, avatarUrl: "" } })}
                            disabled={isUploadingAvatar || !draft.basic.avatarUrl}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <span className="helper-text">PNG, JPG, WebP, or SVG up to 2MB.</span>
                      {avatarUploadError ? <span className="helper-text connect-setup-error-text">{avatarUploadError}</span> : null}
                      {fieldErrors.avatarUrl ? <span className="helper-text connect-setup-error-text">{fieldErrors.avatarUrl}</span> : null}
                    </label>
                  </section>

                  <section className="connect-setup-section-group connect-setup-span-2" aria-label="Banner Style section">
                    <div className="connect-setup-section-head">
                      <h4>Banner Style</h4>
                    </div>
                    <div className="label connect-setup-span-2">
                      Banner theme
                      <div className="connect-setup-banner-theme-grid">
                        {BANNER_THEME_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`connect-setup-banner-theme-card${draft.basic.bannerTheme === option.value && draft.basic.bannerMode === "theme" ? " is-active" : ""}`}
                            style={{ ["--banner-theme-preview" as any]: option.preview, ["--banner-theme-accent" as any]: option.accent }}
                            aria-pressed={draft.basic.bannerTheme === option.value && draft.basic.bannerMode === "theme"}
                            onClick={() => updateDraft({ basic: { ...draft.basic, bannerTheme: option.value, bannerMode: "theme", bannerEnabled: true } })}
                          >
                            <span className="connect-setup-banner-theme-preview" aria-hidden="true" />
                            <span className="connect-setup-banner-theme-copy">
                              <strong>{option.label}</strong>
                              <small>{option.tone}</small>
                            </span>
                            {draft.basic.bannerTheme === option.value && draft.basic.bannerMode === "theme" ? (
                              <span className="connect-setup-banner-selected-pill"><Check size={12} />Selected</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="label connect-setup-span-2">
                      Banner source
                      <div className="connect-setup-banner-mode-toggle" role="group" aria-label="Banner source">
                        <button
                          type="button"
                          className={draft.basic.bannerMode === "theme" ? "is-active" : ""}
                          aria-pressed={draft.basic.bannerMode === "theme"}
                          onClick={() => updateDraft({ basic: { ...draft.basic, bannerMode: "theme", bannerEnabled: true } })}
                        >
                          Use Theme
                        </button>
                        <button
                          type="button"
                          className={draft.basic.bannerMode === "image" ? "is-active" : ""}
                          aria-pressed={draft.basic.bannerMode === "image"}
                          onClick={() => updateDraft({ basic: { ...draft.basic, bannerMode: "image", bannerEnabled: true } })}
                          disabled={!normalizeOptionalHttpUrl(draft.basic.bannerImageUrl)}
                        >
                          Use Uploaded Image
                        </button>
                      </div>
                      {!normalizeOptionalHttpUrl(draft.basic.bannerImageUrl) ? (
                        <span className="helper-text">Upload a banner image to enable image mode.</span>
                      ) : null}
                    </div>

                    <label className="label connect-setup-span-2">
                      Banner Image
                      <div className="connect-setup-banner-upload-row">
                        <label className="btn secondary connect-setup-upload-btn" aria-disabled={isUploadingBanner}>
                          <ImagePlus size={14} />
                          {isUploadingBanner ? "Uploading..." : "Upload Banner"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                            onChange={handleBannerFile}
                            disabled={isUploadingBanner}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => updateDraft({ basic: { ...draft.basic, bannerImageUrl: "", bannerMode: "theme", bannerEnabled: true } })}
                          disabled={isUploadingBanner || !draft.basic.bannerImageUrl}
                        >
                          Remove Banner
                        </button>
                      </div>
                      <span className="helper-text">Upload a wide image for the top of your profile, or switch back to a theme without deleting the upload.</span>
                      {bannerUploadError ? <span className="helper-text connect-setup-error-text">{bannerUploadError}</span> : null}
                      {fieldErrors.bannerImageUrl ? <span className="helper-text connect-setup-error-text">{fieldErrors.bannerImageUrl}</span> : null}
                    </label>
                  </section>

                  <section className="connect-setup-section-group connect-setup-span-2" aria-label="Profile Link section">
                    <div className="connect-setup-section-head">
                      <h4>Profile Link</h4>
                    </div>
                    <label className="label connect-setup-span-2">
                      Custom slug
                      <div className="connect-setup-slug-row">
                        <span>clutchconnect.link/</span>
                        <input
                          className="input"
                          value={draft.basic.slug}
                          onChange={(event) => updateDraft({ basic: { ...draft.basic, slug: event.target.value } })}
                          placeholder={previewSlug}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                      <span className="helper-text">Leave this blank and we will auto-generate a clean slug for you.</span>
                      {!fieldErrors.slug ? <span className="helper-text">System and brand words like clutchprintshop are reserved and cannot be claimed.</span> : null}
                      {fieldErrors.slug ? <span className="helper-text connect-setup-error-text">{fieldErrors.slug}</span> : null}
                      {!fieldErrors.slug ? <span className="helper-text">Preview: {buildConnectSlugPreview(previewSlug)}</span> : null}
                    </label>
                  </section>
                </div>
              </div>
            ) : null}

            {currentStep === "contact" ? (
              <div className="connect-setup-panel">
                <div className="connect-setup-panel-head">
                  <p className="eyebrow">Step 2</p>
                  <h3>Contact Info</h3>
                  <p>These details power your public profile and contact save actions so customers can reach you fast.</p>
                </div>

                <div className="connect-setup-grid connect-setup-contact-grid">
                  <label className="label connect-setup-contact-field">
                    <span className="connect-setup-label-row">
                      <span>Phone</span>
                      <button
                        type="button"
                        className={`connect-setup-visibility-toggle${draft.contact.showPhone ? " is-visible" : " is-hidden"}`}
                        onClick={() => updateDraft({ contact: { ...draft.contact, showPhone: !draft.contact.showPhone } })}
                        aria-pressed={draft.contact.showPhone}
                        aria-label={`Phone visibility: ${draft.contact.showPhone ? "Visible" : "Hidden"}. Click to ${draft.contact.showPhone ? "hide" : "show"}.`}
                      >
                        {draft.contact.showPhone ? <Eye size={14} /> : <EyeOff size={14} />}
                        {draft.contact.showPhone ? "Visible" : "Hidden"}
                      </button>
                    </span>
                    <input
                      className="input"
                      value={draft.contact.phone}
                      onChange={(event) => updateDraft({ contact: { ...draft.contact, phone: event.target.value } })}
                      placeholder="(555) 123-4567"
                      inputMode="tel"
                    />
                    <span className="helper-text">Optional. Use your preferred business line format.</span>
                  </label>

                  <label className="label connect-setup-contact-field">
                    <span className="connect-setup-label-row">
                      <span>Email</span>
                      <button
                        type="button"
                        className={`connect-setup-visibility-toggle${draft.contact.showEmail ? " is-visible" : " is-hidden"}`}
                        onClick={() => updateDraft({ contact: { ...draft.contact, showEmail: !draft.contact.showEmail } })}
                        aria-pressed={draft.contact.showEmail}
                        aria-label={`Email visibility: ${draft.contact.showEmail ? "Visible" : "Hidden"}. Click to ${draft.contact.showEmail ? "hide" : "show"}.`}
                      >
                        {draft.contact.showEmail ? <Eye size={14} /> : <EyeOff size={14} />}
                        {draft.contact.showEmail ? "Visible" : "Hidden"}
                      </button>
                    </span>
                    <input
                      className="input"
                      type="email"
                      value={draft.contact.email}
                      onChange={(event) => updateDraft({ contact: { ...draft.contact, email: event.target.value } })}
                      placeholder="hello@clutchprintshop.com"
                    />
                    {!fieldErrors.email ? <span className="helper-text">Optional. Only validated when entered.</span> : null}
                    {fieldErrors.email ? <span className="helper-text connect-setup-error-text">{fieldErrors.email}</span> : null}
                  </label>

                  <label className="label connect-setup-span-2 connect-setup-contact-field">
                    <span className="connect-setup-label-row">
                      <span>Website</span>
                      <button
                        type="button"
                        className={`connect-setup-visibility-toggle${draft.contact.showWebsite ? " is-visible" : " is-hidden"}`}
                        onClick={() => updateDraft({ contact: { ...draft.contact, showWebsite: !draft.contact.showWebsite } })}
                        aria-pressed={draft.contact.showWebsite}
                        aria-label={`Website visibility: ${draft.contact.showWebsite ? "Visible" : "Hidden"}. Click to ${draft.contact.showWebsite ? "hide" : "show"}.`}
                      >
                        {draft.contact.showWebsite ? <Eye size={14} /> : <EyeOff size={14} />}
                        {draft.contact.showWebsite ? "Visible" : "Hidden"}
                      </button>
                    </span>
                    <input
                      className="input"
                      value={draft.contact.website}
                      onChange={(event) => updateDraft({ contact: { ...draft.contact, website: event.target.value } })}
                      placeholder="clutchprintshop.com"
                      inputMode="url"
                    />
                    <span className="helper-text">We will format this for the public profile automatically.</span>
                    {fieldErrors.website ? <span className="helper-text connect-setup-error-text">{fieldErrors.website}</span> : null}
                  </label>

                  <label className="label connect-setup-span-2 connect-setup-contact-field">
                    Service area or location
                    <input
                      className="input"
                      value={draft.contact.serviceArea}
                      onChange={(event) => updateDraft({ contact: { ...draft.contact, serviceArea: event.target.value } })}
                      placeholder="Nashville, TN"
                    />
                    <span className="helper-text">Used for map and directions actions in your public profile.</span>
                  </label>
                </div>
              </div>
            ) : null}

            {currentStep === "links" ? (
              <div className="connect-setup-panel">
                <div className="connect-setup-panel-head">
                  <p className="eyebrow">Step 3</p>
                  <h3>Actions & Links</h3>
                  <p>Choose what customers can do when they view your card.</p>
                </div>

                <div className="connect-setup-primary-action-card">
                  <h4>Primary Action</h4>
                  <p>Choose the main action you want visitors to take.</p>

                  <label className="label">
                    CTA Type
                    <select
                      className="input"
                      value={draft.action.primaryActionType}
                      onChange={(event) => {
                        const nextType = event.target.value as SetupDraft["action"]["primaryActionType"];
                        updateDraft({
                          action: {
                            ...draft.action,
                            primaryActionType: nextType,
                            primaryActionLabel: getDefaultPrimaryActionLabel(nextType),
                          },
                        });
                      }}
                    >
                      {PRIMARY_ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="label">
                    Button Label
                    <input
                      className="input"
                      value={draft.action.primaryActionLabel}
                      onChange={(event) => updateDraft({ action: { ...draft.action, primaryActionLabel: event.target.value } })}
                      placeholder="Request a Quote"
                    />
                    {fieldErrors.primaryActionLabel ? <span className="helper-text connect-setup-error-text">{fieldErrors.primaryActionLabel}</span> : null}
                  </label>

                  <label className="label">
                    <span className="connect-setup-label-row">
                      <span>Lead Capture</span>
                      <button
                        type="button"
                        className={`connect-setup-visibility-toggle${draft.action.primaryActionLeadCaptureEnabled ? " is-visible" : ""}`}
                        onClick={() => updateDraft({ action: { ...draft.action, primaryActionLeadCaptureEnabled: !draft.action.primaryActionLeadCaptureEnabled } })}
                        aria-pressed={draft.action.primaryActionLeadCaptureEnabled}
                      >
                        {draft.action.primaryActionLeadCaptureEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                        {draft.action.primaryActionLeadCaptureEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </span>
                    <span className="helper-text">Let visitors send a request from your profile.</span>
                  </label>

                  <label className="label">
                    Form Type
                    <select
                      className="input"
                      value={draft.action.primaryActionFormType}
                      onChange={(event) => updateDraft({ action: { ...draft.action, primaryActionFormType: event.target.value as SetupDraft["action"]["primaryActionFormType"] } })}
                    >
                      <option value="basic_contact">Basic Contact Form</option>
                      <option value="quote_request">Quote Request</option>
                      <option value="appointment_request">Appointment Request</option>
                      <option value="general_inquiry">General Inquiry</option>
                    </select>
                  </label>

                  {!draft.action.primaryActionLeadCaptureEnabled ? (
                    <label className="label">
                      CTA URL
                      <input
                        className="input"
                        value={draft.action.primaryActionUrl}
                        onChange={(event) => updateDraft({ action: { ...draft.action, primaryActionUrl: event.target.value } })}
                        placeholder="https://..."
                        inputMode="url"
                      />
                      {fieldErrors.primaryActionUrl ? <span className="helper-text connect-setup-error-text">{fieldErrors.primaryActionUrl}</span> : null}
                    </label>
                  ) : null}
                </div>

                <div className="connect-setup-style-card">
                  <h4>Profile Style</h4>
                  <p>Choose how your profile text and section headers line up.</p>

                  <div className="label">
                    <span className="connect-setup-segment-label">Global alignment</span>
                    <div className="connect-setup-alignment-segment" role="group" aria-label="Global alignment">
                      {GLOBAL_ALIGNMENT_OPTIONS.map(({ value, label, Icon }) => {
                        const selected = draft.advanced.globalAlignment === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`connect-setup-alignment-option${selected ? " is-active" : ""}`}
                            aria-pressed={selected}
                            onClick={() => updateDraft({ advanced: { ...draft.advanced, globalAlignment: value } })}
                          >
                            <Icon size={14} aria-hidden="true" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="connect-setup-link-cta-row">
                  <strong className="connect-setup-links-subhead">Additional Links</strong>
                  <button type="button" className="btn secondary" onClick={() => addLink("custom")} disabled={draft.links.length >= MAX_LINKS}>
                    <Plus size={14} />
                    Add blank link
                  </button>
                  <span className="helper-text">Quick add templates:</span>
                </div>

                <div className="connect-setup-link-quick-add">
                  {QUICK_ADD_LINKS.map((item) => {
                    const Icon = BEGINNER_LINK_ICON_MAP[item.type];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="connect-setup-link-type-tile"
                        onClick={() => addPresetLink(item.type, item.label, item.defaultValue)}
                        disabled={draft.links.length >= MAX_LINKS}
                      >
                        <span className="connect-setup-link-type-icon"><Icon size={14} /></span>
                        <strong>{item.label}</strong>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="connect-setup-more-toggle"
                  onClick={() => setShowMoreLinkTypes((current) => !current)}
                >
                  <span>Want to add more?</span>
                  <ChevronDown size={14} className={showMoreLinkTypes ? "is-open" : ""} />
                </button>

                {showMoreLinkTypes ? (
                  <div className="connect-setup-link-more">
                    {BEGINNER_LINK_TYPE_ORDER.filter((type) => !QUICK_ADD_LINKS.some((item) => item.type === type)).map((type) => {
                      const spec = getBeginnerConnectLinkSpec(type);
                      const Icon = BEGINNER_LINK_ICON_MAP[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          className="connect-setup-link-type-pill"
                          onClick={() => addLink(type)}
                          disabled={draft.links.length >= MAX_LINKS}
                        >
                          <Icon size={14} />
                          <span>{spec.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="connect-setup-link-list">
                  {draft.links.map((link, index) => {
                    const type = normalizeBeginnerConnectLinkType(link.type);
                    const spec = getBeginnerConnectLinkSpec(type);
                    const Icon = BEGINNER_LINK_ICON_MAP[type];
                    const placeholder = spec.placeholder;
                    const inputMode: "tel" | "email" | "url" = type === "phone" ? "tel" : type === "email" ? "email" : "url";

                    return (
                      <div className="connect-setup-link-card" key={link.id}>
                        <div className="connect-setup-link-card-header">
                          <div className="connect-setup-link-card-title">
                            <span className="connect-setup-link-card-icon"><Icon size={16} /></span>
                            <div>
                              <strong>{link.label || spec.label}</strong>
                              <span>{link.visible !== false ? "Shown on public profile" : "Hidden from public profile"}</span>
                            </div>
                          </div>

                          <div className="connect-setup-link-card-actions">
                            <button
                              type="button"
                              className={`connect-setup-visibility-toggle${link.visible !== false ? " is-visible" : ""}`}
                              onClick={() => updateLink(index, "visible", link.visible === false)}
                              aria-pressed={link.visible !== false}
                              aria-label={link.visible !== false ? "Hide link" : "Show link"}
                            >
                              {link.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                              {link.visible !== false ? "Visible" : "Hidden"}
                            </button>
                            <button
                              type="button"
                              className="btn ghost connect-setup-link-remove"
                              onClick={() => removeLink(index)}
                              aria-label={`Remove ${spec.label} link`}
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="connect-setup-link-grid">
                          <label className="label">
                            Label
                            <input
                              className="input"
                              value={link.label}
                              onChange={(event) => updateLink(index, "label", event.target.value)}
                              placeholder={spec.label}
                            />
                          </label>

                          <label className="label connect-setup-span-2">
                            URL or handle
                            <input
                              className="input"
                              value={link.value}
                              onChange={(event) => updateLink(index, "value", event.target.value)}
                              placeholder={placeholder}
                              inputMode={inputMode}
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                            />
                            <span className="helper-text">{spec.helperText}</span>
                          </label>
                        </div>

                        {fieldErrors[`link-${index}`] ? <p className="connect-setup-link-error">{fieldErrors[`link-${index}`]}</p> : null}
                      </div>
                    );
                  })}
                </div>

                {draft.links.length >= MAX_LINKS ? <p className="connect-setup-limit-note">You have reached the beginner link limit for this starter profile.</p> : null}
              </div>
            ) : null}

            <div className="connect-setup-footer">
              {saveMessage ? <p className={`connect-setup-status ${saveState}`}>{saveMessage}</p> : <p className="connect-setup-status idle">Your changes stay in this draft as you move through the wizard.</p>}
              <div className="connect-setup-footer-actions">
                <button type="button" className="btn ghost connect-setup-preview-trigger" onClick={() => setIsPreviewModalOpen(true)}>
                  Preview
                </button>
                <button type="button" className="btn ghost" onClick={previousStep} disabled={currentStep === "basic" || saveState === "saving"}>
                  <ChevronLeft size={14} />
                  <span className="connect-setup-action-label">Back</span>
                </button>
                {finalStep ? (
                  <button type="button" className="btn primary" onClick={() => persistDraft("complete")} disabled={saveState === "saving"}>
                    {saveState === "saving" ? "Saving..." : "Publish Profile"}
                  </button>
                ) : (
                  <button type="button" className="btn primary" onClick={continueToNextStep} disabled={saveState === "saving"}>
                    <ChevronRight size={14} />
                    <span className="connect-setup-action-label">Continue</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="connect-setup-preview-column">
          <div className="connect-setup-preview-card">
            <div className="connect-setup-preview-head">
              <div>
                <p className="eyebrow">Live preview</p>
                <h3>{previewHasContent ? (previewProfile.business_name || previewProfile.contact_name || "Clutch Connect") : "Your card preview"}</h3>
                <p>{previewHasContent ? buildConnectSlugPreview(previewSlug) : "Add a name, title, or link to watch the card build itself in real time."}</p>
              </div>
            </div>

            <div className={`connect-setup-preview-stage${previewHasContent ? "" : " is-empty"}`}>
              {previewHasContent ? (
                <ConnectProfileView
                  profile={previewProfile}
                  starterLocked={starterLocked}
                  blocks={previewConfig.blocks}
                  sections={previewConfig.sections}
                  forms={previewConfig.forms}
                  theme={previewConfig.theme}
                  mode="preview"
                />
              ) : (
                <div className="connect-setup-preview-empty">
                  <span className="connect-setup-preview-empty-kicker">Blank until you add real details</span>
                  <h4>Start with a name, organization, or one quick action.</h4>
                  <p>Your live card will stay empty until you type information customers should actually see.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isPreviewModalOpen ? (
        <div className="connect-setup-preview-modal" role="dialog" aria-modal="true" aria-label="Profile preview">
          <button type="button" className="connect-setup-preview-modal-backdrop" onClick={() => setIsPreviewModalOpen(false)} aria-label="Close preview" />
          <div className="connect-setup-preview-modal-sheet">
            <div className="connect-setup-preview-modal-head">
              <h3>Live Preview</h3>
              <button type="button" className="btn ghost" onClick={() => setIsPreviewModalOpen(false)}>
                <X size={14} />
                Close
              </button>
            </div>
            <div className={`connect-setup-preview-stage${previewHasContent ? "" : " is-empty"}`}>
              {previewHasContent ? (
                <ConnectProfileView
                  profile={previewProfile}
                  starterLocked={starterLocked}
                  blocks={previewConfig.blocks}
                  sections={previewConfig.sections}
                  forms={previewConfig.forms}
                  theme={previewConfig.theme}
                  mode="preview"
                />
              ) : (
                <div className="connect-setup-preview-empty">
                  <span className="connect-setup-preview-empty-kicker">Blank until you add real details</span>
                  <h4>Start with a name, organization, or one quick action.</h4>
                  <p>Your live card will stay empty until you type information customers should actually see.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}