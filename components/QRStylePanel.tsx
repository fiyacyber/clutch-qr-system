"use client";

import styles from "./QRStylePanel.module.css";
import PremiumColorPicker from "./PremiumColorPicker";

export type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type CornerStyle = "square" | "dot" | "extra-rounded";
export type DownloadSize = "social" | "card" | "print";
export type ThemePreset = "default" | "paper" | "midnight" | "pastel";

type QRStylePanelProps = {
  theme: ThemePreset;
  onThemeChange: (theme: ThemePreset) => void;
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

const THEME_PRESETS: Array<{
  value: ThemePreset;
  label: string;
  gradient: string;
}> = [
  {
    value: "default",
    label: "Default",
    gradient: "linear-gradient(135deg, #FF7A1A, #384862)",
  },
  {
    value: "paper",
    label: "Paper",
    gradient: "linear-gradient(135deg, #FFF8F0, #F5DCC8)",
  },
  {
    value: "midnight",
    label: "Midnight",
    gradient: "linear-gradient(135deg, #1E2A3A, #0F1419)",
  },
  {
    value: "pastel",
    label: "Pastel",
    gradient: "linear-gradient(135deg, #FFD4B4, #B4E4FF)",
  },
];

const DOT_STYLES: Array<{ value: DotStyle; label: string }> = [
  { value: "square", label: "Squares" },
  { value: "dots", label: "Dots" },
  { value: "rounded", label: "Rounded" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy Rounded" },
  { value: "extra-rounded", label: "Extra Rounded" },
];

const CORNER_STYLES: Array<{ value: CornerStyle; label: string }> = [
  { value: "square", label: "Square" },
  { value: "dot", label: "Dot" },
  { value: "extra-rounded", label: "Rounded" },
];

const DOWNLOAD_SIZES: Array<{ value: DownloadSize; label: string; size: string }> = [
  { value: "social", label: "Social", size: "512×512" },
  { value: "card", label: "Card", size: "600×600" },
  { value: "print", label: "Print", size: "2400×2400" },
];

function OptionButtonGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.optionGroup} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.optionButton} ${value === option.value ? styles.active : ""}`}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function QRStylePanel({
  theme,
  onThemeChange,
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
      <h3 className={styles.panelTitle}>Customize QR</h3>

      <div className={styles.section}>
        <h3 className={styles.heading}>Theme</h3>
        <div className={styles.themeGrid}>
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`${styles.themeCard} ${theme === preset.value ? styles.active : ""}`}
              onClick={() => onThemeChange(preset.value)}
              title={preset.label}
            >
              <div
                className={styles.themeSwatch}
                style={{ background: preset.gradient }}
              />
              <span className={styles.themeLabel}>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.heading}>Colors</h3>
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
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.heading}>Pattern</h3>
        <div className={styles.patternGroup}>
          <label className={styles.selectLabel}>
            <span>Dot Style</span>
            <OptionButtonGroup
              label="Dot Style"
              value={dotStyle}
              options={DOT_STYLES}
              onChange={onDotStyleChange}
            />
          </label>

          <label className={styles.selectLabel}>
            <span>Corner Style</span>
            <OptionButtonGroup
              label="Corner Style"
              value={cornerStyle}
              options={CORNER_STYLES}
              onChange={onCornerStyleChange}
            />
          </label>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.heading}>Download Size</h3>
        <div className={styles.sizeGrid}>
          {DOWNLOAD_SIZES.map((size) => (
            <button
              key={size.value}
              type="button"
              className={`${styles.sizeCard} ${downloadSize === size.value ? styles.active : ""}`}
              onClick={() => onDownloadSizeChange(size.value)}
            >
              <div className={styles.sizeLabel}>{size.label}</div>
              <div className={styles.sizeValue}>{size.size}</div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.heading}>Logo</h3>
        <label className={styles.uploadBox}>
          <span className={styles.uploadLabel}>
            {logoFile ? "✓ Logo selected" : "+ Add Logo"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => onLogoFileChange(e.currentTarget.files?.[0] || null)}
            className={styles.fileInput}
          />
          <span className={styles.uploadHint}>PNG/JPG/WEBP/SVG up to 1 MB</span>
        </label>
      </div>
    </div>
  );
}
