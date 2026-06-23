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
  const blocks = [...(config.blocks || [])].sort((a, b) => a.order - b.order);

  return (
    <div
      className="builder-public-profile"
      data-theme={config.theme.darkMode ? "dark" : "light"}
      style={{ "--builder-accent": config.theme.accentColor } as React.CSSProperties}
    >
      {blocks.map((block) => {
        if (!block.visible) return null;

        const type = normalizeBlockType(String((block as any).type));
        const Preview = PREVIEW_COMPONENTS[type] || UnknownBlockPreview;

        return (
          <Preview
            key={block.id}
            block={{ ...block, type } as any}
            profile={profile}
            profileId={profile?.id || "unknown"}
          />
        );
      })}
    </div>
  );
}
