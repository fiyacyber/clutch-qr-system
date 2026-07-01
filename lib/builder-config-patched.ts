export * from "./builder-config";

import {
  createDefaultSections,
  DEFAULT_SECTION_STYLE,
  MAX_PROFILE_SECTIONS,
} from "./builder-config";
import type { BuilderConfig, ProfileSection } from "./builder-types";

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

export function addSectionToConfig(config: BuilderConfig, label = "New Section"): BuilderConfig {
  // Important: an empty section array is an intentional builder state.
  // Do not treat [] as missing and regenerate Contact / Services / More.
  const currentSections = Array.isArray(config.sections) ? config.sections : createDefaultSections();

  if (currentSections.length >= MAX_PROFILE_SECTIONS) {
    return config;
  }

  return {
    ...config,
    sections: [
      ...currentSections,
      createSection(label, currentSections.length),
    ],
  };
}
