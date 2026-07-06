"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuilderConfig, ProfileSection } from "@/lib/builder-types";
import { normalizeBeginnerConnectLinkHref, ctaRequiresLeadCapture } from "@/lib/connect";
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

const STARTER_BANNER_THEMES = [
  "clean-studio",
  "clutch-navy",
  "executive-dark",
  "warm-gradient",
  "soft-slate",
  "orange-edge",
] as const;

const STARTER_BANNER_THEME_SET = new Set<string>(STARTER_BANNER_THEMES);

const PREMIUM_BANNER_BACKGROUNDS: Record<string, string> = {
  "clean-studio": "radial-gradient(120% 100% at 8% 4%, rgba(255,166,101,0.24), transparent 58%), radial-gradient(95% 95% at 88% 10%, rgba(255,255,255,0.62), transparent 60%), linear-gradient(140deg, #fffdf8 0%, #edf2f8 54%, #dbe5f0 100%)",
  "clutch-navy": "radial-gradient(110% 96% at 14% 8%, rgba(255,166,101,0.24), transparent 56%), radial-gradient(88% 86% at 82% 10%, rgba(226,235,255,0.12), transparent 62%), linear-gradient(136deg, #314760 0%, #1b2b3d 52%, #101b2a 100%)",
  "executive-dark": "radial-gradient(116% 96% at 88% 8%, rgba(255,166,101,0.16), transparent 52%), radial-gradient(94% 100% at 18% 18%, rgba(88,102,126,0.18), transparent 58%), linear-gradient(140deg, #0f1724 0%, #161f2f 45%, #0a111d 100%)",
  "warm-gradient": "radial-gradient(108% 92% at 16% 8%, rgba(244,248,255,0.34), transparent 54%), radial-gradient(102% 96% at 82% 14%, rgba(255,194,138,0.28), transparent 58%), linear-gradient(136deg, #2d4159 0%, #4f5f74 36%, #a46d4c 62%, #dd8a4d 100%)",
  "soft-slate": "radial-gradient(112% 96% at 84% 10%, rgba(255,178,120,0.18), transparent 56%), radial-gradient(88% 90% at 24% 12%, rgba(255,255,255,0.52), transparent 62%), linear-gradient(138deg, #eef3f8 0%, #dce4ee 52%, #c1cddc 100%)",
  "orange-edge": "radial-gradient(110% 94% at 8% 14%, rgba(255,214,182,0.3), transparent 52%), radial-gradient(96% 88% at 86% 14%, rgba(183,206,242,0.16), transparent 58%), linear-gradient(136deg, #f2964f 0%, #cf7a3f 35%, #6b4d4e 62%, #2a3d57 100%)",
};

function inferBannerThemeFromColors(gradientFrom: string, gradientTo: string, backgroundColor: string): string | null {
  const from = gradientFrom.trim().toLowerCase();
  const to = gradientTo.trim().toLowerCase();
  const background = backgroundColor.trim().toLowerCase();

  if ((from === "#fffdf8" && to === "#dbe5f0") || (from === "#ffffff" && (to === "#edf2f8" || to === "#f1f3f7"))) return "clean-studio";
  if ((from === "#314760" && to === "#101b2a") || (from === "#384862" && (to === "#182638" || to === "#2f3c53"))) return "clutch-navy";
  if (from === "#0f1724" || to === "#0a111d" || from === "#101827" || background === "#1d2634" || background === "#161f2d") return "executive-dark";
  if (to === "#dd8a4d" || to === "#ff8a3a") return "warm-gradient";
  if (from === "#eef3f8" || to === "#c1cddc" || background === "#dce4ee" || background === "#d8e1eb") return "soft-slate";
  if (from === "#f2964f" || to === "#2a3d57" || from === "#ff7a1a" || background === "#ff7a1a") return "orange-edge";

  return null;
}

function resolveBannerThemeKey(banner: any): string {
  const explicit = typeof banner?.theme === "string" ? banner.theme.trim().toLowerCase() : "";
  if (STARTER_BANNER_THEME_SET.has(explicit)) return explicit;

  const starter = typeof banner?.starterTheme === "string" ? banner.starterTheme.trim().toLowerCase() : "";
  if (STARTER_BANNER_THEME_SET.has(starter)) return starter;

  return inferBannerThemeFromColors(String(banner?.gradientFrom || ""), String(banner?.gradientTo || ""), String(banner?.backgroundColor || "")) || "clean-studio";
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

function sectionHeaderStyle(section: ProfileSection, starterLocked: boolean, globalAlignment: "left" | "center" | "right"): React.CSSProperties {
  const style = section.style;
  const effectiveAlignment = style.alignment === "left" || style.alignment === "right" || style.alignment === "center"
    ? style.alignment
    : globalAlignment;
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
      justifyContent: effectiveAlignment === "center" ? "center" : effectiveAlignment === "right" ? "flex-end" : "flex-start",
      textAlign: effectiveAlignment,
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
    justifyContent: effectiveAlignment === "center" ? "center" : effectiveAlignment === "right" ? "flex-end" : "flex-start",
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
    if (mode === "preview") {
      return links.some((link: any) => link?.visible !== false && String(link?.label || "").trim());
    }
    return links.some((link: any) => link?.visible !== false && normalizeBeginnerConnectLinkHref(link.platform, link.value));
  }

  if (type === "phone-button") return Boolean(data.phone || data.value || profile?.phone);
  if (type === "email-button") return Boolean(data.email || data.value || profile?.email);
  if (type === "website-button") return Boolean(data.website || data.url || profile?.website);
  if (type === "directions-button") return Boolean(data.address || data.url || profile?.address);
  if (type === "request-quote-button" || type === "custom-link-button") {
    // Hide CTA if it requires lead capture but lead capture is disabled
    if (data.isPrimaryAction === true) {
      const url = String(data.url || "").trim();
      if (ctaRequiresLeadCapture(data.primaryActionType, url) && data.primaryActionLeadCaptureEnabled === false) {
        return false;
      }
    }
    
    if (mode === "preview") {
      if (data.isPrimaryAction === true) {
        return Boolean(String(data.label || "").trim());
      }
      return Boolean(String(data.url || "").trim());
    }
    return Boolean(String(data.url || "").trim());
  }

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
  const quickActionTimeoutRef = useRef<number | null>(null);
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
  const rawGlobalAlignment = String(config.theme.globalAlignment || (config.theme as any).textAlign || (config.theme as any).alignment || "").toLowerCase();
  const globalAlignment: "left" | "center" | "right" = rawGlobalAlignment === "left" || rawGlobalAlignment === "right" ? rawGlobalAlignment : "center";
  const bannerThemeKey = resolveBannerThemeKey(banner);
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
      const themedBackground = PREMIUM_BANNER_BACKGROUNDS[bannerThemeKey];
      return { ...base, background: themedBackground || (banner.backgroundColor || buttonColor) };
    }
    if (banner.enabled && banner.type === "gradient") {
      const themedBackground = PREMIUM_BANNER_BACKGROUNDS[bannerThemeKey];
      return {
        ...base,
        background: themedBackground || `linear-gradient(135deg, ${banner.gradientFrom || "#FFFFFF"}, ${banner.gradientTo || buttonColor})`,
      };
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

  const orderedBlocks = useMemo(
    () => [...(config.blocks || [])].sort((a, b) => a.order - b.order),
    [config.blocks]
  );
  const heroBlocks = useMemo(
    () => orderedBlocks.filter((block) => ["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(String(block.type))),
    [orderedBlocks]
  );
  const primaryActionBlocks = useMemo(
    () => orderedBlocks.filter((block) => {
      const type = String(block.type);
      const data = getBlockData(block);
      return (type === "request-quote-button" || type === "custom-link-button") && data.isPrimaryAction === true;
    }),
    [orderedBlocks]
  );
  const primaryActionIds = useMemo(() => new Set(primaryActionBlocks.map((block) => block.id)), [primaryActionBlocks]);
  const guidedLeadFormBlocks = useMemo(
    () => orderedBlocks.filter((block) => {
      if (String(block.type) !== "form-block") return false;
      const data = getBlockData(block);
      return data.source === "clutch_connect_profile" && data.leadCaptureEnabled !== false;
    }),
    [orderedBlocks]
  );
  const guidedLeadFormIds = useMemo(() => new Set(guidedLeadFormBlocks.map((block) => block.id)), [guidedLeadFormBlocks]);
  const sections = useMemo(
    () => [...(config.sections || [])].sort((a, b) => a.order - b.order),
    [config.sections]
  );
  const showSectionLabel = mode === "editor";

  const profileAvatarUrl = (() => {
    const raw = typeof profile?.avatar_url === "string" ? profile.avatar_url.trim() : "";
    if (!raw || !/^https?:\/\//i.test(raw)) return "";
    return raw;
  })();
  const bannerImageUrl = (() => {
    const raw = typeof banner.imageUrl === "string" ? banner.imageUrl.trim() : "";
    if (!raw || !banner.enabled || banner.type !== "image") return "";
    return raw;
  })();
  const [initialDelayComplete, setInitialDelayComplete] = useState(false);
  const [avatarAssetReady, setAvatarAssetReady] = useState(!profileAvatarUrl);
  const [bannerAssetReady, setBannerAssetReady] = useState(!bannerImageUrl);

  useEffect(() => {
    const timer = window.setTimeout(() => setInitialDelayComplete(true), 150);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!profileAvatarUrl) {
      setAvatarAssetReady(true);
      return;
    }
    setAvatarAssetReady(false);
    const image = new Image();
    image.onload = () => setAvatarAssetReady(true);
    image.onerror = () => setAvatarAssetReady(true);
    image.src = profileAvatarUrl;
  }, [profileAvatarUrl]);

  useEffect(() => {
    if (!bannerImageUrl) {
      setBannerAssetReady(true);
      return;
    }
    setBannerAssetReady(false);
    const image = new Image();
    image.onload = () => setBannerAssetReady(true);
    image.onerror = () => setBannerAssetReady(true);
    image.src = bannerImageUrl;
  }, [bannerImageUrl]);

  const previewReady = initialDelayComplete && avatarAssetReady && bannerAssetReady;

  const handleQuickAction = useCallback((action: string) => {
    if (quickActionTimeoutRef.current) {
      window.clearTimeout(quickActionTimeoutRef.current);
    }
    setQuickActionNotice(action);
    quickActionTimeoutRef.current = window.setTimeout(() => setQuickActionNotice(null), 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (quickActionTimeoutRef.current) {
        window.clearTimeout(quickActionTimeoutRef.current);
      }
    };
  }, []);

  const sectionBlocksById = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const section of sections) {
      const sectionBlocks = orderedBlocks.filter((block) => {
        const blockType = String(block.type);
        if (primaryActionIds.has(block.id)) return false;
        if (guidedLeadFormIds.has(block.id)) return false;
        if (["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(blockType)) return false;
        return block.sectionId === section.id;
      });
      map.set(section.id, sectionBlocks);
    }
    return map;
  }, [guidedLeadFormIds, orderedBlocks, primaryActionIds, sections]);

  const publicStackBlocks = useMemo(() => {
    const flattened: any[] = [];

    for (const section of sections) {
      if (section.visible === false) continue;

      const sectionBlocks = sectionBlocksById.get(section.id) || [];
      for (const block of sectionBlocks) {
        if (block.visible === false) continue;
        if (!blockHasRenderableContent(block, profile, mode)) continue;
        flattened.push(block);
      }
    }

    return flattened;
  }, [mode, profile, sectionBlocksById, sections]);

  const ProfileBlock = useCallback((block: any, sectionId?: string, index = 0) => {
    if (mode !== "editor" && block.visible === false) return null;

    const type = normalizeBlockType(String(block.type));
    const Component = PREVIEW_COMPONENTS[type] || UnknownBlockPreview;
    const isSelected = selectedBlockId === block.id;
    const canEdit = editablePreview && onSelectBlock;

    return (
      <div
        key={block.id}
        className={`builder-public-section-block builder-preview-selectable builder-block-enter${isSelected ? " selected" : ""}${block.visible === false ? " builder-preview-hidden-block" : ""}`}
        data-builder-block-id={block.id}
        data-builder-block-type={type}
        style={{ ["--builder-block-index" as any]: index }}
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
            block={block}
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
  }, [buttonColor, buttonShape, buttonTextColor, editablePreview, mode, onRemoveBlock, onSelectBlock, profile, selectedBlockId, handleQuickAction]);

  const ProfileHeader = useMemo(() => (
    <div className="builder-public-hero builder-profile-header-stack">
      {heroBlocks.map((block, index) => ProfileBlock(block, undefined, index))}
      {primaryActionBlocks.map((block, index) => ProfileBlock(block, undefined, heroBlocks.length + index))}
    </div>
  ), [ProfileBlock, heroBlocks, primaryActionBlocks]);

  const ProfileBlocks = useMemo(() => {
    if (mode !== "editor") {
      return (
        <div className="builder-public-sections builder-public-sections-flat">
          <div className="builder-public-flat-stack">
            {publicStackBlocks.map((block, index) => ProfileBlock(block, undefined, index + 1))}
          </div>
        </div>
      );
    }

    return (
      <div className="builder-public-sections">
        {sections.map((section, sectionIndex) => {
          const sectionBlocks = sectionBlocksById.get(section.id) || [];
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
                {showSectionLabel ? (
                  <div className="builder-public-section-title builder-public-section-label" style={sectionHeaderStyle(section, starterLocked, globalAlignment)}>{section.label}</div>
                ) : null}
                {sectionBlocks.length ? (
                  <Fragment>
                    {sectionBlocks.map((block, index) => ProfileBlock(block, section.id, sectionIndex * 20 + index + 1))}
                  </Fragment>
                ) : (
                  <div className="builder-public-section-empty">
                    {section.label.toLowerCase().includes("social") ? "Add social links to display them here." : "No blocks assigned to this section yet."}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }, [ProfileBlock, editablePreview, globalAlignment, mode, onRemoveSection, onSelectSection, publicStackBlocks, sectionBlocksById, sections, showSectionLabel, starterLocked]);

  const ProfilePreviewContent = useMemo(() => (
    <div className="builder-public-shell">
      <div className="builder-global-banner" data-image-position={banner.imagePosition || "center"} style={bannerStyle}>
        {banner.overlayEnabled ? <span className="builder-global-banner-overlay" /> : null}
      </div>
      {ProfileHeader}
      {ProfileBlocks}
      {guidedLeadFormBlocks.length ? (
        <div className="builder-guided-lead-slot" data-guided-lead-state="collapsed">
          {guidedLeadFormBlocks.map((block, index) => ProfileBlock(block, undefined, 400 + index))}
        </div>
      ) : null}
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
  ), [ProfileBlocks, ProfileHeader, ProfileBlock, banner.imagePosition, banner.overlayEnabled, bannerStyle, editablePreview, guidedLeadFormBlocks, onSelectSaveShare]);

  return (
    <div
      ref={rootRef}
      className={`builder-public-profile builder-profile-style-${profileStyleName}${mode === "editor" ? " builder-public-profile-editor" : ""}`}
      data-mode={mode}
      data-theme={profileTheme}
      data-style={profileStyleName}
      data-background={background.type || "soft"}
      data-layout={profileLayout}
      data-global-align={globalAlignment}
      data-starter-locked={starterLocked ? "true" : "false"}
      data-header-align={banner.textAlign || "center"}
      data-banner-enabled={banner.enabled ? "true" : "false"}
      data-banner-type={banner.type || "none"}
      data-banner-theme={bannerThemeKey}
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
      {!previewReady ? (
        <div className="builder-preview-skeleton" aria-hidden="true">
          <div className="builder-preview-skeleton-banner" />
          <div className="builder-preview-skeleton-avatar" />
          <div className="builder-preview-skeleton-title" />
          <div className="builder-preview-skeleton-subtitle" />
          <div className="builder-preview-skeleton-card" />
          <div className="builder-preview-skeleton-card" />
          <div className="builder-preview-skeleton-card" />
        </div>
      ) : null}
      <div className={`builder-preview-content${previewReady ? " is-ready" : ""}`}>
        {ProfilePreviewContent}
      </div>
      {quickActionNotice ? <div className="builder-quick-action-toast">{quickActionNotice}</div> : null}
    </div>
  );
}
