"use client";

import { useEffect, useRef } from "react";
import { BuilderBlock } from "@/lib/builder-types";
import { createInitials, getBlockData, normalizeBlockType } from "./blockUtils";
import PremiumColorPicker from "../PremiumColorPicker";

export interface BlockEditorProps {
  block: BuilderBlock;
  onUpdate: (patch: Record<string, any>) => void;
}

const BRAND_SWATCHES = ["#FFA665", "#384862", "#FFFFFF", "#111827", "#6B7280"];

function Field({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <label className="saas-field">
      <span className="saas-field-label-row">
        <span className="saas-field-label">{label}</span>
        {tooltip ? <span className="saas-help-tip" title={tooltip} aria-label={tooltip}>?</span> : null}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  tooltip,
  checked,
  onChange,
}: {
  label: string;
  tooltip?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="saas-toggle-row">
      <span className="saas-field-label-row">
        <span className="saas-field-label">{label}</span>
        {tooltip ? <span className="saas-help-tip" title={tooltip} aria-label={tooltip}>?</span> : null}
      </span>
      <button
        type="button"
        className={`saas-toggle${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span className="saas-toggle-thumb" />
      </button>
    </label>
  );
}

function RowActions({ onUp, onDown, onDelete }: { onUp: () => void; onDown: () => void; onDelete: () => void }) {
  return (
    <div className="saas-inline-actions">
      <button type="button" className="saas-mini-btn" onClick={onUp}>↑</button>
      <button type="button" className="saas-mini-btn" onClick={onDown}>↓</button>
      <button type="button" className="saas-mini-btn danger" onClick={onDelete}>×</button>
    </div>
  );
}

function EditorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="saas-editor-section">
      <div className="saas-editor-section-header">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="saas-editor-section-body">{children}</div>
    </section>
  );
}

function AdvancedAccordion({ children }: { children: React.ReactNode }) {
  return (
    <details className="saas-advanced-accordion">
      <summary>Advanced styling</summary>
      <div className="saas-advanced-content">{children}</div>
    </details>
  );
}

function ColorPresetRow({ value, onChange }: { value?: string; onChange: (color: string) => void }) {
  return (
    <div className="saas-swatch-row">
      {BRAND_SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          className={`saas-swatch-chip${(value || "").toLowerCase() === swatch.toLowerCase() ? " active" : ""}`}
          onClick={() => onChange(swatch)}
        >
          <span className="saas-swatch-dot" style={{ backgroundColor: swatch }} />
          <span>{swatch}</span>
        </button>
      ))}
    </div>
  );
}

export function ProfileHeroEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const badgeEnabled = Boolean(data.verifiedBadgeEnabled ?? data.verified);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localObjectUrlRef = useRef<string | null>(null);
  const initials = createInitials(data.businessName, undefined, undefined);

  useEffect(() => {
    return () => {
      if (localObjectUrlRef.current) {
        URL.revokeObjectURL(localObjectUrlRef.current);
      }
    };
  }, []);

  const isClose = (a: number, b: number, epsilon = 0.01) => Math.abs(a - b) <= epsilon;
  const sameColor = (a: string | undefined, b: string) => (a || "").toLowerCase() === b.toLowerCase();

  const isPresetActive = (preset: "subtle" | "bold" | "premium") => {
    if (preset === "subtle") {
      return (
        data.avatarGlowEnabled !== false &&
        sameColor(data.avatarGlowColor, "#FF6B2C") &&
        isClose(data.avatarGlowOpacity ?? 0.35, 0.2) &&
        isClose(data.avatarGlowBlur ?? 18, 12, 0.5) &&
        isClose(data.avatarGlowSpread ?? 10, 6, 0.5) &&
        !badgeEnabled
      );
    }

    if (preset === "bold") {
      return (
        data.avatarGlowEnabled !== false &&
        sameColor(data.avatarGlowColor, "#FF6B2C") &&
        isClose(data.avatarGlowOpacity ?? 0.35, 0.48) &&
        isClose(data.avatarGlowBlur ?? 18, 26, 0.5) &&
        isClose(data.avatarGlowSpread ?? 10, 16, 0.5) &&
        badgeEnabled &&
        sameColor(data.verifiedBadgeColor, "#f59e0b") &&
        sameColor(data.verifiedBadgeIconColor, "#0f172a") &&
        (data.verifiedBadgeIcon || "checkmark") === "checkmark" &&
        (data.verifiedBadgePosition || "bottom-right") === "bottom-right" &&
        isClose(data.verifiedBadgeSize ?? 24, 24, 0.5)
      );
    }

    return (
      data.avatarGlowEnabled !== false &&
      sameColor(data.avatarGlowColor, "#f59e0b") &&
      isClose(data.avatarGlowOpacity ?? 0.35, 0.55) &&
      isClose(data.avatarGlowBlur ?? 18, 32, 0.5) &&
      isClose(data.avatarGlowSpread ?? 10, 20, 0.5) &&
      badgeEnabled &&
      sameColor(data.verifiedBadgeColor, "#111827") &&
      sameColor(data.verifiedBadgeIconColor, "#f8fafc") &&
      (data.verifiedBadgeIcon || "checkmark") === "shield" &&
      (data.verifiedBadgePosition || "bottom-right") === "top-right" &&
      isClose(data.verifiedBadgeSize ?? 24, 28, 0.5)
    );
  };

  const applyHeroStylePreset = (preset: "subtle" | "bold" | "premium") => {
    if (preset === "subtle") {
      onUpdate({
        avatarGlowEnabled: true,
        avatarGlowColor: "#FF6B2C",
        avatarGlowOpacity: 0.2,
        avatarGlowBlur: 12,
        avatarGlowSpread: 6,
        verifiedBadgeEnabled: false,
        verified: false,
      });
      return;
    }

    if (preset === "bold") {
      onUpdate({
        avatarGlowEnabled: true,
        avatarGlowColor: "#FF6B2C",
        avatarGlowOpacity: 0.48,
        avatarGlowBlur: 26,
        avatarGlowSpread: 16,
        verifiedBadgeEnabled: true,
        verifiedBadgeColor: "#f59e0b",
        verifiedBadgeIconColor: "#0f172a",
        verifiedBadgeIcon: "checkmark",
        verifiedBadgePosition: "bottom-right",
        verifiedBadgeSize: 24,
        verified: true,
      });
      return;
    }

    onUpdate({
      avatarGlowEnabled: true,
      avatarGlowColor: "#f59e0b",
      avatarGlowOpacity: 0.55,
      avatarGlowBlur: 32,
      avatarGlowSpread: 20,
      verifiedBadgeEnabled: true,
      verifiedBadgeColor: "#111827",
      verifiedBadgeIconColor: "#f8fafc",
      verifiedBadgeIcon: "shield",
      verifiedBadgePosition: "top-right",
      verifiedBadgeSize: 28,
      verified: true,
    });
  };

  const resetGlowAndBadgeDefaults = () => {
    onUpdate({
      avatarGlowEnabled: true,
      avatarGlowColor: "#FF6B2C",
      avatarGlowOpacity: 0.35,
      avatarGlowBlur: 18,
      avatarGlowSpread: 10,
      verifiedBadgeEnabled: false,
      verifiedBadgeColor: "#f59e0b",
      verifiedBadgeIconColor: "#0f172a",
      verifiedBadgeIcon: "checkmark",
      verifiedBadgePosition: "bottom-right",
      verifiedBadgeSize: 24,
      verified: false,
    });
  };

  const handleAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (localObjectUrlRef.current) {
      URL.revokeObjectURL(localObjectUrlRef.current);
    }

    // TODO: connect this to Supabase Storage avatar upload.
    const objectUrl = URL.createObjectURL(file);
    localObjectUrlRef.current = objectUrl;
    onUpdate({ avatarUrl: objectUrl });
  };

  return (
    <div className="saas-fields">
      <EditorSection title="Avatar" description="Profile imagery and presence.">
        <div className="saas-avatar-panel">
          <div className="saas-avatar-preview-circle">
            {data.avatarUrl ? <img src={data.avatarUrl} alt="Avatar preview" /> : <span>{initials}</span>}
          </div>
          <div className="saas-avatar-actions">
            <button type="button" className="saas-mini-btn" onClick={() => fileInputRef.current?.click()}>
              Upload avatar
            </button>
            <button type="button" className="saas-mini-btn" onClick={() => onUpdate({ avatarUrl: "" })}>
              Remove avatar
            </button>
          </div>
          <p className="saas-field-hint">Recommended: square image, 500x500px or larger.</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="saas-hidden-input" onChange={handleAvatarFile} />
        </div>
      </EditorSection>

      <EditorSection title="Content" description="What visitors see first.">
        <Field label="Business / name">
          <input type="text" value={data.businessName || ""} onChange={(e) => onUpdate({ businessName: e.target.value })} placeholder="Business Name" />
        </Field>
        <Field label="Title / role">
          <input type="text" value={data.title || ""} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Founder" />
        </Field>
        <Field label="Bio / description">
          <textarea value={data.bio || ""} onChange={(e) => onUpdate({ bio: e.target.value })} rows={4} placeholder="Tell visitors about your business" />
        </Field>
      </EditorSection>

      <EditorSection title="Appearance" description="Glow, badge, and brand emphasis.">
        <Toggle
          label="Avatar glow"
          tooltip="Turn the halo behind the avatar on or off."
          checked={data.avatarGlowEnabled !== false}
          onChange={(v) => onUpdate({ avatarGlowEnabled: v })}
        />

        {data.avatarGlowEnabled !== false && (
          <>
            <Field label="Glow color" tooltip="The tint used for the halo behind your avatar.">
              <ColorPresetRow value={data.avatarGlowColor || "#FF6B2C"} onChange={(color) => onUpdate({ avatarGlowColor: color })} />
              <PremiumColorPicker
                value={data.avatarGlowColor || "#FF6B2C"}
                onChange={(color) => onUpdate({ avatarGlowColor: color })}
                ariaLabel="Avatar glow color"
                buttonText="Custom"
                presets={["#FFA665", "#384862", "#FFFFFF", "#111827", "#6B7280"]}
              />
            </Field>
            <Field
              label={`Glow opacity (${Math.round((data.avatarGlowOpacity ?? 0.35) * 100)}%)`}
              tooltip="Controls glow strength. Lower is softer; higher is more vivid."
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={data.avatarGlowOpacity ?? 0.35}
                onChange={(e) => onUpdate({ avatarGlowOpacity: Number(e.target.value) })}
              />
            </Field>
          </>
        )}

        <Toggle
          label="Verified badge"
          tooltip="Shows a quality marker over the avatar."
          checked={Boolean(data.verifiedBadgeEnabled ?? data.verified)}
          onChange={(v) => onUpdate({ verifiedBadgeEnabled: v, verified: v })}
        />

        {badgeEnabled && (
          <Field label="Verified badge color" tooltip="Background color of the badge circle.">
            <ColorPresetRow value={data.verifiedBadgeColor || "#3B82F6"} onChange={(color) => onUpdate({ verifiedBadgeColor: color })} />
            <PremiumColorPicker
              value={data.verifiedBadgeColor || "#3B82F6"}
              onChange={(color) => onUpdate({ verifiedBadgeColor: color })}
              ariaLabel="Verified badge color"
              buttonText="Custom"
              presets={["#FFA665", "#384862", "#FFFFFF", "#111827", "#6B7280"]}
            />
          </Field>
        )}

        <div className="saas-field">
          <span className="saas-field-label-row">
            <span className="saas-field-label">Style presets</span>
            <span className="saas-help-tip" title="One-click looks that set glow and badge values together." aria-label="One-click looks that set glow and badge values together.">?</span>
          </span>
          <div className="saas-chip-row">
            <button type="button" className={`saas-chip-btn${isPresetActive("subtle") ? " active" : ""}`} aria-pressed={isPresetActive("subtle")} onClick={() => applyHeroStylePreset("subtle")}>Subtle</button>
            <button type="button" className={`saas-chip-btn${isPresetActive("bold") ? " active" : ""}`} aria-pressed={isPresetActive("bold")} onClick={() => applyHeroStylePreset("bold")}>Bold</button>
            <button type="button" className={`saas-chip-btn${isPresetActive("premium") ? " active" : ""}`} aria-pressed={isPresetActive("premium")} onClick={() => applyHeroStylePreset("premium")}>Premium</button>
          </div>
        </div>
      </EditorSection>

      <AdvancedAccordion>
        <Field label="Avatar image URL">
          <input type="text" value={data.avatarUrl || ""} onChange={(e) => onUpdate({ avatarUrl: e.target.value })} placeholder="https://..." />
        </Field>
        <Field label="Glow hex">
          <input type="text" value={data.avatarGlowColor || "#FF6B2C"} onChange={(e) => onUpdate({ avatarGlowColor: e.target.value })} placeholder="#FFA665" />
        </Field>
        <Field label={`Glow blur (${data.avatarGlowBlur ?? 18}px)`} tooltip="Controls softness. Higher blur creates a diffused glow.">
          <input type="range" min="0" max="60" step="1" value={data.avatarGlowBlur ?? 18} onChange={(e) => onUpdate({ avatarGlowBlur: Number(e.target.value) })} />
        </Field>
        <Field label={`Glow spread (${data.avatarGlowSpread ?? 10}px)`} tooltip="Controls reach. Higher spread makes the glow extend farther from the avatar.">
          <input type="range" min="0" max="48" step="1" value={data.avatarGlowSpread ?? 10} onChange={(e) => onUpdate({ avatarGlowSpread: Number(e.target.value) })} />
        </Field>
        <Field label="Brand color">
          <PremiumColorPicker value={data.brandColor || "#FF6B2C"} onChange={(color) => onUpdate({ brandColor: color })} ariaLabel="Theme / brand color" buttonText="Choose brand color" presets={["#FFA665", "#384862", "#111827", "#FFFFFF", "#F5F7FA"]} />
        </Field>
        {badgeEnabled ? (
          <>
            <Field label="Badge hex">
              <input type="text" value={data.verifiedBadgeColor || "#3B82F6"} onChange={(e) => onUpdate({ verifiedBadgeColor: e.target.value })} placeholder="#3B82F6" />
            </Field>
            <Field label="Badge icon color">
              <PremiumColorPicker value={data.verifiedBadgeIconColor || "#0f172a"} onChange={(color) => onUpdate({ verifiedBadgeIconColor: color })} ariaLabel="Verified badge icon color" buttonText="Choose icon color" presets={["#FFA665", "#384862", "#111827", "#FFFFFF", "#F5F7FA"]} />
            </Field>
            <Field label="Badge icon">
              <select value={data.verifiedBadgeIcon || "checkmark"} onChange={(e) => onUpdate({ verifiedBadgeIcon: e.target.value })}>
                <option value="checkmark">Check badge</option>
                <option value="badge-check">Badge check</option>
                <option value="shield">Shield</option>
                <option value="shield-check">Shield check</option>
                <option value="sparkles">Sparkles</option>
                <option value="medal">Medal</option>
                <option value="none">None</option>
              </select>
            </Field>
            <Field label="Badge position">
              <select value={data.verifiedBadgePosition || "bottom-right"} onChange={(e) => onUpdate({ verifiedBadgePosition: e.target.value })}>
                <option value="bottom-right">Bottom-right</option>
                <option value="bottom-left">Bottom-left</option>
                <option value="top-right">Top-right</option>
                <option value="top-left">Top-left</option>
              </select>
            </Field>
            <Field label={`Badge size (${data.verifiedBadgeSize ?? 24}px)`}>
              <input type="range" min="14" max="48" step="1" value={data.verifiedBadgeSize ?? 24} onChange={(e) => onUpdate({ verifiedBadgeSize: Number(e.target.value) })} />
            </Field>
          </>
        ) : null}
      </AdvancedAccordion>

      <div className="saas-inline-actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="saas-mini-btn" onClick={resetGlowAndBadgeDefaults}>Reset glow + badge</button>
      </div>
    </div>
  );
}

export function ContactButtonsEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <EditorSection title="Content" description="Primary contact actions for your profile.">
        <Field label="Phone"><input type="text" value={data.phone || ""} onChange={(e) => onUpdate({ phone: e.target.value })} placeholder="(555) 123-4567" /></Field>
        <Field label="Email"><input type="email" value={data.email || ""} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="you@company.com" /></Field>
        <Field label="Website"><input type="text" value={data.website || ""} onChange={(e) => onUpdate({ website: e.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Address"><input type="text" value={data.address || ""} onChange={(e) => onUpdate({ address: e.target.value })} placeholder="123 Main St" /></Field>
        <Field label="SMS / text number"><input type="text" value={data.sms || ""} onChange={(e) => onUpdate({ sms: e.target.value })} placeholder="(555) 123-4567" /></Field>
        <Field label="Custom button label"><input type="text" value={data.customLabel || ""} onChange={(e) => onUpdate({ customLabel: e.target.value })} placeholder="Book Now" /></Field>
        <Field label="Custom button URL"><input type="text" value={data.customUrl || ""} onChange={(e) => onUpdate({ customUrl: e.target.value })} placeholder="https://..." /></Field>
      </EditorSection>

      <EditorSection title="Appearance" description="Choose how contact buttons are arranged.">
        <Field label="Button style">
          <select value={data.style || "grid"} onChange={(e) => onUpdate({ style: e.target.value })}>
            <option value="grid">Grid</option>
            <option value="row">Row</option>
          </select>
        </Field>
        <p className="saas-field-hint">Color controls for grouped contact buttons are coming soon.</p>
      </EditorSection>

      <AdvancedAccordion>
        <Toggle label="Show phone" checked={data.showPhone !== false} onChange={(v) => onUpdate({ showPhone: v })} />
        <Toggle label="Show email" checked={data.showEmail !== false} onChange={(v) => onUpdate({ showEmail: v })} />
        <Toggle label="Show website" checked={data.showWebsite !== false} onChange={(v) => onUpdate({ showWebsite: v })} />
        <Toggle label="Show address" checked={Boolean(data.showAddress)} onChange={(v) => onUpdate({ showAddress: v })} />
        <Toggle label="Show SMS" checked={Boolean(data.showSms)} onChange={(v) => onUpdate({ showSms: v })} />
        <Toggle label="Show custom" checked={Boolean(data.showCustom)} onChange={(v) => onUpdate({ showCustom: v })} />
      </AdvancedAccordion>
    </div>
  );
}

export function PhoneBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const type = normalizeBlockType(String((block as any).type));
  const isPhone = type === "phone-button";
  const isEmail = type === "email-button";
  const isWebsite = type === "website-button";
  const isDirections = type === "directions-button";

  const defaultLabel = isEmail ? "Email" : isWebsite ? "Website" : isDirections ? "Directions" : "Call";

  const handleBehaviorChange = (nextBehavior: string) => {
    const currentLabel = String(data.label || "").trim();
    const shouldAutoLabel = !currentLabel || currentLabel === "Call" || currentLabel === "Text";
    onUpdate({
      behavior: nextBehavior,
      ...(shouldAutoLabel ? { label: nextBehavior === "sms" ? "Text" : "Call" } : {}),
    });
  };

  return (
    <div className="saas-fields">
      <EditorSection title="Content">
        <Field label="Label"><input type="text" value={data.label || defaultLabel} onChange={(e) => onUpdate({ label: e.target.value })} /></Field>

        {isPhone ? (
          <Field label="Value / phone"><input type="text" value={data.phone || ""} onChange={(e) => onUpdate({ phone: e.target.value })} placeholder="(555) 123-4567" /></Field>
        ) : null}

        {isEmail ? (
          <Field label="Value / email"><input type="email" value={data.email || ""} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="you@company.com" /></Field>
        ) : null}

        {isWebsite ? (
          <Field label="Value / URL"><input type="text" value={data.website || data.url || ""} onChange={(e) => onUpdate({ website: e.target.value, url: e.target.value })} placeholder="https://example.com" /></Field>
        ) : null}

        {isDirections ? (
          <>
            <Field label="Address">
              <input type="text" value={data.address || ""} onChange={(e) => onUpdate({ address: e.target.value })} placeholder="123 Main St, City" />
            </Field>
            <Field label="Custom maps URL (optional)">
              <input type="text" value={data.url || ""} onChange={(e) => onUpdate({ url: e.target.value })} placeholder="https://maps.google.com/..." />
            </Field>
          </>
        ) : null}
      </EditorSection>

      {isPhone ? (
        <EditorSection title="Appearance">
          <Field label="Button action">
            <select value={data.behavior || "call"} onChange={(e) => handleBehaviorChange(e.target.value)}>
              <option value="call">Call</option>
              <option value="sms">Text</option>
            </select>
          </Field>
          <p className="saas-field-hint">Icon and label update with the selected action type.</p>
        </EditorSection>
      ) : (
        <EditorSection title="Appearance">
          <p className="saas-field-hint">This block uses an action-specific icon and destination based on its type.</p>
        </EditorSection>
      )}

      <AdvancedAccordion><Toggle label="Visible" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} /></AdvancedAccordion>
    </div>
  );
}

export function BookingBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <EditorSection title="Content">
        <Field label="Label"><input type="text" value={data.label || "Request / Book"} onChange={(e) => onUpdate({ label: e.target.value })} /></Field>
        <Field label="Value / URL"><input type="text" value={data.url || ""} onChange={(e) => onUpdate({ url: e.target.value })} placeholder="https://..." /></Field>
      </EditorSection>
      <EditorSection title="Appearance">
        <p className="saas-field-hint">Button style and color controls will appear here as this block expands.</p>
      </EditorSection>
      <AdvancedAccordion>
        <Field label="Form mode placeholder"><input type="text" value={data.formPlaceholder || "Optional form mode"} onChange={(e) => onUpdate({ formPlaceholder: e.target.value })} /></Field>
        <Toggle label="Visible" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} />
      </AdvancedAccordion>
    </div>
  );
}

const PLATFORMS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "X",
  "Snapchat",
  "Google Business",
  "Yelp",
  "Custom",
];

export function SocialLinksEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const links = Array.isArray(data.links) ? data.links : [];

  const updateLink = (idx: number, patch: Record<string, any>) => {
    const next = links.map((link: any, i: number) => (i === idx ? { ...link, ...patch } : link));
    onUpdate({ links: next });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= links.length) return;
    const next = [...links];
    [next[idx], next[to]] = [next[to], next[idx]];
    onUpdate({ links: next });
  };

  return (
    <div className="saas-fields">
      <EditorSection title="Content" description="Manage every social destination in one place.">
        {links.map((link: any, idx: number) => (
          <div key={`${link.id || idx}`} className="saas-inline-group">
            <Field label={`Link ${idx + 1} platform`}>
              <select value={link.platform || "Instagram"} onChange={(e) => updateLink(idx, { platform: e.target.value })}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Value / URL">
              <input type="text" value={link.value || ""} onChange={(e) => updateLink(idx, { value: e.target.value })} placeholder="@handle or https://..." />
            </Field>
            <div className="saas-icon-preview">{(link.platform || "Custom").slice(0, 1)}</div>
            <RowActions onUp={() => move(idx, -1)} onDown={() => move(idx, 1)} onDelete={() => onUpdate({ links: links.filter((_: any, i: number) => i !== idx) })} />
          </div>
        ))}
        <button type="button" className="saas-mini-btn" onClick={() => onUpdate({ links: [...links, { id: `${Date.now()}`, platform: "Instagram", value: "" }] })}>+ Add link</button>
      </EditorSection>
      <EditorSection title="Appearance">
        <p className="saas-field-hint">Icon style and color controls remain compatible and will be elevated here next.</p>
      </EditorSection>
      <AdvancedAccordion><Toggle label="Visible" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} /></AdvancedAccordion>
    </div>
  );
}

export function ServicesEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const services = Array.isArray(data.services) ? data.services : [];

  const updateService = (idx: number, patch: Record<string, any>) => {
    const next = services.map((item: any, i: number) => (i === idx ? { ...item, ...patch } : item));
    onUpdate({ services: next });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= services.length) return;
    const next = [...services];
    [next[idx], next[to]] = [next[to], next[idx]];
    onUpdate({ services: next });
  };

  return (
    <div className="saas-fields">
      {services.map((service: any, idx: number) => (
        <div key={`${service.id || idx}`} className="saas-inline-group">
          <Field label="Service Title">
            <input type="text" value={service.title || ""} onChange={(e) => updateService(idx, { title: e.target.value })} placeholder="Service title" />
          </Field>
          <Field label="Description">
            <textarea value={service.description || ""} onChange={(e) => updateService(idx, { description: e.target.value })} rows={2} placeholder="Description" />
          </Field>
          <Field label="Price / Range (optional)">
            <input type="text" value={service.price || ""} onChange={(e) => updateService(idx, { price: e.target.value })} placeholder="$99" />
          </Field>
          <Field label="Button URL (optional)">
            <input type="text" value={service.url || ""} onChange={(e) => updateService(idx, { url: e.target.value })} placeholder="https://..." />
          </Field>
          <RowActions onUp={() => move(idx, -1)} onDown={() => move(idx, 1)} onDelete={() => onUpdate({ services: services.filter((_: any, i: number) => i !== idx) })} />
        </div>
      ))}
      <button type="button" className="saas-mini-btn" onClick={() => onUpdate({ services: [...services, { id: `${Date.now()}`, title: "", description: "", price: "", url: "" }] })}>+ Add Service</button>
      <Toggle label="Visible" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} />
    </div>
  );
}

export function TextSectionEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <Field label="Section Heading">
        <input type="text" value={data.heading || ""} onChange={(e) => onUpdate({ heading: e.target.value })} placeholder="About Me" />
      </Field>
      <Field label="Body Text">
        <textarea value={data.content || ""} onChange={(e) => onUpdate({ content: e.target.value })} rows={4} placeholder="Write your section content" />
      </Field>
      <Field label="Alignment">
        <select value={data.alignment || "center"} onChange={(e) => onUpdate({ alignment: e.target.value })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Toggle label="Visible" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} />
    </div>
  );
}

export function ImageBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <Field label="Image URL / Upload URL">
        <input type="text" value={data.imageUrl || ""} onChange={(e) => onUpdate({ imageUrl: e.target.value })} placeholder="https://..." />
      </Field>
      <Field label="Alt Text">
        <input type="text" value={data.altText || ""} onChange={(e) => onUpdate({ altText: e.target.value })} placeholder="Describe image" />
      </Field>
      <Field label="Caption">
        <input type="text" value={data.caption || ""} onChange={(e) => onUpdate({ caption: e.target.value })} placeholder="Caption" />
      </Field>
      <Field label="Link URL (optional)">
        <input type="text" value={data.linkUrl || ""} onChange={(e) => onUpdate({ linkUrl: e.target.value })} placeholder="https://..." />
      </Field>
      <Toggle label="Visible" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} />
    </div>
  );
}

export function BusinessHoursEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const hours = data.hours || {};
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className="saas-fields">
      <Field label="Section Title">
        <input
          type="text"
          value={data.title || "Business Hours"}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Business Hours"
        />
      </Field>
      {days.map((day) => (
        <Field key={day} label={day}>
          <input
            type="text"
            value={hours[day] || ""}
            onChange={(e) => onUpdate({ hours: { ...hours, [day]: e.target.value } })}
            placeholder={day === "Saturday" || day === "Sunday" ? "Closed" : "9:00 AM - 5:00 PM"}
          />
        </Field>
      ))}
      <Toggle
        label="Visible"
        checked={block.visible !== false}
        onChange={(v) => onUpdate({ __toggleVisibility: v })}
      />
    </div>
  );
}

export function FormBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <Field label="Form Label">
        <input
          type="text"
          value={data.formLabel || "Contact Form"}
          onChange={(e) => onUpdate({ formLabel: e.target.value })}
          placeholder="Contact Form"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={data.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={3}
          placeholder="Tell customers what this form is for"
        />
      </Field>
      <Field label="Submit Button Text">
        <input
          type="text"
          value={data.submitText || "Send"}
          onChange={(e) => onUpdate({ submitText: e.target.value })}
          placeholder="Send"
        />
      </Field>
      <Toggle
        label="Visible"
        checked={block.visible !== false}
        onChange={(v) => onUpdate({ __toggleVisibility: v })}
      />
    </div>
  );
}

export function WalletButtonEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <Field label="Button Label">
        <input
          type="text"
          value={data.label || "Add to Wallet"}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Add to Wallet"
        />
      </Field>
      <Field label="Destination URL (optional)">
        <input
          type="text"
          value={data.url || ""}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://..."
        />
      </Field>
      <Toggle
        label="Show icon"
        checked={data.showIcon !== false}
        onChange={(v) => onUpdate({ showIcon: v })}
      />
      <Toggle
        label="Visible"
        checked={block.visible !== false}
        onChange={(v) => onUpdate({ __toggleVisibility: v })}
      />
    </div>
  );
}

export function QRCodeBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <Field label="Label">
        <input
          type="text"
          value={data.label || "Scan to connect"}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Scan to connect"
        />
      </Field>
      <Field label="QR Destination URL">
        <input
          type="text"
          value={data.url || ""}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://..."
        />
      </Field>
      <Field label="Caption (optional)">
        <input
          type="text"
          value={data.caption || ""}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder="Quick contact"
        />
      </Field>
      <Toggle
        label="Show label"
        checked={data.showLabel !== false}
        onChange={(v) => onUpdate({ showLabel: v })}
      />
      <Toggle
        label="Visible"
        checked={block.visible !== false}
        onChange={(v) => onUpdate({ __toggleVisibility: v })}
      />
    </div>
  );
}
