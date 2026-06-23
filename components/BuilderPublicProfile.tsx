"use client";

import { BuilderConfig } from "@/lib/builder-types";
import { normalizeBlockType } from "./builder/blockUtils";
import {
  ProfileHeroPreview,
  ContactButtonsPreview,
  PhoneBlockPreview,
  BookingBlockPreview,
  SocialLinksPreview,
  ServicesPreview,
  TextSectionPreview,
  ImageBlockPreview,
  BusinessHoursPreview,
  FormBlockPreview,
  WalletButtonPreview,
  QRCodeBlockPreview,
  UnknownBlockPreview,
} from "./builder/blockPreviews";

interface BuilderPublicProfileProps {
  config: BuilderConfig;
  profile: any;
}

type GroupKey =
  | "contact-actions"
  | "links"
  | "social-links"
  | "business-actions"
  | "custom-links"
  | "content";

const GROUP_LABELS: Record<Exclude<GroupKey, "content">, string> = {
  "contact-actions": "Contact Actions",
  links: "Links",
  "social-links": "Social Links",
  "business-actions": "Business Actions",
  "custom-links": "Custom Links",
};

function getGroupForType(type: string): GroupKey {
  if (["contact-buttons", "phone-button", "email-button", "website-button"].includes(type)) {
    return "contact-actions";
  }
  if (["directions-button", "qr-code-block"].includes(type)) {
    return "links";
  }
  if (["social-media-links", "social-links"].includes(type)) {
    return "social-links";
  }
  if (["request-quote-button", "apple-wallet-button", "google-wallet-button", "form-block"].includes(type)) {
    return "business-actions";
  }
  if (type === "custom-link-button") {
    return "custom-links";
  }
  return "content";
}

const PREVIEW_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "profile-hero": ProfileHeroPreview,
  "contact-buttons": ContactButtonsPreview,
  "phone-button": PhoneBlockPreview,
  "email-button": PhoneBlockPreview,
  "website-button": PhoneBlockPreview,
  "directions-button": PhoneBlockPreview,
  "request-quote-button": BookingBlockPreview,
  "custom-link-button": BookingBlockPreview,
  "social-media-links": SocialLinksPreview,
  "services-list": ServicesPreview,
  "business-hours": BusinessHoursPreview,
  "form-block": FormBlockPreview,
  "apple-wallet-button": WalletButtonPreview,
  "google-wallet-button": WalletButtonPreview,
  "qr-code-block": QRCodeBlockPreview,
  "text-section": TextSectionPreview,
  "image-banner": ImageBlockPreview,
  contact: ContactButtonsPreview,
  "social-links": SocialLinksPreview,
  "image-block": ImageBlockPreview,
};

export default function BuilderPublicProfile({
  config,
  profile,
}: BuilderPublicProfileProps) {
  const blocks = [...(config.blocks || [])]
    .sort((a, b) => a.order - b.order)
    .filter((block) => block.visible)
    .map((block) => {
      const type = normalizeBlockType(String((block as any).type));
      return { ...block, type } as any;
    });

  const heroBlocks = blocks.filter((block) => block.type === "profile-hero");
  const groupedBlocks: Record<GroupKey, any[]> = {
    "contact-actions": [],
    links: [],
    "social-links": [],
    "business-actions": [],
    "custom-links": [],
    content: [],
  };

  blocks.forEach((block) => {
    if (block.type === "profile-hero") return;
    const group = getGroupForType(block.type);
    groupedBlocks[group].push(block);
  });

  const sectionOrder: GroupKey[] = [
    "contact-actions",
    "links",
    "social-links",
    "business-actions",
    "custom-links",
    "content",
  ];

  return (
    <div
      className="builder-public-profile"
      data-theme={config.theme.darkMode ? "dark" : "light"}
      style={{ "--builder-accent": config.theme.accentColor } as React.CSSProperties}
    >
      {heroBlocks.map((block) => {
        const Preview = PREVIEW_COMPONENTS[block.type] || UnknownBlockPreview;
        return (
          <Preview
            key={block.id}
            block={block}
            profile={profile}
            profileId={profile?.id || "unknown"}
          />
        );
      })}

      <div className="builder-public-sections">
        {sectionOrder.map((groupKey) => {
          const sectionBlocks = groupedBlocks[groupKey] || [];
          if (!sectionBlocks.length) return null;

          return (
            <section key={groupKey} className="builder-public-section">
              {groupKey !== "content" ? (
                <h2 className="builder-public-section-label">{GROUP_LABELS[groupKey]}</h2>
              ) : null}

              <div className="builder-public-section-stack">
                {sectionBlocks.map((block) => {
                  const Preview = PREVIEW_COMPONENTS[block.type] || UnknownBlockPreview;
                  return (
                    <Preview
                      key={block.id}
                      block={block}
                      profile={profile}
                      profileId={profile?.id || "unknown"}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {config.theme.showFooter !== false ? (
        <footer className="builder-public-footer">
          <p>
            Powered by <strong>Clutch Connect</strong>
          </p>
          <a href="https://clutchprintshop.com" target="_blank" rel="noreferrer">
            clutchprintshop.com
          </a>
        </footer>
      ) : null}
    </div>
  );
}
