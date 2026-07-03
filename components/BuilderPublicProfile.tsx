"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import { BuilderConfig, ProfileSection } from "@/lib/builder-types";
import { normalizeBeginnerConnectLinkHref } from "@/lib/connect";
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
  starterLocked?: boolean;
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

function sectionHeaderStyle(section: ProfileSection, starterLocked: boolean): React.CSSProperties {
  const style = section.style;
  const fontSize = clampNumber(style.fontSize, 10, 72, 13);
  const letterSpacing = clampNumber(style.letterSpacing, 0, 16, 2);
  const borderWidth = clampNumber(style.borderWidth, 0, 24, 1);
  const borderRadius = clampNumber(style.borderRadius, 0, 999, 999);
  const paddingX = clampNumber(style.paddingX, 0, 96, 18);
  const paddingY = clampNumber(style.paddingY, 0, 72, 10);
  const marginTop = clampNumber(style.marginTop, 0, 120, 0);
  const marginBottom = clampNumber(style.marginBottom, 0, 120, 14);
  if (starterLocked) {
    const minHeight = paddingY * 2 + fontSize;
    return {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      width: "100%",
      transform: "translateY(1px)",
      fontFamily: style.fontFamily && style.fontFamily !== "inherit" ? resolveFontFamily(style.fontFamily) : undefined,
      fontSize: `${fontSize}px`,
      fontWeight: style.fontWeight,
      lineHeight: 1,
      letterSpacing: `${letterSpacing}px`,
      textTransform: style.textTransform,
      color: "#111111",
      backgroundColor: "#FFFFFF",
      borderColor: "rgba(17, 17, 17, 0.18)",
      borderWidth: `${borderWidth}px`,
      borderStyle: borderWidth > 0 ? "solid" : "none",
      borderRadius: `${borderRadius}px`,
      minHeight: `${Math.max(40, minHeight)}px`,
      padding: `0 ${paddingX}px`,
      marginTop: `${marginTop}px`,
      marginBottom: `${marginBottom}px`,
    };
  }

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

function blockHasRenderableContent(block: any, profile: any, mode: "public" | "preview" | "editor") {
  if (mode === "editor") return true;
  if (block.visible === false) return false;

  const type = normalizeBlockType(String(block.type));
  const data = getBlockData(block);

  if (type === "social-media-links" || type === "social-links") {
    const links = Array.isArray(data.links) ? data.links : [];
    return links.some((link: any) => link?.visible !== false && normalizeBeginnerConnectLinkHref(link.platform, link.value));
  }

  if (type === "phone-button") return Boolean(data.phone || data.value || profile?.phone);
  if (type === "email-button") return Boolean(data.email || data.value || profile?.email);
  if (type === "website-button") return Boolean(data.website || data.url || profile?.website);
  if (type === "directions-button") return Boolean(data.address || data.url || profile?.address);
  if (type === "request-quote-button" || type === "custom-link-button") return Boolean(data.url);

  return true;
}

export default function BuilderPublicProfile({
  config,
  profile,
  starterLocked = false,
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
  const monochromeStarterView = starterLocked && (mode === "public" || mode === "preview");
  const buttonColor = monochromeStarterView
    ? "#FFFFFF"
    : normalizeHex(buttons.color) || normalizeHex(config.theme.buttonColor) || normalizeHex(config.theme.accentColor) || "#FFA665";
  const buttonTextColor = monochromeStarterView
    ? "#111111"
    : normalizeHex(buttons.textColor) || getReadableTextColor(buttonColor);
  const buttonShape = buttons.style === "pill" || buttons.style === "square" ? buttons.style : "rounded";
  const profileTheme = config.theme.themeMode || (config.theme.darkMode ? "dark" : "light");
  const profileStyleName = config.theme.profileStyle || "clutch";
  const profileLayout = config.theme.layout || "default";
  const backgroundStyle: React.CSSProperties = background.type === "solid"
    ? { background: background.color || "#F8FAFC" }
    : background.type === "gradient"
      ? { background: `linear-gradient(160deg, ${background.gradientFrom || "#FFFFFF"}, ${background.gradientTo || "#FFF4EC"})` }
      : { background: "linear-gradient(180deg, #FFFFFF 0%, #FFF7EF 100%)" };
  const bannerStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      minHeight: `${clampNumber(banner.height, 80, 420, 160)}px`,
      borderRadius: `${clampNumber(banner.borderRadius, 0, 48, 24)}px`,
    };
    const imageUrl = toCssImageUrl(banner.imageUrl);
    if (banner.enabled && banner.type === "image" && imageUrl) {
      return {
        ...base,
        backgroundImage: banner.overlayEnabled
          ? `linear-gradient(rgba(15,23,42,${clampNumber(banner.overlayOpacity, 0, 0.85, 0.22)}), rgba(15,23,42,${clampNumber(banner.overlayOpacity, 0, 0.85, 0.22)})), ${imageUrl}`
          : imageUrl,
        backgroundSize: "cover",
        backgroundPosition: banner.imagePosition || "center",
      };
    }
    if (banner.enabled && banner.type === "solid") {
      return { ...base, background: banner.backgroundColor || buttonColor };
    }
    if (banner.enabled && banner.type === "gradient") {
      return { ...base, background: `linear-gradient(135deg, ${banner.gradientFrom || "#FFFFFF"}, ${banner.gradientTo || buttonColor})` };
    }
    return { ...base, background: `linear-gradient(135deg, #FFF5E7 0%, ${buttonColor} 100%)` };
  })();

  const profileStyle: React.CSSProperties = {
    ...backgroundStyle,
    ["--builder-accent" as any]: buttonColor,
    ["--builder-button-text" as any]: buttonTextColor,
    ["--builder-button-radius" as any]: buttonShape === "pill" ? "999px" : buttonShape === "square" ? "12px" : "18px",
    ["--builder-bg-color" as any]: background.color || "#F8FAFC",
    ["--builder-bg-gradient-from" as any]: background.gradientFrom || "#FFFFFF",
    ["--builder-bg-gradient-to" as any]: background.gradientTo || "#FFF4EC",
  };

  const orderedBlocks = [...(config.blocks || [])].sort((a, b) => a.order - b.order);
  const heroBlocks = orderedBlocks.filter((block) => ["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(String(block.type)));
  const primaryActionBlocks = orderedBlocks.filter((block) => {
    const type = String(block.type);
    const data = getBlockData(block);
    return (type === "request-quote-button" || type === "custom-link-button") && data.isPrimaryAction === true;
  });
  const primaryActionIds = new Set(primaryActionBlocks.map((block) => block.id));
  const sections = [...(config.sections || [])].sort((a, b) => a.order - b.order);

  const handleQuickAction = useCallback((action: string) => {
    setQuickActionNotice(action);
    window.setTimeout(() => setQuickActionNotice(null), 1400);
  }, []);

  const renderBlock = (block: any, sectionId?: string) => {
    if (mode !== "editor" && block.visible === false) return null;

    const type = normalizeBlockType(String(block.type));
    const Component = PREVIEW_COMPONENTS[type] || UnknownBlockPreview;
    const data = getBlockData(block);
    const isSelected = selectedBlockId === block.id;
    const canEdit = editablePreview && onSelectBlock;

    return (
      <div
        key={block.id}
        className={`builder-public-section-block builder-preview-selectable${isSelected ? " selected" : ""}${block.visible === false ? " builder-preview-hidden-block" : ""}`}
        data-builder-block-id={block.id}
      >
        {canEdit ? (
          <div className="builder-preview-toolbar">
            <button type="button" onClick={(event) => { event.stopPropagation(); onSelectBlock?.(block.id); }}>Edit</button>
            {onRemoveBlock ? <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); onRemoveBlock(block.id); }}>Remove</button> : null}
          </div>
        ) : null}
        <div
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onClick={canEdit ? () => onSelectBlock?.(block.id) : undefined}
          onKeyDown={canEdit ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectBlock?.(block.id);
            }
          } : undefined}
        >
          <Component
            block={{ ...block, data, settings: data }}
            profile={profile}
            buttonColor={buttonColor}
            buttonTextColor={buttonTextColor}
            buttonShape={buttonShape}
            mode={mode}
            onQuickAction={handleQuickAction}
            sectionId={sectionId}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`builder-public-profile builder-profile-style-${profileStyleName}`}
      data-mode={mode}
      data-theme={profileTheme}
      data-style={profileStyleName}
      data-background={background.type || "soft"}
      data-layout={profileLayout}
      data-starter-locked={starterLocked ? "true" : "false"}
      data-header-align={banner.textAlign || "center"}
      data-banner-enabled={banner.enabled ? "true" : "false"}
      data-banner-type={banner.type || "none"}
      data-banner-image-state={banner.imageUrl ? "set" : "empty"}
      data-banner-overlap={banner.avatarOverlap !== false ? "true" : "false"}
      style={{
        ...profileStyle,
        ["--builder-banner-height" as any]: `${clampNumber(banner.height, 120, 220, 176)}px`,
        ["--builder-banner-overlay-opacity" as any]: `${clampNumber(banner.overlayOpacity, 0, 1, 0.22)}`,
        ["--builder-banner-solid" as any]: banner.backgroundColor || "#f4f6fa",
        ["--builder-banner-gradient-from" as any]: banner.gradientFrom || "#ffffff",
        ["--builder-banner-gradient-to" as any]: banner.gradientTo || buttonColor,
        ["--builder-banner-image" as any]: toCssImageUrl(banner.imageUrl) || "none",
      }}
    >
      <div className="builder-public-shell">
        <div className="builder-global-banner" data-image-position={banner.imagePosition || "center"} style={bannerStyle}>
          {banner.overlayEnabled ? <span className="builder-global-banner-overlay" /> : null}
        </div>
        <div className="builder-public-hero builder-profile-header-stack">
          {heroBlocks.map((block) => renderBlock(block))}
          {primaryActionBlocks.map((block) => renderBlock(block))}
        </div>
        <div className="builder-public-sections">
          {sections.map((section) => {
            if (mode !== "editor" && section.visible === false) return null;

            const sectionBlocks = orderedBlocks.filter((block) => {
              const blockType = String(block.type);
              if (primaryActionIds.has(block.id)) return false;
              if (["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(blockType)) return false;
              return block.sectionId === section.id;
            });
            const visibleSectionBlocks = mode === "editor" ? sectionBlocks : sectionBlocks.filter((block) => blockHasRenderableContent(block, profile, mode));
            if (mode !== "editor" && visibleSectionBlocks.length === 0) return null;
            const canSelectSection = editablePreview && onSelectSection;
            return (
              <section
                key={section.id}
                className={`builder-public-section builder-preview-selectable${section.visible === false ? " builder-preview-hidden-block" : ""}`}
                data-builder-section-id={section.id}
                role={canSelectSection ? "button" : undefined}
                tabIndex={canSelectSection ? 0 : undefined}
                onClick={canSelectSection ? () => onSelectSection?.(section.id) : undefined}
                onKeyDown={canSelectSection ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectSection?.(section.id);
                  }
                } : undefined}
              >
                {editablePreview && onRemoveSection ? (
                  <div className="builder-preview-toolbar section-toolbar">
                    <button type="button" onClick={(event) => { event.stopPropagation(); onSelectSection?.(section.id); }}>Edit</button>
                    <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); onRemoveSection(section.id); }}>Remove</button>
                  </div>
                ) : null}
                <div className="builder-public-section-stack">
                  <div className="builder-public-section-title builder-public-section-label" style={sectionHeaderStyle(section, starterLocked)}>{section.label}</div>
                  {visibleSectionBlocks.length ? (
                    <Fragment>
                      {visibleSectionBlocks.map((block) => renderBlock(block, section.id))}
                    </Fragment>
                  ) : mode === "editor" ? (
                    <div className="builder-public-section-empty">
                      {section.label.toLowerCase().includes("social") ? "Add social links to display them here." : "No blocks assigned to this section yet."}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
        <div
          className="builder-public-footer builder-preview-selectable"
          role={editablePreview && onSelectSaveShare ? "button" : undefined}
          tabIndex={editablePreview && onSelectSaveShare ? 0 : undefined}
          onClick={editablePreview && onSelectSaveShare ? () => onSelectSaveShare() : undefined}
          onKeyDown={editablePreview && onSelectSaveShare ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectSaveShare();
            }
          } : undefined}
        >
          <span className="builder-public-footer-line">Powered by{" "}<strong className="builder-public-footer-brand">Clutch Connect</strong></span>
          <span className="builder-public-footer-line">clutchprintshop.com</span>
        </div>
      </div>
      {quickActionNotice ? <div className="builder-quick-action-toast">{quickActionNotice}</div> : null}
    </div>
  );
}
