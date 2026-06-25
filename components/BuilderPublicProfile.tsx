"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaAddressCard, FaApple, FaGooglePay, FaShareNodes } from "react-icons/fa6";
import { BuilderConfig } from "@/lib/builder-types";
import { normalizeBlockType } from "./builder/blockUtils";
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
}

type GroupKey =
  | "contact-actions"
  | "links"
  | "social-links"
  | "business-actions"
  | "custom-links"
  | "content";

const GROUP_LABELS: Record<Exclude<GroupKey, "content">, string> = {
  "contact-actions": "Contact",
  links: "Quick Links",
  "social-links": "Social",
  "business-actions": "Services",
  "custom-links": "More",
};

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

function getReadableTextColor(hex: string) {
  const normalized = normalizeHex(hex) || "#FFA665";
  const raw = normalized.slice(1);
  const red = parseInt(raw.slice(0, 2), 16);
  const green = parseInt(raw.slice(2, 4), 16);
  const blue = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#0F172A" : "#F8FAFC";
}

function resolveFontFamily(fontFamily?: string) {
  if (fontFamily === "display") return '"Archivo Black", "Anton", "Avenir Next", sans-serif';
  if (fontFamily === "sans") return '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif';
  if (fontFamily === "serif") return '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  if (fontFamily === "mono") return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  if (fontFamily === "rounded") return '"Trebuchet MS", "Avenir Next Rounded", "Nunito", sans-serif';
  if (fontFamily === "editorial") return 'Georgia, "Times New Roman", Times, serif';
  return 'var(--font-exo2), "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif';
}

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
}: BuilderPublicProfileProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);
  const buttonColor = normalizeHex(config.theme.buttonColor) || normalizeHex(config.theme.accentColor) || "#FFA665";
  const buttonTextColor = getReadableTextColor(buttonColor);
  const textColor = normalizeHex(config.theme.textColor) || (config.theme.darkMode ? "#F8FAFC" : "#0F172A");
  const fontFamily = resolveFontFamily(config.theme.fontFamily);
  const fontScale = config.theme.fontScale === "large" ? 1.12 : 1;
  const profileId = String(profile?.id || "").trim();
  const slug = profile?.slug || undefined;
  const hasProfileId = Boolean(profileId);
  const saveContactHref = hasProfileId ? `/api/vcard/${profileId}` : "";
  const appleWalletHref = hasProfileId ? `/api/wallet/apple/${profileId}` : "";
  const googleWalletHref = hasProfileId ? `/api/wallet/google/${profileId}` : "";
  const profileName = String(profile?.contact_name || profile?.business_name || "Clutch Connect").trim();
  const blocks = [...(config.blocks || [])]
    .sort((a, b) => a.order - b.order)
    .filter((block) => block.visible)
    .map((block) => {
      const type = normalizeBlockType(String((block as any).type));
      return { ...block, type } as any;
    });

  const headerTypes = new Set(["profile-hero", "avatar-block", "business-name-block", "subheader-block"]);
  const heroBlocks = blocks.filter((block) => headerTypes.has(block.type));
  const groupedBlocks: Record<GroupKey, any[]> = {
    "contact-actions": [],
    links: [],
    "social-links": [],
    "business-actions": [],
    "custom-links": [],
    content: [],
  };

  blocks.forEach((block) => {
    if (headerTypes.has(block.type)) return;
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
      await navigator.clipboard.writeText(value);
      return;
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.focus();
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  };

  const handleShareQuickAction = useCallback(async () => {
    if (typeof window === "undefined") return;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: profileName,
          text: `View ${profileName}`,
          url: shareUrl,
        });
        sendEvent("quick_action_share", { method: "native", href: shareUrl });
        return;
      } catch (error) {
        const err = error as Error & { name?: string };
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await copyShareUrl(shareUrl);
      setQuickActionNotice("Profile link copied.");
      sendEvent("quick_action_share", { method: "copy", href: shareUrl });
    } catch {
      setQuickActionNotice("Could not copy link.");
    }
  }, [profileName, sendEvent]);

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
    const renderedBlock = (
      <Preview
        key={block.id}
        block={block}
        profile={profile}
        profileId={profile?.id || "unknown"}
      />
    );

    if (!editablePreview || block.type === "profile-hero") return renderedBlock;

    return (
      <div
        key={block.id}
        className={`builder-preview-selectable${selectedBlockId === block.id ? " selected" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${String(block.type).replace(/-/g, " ")} block`}
        onClickCapture={(event) => {
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
        <span className="builder-preview-edit-chip">Tap to edit</span>
        {renderedBlock}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="builder-public-profile"
      data-mode={mode}
      data-theme={config.theme.darkMode ? "dark" : "light"}
      data-layout={config.theme.layout || "default"}
      style={{
        "--builder-accent": config.theme.accentColor,
        "--builder-button-color": buttonColor,
        "--builder-button-text": buttonTextColor,
        "--builder-text-color": textColor,
        "--builder-font-family": fontFamily,
        "--builder-font-scale": String(fontScale),
      } as React.CSSProperties}
    >
      {heroBlocks.length ? (
        <section className="builder-profile-header-stack">
          <div className="builder-hero-cover" aria-hidden="true" />
          {heroBlocks.map((block) => {
            return renderPreviewBlock(block);
          })}
        </section>
      ) : null}

      <section className="builder-quick-actions-shell" aria-label="Quick actions">
        <div className="builder-quick-actions-grid">
          {saveContactHref ? (
            <a
              className="builder-quick-action-btn"
              href={saveContactHref}
              onClick={() => sendEvent("quick_action_save_contact", { href: saveContactHref })}
            >
              <span className="builder-quick-action-icon" aria-hidden="true"><FaAddressCard /></span>
              <span className="builder-quick-action-copy">
                <strong>Save Contact</strong>
                <small>vCard</small>
              </span>
            </a>
          ) : (
            <button type="button" className="builder-quick-action-btn is-disabled" disabled>
              <span className="builder-quick-action-icon" aria-hidden="true"><FaAddressCard /></span>
              <span className="builder-quick-action-copy">
                <strong>Save Contact</strong>
                <small>Coming soon</small>
              </span>
            </button>
          )}

          <button
            type="button"
            className="builder-quick-action-btn"
            onClick={handleShareQuickAction}
          >
            <span className="builder-quick-action-icon" aria-hidden="true"><FaShareNodes /></span>
            <span className="builder-quick-action-copy">
              <strong>Share</strong>
              <small>Send profile</small>
            </span>
          </button>

          {appleWalletHref ? (
            <a
              className="builder-quick-action-btn"
              href={appleWalletHref}
              onClick={() => sendEvent("quick_action_apple_wallet", { href: appleWalletHref })}
            >
              <span className="builder-quick-action-icon" aria-hidden="true"><FaApple /></span>
              <span className="builder-quick-action-copy">
                <strong>Apple Wallet</strong>
                <small>Add pass</small>
              </span>
            </a>
          ) : (
            <button type="button" className="builder-quick-action-btn is-disabled" disabled>
              <span className="builder-quick-action-icon" aria-hidden="true"><FaApple /></span>
              <span className="builder-quick-action-copy">
                <strong>Apple Wallet</strong>
                <small>Coming soon</small>
              </span>
            </button>
          )}

          {googleWalletHref ? (
            <a
              className="builder-quick-action-btn"
              href={googleWalletHref}
              onClick={() => sendEvent("quick_action_google_wallet", { href: googleWalletHref })}
            >
              <span className="builder-quick-action-icon" aria-hidden="true"><FaGooglePay /></span>
              <span className="builder-quick-action-copy">
                <strong>Google Wallet</strong>
                <small>Add pass</small>
              </span>
            </a>
          ) : (
            <button type="button" className="builder-quick-action-btn is-disabled" disabled>
              <span className="builder-quick-action-icon" aria-hidden="true"><FaGooglePay /></span>
              <span className="builder-quick-action-copy">
                <strong>Google Wallet</strong>
                <small>Coming soon</small>
              </span>
            </button>
          )}
        </div>

        {quickActionNotice ? (
          <p className="builder-quick-actions-toast" role="status" aria-live="polite">{quickActionNotice}</p>
        ) : null}
      </section>

      <div className="builder-public-sections">
        {sectionOrder.map((groupKey) => {
          const sectionBlocks = groupedBlocks[groupKey] || [];
          if (!sectionBlocks.length) return null;

          return (
            <section key={groupKey} className="builder-public-section">
              <div className="builder-public-section-stack">
                {groupKey !== "content" ? (
                  <div className="builder-public-section-block" aria-label={GROUP_LABELS[groupKey]}>
                    <span className="builder-public-section-label">{GROUP_LABELS[groupKey]}</span>
                  </div>
                ) : null}

                {sectionBlocks.map((block) => {
                  return renderPreviewBlock(block);
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
