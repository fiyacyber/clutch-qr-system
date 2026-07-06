"use client";

import { memo, useMemo } from "react";
import BuilderPublicProfile from "@/components/BuilderPublicProfile";
import { BuilderBlock, BuilderConfig, BuilderTheme } from "@/lib/builder-types";
import { createDefaultTheme, sanitizeBuilderConfig } from "@/lib/builder-config";

type SocialLink = {
  id?: string;
  label?: string | null;
  url?: string | null;
  platform?: string | null;
};

interface ConnectProfileViewProps {
  profile: any;
  starterLocked?: boolean;
  blocks?: BuilderBlock[];
  sections?: BuilderConfig["sections"];
  forms?: BuilderConfig["forms"];
  socialLinks?: SocialLink[];
  theme?: Partial<BuilderTheme>;
  mode: "public" | "preview" | "editor";
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  onSelectSection?: (sectionId: string) => void;
  onSelectSaveShare?: () => void;
  onRemoveBlock?: (blockId: string) => void;
  onRemoveSection?: (sectionId: string) => void;
}

function cloneBuilderBlocks(blocks?: BuilderBlock[]): BuilderBlock[] {
  return Array.isArray(blocks)
    ? blocks.map((block) => ({
      ...block,
      data: block.data ? { ...block.data } : undefined,
      settings: block.settings ? { ...block.settings } : undefined,
    }))
    : [];
}

function createLegacyFallbackBlocks(profile: any, socialLinks?: SocialLink[]): BuilderBlock[] {
  const generated: BuilderBlock[] = [
    {
      id: "profile-hero-default",
      type: "profile-hero",
      order: 0,
      visible: true,
      data: {
        businessName: profile?.business_name || profile?.contact_name || "Business",
        title: profile?.title || "",
        bio: profile?.bio || "",
        avatarUrl: profile?.avatar_url || "",
      },
    },
  ];

  let order = 1;

  if (profile?.phone) {
    generated.push({
      id: "phone-button-default",
      type: "phone-button",
      order,
      visible: true,
      data: { label: "Call", phone: profile.phone, value: profile.phone },
    });
    order += 1;
  }

  if (profile?.email) {
    generated.push({
      id: "email-button-default",
      type: "email-button",
      order,
      visible: true,
      data: { label: "Email", email: profile.email, value: profile.email },
    });
    order += 1;
  }

  if (profile?.website) {
    generated.push({
      id: "website-button-default",
      type: "website-button",
      order,
      visible: true,
      data: { label: "Website", website: profile.website, url: profile.website },
    });
    order += 1;
  }

  if (profile?.address || profile?.location) {
    const address = String(profile?.address || profile?.location || "").trim();
    generated.push({
      id: "directions-button-default",
      type: "directions-button",
      order,
      visible: true,
      data: {
        label: "Directions",
        address,
        url: address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : "",
      },
    });
    order += 1;
  }

  const mappedSocialLinks = (socialLinks || [])
    .filter((item) => item?.url)
    .map((item, idx) => ({
      id: item.id || `social-${idx}`,
      label: item.label || item.platform || "Social",
      platform: item.platform || item.label || "Social",
      value: String(item.url),
    }));

  if (mappedSocialLinks.length) {
    generated.push({
      id: "social-media-links-default",
      type: "social-media-links",
      order,
      visible: true,
      data: {
        links: mappedSocialLinks,
        iconColorMode: "mono",
      },
    });
    order += 1;
  }

  generated.push({
    id: "save-contact-default",
    type: "custom-link-button",
    order,
    visible: true,
    data: {
      label: "Save Contact",
      url: profile?.id ? `/api/vcard/${profile.id}` : "",
      icon: "📇",
      description: "Download vCard",
    },
  });

  return generated;
}

function toBuilderBlocks(profile: any, blocks?: BuilderBlock[], socialLinks?: SocialLink[]): BuilderBlock[] {
  const customBlocks = cloneBuilderBlocks(blocks);

  if (Array.isArray(blocks)) {
    return customBlocks;
  }

  return createLegacyFallbackBlocks(profile, socialLinks);
}

function sanitizeForRender(config: BuilderConfig, sections?: BuilderConfig["sections"]): BuilderConfig {
  const hydrated = sanitizeBuilderConfig(config);

  if (Array.isArray(sections) && sections.length === 0) {
    return {
      ...hydrated,
      sections: [],
      blocks: hydrated.blocks.map((block) => ({ ...block, sectionId: undefined })),
    };
  }

  return hydrated;
}

function ConnectProfileView({
  profile,
  starterLocked = false,
  blocks,
  sections,
  forms,
  socialLinks,
  theme: themeOverrides,
  mode,
  selectedBlockId,
  onSelectBlock,
  onSelectSection,
  onSelectSaveShare,
  onRemoveBlock,
  onRemoveSection,
}: ConnectProfileViewProps) {
  const resolvedBlocks = useMemo(
    () => toBuilderBlocks(profile, blocks, socialLinks)
      .map((block, index) => ({ ...block, order: typeof block.order === "number" ? block.order : index }))
      .sort((a, b) => a.order - b.order)
      .map((block, index) => ({ ...block, order: index })),
    [blocks, profile, socialLinks]
  );

  const resolvedTheme = useMemo(() => {
    const existingTheme = profile?.builder_config?.theme;
    return {
      ...createDefaultTheme(profile?.theme_color || "#FFA665"),
      ...(existingTheme || {}),
      ...(themeOverrides || {}),
    };
  }, [profile?.builder_config?.theme, profile?.theme_color, themeOverrides]);

  const config: BuilderConfig = useMemo(() => ({
    version: Number(profile?.builder_config?.version || 1),
    theme: resolvedTheme,
    sections: Array.isArray(sections)
      ? sections
      : (Array.isArray(profile?.builder_config?.sections) ? profile.builder_config.sections : []),
    blocks: resolvedBlocks,
    forms: Array.isArray(forms)
      ? forms
      : (Array.isArray(profile?.builder_config?.forms) ? profile.builder_config.forms : []),
  }), [forms, profile, resolvedBlocks, resolvedTheme, sections]);

  const hydratedConfig = useMemo(() => sanitizeForRender(config, config.sections), [config]);

  return (
    <BuilderPublicProfile
      config={hydratedConfig}
      profile={profile}
      starterLocked={starterLocked}
      mode={mode}
      editablePreview={mode === "editor"}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
      onSelectSection={onSelectSection}
      onSelectSaveShare={onSelectSaveShare}
      onRemoveBlock={onRemoveBlock}
      onRemoveSection={onRemoveSection}
    />
  );
}

export default memo(ConnectProfileView);
