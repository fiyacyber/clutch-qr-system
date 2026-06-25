"use client";

import BuilderPublicProfile from "@/components/BuilderPublicProfile";
import { BuilderBlock, BuilderConfig, BuilderTheme } from "@/lib/builder-types";
import { createDefaultTheme } from "@/lib/builder-config";

type SocialLink = {
  id?: string;
  label?: string | null;
  url?: string | null;
  platform?: string | null;
};

interface ConnectProfileViewProps {
  profile: any;
  blocks?: BuilderBlock[];
  socialLinks?: SocialLink[];
  theme?: Partial<BuilderTheme>;
  mode: "public" | "preview" | "editor";
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
}

function toBuilderBlocks(profile: any, blocks?: BuilderBlock[], socialLinks?: SocialLink[]): BuilderBlock[] {
  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocks;
  }

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

export default function ConnectProfileView({
  profile,
  blocks,
  socialLinks,
  theme: themeOverrides,
  mode,
  selectedBlockId,
  onSelectBlock,
}: ConnectProfileViewProps) {
  const resolvedBlocks = toBuilderBlocks(profile, blocks, socialLinks)
    .map((block, index) => ({ ...block, order: typeof block.order === "number" ? block.order : index }))
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({ ...block, order: index }));

  const existingTheme = profile?.builder_config?.theme;
  const resolvedTheme = {
    ...createDefaultTheme(profile?.theme_color || "#FFA665"),
    ...(existingTheme || {}),
    ...(themeOverrides || {}),
  };

  const config: BuilderConfig = {
    version: Number(profile?.builder_config?.version || 1),
    theme: resolvedTheme,
    blocks: resolvedBlocks,
    forms: Array.isArray(profile?.builder_config?.forms) ? profile.builder_config.forms : [],
  };

  return (
    <BuilderPublicProfile
      config={config}
      profile={profile}
      mode={mode}
      editablePreview={mode === "editor"}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
    />
  );
}