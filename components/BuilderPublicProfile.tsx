"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { FaAddressCard, FaApple, FaGooglePay, FaLink, FaQrcode, FaShareNodes } from "react-icons/fa6";
import { BuilderConfig, ProfileSection } from "@/lib/builder-types";
import { getBlockData, normalizeBlockType } from "./builder/blockUtils";
import {
  ProfileHeroPreview,
  AvatarBlockPreview,
  BusinessNameBlockPreview,
  SubheaderBlockPreview,
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
  mode?: "public" | "preview" | "editor";
  editablePreview?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  onSelectSection?: (sectionId: string) => void;
  onSelectSaveShare?: () => void;
  onRemoveBlock?: (blockId: string) => void;
  onRemoveSection?: (sectionId: string) => void;
}

function normalizeHex(value: unknown) {
  const raw = typeof value === "string" ? value.trim().replace(/^#/, "") : "";
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((char) => char + char)
      .join("")
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return null;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function getReadableTextColor(hex: string) {
  const normalized = normalizeHex(hex) || "#FFA665";
  const raw = normalized.slice(1);
  const red = parseInt(raw.slice(0, 2), 16);
  const green = parseInt(raw.slice(2, 4), 16);
  const blue = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#0F172A" : "#F8FAFC";
}

function toCssImageUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const safe = raw.replace(/["\\\n\r]/g, "");
  return safe ? `url("${safe}")` : null;
}

function resolveFontFamily(fontFamily?: string) {
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
  return 'var(--font-exo2), "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif';
}

function sectionHeaderStyle(section: ProfileSection): React.CSSProperties {
  const style = section.style;
  const fontSize = clampNumber(style.fontSize, 10, 40, 13);
  const letterSpacing = clampNumber(style.letterSpacing, 0, 10, 2);
  const borderWidth = clampNumber(style.borderWidth, 0, 12, 1);
  const borderRadius = clampNumber(style.borderRadius, 0, 999, 999);
  const paddingX = clampNumber(style.paddingX, 0, 48, 18);
  const paddingY = clampNumber(style.paddingY, 0, 32, 10);
  const marginTop = clampNumber(style.marginTop, 0, 60, 0);
  const marginBottom = clampNumber(style.marginBottom, 0, 60, 14);
  const rawTextColor = typeof style.textColor === "string" ? style.textColor.trim().toUpperCase() : "";
  const rawBackgroundColor = typeof style.backgroundColor === "string" ? style.backgroundColor.trim().toLowerCase() : "";
  const rawBorderColor = typeof style.borderColor === "string" ? style.borderColor.trim().toLowerCase() : "";
  const textColor = !rawTextColor || rawTextColor === "#FFFFFF" || rawTextColor === "WHITE"
    ? "var(--builder-section-label-color, #384862)"
    : style.textColor;
  const backgroundColor = !rawBackgroundColor || rawBackgroundColor === "transparent" || rawBackgroundColor === "rgba(0,0,0,0)"
    ? "var(--builder-section-label-bg, #FFFFFF)"
    : style.backgroundColor;
  const borderColor = !rawBorderColor || rawBorderColor === "transparent"
    ? "var(--builder-section-label-border, rgba(255, 166, 101, 0.32))"
    : style.borderColor;

  return {
    justifyContent: style.alignment === "center" ? "center" : style.alignment === "right" ? "flex-end" : "flex-start",
    fontFamily: style.fontFamily && style.fontFamily !== "inherit" ? resolveFontFamily(style.fontFamily) : undefined,
    fontSize: `${fontSize}px`,
    fontWeight: style.fontWeight,
    letterSpacing: `${letterSpacing}px`,
    textTransform: style.textTransform,
    color: textColor,
    backgroundColor,
    borderColor,
    borderWidth: `${borderWidth}px`,
    borderStyle: borderWidth > 0 ? "solid" : "none",
    borderRadius: `${borderRadius}px`,
    padding: `${paddingY}px ${paddingX}px`,
    marginTop: `${marginTop}px`,
    marginBottom: `${marginBottom}px`,
  };
}

const PREVIEW_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "profile-hero": ProfileHeroPreview,
  "avatar-block": AvatarBlockPreview,
  "business-name-block": BusinessNameBlockPreview,
  "subheader-block": SubheaderBlockPreview,
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
  mode = "public",
  editablePreview = false,
  selectedBlockId,
  onSelectBlock,
  onSelectSection,
  onSelectSaveShare,
  onRemoveBlock,
  onRemoveSection,
}: BuilderPublicProfileProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);
  const background = config.theme.background || {
    type: "soft",
    color: "#F8FAFC",
    gradientFrom: "#FFFFFF",
    gradientTo: "#FFF4EC",
  };
  const buttons = config.theme.buttons || {
    style: "rounded",
    color: config.theme.buttonColor || config.theme.accentColor || "#FFA665",
    textColor: "",
  };
  const banner = config.theme.banner || {
    enabled: false,
    type: "none",
    height: 160,
    backgroundColor: "#FFA665",
    gradientFrom: "#FFFFFF",
    gradientTo: "#FFA665",
    imageUrl: null,
    imagePosition: "center",
    overlayEnabled: false,
    overlayOpacity: 0.22,
    borderRadius: 24,
    avatarOverlap: true,
    textAlign: "center",
  };
  const buttonColor = normalizeHex(buttons.color) || normalizeHex(config.theme.buttonColor) || normalizeHex(config.theme.accentColor) || "#FFA665";
  const buttonTextColor = normalizeHex(buttons.textColor) || getReadableTextColor(buttonColor);
  const buttonShape = buttons.style === "pill" || buttons.style === "square" ? buttons.style : "rounded";
  const backgroundType = background.type === "solid" || background.type === "gradient" ? background.type : "soft";
  const backgroundColor = normalizeHex(background.color) || "#F8FAFC";
  const backgroundGradientFrom = normalizeHex(background.gradientFrom) || "#FFFFFF";
  const backgroundGradientTo = normalizeHex(background.gradientTo) || "#FFF4EC";
  const bannerType = banner.type === "solid" || banner.type === "gradient" || banner.type === "image" || banner.type === "glass" ? banner.type : "none";
  const bannerEnabled = banner.enabled !== false && bannerType !== "none";
  const bannerHeight = clampNumber(banner.height, 80, 320, 160);
  const bannerBackgroundColor = normalizeHex(banner.backgroundColor) || normalizeHex(config.theme.accentColor) || "#FFA665";
  const bannerGradientFrom = normalizeHex(banner.gradientFrom) || "#FFFFFF";
  const bannerGradientTo = normalizeHex(banner.gradientTo) || bannerBackgroundColor;
  const bannerOverlayOpacity = clampNumber(banner.overlayOpacity, 0, 1, 0.22);
  const bannerRadius = clampNumber(banner.borderRadius, 0, 40, 24);
  const bannerImagePosition = banner.imagePosition === "top" || banner.imagePosition === "bottom" ? banner.imagePosition : "center";
  const bannerImageCss = bannerType === "image" ? toCssImageUrl(banner.imageUrl) : null;
  const bannerHasImage = Boolean(bannerImageCss);
  const effectiveBannerHeight = bannerType === "image" && !bannerHasImage
    ? Math.min(bannerHeight, 160)
    : bannerHeight;
  const bannerHeaderAlign = banner.textAlign === "left" || banner.textAlign === "right" ? banner.textAlign : "center";
  const bannerOverlap = banner.avatarOverlap !== false;
  const themeTextColor = normalizeHex(config.theme.textColor);
  const themeMode = config.theme.themeMode || "system";
  const profileStyle = config.theme.profileStyle || "clutch";
  const [resolvedThemeMode, setResolvedThemeMode] = useState<"light" | "dark">(themeMode === "dark" ? "dark" : "light");
  const fontFamily = resolveFontFamily(config.theme.fontFamily);
  const fontScale = config.theme.fontScale === "large" ? 1.12 : 1;
  const profileId = String(profile?.id || "").trim();
  const slug = profile?.slug || undefined;
  const hasProfileId = Boolean(profileId);
  const showSaveShareSection = config.theme.showSaveShareSection !== false;
  const saveSharePosition = config.theme.saveSharePosition === "top" ? "top" : "bottom";
  const saveShareAlignment = config.theme.saveShareAlignment === "left" || config.theme.saveShareAlignment === "right"
    ? config.theme.saveShareAlignment
    : "center";
  const showSaveContact = config.theme.saveShareShowSaveContact !== false;
  const showAppleWallet = config.theme.saveShareShowAppleWallet !== false;
  const showGoogleWallet = config.theme.saveShareShowGoogleWallet !== false;
  const showShareProfile = config.theme.saveShareShowShareProfile !== false;
  const showCopyLink = config.theme.saveShareShowCopyLink !== false;
  const showDownloadQr = config.theme.saveShareShowDownloadQr !== false;
  const saveContactHref = hasProfileId ? `/api/vcard/${profileId}` : "";
  const appleWalletHref = hasProfileId ? `/api/wallet/apple/${profileId}` : "";
  const googleWalletHref = hasProfileId ? `/api/wallet/google/${profileId}` : "";
  const qrDownloadHref = hasProfileId ? `/api/qr/${profileId}/download` : "";
  const profileName = String(profile?.contact_name || profile?.business_name || "Clutch Connect").trim();

  useEffect(() => {
    if (themeMode === "system") {
      if (typeof window === "undefined") return;
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => setResolvedThemeMode(media.matches ? "dark" : "light");
      apply();
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    setResolvedThemeMode(themeMode === "dark" ? "dark" : "light");
  }, [themeMode]);

  const textColor = resolvedThemeMode === "dark"
    ? (themeTextColor && themeTextColor !== "#0F172A" ? themeTextColor : "#F8FAFC")
    : themeTextColor || "#0F172A";
  const blocks = [...(config.blocks || [])]
    .sort((a, b) => a.order - b.order)
    .filter((block) => (mode === "editor" ? true : block.visible))
    .map((block) => {
      const type = normalizeBlockType(String((block as any).type));
      return { ...block, type } as any;
    });

  const headerTypes = new Set(["profile-hero", "avatar-block", "business-name-block", "subheader-block"]);
  const heroOrder: Record<string, number> = {
    "profile-hero": 0,
    "avatar-block": 1,
    "business-name-block": 2,
    "subheader-block": 3,
  };
  const heroBlocks = blocks
    .filter((block) => headerTypes.has(block.type))
    .sort((a, b) => (heroOrder[a.type] ?? 99) - (heroOrder[b.type] ?? 99));
  const contentBlocks = blocks.filter((block) => !headerTypes.has(block.type));
  const sections = [...(config.sections || [])].sort((a, b) => a.order - b.order);
  const sectionIdSet = new Set(sections.map((section) => section.id));
  const orphanBlocks = sections.length
    ? contentBlocks.filter((block) => !block.sectionId || !sectionIdSet.has(block.sectionId))
    : [];
  const resolvedSections = sections.length
    ? sections
    : contentBlocks.length
      ? [{
        id: "legacy-default",
        label: "More",
        visible: true,
        order: 0,
        blockIds: contentBlocks.map((block) => block.id),
        style: {
          alignment: "left" as const,
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 2,
          textTransform: "uppercase" as const,
          textColor: "#FFFFFF",
          backgroundColor: "transparent",
          borderColor: "rgba(255, 166, 101, 0.35)",
          borderWidth: 1,
          borderRadius: 999,
          paddingX: 18,
          paddingY: 10,
          marginTop: 0,
          marginBottom: 14,
        },
      }]
      : [];

  const sendEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    if (mode !== "public") return;
    if (!profileId) return;

    const source = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("source") || undefined
      : undefined;

    const payload = {
      profile_id: profileId,
      event_type: eventType,
      metadata: {
        slug,
        source,
        ...(metadata || {}),
      },
    };

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/connect/events", blob);
      return;
    }

    void fetch("/api/connect/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }, [mode, profileId, slug]);

  const copyShareUrl = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall through to the textarea copy fallback for local HTTP or restricted browsers.
      }
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.focus();
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    if (!copied) {
      throw new Error("Copy command was blocked.");
    }
  };

  const resolveShareUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const profileSlug = String(profile?.slug || "").trim();
    if (profileSlug) {
      return `${window.location.origin}/u/${encodeURIComponent(profileSlug)}`;
    }
    return window.location.href;
  }, [profile?.slug]);

  const handleShareQuickAction = useCallback(async () => {
    if (typeof window === "undefined") return;
    const shareUrl = resolveShareUrl();

    if (navigator.share) {
      try {
        await navigator.share({
          title: profileName,
          text: `View ${profileName}`,
          url: shareUrl,
        });
        sendEvent("link_click", { method: "native_share", href: shareUrl, link_label: "Share Profile" });
        return;
      } catch (error) {
        const err = error as Error & { name?: string };
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await copyShareUrl(shareUrl);
      setQuickActionNotice("Profile link copied.");
      sendEvent("link_click", { method: "copy_share", href: shareUrl, link_label: "Share Profile" });
    } catch {
      setQuickActionNotice("Could not copy link.");
    }
  }, [profileName, resolveShareUrl, sendEvent]);

  const handleCopyQuickAction = useCallback(async () => {
    if (typeof window === "undefined") return;
    const shareUrl = resolveShareUrl();

    try {
      await copyShareUrl(shareUrl);
      setQuickActionNotice("Profile link copied.");
      sendEvent("link_click", { href: shareUrl, link_label: "Copy Link" });
    } catch {
      setQuickActionNotice("Could not copy link.");
    }
  }, [resolveShareUrl, sendEvent]);

  useEffect(() => {
    if (!quickActionNotice) return;
    const timer = window.setTimeout(() => setQuickActionNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [quickActionNotice]);

  useEffect(() => {
    if (mode !== "public") return;

    // Distinguish client-rendered page view from server profile view logging.
    sendEvent("profile_view", { view_kind: "page_view" });

    const root = rootRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = (anchor.getAttribute("href") || "").trim();
      const label = anchor.textContent?.trim() || undefined;
      const lower = href.toLowerCase();

      let eventType = "link_click";
      if (lower.startsWith("tel:")) eventType = "call_click";
      else if (lower.startsWith("mailto:")) eventType = "email_click";
      else if (lower.startsWith("sms:")) eventType = "text_click";
      else if (lower.includes("google.com/maps") || lower.includes("maps.apple.com")) eventType = "directions_click";
      else if (lower.includes("/api/vcard/")) eventType = "save_contact";
      else if ((label || "").toLowerCase().includes("website")) eventType = "website_click";

      sendEvent(eventType, {
        href,
        label,
      });
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [mode, sendEvent]);

  const renderPreviewBlock = (block: any) => {
    const Preview = PREVIEW_COMPONENTS[block.type] || UnknownBlockPreview;
    const blockData = getBlockData(block);
    const alignment = blockData.alignment === "left" || blockData.alignment === "right" ? blockData.alignment : "center";
    const blockRemovable = block.type !== "avatar-block";
    const renderedBlock = (
      <div className={`builder-preview-flow-item${!block.visible ? " builder-preview-hidden-block" : ""}`} data-block-id={block.id} data-align={alignment}>
        <Preview
          block={block}
          profile={profile}
          profileId={profile?.id || "unknown"}
        />
      </div>
    );

    if (!editablePreview || block.type === "profile-hero") return renderedBlock;

    return (
      <div
        key={block.id}
        className={`builder-preview-selectable${selectedBlockId === block.id ? " selected" : ""}${!block.visible ? " is-hidden" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${String(block.type).replace(/-/g, " ")} block`}
        onClickCapture={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-preview-action="remove"]')) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onSelectBlock?.(block.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectBlock?.(block.id);
          }
        }}
      >
        <div className="builder-preview-chip-row">
          {!block.visible ? <span className="builder-preview-chip builder-preview-hidden-chip">Hidden</span> : null}
          <span className="builder-preview-chip builder-preview-edit-chip">Tap to edit</span>
          {blockRemovable ? (
            <button
              type="button"
              className="builder-preview-chip builder-preview-remove-chip"
              data-preview-action="remove"
              aria-label={`Remove ${String(block.type).replace(/-/g, " ")} block`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemoveBlock?.(block.id);
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
        {renderedBlock}
      </div>
    );
  };

  const renderSaveShareSection = (position: "top" | "bottom") => {
    const hasSecondaryAction = showAppleWallet || showGoogleWallet || showShareProfile || showCopyLink || showDownloadQr;
    if (!showSaveContact && !hasSecondaryAction) return null;

    const content = (
      <section className={`builder-save-share-section is-${position}`} aria-label="Save and share" data-align={saveShareAlignment}>
        <div className="builder-save-share-shell">
        <h2 className="builder-save-share-heading">Save &amp; Share</h2>

        {showSaveContact ? (
          saveContactHref ? (
            <a
              className="builder-save-share-primary"
              href={saveContactHref}
              aria-label="Save contact"
              onClick={() => sendEvent("save_contact", { href: saveContactHref })}
            >
              <span className="builder-save-share-icon brand-contact" aria-hidden="true"><FaAddressCard /></span>
              <span className="builder-save-share-copy">
                <strong>Save Contact</strong>
                <small>Add to contacts</small>
              </span>
            </a>
          ) : (
            <button type="button" className="builder-save-share-primary is-disabled" aria-label="Save contact unavailable" disabled>
              <span className="builder-save-share-icon brand-contact" aria-hidden="true"><FaAddressCard /></span>
              <span className="builder-save-share-copy">
                <strong>Save Contact</strong>
                <small>Unavailable</small>
              </span>
            </button>
          )
        ) : null}

        {hasSecondaryAction ? (
          <div className="builder-save-share-grid" role="list" aria-label="Save and share actions">
          {showAppleWallet ? (
            appleWalletHref ? (
              <a
                className="builder-save-share-action"
                href={appleWalletHref}
                aria-label="Add to Apple Wallet"
                onClick={() => sendEvent("apple_wallet_download", { href: appleWalletHref })}
              >
                <span className="builder-save-share-icon brand-apple" aria-hidden="true"><FaApple /></span>
                <span className="builder-save-share-label">Apple Wallet</span>
              </a>
            ) : (
              <button type="button" className="builder-save-share-action is-disabled" aria-label="Apple Wallet unavailable" disabled>
                <span className="builder-save-share-icon brand-apple" aria-hidden="true"><FaApple /></span>
                <span className="builder-save-share-label">Apple Wallet</span>
              </button>
            )
          ) : null}

          {showGoogleWallet ? (
            googleWalletHref ? (
              <a
                className="builder-save-share-action"
                href={googleWalletHref}
                aria-label="Add to Google Wallet"
                onClick={() => sendEvent("google_wallet_add", { href: googleWalletHref })}
              >
                <span className="builder-save-share-icon brand-google" aria-hidden="true"><FaGooglePay /></span>
                <span className="builder-save-share-label">Google Wallet</span>
              </a>
            ) : (
              <button type="button" className="builder-save-share-action is-disabled" aria-label="Google Wallet unavailable" disabled>
                <span className="builder-save-share-icon brand-google" aria-hidden="true"><FaGooglePay /></span>
                <span className="builder-save-share-label">Google Wallet</span>
              </button>
            )
          ) : null}

          {showShareProfile ? (
            <button
              type="button"
              className="builder-save-share-action"
              aria-label="Share profile"
              onClick={handleShareQuickAction}
            >
              <span className="builder-save-share-icon brand-share" aria-hidden="true"><FaShareNodes /></span>
              <span className="builder-save-share-label">Share Profile</span>
            </button>
          ) : null}

          {showCopyLink ? (
            <button
              type="button"
              className="builder-save-share-action"
              aria-label="Copy profile link"
              onClick={handleCopyQuickAction}
            >
              <span className="builder-save-share-icon brand-copy" aria-hidden="true"><FaLink /></span>
              <span className="builder-save-share-label">Copy Link</span>
            </button>
          ) : null}

          {showDownloadQr ? (
            hasProfileId ? (
              <a
                className="builder-save-share-action"
                href={qrDownloadHref}
                download
                aria-label="Download QR code"
                onClick={() => sendEvent("link_click", { href: qrDownloadHref, link_label: "Download QR" })}
              >
                <span className="builder-save-share-icon brand-qr" aria-hidden="true"><FaQrcode /></span>
                <span className="builder-save-share-label">Download QR</span>
              </a>
            ) : (
              <button type="button" className="builder-save-share-action is-disabled" aria-label="Download QR unavailable" disabled>
                <span className="builder-save-share-icon brand-qr" aria-hidden="true"><FaQrcode /></span>
                <span className="builder-save-share-label">Download QR</span>
              </button>
            )
          ) : null}
          </div>
        ) : null}

        {quickActionNotice ? (
          <p className="builder-save-share-toast" role="status" aria-live="polite">{quickActionNotice}</p>
        ) : null}
        </div>
      </section>
    );

    if (!editablePreview) return content;

    return (
      <div
        className="builder-preview-selectable"
        role="button"
        tabIndex={0}
        aria-label="Edit Save and Share section"
        onClickCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectSaveShare?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectSaveShare?.();
          }
        }}
      >
        <span className="builder-preview-edit-chip">Tap to edit</span>
        {content}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="builder-public-profile"
      data-mode={mode}
      data-theme={resolvedThemeMode}
      data-style={profileStyle}
      data-layout={config.theme.layout || "default"}
      data-background={backgroundType}
      data-button-shape={buttonShape}
      data-banner-enabled={bannerEnabled ? "true" : "false"}
      data-banner-type={bannerType}
      data-banner-image-state={bannerType === "image" && !bannerHasImage ? "empty" : "ready"}
      data-banner-overlap={bannerOverlap ? "true" : "false"}
      data-header-align={bannerHeaderAlign}
      style={{
        "--builder-accent": config.theme.accentColor,
        "--builder-button-color": buttonColor,
        "--builder-button-text": buttonTextColor,
        "--builder-bg-color": backgroundColor,
        "--builder-bg-gradient-from": backgroundGradientFrom,
        "--builder-bg-gradient-to": backgroundGradientTo,
        "--builder-banner-height": `${effectiveBannerHeight}px`,
        "--builder-banner-bg": bannerBackgroundColor,
        "--builder-banner-gradient-from": bannerGradientFrom,
        "--builder-banner-gradient-to": bannerGradientTo,
        "--builder-banner-overlay-opacity": String(banner.overlayEnabled ? bannerOverlayOpacity : 0),
        "--builder-banner-radius": `${bannerRadius}px`,
        "--builder-header-align": bannerHeaderAlign,
        ...(bannerImageCss ? { "--builder-banner-image": bannerImageCss } : {}),
        "--builder-text-color": textColor,
        "--builder-font-family": fontFamily,
        "--builder-font-scale": String(fontScale),
      } as React.CSSProperties}
    >
      {heroBlocks.length ? (
        <section className="builder-profile-header-stack">
          {bannerEnabled ? (
            <div className="builder-global-banner" data-image-position={bannerImagePosition} aria-hidden="true">
              {banner.overlayEnabled ? <span className="builder-global-banner-overlay" /> : null}
            </div>
          ) : null}
          {heroBlocks.map((block, index) => (
            <Fragment key={`${block.id}-${index}`}>{renderPreviewBlock({ ...block, mode })}</Fragment>
          ))}
        </section>
      ) : null}

      {showSaveShareSection && saveSharePosition === "top" ? renderSaveShareSection("top") : null}

      <div className="builder-public-sections">
        {resolvedSections.map((section, sectionIndex) => {
          const sectionHiddenInPublic = !section.visible;
          if (sectionHiddenInPublic && mode !== "editor") return null;
          const sectionBlocks = contentBlocks.filter((block) => block.sectionId === section.id);
          if (!sectionBlocks.length) {
            if (mode !== "editor") return null;
            return (
              <section key={`${section.id}-${sectionIndex}`} className={`builder-public-section${sectionHiddenInPublic ? " builder-preview-hidden-block" : ""}`}>
                <div className="builder-public-section-stack">
                  {editablePreview ? (
                    <div
                      className="builder-preview-selectable"
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit ${section.label} section`}
                      onClickCapture={(event) => {
                        const target = event.target as HTMLElement | null;
                        if (target?.closest('[data-preview-action="remove"]')) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        onSelectSection?.(section.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectSection?.(section.id);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="builder-preview-chip builder-preview-remove-chip"
                        data-preview-action="remove"
                        aria-label={`Remove ${section.label} section`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onRemoveSection?.(section.id);
                        }}
                      >
                        Remove
                      </button>
                      <span className="builder-preview-edit-chip">Tap to edit</span>
                      <div className="builder-public-section-block" aria-label={section.label}>
                        <span className="builder-public-section-label" style={sectionHeaderStyle(section)}>{section.label}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="builder-public-section-block" aria-label={section.label}>
                      <span className="builder-public-section-label" style={sectionHeaderStyle(section)}>{section.label}</span>
                    </div>
                  )}
                  <div className="builder-public-section-empty">No blocks assigned to this section yet.</div>
                </div>
              </section>
            );
          }

          return (
            <section key={`${section.id}-${sectionIndex}`} className={`builder-public-section${sectionHiddenInPublic ? " builder-preview-hidden-block" : ""}`}>
              <div className="builder-public-section-stack">
                {editablePreview ? (
                  <div
                    className="builder-preview-selectable"
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${section.label} section`}
                    onClickCapture={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest('[data-preview-action="remove"]')) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectSection?.(section.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectSection?.(section.id);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="builder-preview-chip builder-preview-remove-chip"
                      data-preview-action="remove"
                      aria-label={`Remove ${section.label} section`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemoveSection?.(section.id);
                      }}
                    >
                      Remove
                    </button>
                    <span className="builder-preview-edit-chip">Tap to edit</span>
                    <div className="builder-public-section-block" aria-label={section.label}>
                      <span className="builder-public-section-label" style={sectionHeaderStyle(section)}>{section.label}</span>
                    </div>
                  </div>
                ) : (
                  <div className="builder-public-section-block" aria-label={section.label}>
                    <span className="builder-public-section-label" style={sectionHeaderStyle(section)}>{section.label}</span>
                  </div>
                )}

                {sectionBlocks.map((block, blockIndex) => (
                  <Fragment key={`${block.id}-${blockIndex}`}>{renderPreviewBlock({ ...block, mode })}</Fragment>
                ))}
              </div>
            </section>
          );
        })}

        {orphanBlocks.length ? (
          <section key="orphan-default-section" className="builder-public-section">
            <div className="builder-public-section-stack">
              <div className="builder-public-section-block" aria-label="More">
                <span className="builder-public-section-label" style={sectionHeaderStyle({
                  id: "orphan-default",
                  label: "More",
                  blockIds: [],
                  visible: true,
                  order: sections.length,
                  style: {
                    alignment: "left",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    textColor: "#FFFFFF",
                    backgroundColor: "transparent",
                    borderColor: "rgba(255, 166, 101, 0.35)",
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingX: 18,
                    paddingY: 10,
                    marginTop: 0,
                    marginBottom: 14,
                  },
                })}>More</span>
              </div>
              {orphanBlocks.map((block, blockIndex) => (
                <Fragment key={`${block.id}-${blockIndex}-orphan`}>{renderPreviewBlock({ ...block, mode })}</Fragment>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {showSaveShareSection && saveSharePosition === "bottom" ? renderSaveShareSection("bottom") : null}

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
