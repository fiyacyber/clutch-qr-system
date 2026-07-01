export * from "./builder-config";

import {
  createDefaultSections,
  DEFAULT_SECTION_STYLE,
  MAX_PROFILE_SECTIONS,
  sanitizeBuilderConfig as baseSanitizeBuilderConfig,
} from "./builder-config";
import type { BuilderBlock, BuilderConfig, ProfileSection, ProfileSectionStyle } from "./builder-types";

function createSection(label: string, order: number): ProfileSection {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    visible: true,
    order,
    blockIds: [],
    style: { ...DEFAULT_SECTION_STYLE },
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function isHeaderBlockType(type: string): boolean {
  return ["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(type);
}

function rebuildSectionBlockIds(sections: ProfileSection[], blocks: BuilderBlock[]): ProfileSection[] {
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  return sections.map((section, index) => ({
    ...section,
    order: index,
    blockIds: sortedBlocks.filter((block) => block.sectionId === section.id).map((block) => block.id),
  }));
}

function normalizeSectionStyle(style: Partial<ProfileSectionStyle> | undefined): ProfileSectionStyle {
  const source = style || {};
  return {
    ...DEFAULT_SECTION_STYLE,
    ...source,
    fontSize: clamp(source.fontSize, 10, 72, DEFAULT_SECTION_STYLE.fontSize),
    fontWeight: clamp(source.fontWeight, 400, 900, DEFAULT_SECTION_STYLE.fontWeight),
    letterSpacing: clamp(source.letterSpacing, 0, 16, DEFAULT_SECTION_STYLE.letterSpacing),
    borderWidth: clamp(source.borderWidth, 0, 24, DEFAULT_SECTION_STYLE.borderWidth),
    borderRadius: clamp(source.borderRadius, 0, 999, DEFAULT_SECTION_STYLE.borderRadius),
    paddingX: clamp(source.paddingX, 0, 96, DEFAULT_SECTION_STYLE.paddingX),
    paddingY: clamp(source.paddingY, 0, 72, DEFAULT_SECTION_STYLE.paddingY),
    marginTop: clamp(source.marginTop, 0, 120, DEFAULT_SECTION_STYLE.marginTop),
    marginBottom: clamp(source.marginBottom, 0, 120, DEFAULT_SECTION_STYLE.marginBottom),
    alignment: source.alignment === "center" || source.alignment === "right" ? source.alignment : "left",
    textTransform: source.textTransform === "none" ? "none" : "uppercase",
    fontFamily: typeof source.fontFamily === "string" && source.fontFamily.trim() ? source.fontFamily : DEFAULT_SECTION_STYLE.fontFamily,
    textColor: typeof source.textColor === "string" && source.textColor.trim() ? source.textColor : DEFAULT_SECTION_STYLE.textColor,
    backgroundColor: typeof source.backgroundColor === "string" && source.backgroundColor.trim() ? source.backgroundColor : DEFAULT_SECTION_STYLE.backgroundColor,
    borderColor: typeof source.borderColor === "string" && source.borderColor.trim() ? source.borderColor : DEFAULT_SECTION_STYLE.borderColor,
  };
}

function getCurrentSections(config: BuilderConfig): ProfileSection[] {
  return Array.isArray(config.sections) ? config.sections : createDefaultSections();
}

function readExplicitSections(config: unknown): ProfileSection[] | null {
  const rawSections = (config as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(rawSections)) return null;

  const seen = new Set<string>();
  return rawSections
    .filter((section: any) => section && typeof section.id === "string" && !seen.has(section.id))
    .map((section: any, index: number) => {
      seen.add(section.id);
      return {
        id: String(section.id),
        label: String(section.label || `Section ${index + 1}`),
        visible: section.visible !== false,
        order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
        blockIds: Array.isArray(section.blockIds) ? section.blockIds.map((id: unknown) => String(id)) : [],
        style: normalizeSectionStyle(section.style),
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index }));
}

function rawBlockMap(config: unknown) {
  const map = new Map<string, any>();
  const rawBlocks = (config as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(rawBlocks)) return map;
  rawBlocks.forEach((block: any) => {
    if (!block?.id) return;
    map.set(String(block.id), {
      ...(block.settings && typeof block.settings === "object" ? block.settings : {}),
      ...(block.data && typeof block.data === "object" ? block.data : {}),
    });
  });
  return map;
}

function preserveExpandedBlockValues(blocks: BuilderBlock[], config: unknown): BuilderBlock[] {
  const rawById = rawBlockMap(config);
  return blocks.map((block) => {
    const raw = rawById.get(block.id);
    if (!raw) return block;

    const data = { ...(block.data || block.settings || {}) } as Record<string, any>;
    const preserveNumber = (key: string, min: number, max: number) => {
      if (raw[key] !== undefined) data[key] = clamp(raw[key], min, max, Number(data[key] ?? min));
    };

    preserveNumber("fontSize", 8, 96);
    preserveNumber("avatarBorderWidth", 0, 32);
    preserveNumber("avatarBorderRadius", 0, 999);
    preserveNumber("avatarGlowBlur", 0, 120);
    preserveNumber("avatarGlowSpread", 0, 96);
    preserveNumber("verifiedBadgeSize", 10, 72);

    return {
      ...block,
      data,
      settings: { ...(block.settings || block.data || {}), ...data },
    };
  });
}

export function sanitizeBuilderConfig(config: unknown): BuilderConfig {
  const cleanConfig = baseSanitizeBuilderConfig(config);
  const explicitSections = readExplicitSections(config);
  let blocks = preserveExpandedBlockValues(cleanConfig.blocks, config);

  if (!explicitSections) {
    return { ...cleanConfig, blocks };
  }

  const sectionIds = new Set(explicitSections.map((section) => section.id));
  blocks = blocks.map((block) => {
    if (isHeaderBlockType(String(block.type))) return { ...block, sectionId: undefined };
    return typeof block.sectionId === "string" && sectionIds.has(block.sectionId)
      ? block
      : { ...block, sectionId: undefined };
  });

  return {
    ...cleanConfig,
    sections: rebuildSectionBlockIds(explicitSections, blocks),
    blocks,
  };
}

export function addSectionToConfig(config: BuilderConfig, label = "New Section"): BuilderConfig {
  const currentSections = getCurrentSections(config);
  if (currentSections.length >= MAX_PROFILE_SECTIONS) return config;
  return {
    ...config,
    sections: [...currentSections, createSection(label, currentSections.length)],
  };
}

export function removeSectionFromConfig(config: BuilderConfig, sectionId: string): BuilderConfig {
  const currentSections = getCurrentSections(config);
  if (!currentSections.some((section) => section.id === sectionId)) return config;

  const fallbackSection = currentSections.find((section) => section.id !== sectionId);
  const nextSections = currentSections
    .filter((section) => section.id !== sectionId)
    .map((section, index) => ({ ...section, order: index }));
  const nextBlocks = config.blocks.map((block) =>
    block.sectionId === sectionId ? { ...block, sectionId: fallbackSection?.id } : block
  );

  return {
    ...config,
    sections: rebuildSectionBlockIds(nextSections, nextBlocks),
    blocks: nextBlocks,
  };
}

export function updateSectionInConfig(
  config: BuilderConfig,
  sectionId: string,
  patch: Partial<Omit<ProfileSection, "style">> & { style?: Partial<ProfileSectionStyle> }
): BuilderConfig {
  const currentSections = getCurrentSections(config);
  if (!currentSections.some((section) => section.id === sectionId)) return config;

  const nextSections = currentSections.map((section) => section.id === sectionId
    ? {
      ...section,
      ...patch,
      style: patch.style ? normalizeSectionStyle({ ...section.style, ...patch.style }) : section.style,
    }
    : section
  );

  return {
    ...config,
    sections: rebuildSectionBlockIds(nextSections, config.blocks),
  };
}

export function reorderSectionsInConfig(config: BuilderConfig, sectionIds: string[]): BuilderConfig {
  const currentSections = getCurrentSections(config);
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
  const currentSections = getCurrentSections(config);
  if (currentSections.length >= MAX_PROFILE_SECTIONS) return config;
  const section = currentSections.find((item) => item.id === sectionId);
  if (!section) return config;

  return {
    ...config,
    sections: [
      ...currentSections,
      {
        ...section,
        id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: `${section.label} Copy`,
        blockIds: [],
        order: currentSections.length,
        style: { ...section.style },
      },
    ],
  };
}
