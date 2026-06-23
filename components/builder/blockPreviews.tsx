"use client";

import { useMemo, useState } from "react";
import { BuilderBlock } from "@/lib/builder-types";
import { trackBlockEvent } from "@/lib/builder-analytics";
import { createInitials, getBlockData } from "./blockUtils";

export interface BlockPreviewProps {
  block: BuilderBlock;
  profile: any;
  profileId: string;
}

function Placeholder({ text }: { text: string }) {
  return <p className="builder-placeholder-text">{text}</p>;
}

function HeroAvatar({ data, profile }: { data: any; profile: any }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = data.avatarUrl || profile.avatar_url;
  const initials = useMemo(
    () => createInitials(data.businessName, profile.business_name, profile.email),
    [data.businessName, profile.business_name, profile.email]
  );

  if (!avatarUrl || failed) {
    return (
      <div className="builder-hero-avatar builder-hero-avatar-fallback" aria-label="Profile initials">
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={data.businessName || profile.business_name || "Profile"}
      className="builder-hero-avatar"
      onError={() => setFailed(true)}
    />
  );
}

function BadgeIcon({ icon }: { icon: string }) {
  if (icon === "none") return null;

  if (icon === "star") {
    return (
      <svg viewBox="0 0 24 24" className="builder-badge-icon" aria-hidden="true" focusable="false">
        <path
          d="M12 3.2l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 15.44l-4.8 2.52.92-5.34L4.24 8.84l5.36-.78L12 3.2z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="builder-badge-icon" aria-hidden="true" focusable="false">
        <path
          d="M12 2.5l7 3v6.1c0 4.3-2.58 8.18-7 9.9-4.42-1.72-7-5.6-7-9.9V5.5l7-3z"
          fill="currentColor"
        />
        <path
          d="M9.05 12.05l1.95 1.95 3.95-3.95"
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="builder-badge-icon" aria-hidden="true" focusable="false">
      <path
        d="M20.3 6.7a1 1 0 010 1.42l-9.18 9.18a1 1 0 01-1.42 0L3.7 11.3a1 1 0 111.42-1.42l5.29 5.3 8.47-8.48a1 1 0 011.42 0z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ProfileHeroPreview({ block, profile }: BlockPreviewProps) {
  const data = getBlockData(block);
  const glowEnabled = data.avatarGlowEnabled !== false;
  const glowColor = data.avatarGlowColor || "#FF6B2C";
  const glowOpacity = data.avatarGlowOpacity ?? 0.35;
  const glowBlur = data.avatarGlowBlur ?? 18;
  const glowSpread = data.avatarGlowSpread ?? 10;

  const badgeEnabled = Boolean(data.verifiedBadgeEnabled ?? data.verified);
  const badgeColor = data.verifiedBadgeColor || "#f59e0b";
  const badgeIconColor = data.verifiedBadgeIconColor || "#0f172a";
  const badgeIcon = data.verifiedBadgeIcon || "checkmark";
  const badgePosition = data.verifiedBadgePosition || "bottom-right";
  const badgeSize = data.verifiedBadgeSize ?? 24;

  return (
    <div className="builder-block builder-block-hero" style={{ "--builder-accent": data.brandColor || undefined } as React.CSSProperties}>
      {data.showProfilePicture !== false && (
        <div className="builder-hero-avatar-wrap">
          {glowEnabled && (
            <span
              className="builder-avatar-glow-layer"
              style={{
                backgroundColor: glowColor,
                opacity: glowOpacity,
                filter: `blur(${glowBlur}px)`,
                inset: `-${glowSpread}px`,
              }}
              aria-hidden="true"
            />
          )}

          <HeroAvatar data={data} profile={profile} />

          {badgeEnabled && (
            <span
              className={`builder-verified-badge builder-verified-badge-${badgePosition}`}
              style={{
                backgroundColor: badgeColor,
                color: badgeIconColor,
                width: `${badgeSize}px`,
                height: `${badgeSize}px`,
                fontSize: `${Math.max(10, Math.round(badgeSize * 0.55))}px`,
              }}
              aria-label="Verified badge"
            >
              <BadgeIcon icon={badgeIcon} />
            </span>
          )}
        </div>
      )}
      <h1 className="builder-hero-name">{data.businessName || profile.business_name || "Your Business Name"}</h1>
      <p className="builder-hero-title">{data.title || profile.title || "Your Title"}</p>
      <p className="builder-hero-bio">{data.bio || profile.bio || "Add a short bio to introduce your business."}</p>
    </div>
  );
}

export function ContactButtonsPreview({ block, profile, profileId }: BlockPreviewProps) {
  const data = getBlockData(block);
  const phone = data.phone || profile.phone;
  const email = data.email || profile.email;
  const website = data.website || profile.website;
  const address = data.address || profile.address;
  const sms = data.sms || profile.sms;

  return (
    <div className={`builder-block builder-block-contact builder-contact-${data.style || "grid"}`}>
      {data.showPhone !== false ? (
        phone ? (
          <a href={`tel:${phone}`} className="builder-button" onClick={() => trackBlockEvent({ profileId, blockId: block.id, eventType: "phone" })}><span>📞</span>Call</a>
        ) : <div className="builder-button builder-button-placeholder"><span>📞</span>Call</div>
      ) : null}
      {data.showEmail !== false ? (
        email ? (
          <a href={`mailto:${email}`} className="builder-button" onClick={() => trackBlockEvent({ profileId, blockId: block.id, eventType: "email" })}><span>✉️</span>Email</a>
        ) : <div className="builder-button builder-button-placeholder"><span>✉️</span>Email</div>
      ) : null}
      {data.showWebsite !== false ? (
        website ? (
          <a href={website} target="_blank" rel="noreferrer" className="builder-button" onClick={() => trackBlockEvent({ profileId, blockId: block.id, eventType: "website" })}><span>🌐</span>Website</a>
        ) : <div className="builder-button builder-button-placeholder"><span>🌐</span>Website</div>
      ) : null}
      {data.showAddress ? (
        address ? (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="builder-button"><span>📍</span>Address</a>
        ) : <div className="builder-button builder-button-placeholder"><span>📍</span>Address</div>
      ) : null}
      {data.showSms ? (
        sms ? (
          <a href={`sms:${sms}`} className="builder-button"><span>💬</span>Text</a>
        ) : <div className="builder-button builder-button-placeholder"><span>💬</span>Text</div>
      ) : null}
      {data.showCustom ? (
        data.customUrl ? (
          <a href={data.customUrl} target="_blank" rel="noreferrer" className="builder-button"><span>🔗</span>{data.customLabel || "Custom"}</a>
        ) : <div className="builder-button builder-button-placeholder"><span>🔗</span>{data.customLabel || "Custom"}</div>
      ) : null}
    </div>
  );
}

export function PhoneBlockPreview({ block, profile }: BlockPreviewProps) {
  const data = getBlockData(block);
  const phone = data.phone || profile.phone;
  const behavior = data.behavior || "call";
  const href = behavior === "sms" ? `sms:${phone || ""}` : `tel:${phone || ""}`;
  return phone ? (
    <a href={href} className="builder-block builder-button">
      <span>{behavior === "sms" ? "💬" : "📞"}</span>
      {data.label || "Call"}
    </a>
  ) : (
    <div className="builder-block builder-button builder-button-placeholder">
      <span>{behavior === "sms" ? "💬" : "📞"}</span>
      {data.label || "Call"}
    </div>
  );
}

export function BookingBlockPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  if (data.url) {
    return (
      <a href={data.url} target="_blank" rel="noreferrer" className="builder-block builder-button">
        <span>📅</span>
        {data.label || "Request / Book"}
      </a>
    );
  }
  return (
    <div className="builder-block builder-button builder-button-placeholder">
      <span>📅</span>
      {data.label || "Request / Book"}
    </div>
  );
}

export function SocialLinksPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  const links = Array.isArray(data.links) ? data.links : [];
  if (links.length === 0) {
    return (
      <div className="builder-block builder-block-social">
        <Placeholder text="Add social links to display them here." />
      </div>
    );
  }

  return (
    <div className="builder-block builder-block-social">
      {links.map((link: any, idx: number) => (
        <a
          key={link.id || idx}
          href={link.value || "#"}
          className="builder-button builder-button-social"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!link.value) e.preventDefault();
          }}
          title={link.platform || "Social"}
        >
          {(link.platform || "S").slice(0, 1)}
        </a>
      ))}
    </div>
  );
}

export function ServicesPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  const services = Array.isArray(data.services) ? data.services : [];
  return (
    <div className="builder-block builder-block-services">
      <h3 className="builder-services-title">{data.title || "Services"}</h3>
      {services.length === 0 ? (
        <Placeholder text="Add services to populate this section." />
      ) : (
        <ul className="builder-services-list">
          {services.map((service: any, idx: number) => (
            <li key={service.id || idx}>
              <strong>{service.title || "Service"}</strong>
              {service.description ? <div>{service.description}</div> : null}
              {service.price ? <div>{service.price}</div> : null}
              {service.url ? <a href={service.url} target="_blank" rel="noreferrer">Learn more</a> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TextSectionPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  return (
    <div className="builder-block builder-block-text" style={{ textAlign: data.alignment || "center" }}>
      <h2 className="builder-text-heading">{data.heading || "About Me"}</h2>
      <p className="builder-text-content">{data.content || "Add text to share more details about your business."}</p>
    </div>
  );
}

export function ImageBlockPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  const [failed, setFailed] = useState(false);
  const content = data.imageUrl && !failed ? (
    <img src={data.imageUrl} alt={data.altText || "Image"} className="builder-image" onError={() => setFailed(true)} />
  ) : (
    <div className="builder-image-placeholder">
      <span>🖼️</span>
      <Placeholder text="Add an image URL to display this block." />
    </div>
  );

  return (
    <div className="builder-block builder-block-image">
      {data.linkUrl ? (
        <a href={data.linkUrl} target="_blank" rel="noreferrer">{content}</a>
      ) : (
        content
      )}
      <p className="builder-image-caption">{data.caption || "Image caption"}</p>
    </div>
  );
}

export function UnknownBlockPreview({ block }: BlockPreviewProps) {
  return (
    <div className="builder-block builder-block-unknown">
      <h3 className="builder-unknown-title">Unsupported block</h3>
      <p className="builder-unknown-type">Type: {String((block as any).type)}</p>
    </div>
  );
}

export function BusinessHoursPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  const hours = data.hours || {};
  const entries = Object.entries(hours).filter(([, value]) => String(value || "").trim().length > 0);

  return (
    <div className="builder-block builder-block-hours">
      <h3 className="builder-hours-title">{data.title || "Business Hours"}</h3>
      {entries.length > 0 ? (
        <div className="builder-hours-list">
          {entries.map(([day, time]) => (
            <div key={day} className="builder-hours-item">
              <span className="builder-hours-day">{day}</span>
              <span className="builder-hours-time">{String(time)}</span>
            </div>
          ))}
        </div>
      ) : (
        <Placeholder text="Set your weekly business hours." />
      )}
    </div>
  );
}

export function FormBlockPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  return (
    <div className="builder-block builder-block-form">
      <h3 className="builder-form-title">{data.formLabel || "Contact Form"}</h3>
      <p className="builder-form-description">
        {data.description || "Use this form to collect lead details from visitors."}
      </p>
      <p className="builder-form-placeholder">{data.submitText || "Send"} button preview</p>
    </div>
  );
}

export function WalletButtonPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  const icon = String((block as any).type).includes("apple") ? "🍎" : "🔵";
  const label = data.label || "Add to Wallet";

  if (data.url) {
    return (
      <a href={data.url} target="_blank" rel="noreferrer" className="builder-block builder-button builder-button-wallet">
        {data.showIcon !== false && <span>{icon}</span>}
        {label}
      </a>
    );
  }

  return (
    <div className="builder-block builder-button builder-button-wallet builder-button-placeholder">
      {data.showIcon !== false && <span>{icon}</span>}
      {label}
    </div>
  );
}

export function QRCodeBlockPreview({ block, profileId }: BlockPreviewProps) {
  const data = getBlockData(block);
  const link = data.url || `/api/vcard/${profileId}`;

  return (
    <div className="builder-block builder-block-qr">
      {data.showLabel !== false && (
        <p className="builder-qr-title">{data.label || "Scan to connect"}</p>
      )}
      <div className="builder-qr-placeholder">
        <a href={link} target="_blank" rel="noreferrer" className="builder-qr-link">
          📱 Open QR Link
        </a>
      </div>
      {data.caption ? <p className="builder-image-caption">{data.caption}</p> : null}
    </div>
  );
}
