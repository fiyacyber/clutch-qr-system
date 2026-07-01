"use client";

import { useRef, useState } from "react";
import { ChevronDown, UploadCloud } from "lucide-react";
import { BuilderBlock } from "@/lib/builder-types";
import { createInitials, getBlockData, normalizeBlockType } from "./blockUtils";
import FontFamilyPicker from "../FontFamilyPicker";
import PremiumColorPicker from "../PremiumColorPicker";

export interface BlockEditorProps {
  block: BuilderBlock;
  onUpdate: (patch: Record<string, any>) => void;
}

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
      <button type="button" className="saas-mini-btn" onClick={onUp} aria-label="Move item up">↑</button>
      <button type="button" className="saas-mini-btn" onClick={onDown} aria-label="Move item down">↓</button>
      <button type="button" className="saas-mini-btn danger" onClick={onDelete} aria-label="Remove item">×</button>
    </div>
  );
}

function AdvancedAccordion({ children }: { children: React.ReactNode }) {
  return <CollapsibleSection title="Advanced styling" defaultOpen={false}>{children}</CollapsibleSection>;
}

function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={`saas-advanced-accordion${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="saas-accordion-trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{title}</span>
        <ChevronDown className="saas-accordion-caret" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="saas-advanced-content">
        {description ? <p className="saas-field-hint">{description}</p> : null}
        {children}
        </div>
      ) : null}
    </section>
  );
}

function NestedSection({ title, description, children, defaultOpen = true }: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <CollapsibleSection title={title} description={description} defaultOpen={defaultOpen}>
      {children}
    </CollapsibleSection>
  );
}

function AlignmentControl({ value, onChange }: { value?: string; onChange: (value: "left" | "center" | "right") => void }) {
  const active = value === "left" || value === "right" ? value : "center";
  return (
    <Field label="Alignment">
      <div className="saas-chip-row" role="radiogroup" aria-label="Block alignment">
        {(["left", "center", "right"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active === option}
            className={`saas-chip-btn${active === option ? " active" : ""}`}
            onClick={() => onChange(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
    </Field>
  );
}

function BlockAdvancedControls({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <>
      <AlignmentControl value={data.alignment} onChange={(alignment) => onUpdate({ alignment })} />
      <Toggle label="Show on public profile" checked={block.visible !== false} onChange={(v) => onUpdate({ __toggleVisibility: v })} />
    </>
  );
}

export function AvatarBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const avatarUrl = !data.avatarRemoved && typeof data.avatarUrl === "string" && data.avatarUrl !== "null" && data.avatarUrl !== "undefined" && !data.avatarUrl.startsWith("blob:") ? data.avatarUrl : "";
  const badgeEnabled = Boolean(data.verifiedBadgeEnabled ?? data.verified);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const initials = createInitials(data.businessName, undefined, undefined);

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

  const uploadAvatarFile = async (file: File) => {
    if (!file) return;

    const heicTypes = ["image/heic", "image/heif"];
    if (heicTypes.includes(file.type)) {
      setAvatarUploadError("HEIC photos are not supported yet. Please upload PNG, JPG, or WebP.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarUploadError("Profile photo must be PNG, JPG, WebP, or SVG.");
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAvatarUploadError("Profile photo must be 2MB or smaller.");
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarUploadError(null);

    try {
      const form = new FormData();
      form.append("avatar", file);
      const response = await fetch("/api/connect/avatar", {
        method: "POST",
        body: form,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn("Avatar upload failed", {
          status: response.status,
          error: result?.error,
        });
        throw new Error(result.error || "Avatar upload failed.");
      }

      const avatarUrl = result.avatar_url;
      if (!avatarUrl) {
        throw new Error("Avatar upload did not return a public image URL.");
      }

      onUpdate({ avatarUrl, avatarRemoved: false });
    } catch (error) {
      setAvatarUploadError(error instanceof Error ? error.message : "Avatar upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAvatarFile(file);
    event.target.value = "";
  };

  return (
    <div className="saas-fields">
      <CollapsibleSection title="Avatar" description="Profile imagery and presence.">
        <div className="saas-avatar-panel">
          <div className="saas-avatar-preview-circle">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar preview" /> : <span>{initials}</span>}
          </div>
          <div
            className={`saas-avatar-upload-drop${isAvatarDragActive ? " is-drag-active" : ""}${isUploadingAvatar ? " is-uploading" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && !isUploadingAvatar) {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isUploadingAvatar) setIsAvatarDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isUploadingAvatar) setIsAvatarDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsAvatarDragActive(false);
            }}
            onDrop={async (event) => {
              event.preventDefault();
              setIsAvatarDragActive(false);
              if (isUploadingAvatar) return;
              const file = event.dataTransfer?.files?.[0];
              if (!file) return;
              await uploadAvatarFile(file);
            }}
          >
            <span className="saas-avatar-upload-icon" aria-hidden="true">
              <UploadCloud size={18} />
            </span>
            <span className="saas-avatar-upload-copy">
              <strong>{isUploadingAvatar ? "Uploading profile photo..." : "Upload Profile Photo"}</strong>
              <small>Drag & drop or click to browse</small>
            </span>
          </div>
          {avatarUploadError ? <p className="saas-field-error">{avatarUploadError}</p> : null}
          <div className="saas-avatar-actions">
            <button
              type="button"
              className="saas-avatar-secondary-btn"
              onClick={() => onUpdate({ avatarUrl: "", avatarRemoved: true })}
              disabled={isUploadingAvatar}
            >
              Remove avatar
            </button>
          </div>
          <p className="saas-field-hint">Recommended: square image, at least 1000×1000px, PNG/JPG/WebP/SVG, max 2MB.</p>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="saas-hidden-input" onChange={handleAvatarFile} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" description="Glow, badge, and brand emphasis.">
        <Toggle
          label="Avatar glow"
          tooltip="Turn the halo behind the avatar on or off."
          checked={data.avatarGlowEnabled !== false}
          onChange={(v) => onUpdate({ avatarGlowEnabled: v })}
        />

        {data.avatarGlowEnabled !== false && (
          <>
            <Field label="Glow color" tooltip="The tint used for the halo behind your avatar.">
              <PremiumColorPicker
                value={data.avatarGlowColor || "#FF6B2C"}
                onChange={(color) => onUpdate({ avatarGlowColor: color })}
                ariaLabel="Avatar glow color"
                buttonText="Custom"
                presets={[]}
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
            <PremiumColorPicker
              value={data.verifiedBadgeColor || "#3B82F6"}
              onChange={(color) => onUpdate({ verifiedBadgeColor: color })}
              ariaLabel="Verified badge color"
              buttonText="Custom"
              presets={[]}
            />
          </Field>
        )}

        <Toggle
          label="Avatar border"
          tooltip="Add a custom border around the avatar."
          checked={data.avatarBorderEnabled === true}
          onChange={(v) => onUpdate({ avatarBorderEnabled: v })}
        />

        {data.avatarBorderEnabled === true ? (
          <>
            <Field label="Border color">
              <PremiumColorPicker
                value={data.avatarBorderColor || "#FFA665"}
                onChange={(color) => onUpdate({ avatarBorderColor: color })}
                ariaLabel="Avatar border color"
                buttonText="Custom"
                presets={[]}
              />
            </Field>
            <Field label={`Border width (${Number(data.avatarBorderWidth ?? 4)}px)`}>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={Number(data.avatarBorderWidth ?? 4)}
                onChange={(e) => onUpdate({ avatarBorderWidth: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Border radius (${Number(data.avatarBorderRadius ?? 999)}px)`}>
              <input
                type="range"
                min="0"
                max="999"
                step="1"
                value={Number(data.avatarBorderRadius ?? 999)}
                onChange={(e) => onUpdate({ avatarBorderRadius: Number(e.target.value) })}
              />
            </Field>
          </>
        ) : null}
      </CollapsibleSection>

      <AdvancedAccordion>
        <Field label="Avatar image URL">
          <input type="text" value={avatarUrl} onChange={(e) => onUpdate({ avatarUrl: e.target.value, avatarRemoved: false })} placeholder="https://..." />
        </Field>
        <Field label="Glow hex">
          <input type="text" value={data.avatarGlowColor || "#FF6B2C"} onChange={(e) => onUpdate({ avatarGlowColor: e.target.value })} placeholder="#FFFFFF" />
        </Field>
        <Field label={`Glow blur (${data.avatarGlowBlur ?? 18}px)`} tooltip="Controls softness. Higher blur creates a diffused glow.">
          <input type="range" min="0" max="60" step="1" value={data.avatarGlowBlur ?? 18} onChange={(e) => onUpdate({ avatarGlowBlur: Number(e.target.value) })} />
        </Field>
        <Field label={`Glow spread (${data.avatarGlowSpread ?? 10}px)`} tooltip="Controls reach. Higher spread makes the glow extend farther from the avatar.">
          <input type="range" min="0" max="48" step="1" value={data.avatarGlowSpread ?? 10} onChange={(e) => onUpdate({ avatarGlowSpread: Number(e.target.value) })} />
        </Field>
        <Field label="Brand color">
          <PremiumColorPicker value={data.brandColor || "#FF6B2C"} onChange={(color) => onUpdate({ brandColor: color })} ariaLabel="Theme / brand color" buttonText="Choose brand color" presets={[]} />
        </Field>
        {badgeEnabled ? (
          <>
            <Field label="Badge hex">
              <input type="text" value={data.verifiedBadgeColor || "#3B82F6"} onChange={(e) => onUpdate({ verifiedBadgeColor: e.target.value })} placeholder="#FFFFFF" />
            </Field>
            <Field label="Badge icon color">
              <PremiumColorPicker value={data.verifiedBadgeIconColor || "#0f172a"} onChange={(color) => onUpdate({ verifiedBadgeIconColor: color })} ariaLabel="Verified badge icon color" buttonText="Choose icon color" presets={[]} />
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
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
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
      <CollapsibleSection title="Content" description="Primary contact actions for your profile.">
        <Field label="Phone"><input type="text" value={data.phone || ""} onChange={(e) => onUpdate({ phone: e.target.value })} placeholder="(555) 123-4567" /></Field>
        <Field label="Email"><input type="email" value={data.email || ""} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="you@company.com" /></Field>
        <Field label="Website"><input type="text" value={data.website || ""} onChange={(e) => onUpdate({ website: e.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Address"><input type="text" value={data.address || ""} onChange={(e) => onUpdate({ address: e.target.value })} placeholder="123 Main St" /></Field>
        <Field label="SMS / text number"><input type="text" value={data.sms || ""} onChange={(e) => onUpdate({ sms: e.target.value })} placeholder="(555) 123-4567" /></Field>
        <Field label="Custom button label"><input type="text" value={data.customLabel || ""} onChange={(e) => onUpdate({ customLabel: e.target.value })} placeholder="Book Now" /></Field>
        <Field label="Custom button URL"><input type="text" value={data.customUrl || ""} onChange={(e) => onUpdate({ customUrl: e.target.value })} placeholder="https://..." /></Field>
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" description="Choose how contact buttons are arranged.">
        <Field label="Button style">
          <select value={data.style || "grid"} onChange={(e) => onUpdate({ style: e.target.value })}>
            <option value="grid">Grid</option>
            <option value="row">Row</option>
          </select>
        </Field>
        <p className="saas-field-hint">Color controls for grouped contact buttons are coming soon.</p>
      </CollapsibleSection>

      <AdvancedAccordion>
        <Toggle label="Show phone" checked={data.showPhone !== false} onChange={(v) => onUpdate({ showPhone: v })} />
        <Toggle label="Show email" checked={data.showEmail !== false} onChange={(v) => onUpdate({ showEmail: v })} />
        <Toggle label="Show website" checked={data.showWebsite !== false} onChange={(v) => onUpdate({ showWebsite: v })} />
        <Toggle label="Show address" checked={Boolean(data.showAddress)} onChange={(v) => onUpdate({ showAddress: v })} />
        <Toggle label="Show SMS" checked={Boolean(data.showSms)} onChange={(v) => onUpdate({ showSms: v })} />
        <Toggle label="Show custom" checked={Boolean(data.showCustom)} onChange={(v) => onUpdate({ showCustom: v })} />
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

function TextBlockStyleEditor({
  block,
  onUpdate,
  label,
  placeholder,
  defaultSize,
  defaultWeight,
  maxChars,
}: {
  block: BuilderBlock;
  onUpdate: (patch: Record<string, any>) => void;
  label: string;
  placeholder: string;
  defaultSize: number;
  defaultWeight: number;
  maxChars: number;
}) {
  const data = getBlockData(block);
  const size = Number(data.fontSize) || defaultSize;
  const weight = Number(data.fontWeight) || defaultWeight;
  const textValue = String(data.text || "");
  const [textLengthError, setTextLengthError] = useState<string | null>(null);

  return (
    <div className="saas-fields">
      <CollapsibleSection title="Content" description="Text shown in your profile header.">
        <Field label={label}>
          <input
            type="text"
            value={textValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (nextValue.length > maxChars) {
                setTextLengthError(`Maximum ${maxChars} characters.`);
                return;
              }
              if (textLengthError) {
                setTextLengthError(null);
              }
              onUpdate({ text: nextValue });
            }}
            placeholder={placeholder}
          />
          <p className="saas-field-hint">{textValue.length}/{maxChars} characters</p>
          {textLengthError ? <p className="saas-field-error">{textLengthError}</p> : null}
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" description="Typography and color controls.">
        <Field label={`Font size (${size}px)`}>
          <input
            type="range"
            min="16"
            max="64"
            step="1"
            value={size}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          />
        </Field>
        <Field label="Weight">
          <select value={String(weight)} onChange={(e) => onUpdate({ fontWeight: Number(e.target.value) })}>
            <option value="500">Medium</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
            <option value="800">Extra Bold</option>
            <option value="900">Black</option>
          </select>
        </Field>
        <Field label="Font family">
          <FontFamilyPicker value={data.fontFamily || "inherit"} allowInherit onChange={(value) => onUpdate({ fontFamily: value })} />
        </Field>
        <Field label="Text color">
          <PremiumColorPicker
            value={data.color || "#0F172A"}
            onChange={(color) => onUpdate({ color })}
            ariaLabel={`${label} text color`}
            buttonText="Custom"
            presets={[]}
          />
        </Field>
      </CollapsibleSection>

      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function BusinessNameBlockEditor({ block, onUpdate }: BlockEditorProps) {
  return (
    <TextBlockStyleEditor
      block={block}
      onUpdate={onUpdate}
      label="Business name"
      placeholder="Your Business Name"
      defaultSize={40}
      defaultWeight={800}
      maxChars={60}
    />
  );
}

export function SubheaderBlockEditor({ block, onUpdate }: BlockEditorProps) {
  return (
    <TextBlockStyleEditor
      block={block}
      onUpdate={onUpdate}
      label="Subheader"
      placeholder="Owner / Designer"
      defaultSize={22}
      defaultWeight={600}
      maxChars={80}
    />
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
      <CollapsibleSection title="Content">
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
      </CollapsibleSection>

      {isPhone ? (
        <CollapsibleSection title="Appearance" description="Behavior and visual treatment for this action button.">
          <Field label="Button action">
            <select value={data.behavior || "call"} onChange={(e) => handleBehaviorChange(e.target.value)}>
              <option value="call">Call</option>
              <option value="sms">Text</option>
            </select>
          </Field>
          <p className="saas-field-hint">Icon and label update with the selected action type.</p>
        </CollapsibleSection>
      ) : (
        <CollapsibleSection title="Appearance" description="Behavior and visual treatment for this action button.">
          <p className="saas-field-hint">This block uses an action-specific icon and destination based on its type.</p>
        </CollapsibleSection>
      )}

      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function BookingBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <CollapsibleSection title="Content">
        <Field label="Label"><input type="text" value={data.label || "Request / Book"} onChange={(e) => onUpdate({ label: e.target.value })} /></Field>
        <Field label="Value / URL"><input type="text" value={data.url || ""} onChange={(e) => onUpdate({ url: e.target.value })} placeholder="https://..." /></Field>
      </CollapsibleSection>
      <CollapsibleSection title="Appearance" description="Behavior and visual treatment for this booking action.">
        <p className="saas-field-hint">Button style and color controls will appear here as this block expands.</p>
      </CollapsibleSection>
      <AdvancedAccordion>
        <Field label="Form mode placeholder"><input type="text" value={data.formPlaceholder || "Optional form mode"} onChange={(e) => onUpdate({ formPlaceholder: e.target.value })} /></Field>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
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
  const links = Array.isArray(data.links) ? data.links.slice(0, 6) : [];
  const iconColorMode = data.iconColorMode || "mono";
  const reachedLimit = links.length >= 6;

  const updateLink = (idx: number, patch: Record<string, any>) => {
    const next = links.map((link: any, i: number) => (i === idx ? { ...link, ...patch } : link)).slice(0, 6);
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
      <CollapsibleSection title="Content" description="Manage every social destination in one place.">
        <div className="saas-field">
          <span className="saas-field-label-row">
            <span className="saas-field-label">Icon color style</span>
            <span className="saas-help-tip" title="Keep icons monochrome by default, or switch to brand colors per platform." aria-label="Keep icons monochrome by default, or switch to brand colors per platform.">?</span>
          </span>
          <div className="saas-chip-row">
            <button
              type="button"
              className={`saas-chip-btn${iconColorMode === "mono" ? " active" : ""}`}
              aria-pressed={iconColorMode === "mono"}
              onClick={() => onUpdate({ iconColorMode: "mono" })}
            >
              Monochrome
            </button>
            <button
              type="button"
              className={`saas-chip-btn${iconColorMode === "brand" ? " active" : ""}`}
              aria-pressed={iconColorMode === "brand"}
              onClick={() => onUpdate({ iconColorMode: "brand" })}
            >
              Brand colors
            </button>
          </div>
          <p className="saas-field-hint">Monochrome keeps the icons clean and consistent with the rest of the page.</p>
        </div>
        {links.map((link: any, idx: number) => (
          <div key={`${link.id || idx}`} className="saas-inline-group">
            <Field label={`Link ${idx + 1} platform`}>
              <select value={link.platform || "Instagram"} onChange={(e) => updateLink(idx, { platform: e.target.value })}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Label">
              <input type="text" value={link.label || link.platform || ""} onChange={(e) => updateLink(idx, { label: e.target.value })} placeholder="Instagram" />
            </Field>
            <Field label="Value / URL">
              <input type="text" value={link.value || ""} onChange={(e) => updateLink(idx, { value: e.target.value })} placeholder="@handle or https://..." />
            </Field>
            <Field label="Icon treatment">
              <select value={link.iconTreatment || "default"} onChange={(e) => updateLink(idx, { iconTreatment: e.target.value === "default" ? undefined : e.target.value })}>
                <option value="default">Use block style</option>
                <option value="mono">Monochrome</option>
                <option value="brand">Brand color</option>
              </select>
            </Field>
            <div className="saas-icon-preview">{(link.platform || "Custom").slice(0, 1)}</div>
            <RowActions onUp={() => move(idx, -1)} onDown={() => move(idx, 1)} onDelete={() => onUpdate({ links: links.filter((_: any, i: number) => i !== idx) })} />
          </div>
        ))}
        <button
          type="button"
          className="saas-mini-btn"
          disabled={reachedLimit}
          onClick={() => {
            if (reachedLimit) return;
            onUpdate({ links: [...links, { id: `${Date.now()}`, platform: "Instagram", label: "Instagram", value: "", iconTreatment: "mono" }] });
          }}
        >
          + Add social link
        </button>
        {reachedLimit ? <p className="saas-field-hint">Maximum of 6 social links reached.</p> : null}
      </CollapsibleSection>
      <CollapsibleSection title="Appearance" description="Behavior and visual treatment for social icons.">
        <p className="saas-field-hint">Icons inherit the selected color style automatically in the live preview.</p>
      </CollapsibleSection>
      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
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
      <CollapsibleSection title="Content" description="Add, edit, remove, and reorder services.">
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
      </CollapsibleSection>
      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function TextSectionEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <CollapsibleSection title="Content" description="Write the text that appears in this section.">
        <Field label="Section Heading">
          <input type="text" value={data.heading || ""} onChange={(e) => onUpdate({ heading: e.target.value })} placeholder="About Me" />
        </Field>
        <Field label="Body Text">
          <textarea value={data.content || ""} onChange={(e) => onUpdate({ content: e.target.value })} rows={4} placeholder="Write your section content" />
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" description="Tweak alignment and spacing behavior.">
        <Field label="Alignment">
          <select value={data.alignment || "center"} onChange={(e) => onUpdate({ alignment: e.target.value })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Field>
      </CollapsibleSection>

      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function ImageBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [isBannerDragActive, setIsBannerDragActive] = useState(false);

  const uploadBannerFile = async (file: File) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setBannerUploadError("Please use PNG, JPG, WEBP, or SVG files.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setBannerUploadError("Image is too large. Maximum size is 2 MB.");
      return;
    }

    setIsUploadingBanner(true);
    setBannerUploadError(null);

    try {
      const formData = new FormData();
      formData.append("banner", file);

      const response = await fetch("/api/connect/banner-image", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "x-clutch-fetch": "true",
        },
      });

      const result = await response.json();
      if (!response.ok) {
        setBannerUploadError(result.error || "Failed to upload image.");
        return;
      }

      onUpdate({ imageUrl: result.imageUrl });
    } catch (error) {
      setBannerUploadError(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleBannerFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    await uploadBannerFile(file);
    input.value = "";
  };

  return (
    <div className="saas-fields">
      <div className="saas-avatar-panel">
        <div
          className={`saas-avatar-upload-drop${isBannerDragActive ? " is-drag-active" : ""}${isUploadingBanner ? " is-uploading" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => !isUploadingBanner && fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !isUploadingBanner) {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isUploadingBanner) setIsBannerDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isUploadingBanner) setIsBannerDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsBannerDragActive(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            setIsBannerDragActive(false);
            if (isUploadingBanner) return;
            const file = event.dataTransfer?.files?.[0];
            if (!file) return;
            await uploadBannerFile(file);
          }}
        >
          <span className="saas-avatar-upload-icon" aria-hidden="true">
            <UploadCloud size={18} />
          </span>
          <span className="saas-avatar-upload-copy">
            <strong>{isUploadingBanner ? "Uploading banner image..." : "Upload Banner Image"}</strong>
            <small>Drag & drop or click to browse</small>
          </span>
        </div>
        {bannerUploadError ? <p className="saas-field-error">{bannerUploadError}</p> : null}
        <p className="saas-field-hint">Recommended: wide image, at least 1400px across, PNG/JPG/WEBP/SVG, max 2 MB.</p>
        <input ref={fileInputRef} type="file" accept="image/*" className="saas-hidden-input" onChange={handleBannerFile} />
      </div>

      <CollapsibleSection title="More settings" description="Image URL, alt text, caption, and link settings.">
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
      </CollapsibleSection>
      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
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
      <NestedSection title="Content" description="Set the heading and hours for each day.">
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
      </NestedSection>
      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function FormBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <CollapsibleSection title="Content" description="Name the form and describe what it does.">
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
      </CollapsibleSection>

      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function WalletButtonEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <CollapsibleSection title="Content" description="Label and destination for the wallet action.">
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
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" description="Visual tweaks for the wallet button.">
        <Toggle
          label="Show icon"
          checked={data.showIcon !== false}
          onChange={(v) => onUpdate({ showIcon: v })}
        />
      </CollapsibleSection>

      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}

export function QRCodeBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const data = getBlockData(block);
  return (
    <div className="saas-fields">
      <CollapsibleSection title="Content" description="The scan label, URL, and helper text.">
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
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" description="Control the supporting label beneath the QR code.">
        <Toggle
          label="Show label"
          checked={data.showLabel !== false}
          onChange={(v) => onUpdate({ showLabel: v })}
        />
      </CollapsibleSection>

      <AdvancedAccordion>
        <BlockAdvancedControls block={block} onUpdate={onUpdate} />
      </AdvancedAccordion>
    </div>
  );
}
