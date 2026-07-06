"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  ArrowUpRight,
  CalendarDays,
  Calculator,
  ClipboardList,
  FileText,
  Globe,
  Link as LinkIcon,
  Mail,
  MapPin,
  Medal,
  ShoppingBag,
  ShoppingCart,
  AtSign,
  Bolt,
  MessageCircleMore,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  FaApple,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTiktok,
  FaYoutube,
  FaGooglePay,
} from "react-icons/fa6";
import {
  FaCalendarAlt,
  FaEnvelope,
  FaGlobe,
  FaGoogle,
  FaLink,
  FaPhone,
  FaYelp,
} from "react-icons/fa";
import { BuilderBlock } from "@/lib/builder-types";
import { formatPhoneDisplay, normalizeBeginnerConnectLinkHref, ctaRequiresLeadCapture } from "@/lib/connect";
import { trackBlockEvent } from "@/lib/builder-analytics";
import { createInitials, getBlockData, normalizeBlockType } from "./blockUtils";

export interface BlockPreviewProps {
  block: BuilderBlock;
  profile: any;
  profileId: string;
  mode?: "public" | "preview" | "editor";
}

function Placeholder({ text }: { text: string }) {
  return <p className="builder-placeholder-text">{text}</p>;
}

function getOrganizationLine(text: string, profile: any) {
  const organization = String(profile?.business_name || "").trim();
  if (!organization) return "";
  if (organization === text) return "";
  return organization;
}

function ActionChevron() {
  return (
    <span className="builder-action-chevron" aria-hidden="true">
      ›
    </span>
  );
}

function getPrimaryActionIconName(primaryActionType?: string, fallbackIcon?: string) {
  const actionType = String(primaryActionType || "").trim().toLowerCase();

  switch (actionType) {
    case "request_quote":
      return "clipboard";
    case "get_estimate":
      return "calculator";
    case "book_appointment":
      return "calendar";
    case "schedule_consultation":
      return "calendar";
    case "request_info":
      return "message";
    case "contact_me":
      return "message";
    case "place_order":
      return "shopping-bag";
    case "custom":
      return "link";
    default:
      return fallbackIcon || "message";
  }
}

function ActionGlyph({ name }: { name: string }) {
  const iconName = name.toLowerCase();
  const actionIconColor = (() => {
    if (iconName === "phone" || iconName === "call") return "#22C55E";
    if (iconName === "mail" || iconName === "email") return "#EF4444";
    if (iconName === "globe" || iconName === "website") return "#2563EB";
    if (iconName === "map-pin" || iconName === "directions" || iconName === "address") return "#0EA5E9";
    if (iconName === "calendar") return "#0EA5E9";
    if (iconName === "calculator") return "#2563EB";
    if (iconName === "clipboard" || iconName === "file-text") return "#475569";
    if (iconName === "shopping-bag" || iconName === "cart" || iconName === "shopping-cart") return "#7C3AED";
    if (iconName === "bolt") return "#EA580C";
    if (iconName === "message" || iconName === "sms" || iconName === "text") return "#22C55E";
    if (iconName === "link") return "#7C3AED";
    return "currentColor";
  })();
  const commonProps = { size: 16, strokeWidth: 2.15, color: actionIconColor, "aria-hidden": true as const };

  switch (iconName) {
    case "phone":
    case "call":
      return <PhoneCall {...commonProps} />;
    case "mail":
    case "email":
      return <Mail {...commonProps} />;
    case "globe":
    case "website":
      return <Globe {...commonProps} />;
    case "map-pin":
    case "directions":
    case "address":
      return <MapPin {...commonProps} />;
    case "calendar":
      return <CalendarDays {...commonProps} />;
    case "calculator":
      return <Calculator {...commonProps} />;
    case "clipboard":
    case "clipboard-list":
      return <ClipboardList {...commonProps} />;
    case "file-text":
      return <FileText {...commonProps} />;
    case "shopping-bag":
      return <ShoppingBag {...commonProps} />;
    case "cart":
    case "shopping-cart":
      return <ShoppingCart {...commonProps} />;
    case "bolt":
      return <Bolt {...commonProps} />;
    case "message":
    case "sms":
    case "text":
      return <MessageCircleMore {...commonProps} />;
    case "link":
      return <LinkIcon {...commonProps} />;
    default:
      return <ArrowUpRight {...commonProps} />;
  }
}

function SocialGlyph({ platform }: { platform?: string | null }) {
  const value = String(platform || "").toLowerCase();
  const commonProps = { size: 16, "aria-hidden": true as const };

  switch (value) {
    case "instagram":
      return <FaInstagram {...commonProps} />;
    case "facebook":
      return <FaFacebook {...commonProps} />;
    case "youtube":
      return <FaYoutube {...commonProps} />;
    case "linkedin":
      return <FaLinkedin {...commonProps} />;
    case "tiktok":
      return <FaTiktok {...commonProps} />;
    case "google_business":
    case "google":
      return <FaGoogle {...commonProps} />;
    case "yelp":
      return <FaYelp {...commonProps} />;
    case "booking":
      return <FaCalendarAlt {...commonProps} />;
    case "email":
      return <FaEnvelope {...commonProps} />;
    case "phone":
      return <FaPhone {...commonProps} />;
    case "website":
      return <FaGlobe {...commonProps} />;
    case "custom":
      return <FaLink {...commonProps} />;
    default:
      return <AtSign {...commonProps} />;
  }
}

function WalletGlyph({ type }: { type?: string | null }) {
  const value = String(type || "").toLowerCase();
  const commonProps = { size: 18, "aria-hidden": true as const };

  if (value.includes("google")) return <FaGooglePay {...commonProps} />;
  return <FaApple {...commonProps} />;
}

function getSocialIconColor(platform?: string | null, iconColorMode?: string | null) {
  if (iconColorMode !== "brand") return "currentColor";

  const value = String(platform || "").toLowerCase();
  if (value === "website") return "#2563EB";
  if (value === "instagram") return "#E1306C";
  if (value === "facebook") return "#1877F2";
  if (value === "youtube") return "#FF0000";
  if (value === "linkedin") return "#0A66C2";
  if (value === "google_business") return "#34A853";
  if (value === "yelp") return "#D32323";
  if (value === "x" || value === "twitter") return "#111827";
  if (value === "tiktok") return "#000000";
  return "#384862";
}

function resolveSocialHref(platform?: string | null, value?: string | null) {
  return normalizeBeginnerConnectLinkHref(platform || "custom", String(value || ""));
}

function formatActionSubtitle(value: string) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

type ActionCardProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  external?: boolean;
  className?: string;
  placeholder?: boolean;
  onClick?: () => void;
};

function ActionCard({
  icon,
  title,
  subtitle,
  href,
  external,
  className,
  placeholder,
  onClick,
}: ActionCardProps) {
  const classes = [
    "builder-button",
    "builder-action-card",
    placeholder ? "builder-button-placeholder" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!placeholder && href) {
    return (
      <a
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        onClick={onClick}
      >
        <span className="builder-action-icon" aria-hidden="true">{icon}</span>
        <span className="builder-action-content">
          <span className="builder-action-title">{title}</span>
          {subtitle ? <span className="builder-action-subtitle" title={subtitle}>{subtitle}</span> : null}
        </span>
        <ActionChevron />
      </a>
    );
  }

  return (
    <div className={classes} aria-disabled="true">
      <span className="builder-action-icon" aria-hidden="true">{icon}</span>
      <span className="builder-action-content">
        <span className="builder-action-title">{title}</span>
        {subtitle ? <span className="builder-action-subtitle" title={subtitle}>{subtitle}</span> : null}
      </span>
      <ActionChevron />
    </div>
  );
}

function HeroAvatar({
  data,
  profile,
  glowEnabled = true,
  glowOpacity = 0.35,
}: {
  data: any;
  profile: any;
  glowEnabled?: boolean;
  glowOpacity?: number;
}) {
  const [failed, setFailed] = useState(false);
  const normalizeAvatarUrl = (value: unknown) => {
    const url = typeof value === "string" ? value.trim() : "";
    if (!url || url === "null" || url === "undefined" || url.startsWith("blob:")) return "";
    if (!/^https?:\/\//i.test(url)) return "";
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
    } catch {
      return "";
    }
  };
  const avatarUrl = normalizeAvatarUrl(data.avatarUrl) || normalizeAvatarUrl(profile.avatar_url);
  const resolvedAvatarUrl = data.avatarRemoved === true ? "" : avatarUrl;
  const initials = useMemo(
    () => createInitials(data.businessName, profile.business_name, profile.email),
    [data.businessName, profile.business_name, profile.email]
  );

  const avatarShadow = "0 18px 36px rgba(11, 31, 53, 0.18)";
  const borderEnabled = data.avatarBorderEnabled === true;
  const borderWidth = Number.isFinite(Number(data.avatarBorderWidth)) ? Math.max(0, Math.min(8, Number(data.avatarBorderWidth))) : 4;
  const borderRadius = Number.isFinite(Number(data.avatarBorderRadius)) ? Math.max(0, Math.min(999, Number(data.avatarBorderRadius))) : 999;
  const avatarStyle = {
    boxShadow: avatarShadow,
    border: borderEnabled && borderWidth > 0 ? `${borderWidth}px solid ${data.avatarBorderColor || "#FFFFFF"}` : "none",
    borderRadius: `${borderEnabled ? borderRadius : 999}px`,
  };

  if (!resolvedAvatarUrl || failed) {
    return (
      <div className="builder-hero-avatar builder-hero-avatar-fallback" aria-label="Profile initials" style={avatarStyle}>
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <Image
      src={resolvedAvatarUrl}
      alt={data.businessName || profile.business_name || "Profile"}
      width={132}
      height={132}
      className="builder-hero-avatar"
      style={avatarStyle}
      unoptimized
      sizes="132px"
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}

function BadgeIcon({ icon }: { icon: string }) {
  const commonProps = { size: 16, strokeWidth: 2.2, className: "builder-badge-icon", "aria-hidden": true as const, focusable: false };

  switch (icon) {
    case "none":
      return null;
    case "sparkles":
      return <Sparkles {...commonProps} />;
    case "medal":
      return <Medal {...commonProps} />;
    case "shield":
    case "shield-check":
      return <ShieldCheck {...commonProps} />;
    case "badge-check":
    case "checkmark":
    default:
      return <BadgeCheck {...commonProps} />;
  }
}

function resolveTextBlockFont(fontFamily?: string) {
  if (fontFamily === "display") return '"Archivo Black", "Anton", "Avenir Next", sans-serif';
  if (fontFamily === "sans") return '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif';
  if (fontFamily === "serif") return '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  if (fontFamily === "mono") return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  if (fontFamily === "rounded") return '"Trebuchet MS", "Avenir Next Rounded", "Nunito", sans-serif';
  if (fontFamily === "editorial") return 'Georgia, "Times New Roman", Times, serif';
  if (fontFamily === "grotesk") return '"Helvetica Neue", Helvetica, Arial, sans-serif';
  if (fontFamily === "humanist") return '"Gill Sans", "Optima", "Segoe UI", sans-serif';
  if (fontFamily === "condensed") return '"Arial Narrow", "Franklin Gothic Medium", "Roboto Condensed", sans-serif';
  if (fontFamily === "geometric") return '"Futura", "Century Gothic", "Avenir Next", sans-serif';
  if (fontFamily === "elegant") return '"Didot", "Bodoni MT", "Book Antiqua", serif';
  if (fontFamily === "newspaper") return '"Times New Roman", Georgia, Cambria, serif';
  if (fontFamily === "slab") return '"Rockwell", "Roboto Slab", "Georgia", serif';
  if (fontFamily === "clean") return 'Calibri, "Segoe UI", "Avenir Next", sans-serif';
  if (fontFamily === "system") return '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  if (fontFamily === "ui-sans") return '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  if (fontFamily === "ui-serif") return 'ui-serif, Georgia, "Times New Roman", serif';
  if (fontFamily === "ui-mono") return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  if (fontFamily === "humanist-alt") return 'Optima, "Gill Sans", "Segoe UI", sans-serif';
  if (fontFamily === "neo-grotesk") return '"Helvetica Neue", Helvetica, Arial, sans-serif';
  if (fontFamily === "book") return '"Book Antiqua", Palatino, Georgia, serif';
  if (fontFamily === "modern-serif") return 'Baskerville, "Garamond", Georgia, serif';
  if (fontFamily === "tech") return '"SF Mono", Menlo, Monaco, Consolas, monospace';
  if (fontFamily === "narrow") return '"Arial Narrow", "Franklin Gothic Medium", sans-serif';
  if (fontFamily === "poster") return 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
  if (fontFamily === "friendly") return 'Verdana, "Trebuchet MS", sans-serif';
  if (fontFamily === "signature") return '"Segoe Script", "Brush Script MT", cursive';
  if (fontFamily === "luxury") return 'Didot, "Bodoni MT", "Times New Roman", serif';
  if (fontFamily === "slab-alt") return '"Roboto Slab", Rockwell, Georgia, serif';
  return "var(--builder-font-family)";
}

export function AvatarBlockPreview({ block, profile }: BlockPreviewProps) {
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
  const badgePosition = data.verifiedBadgePosition || "top-right";
  const badgeSize = data.verifiedBadgeSize ?? 24;

  return (
    <div className="builder-block builder-block-avatar">
      <div className="builder-hero-avatar-wrap">
        {glowEnabled && glowOpacity > 0 && (glowBlur > 0 || glowSpread > 0) && (
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

        <HeroAvatar data={data} profile={profile} glowEnabled={glowEnabled} glowOpacity={glowOpacity} />

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
    </div>
  );
}

export function BusinessNameBlockPreview({ block, profile }: BlockPreviewProps) {
  const data = getBlockData(block);
  const text = String(data.text || profile.contact_name || profile.business_name || "").trim();
  if (!text) return null;
  const organizationLine = getOrganizationLine(text, profile);
  const colorValue = typeof data.color === "string" ? data.color.trim().toUpperCase() : "";
  const useThemeTextColor = !colorValue || colorValue === "#0F172A" || colorValue === "#111827";
  return (
    <div className="builder-block builder-block-business-name">
      {organizationLine ? <p className="builder-hero-kicker">{organizationLine}</p> : null}
      <h1
        className="builder-hero-name"
        style={{
          color: useThemeTextColor ? "var(--builder-text-color, #F8FAFC)" : data.color || undefined,
          fontSize: `${Number(data.fontSize) || 40}px`,
          fontWeight: Number(data.fontWeight) || 800,
          fontFamily: resolveTextBlockFont(data.fontFamily),
        }}
      >
        {text}
      </h1>
    </div>
  );
}

export function SubheaderBlockPreview({ block, profile }: BlockPreviewProps) {
  const data = getBlockData(block);
  const text = String(data.text || profile.title || "").trim();
  if (!text) return null;
  const colorValue = typeof data.color === "string" ? data.color.trim().toUpperCase() : "";
  const useThemeTextColor = !colorValue || colorValue === "#0F172A" || colorValue === "#111827";
  return (
    <div className="builder-block builder-block-subheader">
      <p
        className="builder-hero-title"
        style={{
          color: useThemeTextColor ? "var(--builder-text-color, #F8FAFC)" : data.color || undefined,
          fontSize: `${Number(data.fontSize) || 22}px`,
          fontWeight: Number(data.fontWeight) || 600,
          fontFamily: resolveTextBlockFont(data.fontFamily),
        }}
      >
        {text}
      </p>
    </div>
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
  const badgePosition = data.verifiedBadgePosition || "top-right";
  const badgeSize = data.verifiedBadgeSize ?? 24;

  const headline = String(data.businessName || profile.contact_name || profile.business_name || "").trim();
  const organizationLine = getOrganizationLine(headline, profile);
  const title = String(data.title || profile.title || "").trim();
  const bio = String(data.bio || profile.bio || "").trim();

  if (!headline && !title && !bio && data.showProfilePicture === false) return null;

  return (
    <div className="builder-block builder-block-hero" style={{ "--builder-accent": data.brandColor || undefined } as React.CSSProperties}>
      <div className="builder-hero-cover" aria-hidden="true" />
      {data.showProfilePicture !== false && (
        <div className="builder-hero-avatar-wrap">
          {glowEnabled && glowOpacity > 0 && (glowBlur > 0 || glowSpread > 0) && (
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

          <HeroAvatar data={data} profile={profile} glowEnabled={glowEnabled} glowOpacity={glowOpacity} />

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
      <div className="builder-hero-text">
        {organizationLine ? <p className="builder-hero-kicker">{organizationLine}</p> : null}
        {headline ? <h1 className="builder-hero-name">{headline}</h1> : null}
        {title ? <p className="builder-hero-title">{title}</p> : null}
        {bio ? <p className="builder-hero-bio">{bio}</p> : null}
      </div>
    </div>
  );
}

export function ContactButtonsPreview({ block, profile, profileId }: BlockPreviewProps) {
  const data = getBlockData(block);
  const phone = data.phone || profile.phone;
  const phoneDisplay = formatPhoneDisplay(phone);
  const email = data.email || profile.email;
  const website = data.website || profile.website;
  const address = data.address || profile.address;
  const sms = data.sms || profile.sms;

  const cards = [
    data.showPhone !== false ? {
      key: "phone",
      title: "Call",
      subtitle: phoneDisplay || undefined,
      href: phone ? `tel:${phone}` : undefined,
      placeholder: !phone,
      icon: <ActionGlyph name="phone" /> as any,
      onClick: phone ? () => trackBlockEvent({ profileId, blockId: block.id, eventType: "phone" }) : undefined,
    } : null,
    data.showEmail !== false ? {
      key: "email",
      title: "Email",
      subtitle: email || undefined,
      href: email ? `mailto:${email}` : undefined,
      placeholder: !email,
      icon: <ActionGlyph name="email" /> as any,
      onClick: email ? () => trackBlockEvent({ profileId, blockId: block.id, eventType: "email" }) : undefined,
    } : null,
    data.showWebsite !== false ? {
      key: "website",
      title: "Website",
      subtitle: website || undefined,
      href: website || undefined,
      external: Boolean(website),
      placeholder: !website,
      icon: <ActionGlyph name="website" /> as any,
      onClick: website ? () => trackBlockEvent({ profileId, blockId: block.id, eventType: "website" }) : undefined,
    } : null,
  ].filter(Boolean) as Array<{
    key: string;
    title: string;
    subtitle?: string;
    href?: string;
    external?: boolean;
    placeholder?: boolean;
    icon: any;
    onClick?: () => void;
  }>;

  const visibleCards = cards.filter((card) => !card.placeholder);
  if (!visibleCards.length) return null;

  return (
    <div className={`builder-block builder-block-contact builder-contact-${data.style || "grid"}`}>
      <div className="builder-contact-primary-pills">
        {visibleCards.map((card) => (
          <ActionCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            subtitle={card.subtitle}
            href={card.href}
            external={card.external}
            placeholder={card.placeholder}
            className="builder-action-pill"
            onClick={card.onClick}
          />
        ))}
      </div>

      {(data.showAddress || data.showSms || data.showCustom) ? (
        <div className="builder-contact-secondary-list">
          {data.showAddress ? (
            address ? (
            <ActionCard
              icon={<ActionGlyph name="directions" /> as any}
              title="Directions"
              subtitle={address}
              href={address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : undefined}
              external={Boolean(address)}
              placeholder={!address}
            />
            ) : null
          ) : null}
          {data.showSms ? (
            sms ? (
            <ActionCard
              icon={<ActionGlyph name="sms" /> as any}
              title="Text"
              subtitle={sms}
              href={sms ? `sms:${sms}` : undefined}
              placeholder={!sms}
            />
            ) : null
          ) : null}
          {data.showCustom ? (
            data.customUrl ? (
            <ActionCard
              icon={<ActionGlyph name="link" /> as any}
              title={data.customLabel || "Custom"}
              subtitle={data.customUrl}
              href={data.customUrl || undefined}
              external={Boolean(data.customUrl)}
              placeholder={!data.customUrl}
            />
            ) : null
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PhoneBlockPreview({ block, profile }: BlockPreviewProps) {
  const data = getBlockData(block);
  const type = normalizeBlockType(String((block as any).type));

  if (type === "email-button") {
    const email = data.email || data.value || profile.email;
    if (!email) return null;
    return (
      <div className="builder-block">
        <ActionCard
          icon={<ActionGlyph name="email" /> as any}
          title={data.label || "Email"}
          subtitle={email || undefined}
          href={email ? `mailto:${email}` : undefined}
          placeholder={!email}
        />
      </div>
    );
  }

  if (type === "website-button") {
    const websiteRaw = data.website || data.url || profile.website;
    const websiteHref = normalizeBeginnerConnectLinkHref("website", websiteRaw);
    if (!websiteHref) return null;
    const websiteLabel = formatActionSubtitle(websiteRaw || websiteHref);
    return (
      <div className="builder-block">
        <ActionCard
          icon={<ActionGlyph name="website" /> as any}
          title={data.label || "Website"}
          subtitle={websiteLabel || undefined}
          href={websiteHref}
          external={true}
          placeholder={false}
        />
      </div>
    );
  }

  if (type === "directions-button") {
    const address = data.address || profile.address;
    const mapsHref = data.url || (address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : undefined);
    if (!mapsHref) return null;
    return (
      <div className="builder-block">
        <ActionCard
          icon={<ActionGlyph name="directions" /> as any}
          title={data.label || "Directions"}
          subtitle={address || data.url || undefined}
          href={mapsHref}
          external={Boolean(mapsHref)}
          placeholder={!mapsHref}
        />
      </div>
    );
  }

  const phone = data.phone || data.value || profile.phone;
  const phoneDisplay = formatPhoneDisplay(phone);
  const behavior = data.behavior === "text" ? "sms" : data.behavior || "call";
  const href = behavior === "sms" ? `sms:${phone || ""}` : `tel:${phone || ""}`;
  if (!phone) return null;

  return (
    <div className="builder-block">
      <ActionCard
        icon={<ActionGlyph name={behavior === "sms" ? "sms" : "phone"} /> as any}
        title={data.label || (behavior === "sms" ? "Text" : "Call")}
        subtitle={phoneDisplay || undefined}
        href={phone ? href : undefined}
        placeholder={!phone}
      />
    </div>
  );
}

export function BookingBlockPreview({ block, mode = "public" }: BlockPreviewProps) {
  const data = getBlockData(block);
  const type = normalizeBlockType(String((block as any).type));
  const isPrimaryAction = data.isPrimaryAction === true;
  const url = String(data.url || "").trim();
  const label = String(data.label || "").trim();
  const isPreviewMode = mode === "preview" || mode === "editor";
  
  // Check if CTA requires lead capture but it's disabled
  const requiresLeadCapture = isPrimaryAction && ctaRequiresLeadCapture(data.primaryActionType, url);
  const leadCaptureDisabled = isPrimaryAction && data.primaryActionLeadCaptureEnabled === false;
  const shouldHideDueToLeadCapture = requiresLeadCapture && leadCaptureDisabled;

  const resolvedIconName =
    type === "directions-button"
      ? "directions"
      : type === "custom-link-button" && !isPrimaryAction
        ? "link"
        : type === "request-quote-button" || isPrimaryAction
          ? getPrimaryActionIconName(data.primaryActionType, data.icon)
          : data.icon || "calendar";

  const icon = <ActionGlyph name={resolvedIconName} />;
  const defaultTitle =
    type === "directions-button" ? "Directions" :
    type === "custom-link-button" ? "Custom Link" :
    "Request / Book";
  const subtitle = data.description || url || undefined;

  // Hide CTA if it requires lead capture but lead capture is disabled
  if (shouldHideDueToLeadCapture) {
    return null;
  }

  if (!url && !(isPreviewMode && isPrimaryAction && label)) {
    return null;
  }

  return (
    <div className="builder-block">
      <ActionCard
        icon={icon as any}
        title={label || defaultTitle}
        subtitle={subtitle}
        href={url || undefined}
        external={Boolean(url)}
        placeholder={!url}
        className={isPrimaryAction ? "builder-primary-cta-card" : undefined}
      />
    </div>
  );
}

export function SocialLinksPreview({ block, mode = "public" }: BlockPreviewProps) {
  const data = getBlockData(block);
  const isPreviewMode = mode === "preview" || mode === "editor";
  const links = Array.isArray(data.links)
    ? data.links
        .filter((link: any) => link.visible !== false)
        .map((link: any) => {
          const title = String(link.label || link.platform || "Social").trim();
          const rawValue = String(link.value || "").trim();
          const href = resolveSocialHref(link.platform, rawValue);
          const previewOnly = link.previewOnly === true;
          return { ...link, title, rawValue, href, previewOnly };
        })
        .filter((link: any) => {
          if (isPreviewMode) {
            return Boolean(link.title);
          }
          return Boolean(link.href);
        })
        .slice(0, 6)
    : [];
  const iconColorMode = data.iconColorMode || "brand";
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="builder-block builder-block-social">
      {links.map((link: any, idx: number) => {
        const treatment = link.iconTreatment === "brand" || link.iconTreatment === "mono" ? link.iconTreatment : iconColorMode;
        const subtitle = link.rawValue || (isPreviewMode ? "Add destination URL" : "");

        return (
          <ActionCard
            key={link.id || idx}
            icon={<span style={{ color: getSocialIconColor(link.platform, treatment) }}><SocialGlyph platform={link.platform} /></span>}
            title={link.title}
            subtitle={subtitle || undefined}
            href={link.href || undefined}
            external={Boolean(link.href)}
            placeholder={!link.href}
            className="builder-button-social"
          />
        );
      })}
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

export function ImageBlockPreview({ block, profileId }: BlockPreviewProps) {
  const data = getBlockData(block);
  const [failed, setFailed] = useState(false);
  
  const content = data.imageUrl && !failed ? (
    <Image
      src={data.imageUrl}
      alt={data.altText || "Image"}
      width={1280}
      height={720}
      className="builder-image"
      unoptimized
      loading="lazy"
      sizes="(max-width: 768px) 100vw, 520px"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="builder-image-placeholder" title="Tap to add image">
      <svg viewBox="0 0 24 24" className="builder-image-icon">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
      </svg>
      <p className="builder-image-placeholder-text">Add image</p>
    </div>
  );

  return (
    <div className="builder-block builder-block-image">
      {data.linkUrl ? (
        <a href={data.linkUrl} target="_blank" rel="noreferrer">{content}</a>
      ) : (
        content
      )}
      {data.caption && <p className="builder-image-caption">{data.caption}</p>}
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

export function FormBlockPreview({ block, profile, mode }: BlockPreviewProps) {
  const data = getBlockData(block);
  const isGuidedLeadForm = data.source === "clutch_connect_profile";
  const profileId = String(profile?.id || "").trim();
  const profileSlug = String(profile?.slug || "").trim();
  const leadCaptureEnabled = data.leadCaptureEnabled !== false;
  const sent = profile?._leadSent === true;
  const rateLimited = profile?._leadRateLimited === true;
  const submitError = profile?._leadError === true;

  if (!leadCaptureEnabled && mode !== "editor") {
    return null;
  }

  if (mode === "preview" || mode === "editor") {
    if (isGuidedLeadForm) {
      return null;
    }

    return (
      <div className="builder-block builder-block-form">
        <h3 className="builder-form-title">{data.formLabel || "Contact Form"}</h3>
        <p className="builder-form-description">
          {data.description || "Use this form to collect lead details from visitors."}
        </p>
        <p className="builder-form-placeholder">{data.submitText || "Send"}</p>
      </div>
    );
  }

  if (!profileId || !profileSlug) {
    return null;
  }

  return (
    <div className="builder-block builder-block-form">
      <h3 className="builder-form-title" id="lead-form">{data.formLabel || "Contact Form"}</h3>
      <p className="builder-form-description">
        {data.description || "Use this form to collect lead details from visitors."}
      </p>

      {sent ? <div className="connect-success">Thanks! Your request was sent.</div> : null}
      {rateLimited ? <div className="connect-error">Too many requests. Please wait one minute and try again.</div> : null}
      {submitError ? <div className="connect-error">Something went wrong. Please try again.</div> : null}

      <form action="/api/connect/leads" method="post" className="connect-lead-form">
        <input type="hidden" name="profile_id" value={profileId} />
        <input type="hidden" name="slug" value={profileSlug} />
        <input type="hidden" name="source" value="clutch_connect_profile" />
        <input type="hidden" name="primary_action_type" value={String(data.primaryActionType || "request_quote")} />
        <input type="hidden" name="primary_action_label" value={String(data.primaryActionLabel || data.submitText || "Request a Quote")} />
        <input type="hidden" name="form_type" value={String(data.formType || "quote_request")} />

        <div className="connect-lead-grid">
          <input name="name" placeholder="Your name" className="connect-input" required />
          <input name="email" type="email" placeholder="Your email" className="connect-input" />
          <input name="phone" placeholder="Your phone" className="connect-input" />
          <textarea name="message" placeholder="How can we help?" className="connect-input" rows={3} />
        </div>

        <input
          name="company_website"
          className="connect-honeypot"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
        />

        <button className="connect-submit" type="submit">
          {data.submitText || "Send"}
        </button>
      </form>
    </div>
  );
}

export function WalletButtonPreview({ block }: BlockPreviewProps) {
  const data = getBlockData(block);
  const type = String((block as any).type);
  const label = data.label || (type.includes("apple") ? "Add to Apple Wallet" : "Add to Google Wallet");
  return (
    <div className="builder-block">
      <ActionCard
        icon={data.showIcon !== false ? <WalletGlyph type={type} /> : "💳"}
        title={label}
        subtitle={data.url || undefined}
        href={data.url || undefined}
        external={Boolean(data.url)}
        placeholder={!data.url}
        className="builder-button-wallet"
      />
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
