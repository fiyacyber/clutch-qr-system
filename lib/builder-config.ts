/**
 * Builder configuration utilities
 * Functions for creating, updating, and validating builder configs
 */

import {
  BuilderConfig,
  BuilderBlock,
  BuilderTheme,
  defaultBlockSettings,
  BlockType,
} from "./builder-types";

export const MAX_BUILDER_BLOCKS = 12;

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
  const safeAccent = accentColor || "#FFA665";
  return {
    accentColor: safeAccent,
    buttonColor: safeAccent,
    textColor: "#0F172A",
    fontFamily: "exo2",
    fontScale: "normal",
    layout: "default",
    showProfilePicture: true,
    showBio: true,
    showFooter: true,
    darkMode: false,
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
    createBlock("avatar-block", 0),
    createBlock("business-name-block", 1),
    createBlock("subheader-block", 2),
    createBlock("phone-button", 3),
    createBlock("email-button", 4),
    createBlock("website-button", 5),
    createBlock("social-media-links", 6),
  ];

  return {
    version: 1,
    theme: createDefaultTheme(accentColor),
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

  return true;
}

export function sanitizeBuilderConfig(config: BuilderConfig): BuilderConfig {
  const safeAccent = config.theme?.accentColor || "#FFA665";
  const safeButtonColor = config.theme?.buttonColor || safeAccent;
  const safeTextColor = config.theme?.textColor || "#0F172A";
  const safeFontFamily = ["exo2", "sans", "serif", "display", "mono", "rounded", "editorial"].includes(String(config.theme?.fontFamily))
    ? (config.theme.fontFamily as BuilderTheme["fontFamily"])
    : "exo2";
  const safeFontScale = config.theme?.fontScale === "large" ? "large" : "normal";

  const normalizedBlocks = config.blocks.map((block) => {
    const normalizedType = normalizeBuilderBlockType(String(block.type)) || block.type;
    const data = { ...(block.data || block.settings || {}) };
    if (
      typeof data.avatarUrl === "string" &&
      (data.avatarUrl.startsWith("blob:") || data.avatarUrl === "null" || data.avatarUrl === "undefined")
    ) {
      data.avatarUrl = "";
    }

    return {
      ...block,
      type: normalizedType,
      data,
      settings: data,
    };
  });

  const migratedHeroBlocks = normalizedBlocks.flatMap((block) => {
    if (block.type !== "profile-hero") return [block];

    const data = { ...(block.data || {}) };
    const visible = block.visible;
    const baseOrder = Number(block.order) || 0;

    const avatarData = {
      ...defaultBlockSettings["avatar-block"],
      avatarUrl: data.avatarUrl || "",
      avatarGlowEnabled: data.avatarGlowEnabled !== false,
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

  const expandedBlocks = migratedHeroBlocks.flatMap((block) => {
    if (block.type !== "contact-buttons") return [block];

    const data = { ...(block.data || {}) } as Record<string, any>;
    const converted: BuilderBlock[] = [];
    const visible = block.visible;

    if (data.showPhone !== false) {
      converted.push({
        ...createBlock("phone-button", block.order + converted.length * 0.01),
        id: `phone-button-${block.id}`,
        visible,
        data: {
          ...defaultBlockSettings["phone-button"],
          label: data.phoneLabel || "Call",
          phone: data.phone || "",
          value: data.phone || "",
        },
      });
    }

    if (data.showEmail !== false) {
      converted.push({
        ...createBlock("email-button", block.order + converted.length * 0.01),
        id: `email-button-${block.id}`,
        visible,
        data: {
          ...defaultBlockSettings["email-button"],
          label: data.emailLabel || "Email",
          email: data.email || "",
          value: data.email || "",
        },
      });
    }

    if (data.showWebsite !== false) {
      converted.push({
        ...createBlock("website-button", block.order + converted.length * 0.01),
        id: `website-button-${block.id}`,
        visible,
        data: {
          ...defaultBlockSettings["website-button"],
          label: data.websiteLabel || "Website",
          website: data.website || "",
          url: data.website || "",
        },
      });
    }

    return converted;
  });

  const orderedBlocks = [...expandedBlocks].sort((a, b) => a.order - b.order);
  const seenTypes = new Set<string>();
  const dedupedBlocks = orderedBlocks
    .filter((block) => {
      if (seenTypes.has(block.type)) {
        return false;
      }
      seenTypes.add(block.type);
      return true;
    })
    .map((block, index) => ({ ...block, order: index }));

  return {
    ...config,
    theme: {
      ...config.theme,
      accentColor: safeAccent,
      buttonColor: safeButtonColor,
      textColor: safeTextColor,
      fontFamily: safeFontFamily,
      fontScale: safeFontScale,
    },
    blocks: dedupedBlocks,
  };
}

/**
 * Add a block to the configuration
 */
export function addBlockToConfig(
  config: BuilderConfig,
  type: BlockType,
  customSettings?: Record<string, any>
): BuilderConfig {
  if (config.blocks.length >= MAX_BUILDER_BLOCKS) {
    return config;
  }

  const existingTypes = new Set(config.blocks.map((block) => String(block.type)));
  if (existingTypes.has(type)) {
    return config;
  }

  const newBlock = createBlock(
    type,
    config.blocks.length,
    customSettings
  );

  return {
    ...config,
    blocks: [...config.blocks, newBlock],
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

  return {
    ...config,
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

  return {
    ...config,
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
  return {
    ...config,
    blocks: config.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
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
    ),
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
