/**
 * Builder configuration utilities
 * Functions for creating, updating, and validating builder configs
 */

import {
  BuilderConfig,
  BuilderBlock,
  BuilderTheme,
  BuilderBackgroundSettings,
  BuilderButtonSettings,
  BuilderAvatarSettings,
  BuilderBannerSettings,
  ProfileSection,
  ProfileSectionStyle,
  defaultBlockSettings,
  BlockType,
} from "./builder-types";
import { isBuilderFontFamily } from "./font-catalog";

export const MAX_BUILDER_BLOCKS = 12;
export const MAX_PROFILE_SECTIONS = 4;

export const SINGLETON_BLOCK_TYPES = new Set<BlockType>([
  "profile-hero",
  "avatar-block",
  "business-name-block",
  "subheader-block",
  "contact-buttons",
  "social-media-links",
]);

export const REPEATABLE_BLOCK_TYPES = new Set<BlockType>([
  "phone-button",
  "email-button",
  "website-button",
  "directions-button",
  "request-quote-button",
  "custom-link-button",
  "image-banner",
  "text-section",
  "business-hours",
  "services-list",
  "form-block",
  "apple-wallet-button",
  "google-wallet-button",
  "qr-code-block",
]);

export function isSingletonBlockType(type: BlockType | string): boolean {
  return SINGLETON_BLOCK_TYPES.has(type as BlockType);
}

export function isRepeatableBlockType(type: BlockType | string): boolean {
  return REPEATABLE_BLOCK_TYPES.has(type as BlockType);
}

export const DEFAULT_SECTION_STYLE: ProfileSectionStyle = {
  alignment: "left",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 2,
  textTransform: "uppercase",
  textColor: "#FFFFFF",
  backgroundColor: "transparent",
  borderColor: "rgba(255, 166, 101, 0.35)",
  borderWidth: 1,
  borderRadius: 999,
  paddingX: 18,
  paddingY: 10,
  marginTop: 0,
  marginBottom: 14,
};

const DEFAULT_SECTIONS: Array<{ id: string; label: string; order: number }> = [
  { id: "contact", label: "Contact", order: 0 },
  { id: "services", label: "Services", order: 1 },
  { id: "more", label: "More", order: 2 },
];

function isHeaderBlockType(type: string): boolean {
  return ["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(type);
}

function classifyDefaultSectionId(type: string): string {
  const normalized = String(type || "").toLowerCase();
  if (["phone-button", "email-button", "website-button", "directions-button", "contact-buttons"].includes(normalized)) {
    return "contact";
  }
  if (["services-list", "request-quote-button", "form-block", "business-hours", "apple-wallet-button", "google-wallet-button"].includes(normalized)) {
    return "services";
  }
  if (["social-media-links", "custom-link-button", "text-section", "image-banner", "qr-code-block"].includes(normalized)) {
    return "more";
  }
  return "more";
}

export function createDefaultSections(): ProfileSection[] {
  return DEFAULT_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    visible: true,
    order: section.order,
    blockIds: [],
    style: { ...DEFAULT_SECTION_STYLE },
  }));
}

function normalizeSectionStyle(style: Partial<ProfileSectionStyle> | undefined): ProfileSectionStyle {
  const source = style || {};
  return {
    alignment: source.alignment === "center" || source.alignment === "right" ? source.alignment : "left",
    fontFamily: typeof source.fontFamily === "string" && source.fontFamily.trim() ? source.fontFamily : DEFAULT_SECTION_STYLE.fontFamily,
    fontSize: Number.isFinite(Number(source.fontSize)) ? Math.max(10, Math.min(24, Number(source.fontSize))) : DEFAULT_SECTION_STYLE.fontSize,
    fontWeight: Number.isFinite(Number(source.fontWeight)) ? Math.max(400, Math.min(900, Number(source.fontWeight))) : DEFAULT_SECTION_STYLE.fontWeight,
    letterSpacing: Number.isFinite(Number(source.letterSpacing)) ? Math.max(0, Math.min(6, Number(source.letterSpacing))) : DEFAULT_SECTION_STYLE.letterSpacing,
    textTransform: source.textTransform === "none" ? "none" : "uppercase",
    textColor: typeof source.textColor === "string" && source.textColor.trim() ? source.textColor : DEFAULT_SECTION_STYLE.textColor,
    backgroundColor: typeof source.backgroundColor === "string" && source.backgroundColor.trim() ? source.backgroundColor : DEFAULT_SECTION_STYLE.backgroundColor,
    borderColor: typeof source.borderColor === "string" && source.borderColor.trim() ? source.borderColor : DEFAULT_SECTION_STYLE.borderColor,
    borderWidth: Number.isFinite(Number(source.borderWidth)) ? Math.max(0, Math.min(8, Number(source.borderWidth))) : DEFAULT_SECTION_STYLE.borderWidth,
    borderRadius: Number.isFinite(Number(source.borderRadius)) ? Math.max(0, Math.min(999, Number(source.borderRadius))) : DEFAULT_SECTION_STYLE.borderRadius,
    paddingX: Number.isFinite(Number(source.paddingX)) ? Math.max(0, Math.min(36, Number(source.paddingX))) : DEFAULT_SECTION_STYLE.paddingX,
    paddingY: Number.isFinite(Number(source.paddingY)) ? Math.max(0, Math.min(28, Number(source.paddingY))) : DEFAULT_SECTION_STYLE.paddingY,
    marginTop: Number.isFinite(Number(source.marginTop)) ? Math.max(0, Math.min(40, Number(source.marginTop))) : DEFAULT_SECTION_STYLE.marginTop,
    marginBottom: Number.isFinite(Number(source.marginBottom)) ? Math.max(0, Math.min(40, Number(source.marginBottom))) : DEFAULT_SECTION_STYLE.marginBottom,
  };
}

function rebuildSectionBlockIds(sections: ProfileSection[], blocks: BuilderBlock[]): ProfileSection[] {
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  return sections.map((section, index) => ({
    ...section,
    order: index,
    blockIds: sortedBlocks.filter((block) => block.sectionId === section.id).map((block) => block.id),
  }));
}

const BLOCK_TYPE_ALIASES: Record<string, BlockType> = {
  contact: "contact-buttons",
  "social-links": "social-media-links",
  "image-block": "image-banner",
  booking: "request-quote-button",
  "booking-block": "request-quote-button",
};

function normalizeBuilderBlockType(type: string): BlockType | null {
  const normalizedType = BLOCK_TYPE_ALIASES[type] || type;
  return Object.prototype.hasOwnProperty.call(defaultBlockSettings, normalizedType) ? (normalizedType as BlockType) : null;
}

const MAX_SOCIAL_LINKS = 6;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAlignment(value: unknown): "left" | "center" | "right" {
  return value === "left" || value === "right" ? value : "center";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function createDefaultBackground(): BuilderBackgroundSettings {
  return {
    type: "soft",
    color: "#F8FAFC",
    gradientFrom: "#FFFFFF",
    gradientTo: "#FFF4EC",
  };
}

function createDefaultButtons(accentColor?: string): BuilderButtonSettings {
  return {
    style: "rounded",
    color: "#FFFFFF",
    textColor: "#111111",
  };
}

function createDefaultAvatar(): BuilderAvatarSettings {
  return {
    borderEnabled: false,
    borderColor: "#FFFFFF",
    borderWidth: 4,
    borderRadius: 999,
    glowEnabled: false,
    glowColor: "#FFA665",
    glowOpacity: 0.25,
    verifiedBadgeEnabled: false,
    verifiedBadgeColor: "#FFA665",
  };
}

function createDefaultBanner(): BuilderBannerSettings {
  return {
    enabled: false,
    type: "none",
    height: 160,
    backgroundColor: "#FFF4EC",
    gradientFrom: "#FFFFFF",
    gradientTo: "#FFA665",
    imageUrl: null,
    imagePosition: "center",
    overlayEnabled: false,
    overlayOpacity: 0.35,
    borderRadius: 24,
    avatarOverlap: true,
    textAlign: "center",
  };
}

function normalizeBackgroundSettings(value: unknown): BuilderBackgroundSettings {
  const defaults = createDefaultBackground();
  const source = isRecord(value) ? value : {};
  const type = source.type === "solid" || source.type === "gradient" ? source.type : defaults.type;
  return {
    type,
    color: safeColor(source.color, defaults.color),
    gradientFrom: safeColor(source.gradientFrom, defaults.gradientFrom),
    gradientTo: safeColor(source.gradientTo, defaults.gradientTo),
  };
}

function normalizeButtonSettings(value: unknown, accentColor: string, oldButtonColor?: string): BuilderButtonSettings {
  const defaults = createDefaultButtons(oldButtonColor || accentColor);
  const source = isRecord(value) ? value : {};
  const style = source.style === "pill" || source.style === "square" ? source.style : defaults.style;
  return {
    style,
    color: safeColor(source.color, defaults.color),
    textColor: safeColor(source.textColor, defaults.textColor),
  };
}

function normalizeAvatarSettings(value: unknown): BuilderAvatarSettings {
  const defaults = createDefaultAvatar();
  const source = isRecord(value) ? value : {};
  return {
    borderEnabled: source.borderEnabled === true,
    borderColor: safeColor(source.borderColor, defaults.borderColor),
    borderWidth: clampNumber(source.borderWidth, 0, 16, defaults.borderWidth),
    borderRadius: clampNumber(source.borderRadius, 0, 999, defaults.borderRadius),
    glowEnabled: source.glowEnabled === true,
    glowColor: safeColor(source.glowColor, defaults.glowColor),
    glowOpacity: clampNumber(source.glowOpacity, 0, 1, defaults.glowOpacity),
    verifiedBadgeEnabled: source.verifiedBadgeEnabled === true,
    verifiedBadgeColor: safeColor(source.verifiedBadgeColor, defaults.verifiedBadgeColor),
  };
}

function normalizeBannerSettings(value: unknown): BuilderBannerSettings {
  const defaults = createDefaultBanner();
  const source = isRecord(value) ? value : {};
  const type = source.type === "solid" || source.type === "gradient" || source.type === "image" || source.type === "glass"
    ? source.type
    : defaults.type;
  const imagePosition = source.imagePosition === "top" || source.imagePosition === "bottom" ? source.imagePosition : defaults.imagePosition;
  return {
    enabled: source.enabled === true,
    type,
    height: clampNumber(source.height, 80, 320, defaults.height),
    backgroundColor: safeColor(source.backgroundColor, defaults.backgroundColor),
    gradientFrom: safeColor(source.gradientFrom, defaults.gradientFrom),
    gradientTo: safeColor(source.gradientTo, defaults.gradientTo),
    imageUrl: typeof source.imageUrl === "string" && source.imageUrl.trim() ? source.imageUrl : null,
    imagePosition,
    overlayEnabled: source.overlayEnabled === true,
    overlayOpacity: clampNumber(source.overlayOpacity, 0, 1, defaults.overlayOpacity),
    borderRadius: clampNumber(source.borderRadius, 0, 40, defaults.borderRadius),
    avatarOverlap: source.avatarOverlap !== false,
    textAlign: normalizeAlignment(source.textAlign),
  };
}

function normalizeSocialLink(link: unknown, index: number) {
  const source = typeof link === "object" && link !== null ? (link as Record<string, any>) : {};
  const platform = String(source.platform || source.network || source.type || "Instagram").trim() || "Instagram";
  const value = String(source.value || source.url || source.href || source.handle || "").trim();
  const label = String(source.label || source.title || platform).trim() || platform;
  const iconTreatment = source.iconTreatment === "brand" || source.iconTreatment === "mono"
    ? source.iconTreatment
    : undefined;
  const visible = source.visible !== false;

  if (!value && !label && !platform) return null;

  return {
    id: String(source.id || `social-link-${index}-${Math.random().toString(36).slice(2, 7)}`),
    platform,
    label,
    value,
    iconTreatment,
    visible,
  };
}

function collectSocialLinks(data: Record<string, any>) {
  const rawLinks = Array.isArray(data.links)
    ? data.links
    : Array.isArray(data.items)
      ? data.items
      : [];

  return rawLinks
    .map((link, index) => normalizeSocialLink(link, index))
    .filter((link): link is NonNullable<ReturnType<typeof normalizeSocialLink>> => Boolean(link));
}

/**
 * Generate a unique block ID
 */
export function generateBlockId(type: BlockType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create default theme configuration
 */
export function createDefaultTheme(accentColor?: string): BuilderTheme {
  const safeAccent = accentColor || "#111111";
  return {
    accentColor: safeAccent,
    buttonColor: "#FFFFFF",
    textColor: "#111111",
    themeMode: "light",
    profileStyle: "minimal",
    fontFamily: "exo2",
    fontScale: "normal",
    layout: "default",
    showProfilePicture: true,
    showBio: true,
    showFooter: true,
    showSaveShareSection: true,
    saveSharePosition: "bottom",
    saveShareAlignment: "center",
    saveShareShowSaveContact: true,
    saveShareShowAppleWallet: true,
    saveShareShowGoogleWallet: true,
    saveShareShowShareProfile: true,
    saveShareShowCopyLink: true,
    saveShareShowDownloadQr: true,
    background: createDefaultBackground(),
    buttons: createDefaultButtons(safeAccent),
    avatar: createDefaultAvatar(),
    banner: createDefaultBanner(),
  };
}

/**
 * Create a new block with default settings
 */
export function createBlock(
  type: BlockType,
  order: number,
  customSettings?: Record<string, any>
): BuilderBlock {
  const initialData = {
    ...defaultBlockSettings[type],
    ...(customSettings || {}),
  };

  return {
    id: generateBlockId(type),
    type,
    order,
    visible: true,
    data: initialData,
    settings: initialData,
  };
}

/**
 * Generate a default builder configuration
 * This is used as fallback when a profile doesn't have builder_config yet
 */
export function createDefaultBuilderConfig(
  accentColor?: string
): BuilderConfig {
  const blocks: BuilderBlock[] = [
    { ...createBlock("avatar-block", 0), sectionId: undefined },
    { ...createBlock("business-name-block", 1), sectionId: undefined },
    { ...createBlock("subheader-block", 2), sectionId: undefined },
    { ...createBlock("phone-button", 3), sectionId: "contact" },
    { ...createBlock("email-button", 4), sectionId: "contact" },
    { ...createBlock("website-button", 5), sectionId: "contact" },
    { ...createBlock("social-media-links", 6), sectionId: "more" },
  ];

  const sections = rebuildSectionBlockIds(createDefaultSections(), blocks);

  return {
    version: 1,
    theme: createDefaultTheme(accentColor),
    sections,
    blocks,
    forms: [],
  };
}

/**
 * Validate builder configuration structure
 */
export function validateBuilderConfig(config: any): boolean {
  if (!config || typeof config !== "object") return false;
  if (typeof config.version !== "number") return false;
  if (!Array.isArray(config.blocks)) return false;
  if (!Array.isArray(config.forms)) return false;
  if (config.sections !== undefined && !Array.isArray(config.sections)) return false;

  const seenBlockIds = new Set<string>();

  // Validate blocks
  for (const block of config.blocks) {
    if (!block.id || !block.type || typeof block.order !== "number") {
      return false;
    }
    if (seenBlockIds.has(block.id)) return false;
    if (!normalizeBuilderBlockType(String(block.type))) return false;
    seenBlockIds.add(block.id);
  }

  if (Array.isArray(config.sections)) {
    const seenSectionIds = new Set<string>();
    for (const section of config.sections) {
      if (!section?.id || typeof section.label !== "string" || typeof section.order !== "number") {
        return false;
      }
      if (seenSectionIds.has(section.id)) return false;
      seenSectionIds.add(section.id);
    }
  }

  return true;
}

function normalizeFormField(field: unknown, index: number) {
  if (!isRecord(field)) return null;
  const fieldType = ["text", "email", "phone", "textarea", "dropdown", "checkbox"].includes(String(field.type))
    ? field.type
    : "text";
  return {
    id: String(field.id || `field-${index}`),
    type: fieldType,
    label: String(field.label || `Field ${index + 1}`),
    placeholder: typeof field.placeholder === "string" ? field.placeholder : undefined,
    required: field.required === true,
    order: Number.isFinite(Number(field.order)) ? Number(field.order) : index,
    options: Array.isArray(field.options) ? field.options.map((option) => String(option)) : undefined,
  };
}

function normalizeForms(forms: unknown): BuilderConfig["forms"] {
  if (!Array.isArray(forms)) return [];
  return forms
    .map((form, index) => {
      if (!isRecord(form)) return null;
      const fields = Array.isArray(form.fields)
        ? form.fields
          .map((field, fieldIndex) => normalizeFormField(field, fieldIndex))
          .filter((field): field is NonNullable<ReturnType<typeof normalizeFormField>> => Boolean(field))
          .sort((a, b) => a.order - b.order)
          .map((field, fieldIndex) => ({ ...field, order: fieldIndex }))
        : [];

      return {
        id: String(form.id || `form-${index}`),
        name: String(form.name || `Form ${index + 1}`),
        description: typeof form.description === "string" ? form.description : undefined,
        fields,
        submitButtonText: typeof form.submitButtonText === "string" ? form.submitButtonText : undefined,
        successMessage: typeof form.successMessage === "string" ? form.successMessage : undefined,
        redirectUrl: typeof form.redirectUrl === "string" ? form.redirectUrl : undefined,
      };
    })
    .filter((form): form is NonNullable<typeof form> => Boolean(form));
}

export function sanitizeBuilderConfig(config: unknown): BuilderConfig {
  if (!isRecord(config)) {
    return createDefaultBuilderConfig();
  }

  const rawTheme = isRecord(config.theme) ? config.theme : {};
  const defaultTheme = createDefaultTheme(typeof rawTheme.accentColor === "string" ? rawTheme.accentColor : undefined);
  const safeAccent = typeof rawTheme.accentColor === "string" && rawTheme.accentColor.trim() ? rawTheme.accentColor : defaultTheme.accentColor;
  const safeButtonColor = typeof rawTheme.buttonColor === "string" && rawTheme.buttonColor.trim() ? rawTheme.buttonColor : safeAccent;
  const safeTextColor = typeof rawTheme.textColor === "string" && rawTheme.textColor.trim() ? rawTheme.textColor : defaultTheme.textColor;
  const safeThemeMode = rawTheme.themeMode === "light" || rawTheme.themeMode === "dark" || rawTheme.themeMode === "system"
    ? rawTheme.themeMode
    : "system";
  const safeProfileStyle = rawTheme.profileStyle === "minimal" || rawTheme.profileStyle === "executive" || rawTheme.profileStyle === "glass"
    ? rawTheme.profileStyle
    : "clutch";
  const safeFontFamily = isBuilderFontFamily(rawTheme.fontFamily)
    ? (rawTheme.fontFamily as BuilderTheme["fontFamily"])
    : "exo2";
  const safeFontScale = rawTheme.fontScale === "large" ? "large" : "normal";
  const safeShowSaveShareSection = rawTheme.showSaveShareSection !== false;
  const safeSaveSharePosition = rawTheme.saveSharePosition === "top" ? "top" : "bottom";
  const safeSaveShareAlignment = normalizeAlignment(rawTheme.saveShareAlignment);
  const safeBackground = normalizeBackgroundSettings(rawTheme.background);
  const safeButtons = normalizeButtonSettings(rawTheme.buttons, safeAccent, safeButtonColor);
  const safeAvatar = normalizeAvatarSettings(rawTheme.avatar);
  const safeBanner = normalizeBannerSettings(rawTheme.banner);

  const sourceBlocks = Array.isArray(config.blocks) ? config.blocks : createDefaultBuilderConfig(safeAccent).blocks;
  const normalizedBlocks = sourceBlocks
    .map((rawBlock, index) => {
    if (!isRecord(rawBlock)) return null;
    const normalizedType = normalizeBuilderBlockType(String(rawBlock.type));
    if (!normalizedType) return null;
    const data = {
      ...(isRecord(rawBlock.settings) ? rawBlock.settings : {}),
      ...(isRecord(rawBlock.data) ? rawBlock.data : {}),
    };
    if (
      typeof data.avatarUrl === "string" &&
      (data.avatarUrl.startsWith("blob:") || data.avatarUrl === "null" || data.avatarUrl === "undefined")
    ) {
      data.avatarUrl = "";
    }

    const defaults = defaultBlockSettings[normalizedType] || {};
    const nextData: Record<string, any> = {
      ...defaults,
      ...data,
      alignment: normalizeAlignment(data.alignment ?? defaults.alignment),
    };

    if (normalizedType === "avatar-block") {
      nextData.avatarBorderEnabled = data.avatarBorderEnabled === true;
      nextData.avatarBorderColor = typeof data.avatarBorderColor === "string" && data.avatarBorderColor.trim()
        ? data.avatarBorderColor
        : "#FFA665";
      nextData.avatarBorderWidth = Number.isFinite(Number(data.avatarBorderWidth))
        ? Math.max(0, Math.min(12, Number(data.avatarBorderWidth)))
        : 4;
      nextData.avatarBorderRadius = Number.isFinite(Number(data.avatarBorderRadius))
        ? Math.max(0, Math.min(999, Number(data.avatarBorderRadius)))
        : 999;
      nextData.avatarRemoved = data.avatarRemoved === true;
    }

    if (normalizedType === "social-media-links") {
      nextData.links = collectSocialLinks(nextData).slice(0, MAX_SOCIAL_LINKS);
      nextData.iconColorMode = nextData.iconColorMode === "mono" ? "mono" : "brand";
    }

    return {
      ...rawBlock,
      id: String(rawBlock.id || `${normalizedType}-${index}`),
      type: normalizedType,
      order: Number.isFinite(Number(rawBlock.order)) ? Number(rawBlock.order) : index,
      visible: rawBlock.visible !== false,
      sectionId: typeof rawBlock.sectionId === "string" ? rawBlock.sectionId : undefined,
      data: nextData,
      settings: nextData,
    } as BuilderBlock;
  })
  .filter((block): block is BuilderBlock => Boolean(block));

  if (!normalizedBlocks.length) {
    return createDefaultBuilderConfig(safeAccent);
  }

  const migratedHeroBlocks = normalizedBlocks.flatMap((block) => {
    if (block.type !== "profile-hero") return [block];

    const data = { ...(block.data || {}) };
    const visible = block.visible;
    const baseOrder = Number(block.order) || 0;

    const avatarData = {
      ...defaultBlockSettings["avatar-block"],
      avatarUrl: data.avatarUrl || "",
      avatarRemoved: false,
      avatarBorderEnabled: data.avatarBorderEnabled === true,
      avatarBorderColor: data.avatarBorderColor || "#FFA665",
      avatarBorderWidth: data.avatarBorderWidth ?? 4,
      avatarBorderRadius: data.avatarBorderRadius ?? 999,
      avatarGlowEnabled: data.avatarGlowEnabled === true,
      avatarGlowColor: data.avatarGlowColor || "#FF6B2C",
      avatarGlowOpacity: data.avatarGlowOpacity ?? 0.35,
      avatarGlowBlur: data.avatarGlowBlur ?? 18,
      avatarGlowSpread: data.avatarGlowSpread ?? 10,
      verifiedBadgeEnabled: Boolean(data.verifiedBadgeEnabled ?? data.verified),
      verifiedBadgeColor: data.verifiedBadgeColor || "#f59e0b",
      verifiedBadgeIconColor: data.verifiedBadgeIconColor || "#0f172a",
      verifiedBadgeIcon: data.verifiedBadgeIcon || "checkmark",
      verifiedBadgePosition: data.verifiedBadgePosition || "bottom-right",
      verifiedBadgeSize: data.verifiedBadgeSize ?? 24,
    };

    const businessNameData = {
      ...defaultBlockSettings["business-name-block"],
      text: data.businessName || "",
      color: data.businessNameColor || "",
      fontSize: data.businessNameSize ?? 40,
      fontWeight: data.businessNameWeight ?? 800,
      fontFamily: data.businessNameFont || "inherit",
    };

    const subheaderData = {
      ...defaultBlockSettings["subheader-block"],
      text: data.title || "",
      color: data.subheaderColor || "",
      fontSize: data.subheaderSize ?? 22,
      fontWeight: data.subheaderWeight ?? 600,
      fontFamily: data.subheaderFont || "inherit",
    };

    return [
      {
        ...createBlock("avatar-block", baseOrder),
        id: `avatar-block-${block.id}`,
        visible,
        data: avatarData,
        settings: avatarData,
      },
      {
        ...createBlock("business-name-block", baseOrder + 0.001),
        id: `business-name-block-${block.id}`,
        visible,
        data: businessNameData,
        settings: businessNameData,
      },
      {
        ...createBlock("subheader-block", baseOrder + 0.002),
        id: `subheader-block-${block.id}`,
        visible,
        data: subheaderData,
        settings: subheaderData,
      },
    ];
  });

  const expandedBlocks = migratedHeroBlocks;

  const orderedBlocks = [...expandedBlocks].sort((a, b) => a.order - b.order);
  const seenSingletonTypes = new Set<string>();
  const seenBlockIds = new Set<string>();
  const dedupedBlocks = orderedBlocks
    .filter((block) => {
      if (!isSingletonBlockType(block.type)) return true;
      if (seenSingletonTypes.has(block.type)) {
        return false;
      }
      seenSingletonTypes.add(block.type);
      return true;
    })
    .map((block, index) => {
      let id = String(block.id || `${block.type}-${index}`);
      if (seenBlockIds.has(id)) {
        let suffix = 1;
        while (seenBlockIds.has(`${id}-${suffix}`)) suffix += 1;
        id = `${id}-${suffix}`;
      }
      seenBlockIds.add(id);
      return { ...block, id, order: index };
    });

  const incomingSections = Array.isArray(config.sections) ? config.sections : [];
  const normalizedSections = incomingSections
    .filter((section: any) => section && typeof section.id === "string")
    .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
    .map((section: any, index: number) => ({
      id: String(section.id),
      label: String(section.label || `Section ${index + 1}`),
      visible: section.visible !== false,
      order: index,
      blockIds: Array.isArray(section.blockIds) ? section.blockIds.map((id: unknown) => String(id)) : [],
      style: normalizeSectionStyle(section.style),
    })) as ProfileSection[];

  const seedSections = normalizedSections.length ? normalizedSections : createDefaultSections();
  const sectionIdSet = new Set(seedSections.map((section) => section.id));
  const blocksWithSections = dedupedBlocks.map((block) => {
    if (isHeaderBlockType(String(block.type))) {
      return { ...block, sectionId: undefined };
    }

    const existingSectionId = typeof block.sectionId === "string" && sectionIdSet.has(block.sectionId)
      ? block.sectionId
      : null;
    return {
      ...block,
      sectionId: existingSectionId || classifyDefaultSectionId(String(block.type)),
    };
  });

  const sections = rebuildSectionBlockIds(seedSections, blocksWithSections);

  return {
    ...config,
    version: Number.isInteger(Number(config.version)) && Number(config.version) > 0 ? Number(config.version) : 1,
    theme: {
      ...defaultTheme,
      ...rawTheme,
      accentColor: safeAccent,
      buttonColor: safeButtonColor,
      textColor: safeTextColor,
      themeMode: safeThemeMode,
      profileStyle: safeProfileStyle,
      fontFamily: safeFontFamily,
      fontScale: safeFontScale,
      showSaveShareSection: safeShowSaveShareSection,
      saveSharePosition: safeSaveSharePosition,
      saveShareAlignment: safeSaveShareAlignment,
      showProfilePicture: rawTheme.showProfilePicture !== false,
      showBio: rawTheme.showBio !== false,
      showFooter: rawTheme.showFooter !== false,
      saveShareShowSaveContact: rawTheme.saveShareShowSaveContact !== false,
      saveShareShowAppleWallet: rawTheme.saveShareShowAppleWallet !== false,
      saveShareShowGoogleWallet: rawTheme.saveShareShowGoogleWallet !== false,
      saveShareShowShareProfile: rawTheme.saveShareShowShareProfile !== false,
      saveShareShowCopyLink: rawTheme.saveShareShowCopyLink !== false,
      saveShareShowDownloadQr: rawTheme.saveShareShowDownloadQr !== false,
      background: safeBackground,
      buttons: safeButtons,
      avatar: safeAvatar,
      banner: safeBanner,
    },
    sections,
    blocks: blocksWithSections,
    forms: normalizeForms(config.forms),
  };
}

/**
 * Add a block to the configuration
 */
export function addBlockToConfig(
  config: BuilderConfig,
  type: BlockType,
  customSettings?: Record<string, any>,
  targetSectionId?: string
): BuilderConfig {
  if (config.blocks.length >= MAX_BUILDER_BLOCKS) {
    return config;
  }

  const existingTypes = new Set(config.blocks.map((block) => String(block.type)));
  if (isSingletonBlockType(type) && existingTypes.has(type)) {
    return config;
  }

  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  let sectionId: string | undefined;
  if (!isHeaderBlockType(type)) {
    const sectionIds = new Set(sections.map((section) => section.id));
    const classifiedSectionId = classifyDefaultSectionId(type);
    if (targetSectionId && sectionIds.has(targetSectionId)) {
      sectionId = targetSectionId;
    } else if (sectionIds.has(classifiedSectionId)) {
      sectionId = classifiedSectionId;
    } else {
      sectionId = sections[0]?.id;
    }
  }
  const newBlock = {
    ...createBlock(type, config.blocks.length, customSettings),
    sectionId,
  };

  const blocks = [...config.blocks, newBlock];
  const nextSections = rebuildSectionBlockIds(sections, blocks);

  return {
    ...config,
    sections: nextSections,
    blocks,
  };
}

export function duplicateBlockInConfig(
  config: BuilderConfig,
  blockId: string
): BuilderConfig {
  if (config.blocks.length >= MAX_BUILDER_BLOCKS) return config;

  const orderedBlocks = [...config.blocks].sort((a, b) => a.order - b.order);
  const sourceIndex = orderedBlocks.findIndex((block) => block.id === blockId);
  if (sourceIndex < 0) return config;

  const source = orderedBlocks[sourceIndex];
  if (isSingletonBlockType(source.type)) return config;

  const duplicate = {
    ...source,
    id: generateBlockId(source.type),
    data: { ...(source.data || source.settings || {}) },
    settings: { ...(source.settings || source.data || {}) },
  };

  const nextBlocks = [
    ...orderedBlocks.slice(0, sourceIndex + 1),
    duplicate,
    ...orderedBlocks.slice(sourceIndex + 1),
  ].map((block, index) => ({ ...block, order: index }));

  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();

  return {
    ...config,
    sections: rebuildSectionBlockIds(sections, nextBlocks),
    blocks: nextBlocks,
  };
}

/**
 * Remove a block from configuration
 */
export function removeBlockFromConfig(
  config: BuilderConfig,
  blockId: string
): BuilderConfig {
  const updatedBlocks = config.blocks
    .filter((block) => block.id !== blockId)
    .map((block, index) => ({
      ...block,
      order: index,
    }));

  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const nextSections = rebuildSectionBlockIds(sections, updatedBlocks);

  return {
    ...config,
    sections: nextSections,
    blocks: updatedBlocks,
  };
}

/**
 * Reorder blocks in configuration
 */
export function reorderBlocksInConfig(
  config: BuilderConfig,
  blockIds: string[]
): BuilderConfig {
  const blockMap = new Map(config.blocks.map((b) => [b.id, b]));
  const reorderedBlocks = blockIds
    .map((id) => blockMap.get(id))
    .filter(Boolean)
    .map((block, index) => ({
      ...block!,
      order: index,
    }));

  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const nextSections = rebuildSectionBlockIds(sections, reorderedBlocks);

  return {
    ...config,
    sections: nextSections,
    blocks: reorderedBlocks,
  };
}

/**
 * Toggle block visibility
 */
export function toggleBlockVisibility(
  config: BuilderConfig,
  blockId: string
): BuilderConfig {
  return {
    ...config,
    blocks: config.blocks.map((block) =>
      block.id === blockId ? { ...block, visible: !block.visible } : block
    ),
  };
}

/**
 * Update block settings
 */
export function updateBlockSettings(
  config: BuilderConfig,
  blockId: string,
  newSettings: Record<string, any>
): BuilderConfig {
  const updatedBlocks = config.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            sectionId: typeof newSettings.sectionId === "string" ? newSettings.sectionId : block.sectionId,
            data: {
              ...(block.data || block.settings || {}),
              ...newSettings,
            },
            settings: {
              ...(block.settings || block.data || {}),
              ...newSettings,
            },
          }
        : block
    );

  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const nextSections = rebuildSectionBlockIds(sections, updatedBlocks);

  return {
    ...config,
    sections: nextSections,
    blocks: updatedBlocks,
  };
}

/**
 * Update theme
 */
export function updateTheme(
  config: BuilderConfig,
  theme: Partial<BuilderTheme>
): BuilderConfig {
  return {
    ...config,
    theme: {
      ...config.theme,
      ...theme,
    },
  };
}

export function addSectionToConfig(config: BuilderConfig, label = "New Section"): BuilderConfig {
  const currentSections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  if (currentSections.length >= MAX_PROFILE_SECTIONS) return config;
  const sectionId = `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nextSections = [
    ...currentSections,
    {
      id: sectionId,
      label,
      visible: true,
      order: currentSections.length,
      blockIds: [],
      style: { ...DEFAULT_SECTION_STYLE },
    },
  ];

  return {
    ...config,
    sections: nextSections,
  };
}

export function updateSectionInConfig(
  config: BuilderConfig,
  sectionId: string,
  patch: Partial<Omit<ProfileSection, "style">> & { style?: Partial<ProfileSectionStyle> }
): BuilderConfig {
  const currentSections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const nextSections = currentSections.map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      ...patch,
      style: patch.style ? normalizeSectionStyle({ ...section.style, ...patch.style }) : section.style,
    };
  });

  return {
    ...config,
    sections: rebuildSectionBlockIds(nextSections, config.blocks),
  };
}

export function reorderSectionsInConfig(config: BuilderConfig, sectionIds: string[]): BuilderConfig {
  const currentSections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const sectionMap = new Map(currentSections.map((section) => [section.id, section]));
  const nextSections = sectionIds
    .map((id) => sectionMap.get(id))
    .filter((section): section is ProfileSection => Boolean(section))
    .map((section, index) => ({ ...section, order: index }));

  return {
    ...config,
    sections: rebuildSectionBlockIds(nextSections, config.blocks),
  };
}

export function duplicateSectionInConfig(config: BuilderConfig, sectionId: string): BuilderConfig {
  const currentSections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  if (currentSections.length >= MAX_PROFILE_SECTIONS) return config;
  const section = currentSections.find((item) => item.id === sectionId);
  if (!section) return config;

  const duplicated: ProfileSection = {
    ...section,
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: `${section.label} Copy`,
    blockIds: [],
    order: currentSections.length,
    style: { ...section.style },
  };

  return {
    ...config,
    sections: [...currentSections, duplicated],
  };
}

export function removeSectionFromConfig(config: BuilderConfig, sectionId: string): BuilderConfig {
  const currentSections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const fallbackSection = currentSections.find((section) => section.id !== sectionId);

  const nextBlocks = config.blocks.map((block) => {
    if (block.sectionId !== sectionId) return block;
    return { ...block, sectionId: fallbackSection?.id };
  });

  const nextSections = currentSections
    .filter((section) => section.id !== sectionId)
    .map((section, index) => ({ ...section, order: index }));

  return {
    ...config,
    sections: rebuildSectionBlockIds(nextSections, nextBlocks),
    blocks: nextBlocks,
  };
}

export function moveBlockToSection(config: BuilderConfig, blockId: string, sectionId: string): BuilderConfig {
  const currentSections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  const sectionExists = currentSections.some((section) => section.id === sectionId);
  if (!sectionExists) return config;

  const nextBlocks = config.blocks.map((block) => (block.id === blockId ? { ...block, sectionId } : block));
  return {
    ...config,
    sections: rebuildSectionBlockIds(currentSections, nextBlocks),
    blocks: nextBlocks,
  };
}

export function reorderBlocksWithinSection(config: BuilderConfig, sectionId: string, orderedBlockIds: string[]): BuilderConfig {
  const sectionBlocks = config.blocks
    .filter((block) => block.sectionId === sectionId)
    .sort((a, b) => a.order - b.order);
  if (!sectionBlocks.length) return config;

  const sectionOrderMap = new Map<string, number>();
  orderedBlockIds.forEach((id, index) => sectionOrderMap.set(id, index));
  sectionBlocks.forEach((block, index) => {
    if (!sectionOrderMap.has(block.id)) sectionOrderMap.set(block.id, index + orderedBlockIds.length);
  });

  const nextBlocks = [...config.blocks]
    .sort((a, b) => a.order - b.order)
    .sort((a, b) => {
      if (a.sectionId !== sectionId || b.sectionId !== sectionId) return 0;
      return (sectionOrderMap.get(a.id) || 0) - (sectionOrderMap.get(b.id) || 0);
    })
    .map((block, index) => ({ ...block, order: index }));

  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : createDefaultSections();
  return {
    ...config,
    sections: rebuildSectionBlockIds(sections, nextBlocks),
    blocks: nextBlocks,
  };
}
