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
  return {
    accentColor: accentColor || "#FFA665",
    layout: "default",
    showProfilePicture: true,
    showBio: true,
    showFooter: true,
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
  return {
    id: generateBlockId(type),
    type,
    order,
    visible: true,
    settings: {
      ...defaultBlockSettings[type],
      ...(customSettings || {}),
    },
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
    createBlock("profile-hero", 0),
    createBlock("contact-buttons", 1),
    createBlock("social-media-links", 2),
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

  // Validate blocks
  for (const block of config.blocks) {
    if (!block.id || !block.type || typeof block.order !== "number") {
      return false;
    }
  }

  return true;
}

/**
 * Add a block to the configuration
 */
export function addBlockToConfig(
  config: BuilderConfig,
  type: BlockType,
  customSettings?: Record<string, any>
): BuilderConfig {
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
            settings: {
              ...block.settings,
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
