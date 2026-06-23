"use client";

import { BuilderBlock, BuilderConfig } from "@/lib/builder-types";
import { trackBlockEvent } from "@/lib/builder-analytics";
import { useCallback } from "react";

interface BuilderBlockProps {
  block: BuilderBlock;
  profile: any;
  forms: Map<string, any>;
  profileId: string;
}

/**
 * Individual block renderers
 */
const BlockRenderers: Record<string, React.ComponentType<BuilderBlockProps>> = {
  "profile-hero": ({ block, profile }) => (
    <div className="builder-block builder-block-hero">
      {block.settings.showProfilePicture && profile.avatar_url && (
        <img
          src={profile.avatar_url}
          alt={profile.contact_name}
          className="builder-hero-avatar"
        />
      )}
      {block.settings.showName && (
        <h1 className="builder-hero-name">{profile.business_name}</h1>
      )}
      {block.settings.showTitle && profile.title && (
        <p className="builder-hero-title">{profile.title}</p>
      )}
      {block.settings.showBio && profile.bio && (
        <p className="builder-hero-bio">{profile.bio}</p>
      )}
    </div>
  ),

  "contact-buttons": ({ block, profile, profileId }) => (
    <div className={`builder-block builder-block-contact builder-contact-${block.settings.style || 'grid'}`}>
      {profile.phone && (
        <a
          href={`tel:${profile.phone}`}
          onClick={() =>
            trackBlockEvent({
              profileId,
              blockId: block.id,
              eventType: "phone",
            })
          }
          className="builder-button builder-button-call"
        >
          <span>📞</span> Call
        </a>
      )}
      {profile.email && (
        <a
          href={`mailto:${profile.email}`}
          onClick={() =>
            trackBlockEvent({
              profileId,
              blockId: block.id,
              eventType: "email",
            })
          }
          className="builder-button builder-button-email"
        >
          <span>✉️</span> Email
        </a>
      )}
    </div>
  ),

  "phone-button": ({ block, profile, profileId }) =>
    profile.phone ? (
      <a
        href={`tel:${profile.phone}`}
        onClick={() =>
          trackBlockEvent({
            profileId,
            blockId: block.id,
            eventType: "phone",
          })
        }
        className="builder-block builder-block-phone builder-button"
      >
        {block.settings.showIcon && <span>📞</span>}
        {block.settings.label}
      </a>
    ) : null,

  "email-button": ({ block, profile, profileId }) =>
    profile.email ? (
      <a
        href={`mailto:${profile.email}`}
        onClick={() =>
          trackBlockEvent({
            profileId,
            blockId: block.id,
            eventType: "email",
          })
        }
        className="builder-block builder-block-email builder-button"
      >
        {block.settings.showIcon && <span>✉️</span>}
        {block.settings.label}
      </a>
    ) : null,

  "website-button": ({ block, profile, profileId }) =>
    profile.website ? (
      <a
        href={profile.website}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackBlockEvent({
            profileId,
            blockId: block.id,
            eventType: "website",
          })
        }
        className="builder-block builder-block-website builder-button"
      >
        {block.settings.showIcon && <span>🌐</span>}
        {block.settings.label}
      </a>
    ) : null,

  "directions-button": ({ block, profile, profileId }) => {
    const query = profile.business_name || profile.contact_name;
    return query ? (
      <a
        href={`https://www.google.com/maps/search/${encodeURIComponent(query)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackBlockEvent({
            profileId,
            blockId: block.id,
            eventType: "directions",
          })
        }
        className="builder-block builder-block-directions builder-button"
      >
        {block.settings.showIcon && <span>📍</span>}
        {block.settings.label}
      </a>
    ) : null;
  },

  "custom-link-button": ({ block, profileId }) => (
    <a
      href={block.settings.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        trackBlockEvent({
          profileId,
          blockId: block.id,
          eventType: "custom_link",
          metadata: { url: block.settings.url },
        })
      }
      className="builder-block builder-block-custom builder-button"
    >
      {block.settings.icon && <span>{block.settings.icon}</span>}
      {block.settings.label}
    </a>
  ),

  "request-quote-button": ({ block }) => (
    <button className="builder-block builder-block-quote builder-button">
      {block.settings.showIcon && <span>💬</span>}
      {block.settings.label}
    </button>
  ),

  "text-section": ({ block }) => (
    <div className="builder-block builder-block-text">
      {block.settings.heading && (
        <h2 className="builder-text-heading">{block.settings.heading}</h2>
      )}
      {block.settings.content && (
        <p className="builder-text-content">{block.settings.content}</p>
      )}
    </div>
  ),

  "social-media-links": ({ block, profile, profileId }) => {
    const socialPlatforms = [
      { key: "instagram", icon: "📷", url: (h: string) => `https://instagram.com/${h}` },
      { key: "facebook", icon: "👥", url: (h: string) => `https://facebook.com/${h}` },
      { key: "twitter", icon: "𝕏", url: (h: string) => `https://twitter.com/${h}` },
      { key: "linkedin", icon: "💼", url: (h: string) => `https://linkedin.com/in/${h}` },
      { key: "youtube", icon: "🎥", url: (h: string) => `https://youtube.com/@${h}` },
      { key: "tiktok", icon: "🎵", url: (h: string) => `https://tiktok.com/@${h}` },
    ];

    const links = socialPlatforms
      .map((platform) => {
        const handle = (profile as any)[`${platform.key}_handle`] || (profile as any)[platform.key];
        if (!handle) return null;
        return { ...platform, handle };
      })
      .filter(Boolean);

    if (links.length === 0) return null;

    return (
      <div className="builder-block builder-block-social">
        {links.map((link: any) => (
          <a
            key={link.key}
            href={link.url(link.handle)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackBlockEvent({
                profileId,
                blockId: block.id,
                eventType: `social_${link.key}`,
                metadata: { platform: link.key },
              })
            }
            className="builder-button builder-button-social"
            title={link.key}
          >
            <span>{link.icon}</span>
          </a>
        ))}
      </div>
    );
  },

  "image-banner": ({ block }) =>
    block.settings.imageUrl ? (
      <div className="builder-block builder-block-image">
        <img
          src={block.settings.imageUrl}
          alt={block.settings.altText}
          style={{ height: block.settings.height }}
          className="builder-image"
        />
        {block.settings.caption && (
          <p className="builder-image-caption">{block.settings.caption}</p>
        )}
      </div>
    ) : null,

  "business-hours": ({ block }) => (
    <div className="builder-block builder-block-hours">
      {block.settings.title && (
        <h3 className="builder-hours-title">{block.settings.title}</h3>
      )}
      {block.settings.hours && Object.keys(block.settings.hours).length > 0 && (
        <div className="builder-hours-list">
          {Object.entries(block.settings.hours).map(([day, time]: any) => (
            <div key={day} className="builder-hours-item">
              <span className="builder-hours-day">{day}</span>
              <span className="builder-hours-time">{time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ),

  "services-list": ({ block }) => (
    <div className="builder-block builder-block-services">
      {block.settings.title && (
        <h3 className="builder-services-title">{block.settings.title}</h3>
      )}
      {block.settings.items && block.settings.items.length > 0 && (
        <ul className="builder-services-list">
          {block.settings.items.map((item: any, idx: number) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  ),

  "form-block": ({ block, forms }) => {
    const form = forms.get(block.settings.formId);
    return (
      <div className="builder-block builder-block-form">
        {form?.title && <h3 className="builder-form-title">{form.title}</h3>}
        {form?.description && (
          <p className="builder-form-description">{form.description}</p>
        )}
        {!form && (
          <p className="builder-form-placeholder">
            {block.settings.formLabel || "Contact Form"}
          </p>
        )}
      </div>
    );
  },

  "apple-wallet-button": ({ block }) => (
    <button className="builder-block builder-block-wallet builder-button builder-button-apple">
      {block.settings.showIcon && <span>🍎</span>}
      {block.settings.label}
    </button>
  ),

  "google-wallet-button": ({ block }) => (
    <button className="builder-block builder-block-wallet builder-button builder-button-google">
      {block.settings.showIcon && <span>🔵</span>}
      {block.settings.label}
    </button>
  ),

  "qr-code-block": ({ block, profile, profileId }) => (
    <div className="builder-block builder-block-qr">
      <p className="builder-qr-title">
        {block.settings.label || "Scan to save contact"}
      </p>
      <div className="builder-qr-placeholder">
        <a
          href={`/api/vcard/${profileId}`}
          onClick={() =>
            trackBlockEvent({
              profileId,
              blockId: block.id,
              eventType: "qr_code",
            })
          }
          className="builder-qr-link"
        >
          📱 Download vCard
        </a>
      </div>
    </div>
  ),
};

interface BuilderPublicProfileProps {
  config: BuilderConfig;
  profile: any;
}

/**
 * Main public profile renderer from builder config
 */
export default function BuilderPublicProfile({
  config,
  profile,
}: BuilderPublicProfileProps) {
  const forms = new Map(config.forms.map((form) => [form.id, form]));

  return (
    <div
      className="builder-public-profile"
      style={{ "--builder-accent": config.theme.accentColor } as React.CSSProperties}
    >
      {config.blocks.map((block) => {
        if (!block.visible) return null;

        const BlockComponent = BlockRenderers[block.type];
        if (!BlockComponent) return null;

        return (
          <BlockComponent key={block.id} block={block} profile={profile} forms={forms} profileId={profile.id} />
        );
      })}
    </div>
  );
}
