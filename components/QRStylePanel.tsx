"use client";

import styles from "./QRStylePanel.module.css";
import PremiumColorPicker from "./PremiumColorPicker";

export type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type CornerStyle = "square" | "dot" | "extra-rounded";
export type DownloadSize = "social" | "card" | "print";
export type ThemePreset = "default" | "paper" | "midnight" | "pastel";

type QRStylePanelProps = {
  // Retained as optional props so older callers remain compatible. Theme presets are no longer shown.
  theme?: ThemePreset;
  onThemeChange?: (theme: ThemePreset) => void;
  foregroundColor: string;
  onForegroundColorChange: (color: string) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  dotStyle: DotStyle;
  onDotStyleChange: (style: DotStyle) => void;
  cornerStyle: CornerStyle;
  onCornerStyleChange: (style: CornerStyle) => void;
  downloadSize: DownloadSize;
  onDownloadSizeChange: (size: DownloadSize) => void;
  logoFile: File | null;
  onLogoFileChange: (file: File | null) => void;
};

// These three patterns are meaningfully different at normal preview and print sizes.
// The previously exposed classy variants were visually indistinguishable for most users.
const DOT_STYLES: Array<{ value: DotStyle; label: string; helper: string }> = [
  { value: "square", label: "Squares", helper: "Maximum contrast" },
  { value: "dots", label: "Dots", helper: "Soft circular pattern" },
  { value: "rounded", label: "Rounded", helper: "Balanced modern look" },
];

const CORNER_STYLES: Array<{ value: CornerStyle; label: string }> = [
  { value: "square", label: "Square" },
  { value: "dot", label: "Dot" },
  { value: "extra-rounded", label: "Rounded" },
];

const DOWNLOAD_SIZES: Array<{ value: DownloadSize; label: string; size: string }> = [
  { value: "social", label: "Social", size: "512 × 512" },
  { value: "card", label: "Card", size: "600 × 600" },
  { value: "print", label: "Print", size: "2400 × 2400" },
];

export default function QRStylePanel({
  foregroundColor,
  onForegroundColorChange,
  backgroundColor,
  onBackgroundColorChange,
  dotStyle,
  onDotStyleChange,
  cornerStyle,
  onCornerStyleChange,
  downloadSize,
  onDownloadSizeChange,
  logoFile,
  onLogoFileChange,
}: QRStylePanelProps) {
  return (
    <div className={styles.container}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Customize QR</h3>
          <p>Keep strong contrast for reliable scanning. The defaults are already print-safe.</p>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h3>Colors</h3>
          <span>Use a dark QR color on a light background.</span>
        </div>
        <div className={styles.colorGrid}>
          <label className={styles.colorPicker}>
            <span className={styles.colorLabel}>QR Code</span>
            <PremiumColorPicker
              value={foregroundColor}
              onChange={onForegroundColorChange}
              ariaLabel="QR code color"
              buttonText="Choose QR color"
              className={styles.inlineColorPicker}
              triggerClassName={styles.inlineColorTrigger}
              valueClassName={styles.inlineColorValue}
            />
          </label>
          <label className={styles.colorPicker}>
            <span className={styles.colorLabel}>Background</span>
            <PremiumColorPicker
              value={backgroundColor}
              onChange={onBackgroundColorChange}
              ariaLabel="QR background color"
              buttonText="Choose background"
              className={styles.inlineColorPicker}
              triggerClassName={styles.inlineColorTrigger}
              valueClassName={styles.inlineColorValue}
            />
          </label>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h3>Pattern</h3>
          <span>Three distinct options, without duplicate-looking variants.</span>
        </div>

        <div className={styles.patternBlock}>
          <span className={styles.controlLabel}>Dot style</span>
          <div className={styles.patternGrid} role="radiogroup" aria-label="Dot style">
            {DOT_STYLES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.patternCard} ${dotStyle === option.value ? styles.active : ""}`}
                onClick={() => onDotStyleChange(option.value)}
                aria-pressed={dotStyle === option.value}
              >
                <span className={`${styles.patternSample} ${styles[`sample_${option.value}`] || ""}`} aria-hidden="true" />
                <strong>{option.label}</strong>
                <small>{option.helper}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.patternBlock}>
          <span className={styles.controlLabel}>Finder corner style</span>
          <div className={styles.cornerGrid} role="radiogroup" aria-label="Finder corner style">
            {CORNER_STYLES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.optionButton} ${cornerStyle === option.value ? styles.active : ""}`}
                onClick={() => onCornerStyleChange(option.value)}
                aria-pressed={cornerStyle === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h3>Export size</h3>
          <span>You can download other formats after creation.</span>
        </div>
        <div className={styles.sizeGrid}>
          {DOWNLOAD_SIZES.map((size) => (
            <button
              key={size.value}
              type="button"
              className={`${styles.sizeCard} ${downloadSize === size.value ? styles.active : ""}`}
              onClick={() => onDownloadSizeChange(size.value)}
              aria-pressed={downloadSize === size.value}
            >
              <strong>{size.label}</strong>
              <span>{size.size}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h3>Logo</h3>
          <span>Optional. Use a simple, high-contrast mark.</span>
        </div>
        <label className={styles.uploadBox}>
          <span className={styles.uploadLabel}>
            {logoFile ? "Logo selected" : "+ Add logo"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => onLogoFileChange(event.currentTarget.files?.[0] || null)}
            className={styles.fileInput}
          />
          <span className={styles.uploadHint}>PNG, JPG, WEBP, or SVG up to 1 MB</span>
        </label>
      </section>
    </div>
  );
}
