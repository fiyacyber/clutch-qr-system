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
  return {
    ...DEFAULT_SECTION_STYLE,
    ...(style || {}),
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

export function sanitizeBuilderConfig(config: unknown): BuilderConfig {
  const cleanConfig = baseSanitizeBuilderConfig(config);
  const explicitSections = readExplicitSections(config);

  if (!explicitSections) return cleanConfig;

  const sectionIds = new Set(explicitSections.map((section) => section.id));
  const blocks = cleanConfig.blocks.map((block) => {
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
