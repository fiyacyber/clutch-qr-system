"use client";

import { useMemo, useRef, useState } from "react";
import PremiumColorPicker from "./PremiumColorPicker";
import { useAccountBrandColors } from "@/components/qr/AccountBrandColorsContext";
import {
  SAFE_CIRCLE_BODY_PATTERNS,
  SAFE_CIRCLE_EYE_CENTERS,
  SAFE_CIRCLE_EYE_FRAMES,
  getQrDesignScanIssues,
  type AdvancedQrDesign,
  type QrBodyPattern,
  type QrCanvasShape,
  type QrColorMode,
  type QrEyeCenterShape,
  type QrEyeFrameShape,
} from "@/lib/qr-design";
import styles from "./QRStylePanel.module.css";

export type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type CornerStyle = "square" | "dot" | "extra-rounded";
export type DownloadSize = "social" | "card" | "print";
export type ThemePreset = "default" | "paper" | "midnight" | "pastel";

type DesignTab = "shape" | "eyes" | "colors" | "output";

type QRStylePanelProps = {
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
  logoScale?: number;
  onLogoScaleChange?: (scale: number) => void;
  qrShape?: QrCanvasShape;
  onQrShapeChange?: (shape: QrCanvasShape) => void;
  bodyPattern?: QrBodyPattern;
  onBodyPatternChange?: (pattern: QrBodyPattern) => void;
  eyeFrameShape?: QrEyeFrameShape;
  onEyeFrameShapeChange?: (shape: QrEyeFrameShape) => void;
  eyeCenterShape?: QrEyeCenterShape;
  onEyeCenterShapeChange?: (shape: QrEyeCenterShape) => void;
  colorMode?: QrColorMode;
  onColorModeChange?: (mode: QrColorMode) => void;
  gradientEndColor?: string;
  onGradientEndColorChange?: (color: string) => void;
  eyeFrameColor?: string;
  onEyeFrameColorChange?: (color: string) => void;
  eyeCenterColor?: string;
  onEyeCenterColorChange?: (color: string) => void;
  outerStrokeEnabled?: boolean;
  onOuterStrokeEnabledChange?: (enabled: boolean) => void;
  outerStrokeColor?: string;
  onOuterStrokeColorChange?: (color: string) => void;
};

const BODY_PATTERNS: Array<{ value: QrBodyPattern; label: string; helper: string }> = [
  { value: "square", label: "Squares", helper: "Classic and strongest" },
  { value: "circle", label: "Circles", helper: "Individual round dots" },
  { value: "rounded", label: "Rounded", helper: "Soft square modules" },
  { value: "diamond", label: "Diamonds", helper: "Angled geometric look" },
  { value: "vertical-bars", label: "Vertical bars", helper: "Tall narrow modules" },
  { value: "horizontal-bars", label: "Horizontal bars", helper: "Wide short modules" },
  { value: "cross", label: "Crosses", helper: "Plus-shaped modules" },
  { value: "blob", label: "Soft blobs", helper: "Highly rounded modules" },
  { value: "connected", label: "Connected", helper: "Flowing linked modules" },
];

const EYE_FRAMES: Array<{ value: QrEyeFrameShape; label: string }> = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
  { value: "octagon", label: "Octagon" },
  { value: "diamond", label: "Diamond" },
];

const EYE_CENTERS: Array<{ value: QrEyeCenterShape; label: string }> = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "rounded", label: "Rounded" },
  { value: "diamond", label: "Diamond" },
  { value: "star", label: "Star" },
];

const DOWNLOAD_SIZES: Array<{ value: DownloadSize; label: string; size: string }> = [
  { value: "social", label: "Social", size: "512 × 512" },
  { value: "card", label: "Card", size: "600 × 600" },
  { value: "print", label: "Print", size: "2400 × 2400" },
];

const DEFAULT_LOGO_SCALE = 18;
const MIN_LOGO_SCALE = 8;
const MAX_LOGO_SCALE = 24;

function ColorControl({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets: string[];
}) {
  return (
    <label className={styles.colorPicker}>
      <span className={styles.colorLabel}>{label}</span>
      <PremiumColorPicker
        value={value}
        onChange={onChange}
        ariaLabel={label}
        buttonText={`Choose ${label.toLowerCase()}`}
        presets={presets}
        className={styles.inlineColorPicker}
        triggerClassName={styles.inlineColorTrigger}
        valueClassName={styles.inlineColorValue}
      />
    </label>
  );
}

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
  logoScale = DEFAULT_LOGO_SCALE,
  onLogoScaleChange,
  qrShape = "square",
  onQrShapeChange,
  bodyPattern = dotStyle === "dots" ? "circle" : dotStyle === "rounded" ? "rounded" : "square",
  onBodyPatternChange,
  eyeFrameShape = cornerStyle === "dot" ? "circle" : cornerStyle === "extra-rounded" ? "rounded" : "square",
  onEyeFrameShapeChange,
  eyeCenterShape = "square",
  onEyeCenterShapeChange,
  colorMode = "solid",
  onColorModeChange,
  gradientEndColor = "#9a3f00",
  onGradientEndColorChange,
  eyeFrameColor = foregroundColor,
  onEyeFrameColorChange,
  eyeCenterColor = foregroundColor,
  onEyeCenterColorChange,
  outerStrokeEnabled = false,
  onOuterStrokeEnabledChange,
  outerStrokeColor = foregroundColor,
  onOuterStrokeColorChange,
}: QRStylePanelProps) {
  const [activeTab, setActiveTab] = useState<DesignTab>("shape");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const brandColors = useAccountBrandColors();
  const safeLogoScale = Math.min(MAX_LOGO_SCALE, Math.max(MIN_LOGO_SCALE, Math.round(logoScale)));

  function selectBodyPattern(pattern: QrBodyPattern) {
    onBodyPatternChange?.(pattern);
    onDotStyleChange(
      pattern === "circle"
        ? "dots"
        : pattern === "rounded" || pattern === "blob" || pattern === "connected"
          ? "rounded"
          : "square"
    );
  }

  function selectEyeFrame(shape: QrEyeFrameShape) {
    onEyeFrameShapeChange?.(shape);
    onCornerStyleChange(shape === "circle" ? "dot" : shape === "rounded" ? "extra-rounded" : "square");
  }

  function selectQrShape(shape: QrCanvasShape) {
    onQrShapeChange?.(shape);
    if (shape !== "circle") return;
    if (!SAFE_CIRCLE_BODY_PATTERNS.has(bodyPattern)) selectBodyPattern("square");
    if (!SAFE_CIRCLE_EYE_FRAMES.has(eyeFrameShape)) selectEyeFrame("square");
    if (!SAFE_CIRCLE_EYE_CENTERS.has(eyeCenterShape)) onEyeCenterShapeChange?.("square");
  }

  function chooseLogo() {
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
      logoInputRef.current.click();
    }
  }

  function removeLogo() {
    if (logoInputRef.current) logoInputRef.current.value = "";
    onLogoFileChange(null);
    onLogoScaleChange?.(DEFAULT_LOGO_SCALE);
  }

  const designIssues = useMemo(() => {
    const design: AdvancedQrDesign = {
      qrShape,
      bodyPattern,
      eyeFrameShape,
      eyeCenterShape,
      colorMode,
      bodyColor: foregroundColor,
      gradientEndColor,
      eyeFrameColor,
      eyeCenterColor,
      backgroundColor,
      outerStrokeEnabled,
      outerStrokeColor,
    };
    return getQrDesignScanIssues(design);
  }, [
    backgroundColor,
    bodyPattern,
    colorMode,
    eyeCenterColor,
    eyeCenterShape,
    eyeFrameColor,
    eyeFrameShape,
    foregroundColor,
    gradientEndColor,
    outerStrokeColor,
    outerStrokeEnabled,
    qrShape,
  ]);

  const tabs: Array<{ value: DesignTab; label: string }> = [
    { value: "shape", label: "Shape" },
    { value: "eyes", label: "Eyes" },
    { value: "colors", label: "Colors" },
    { value: "output", label: "Logo & Export" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Customize QR</h3>
          <p>Choose a section below. Your live preview updates immediately.</p>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="QR design controls">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            className={activeTab === tab.value ? styles.activeTab : ""}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "shape" ? (
        <section className={styles.tabPanel} role="tabpanel">
          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}>
              <h3>Overall shape</h3>
              <span>Circle protects the real QR inside a square and fills the outer ring with decorative modules.</span>
            </div>
            <div className={styles.twoChoiceGrid} role="radiogroup" aria-label="Overall QR shape">
              {(["square", "circle"] as QrCanvasShape[]).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  className={`${styles.choiceCard} ${qrShape === shape ? styles.active : ""}`}
                  onClick={() => selectQrShape(shape)}
                  aria-pressed={qrShape === shape}
                >
                  <span className={styles.canvasSample} data-shape={shape} aria-hidden="true" />
                  <strong>{shape === "square" ? "Square QR" : "Circle QR"}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}>
              <h3>Body pattern</h3>
              <span>{qrShape === "circle" ? "The same pattern is used for the real QR and decorative outer ring." : "Nine distinct module styles."}</span>
            </div>
            <div className={styles.patternGrid} role="radiogroup" aria-label="QR body pattern">
              {BODY_PATTERNS.map((option) => {
                const disabled = qrShape === "circle" && !SAFE_CIRCLE_BODY_PATTERNS.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.patternCard} ${bodyPattern === option.value ? styles.active : ""}`}
                    onClick={() => selectBodyPattern(option.value)}
                    aria-pressed={bodyPattern === option.value}
                    disabled={disabled}
                    title={disabled ? "Unavailable for circular QR scan safety." : undefined}
                  >
                    <span className={styles.patternSample} data-pattern={option.value} aria-hidden="true" />
                    <span><strong>{option.label}</strong><small>{disabled ? "Square QR only" : option.helper}</small></span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "eyes" ? (
        <section className={styles.tabPanel} role="tabpanel">
          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}><h3>Eye frame</h3><span>The outer finder shape.</span></div>
            <div className={styles.eyeGrid} role="radiogroup" aria-label="Eye frame shape">
              {EYE_FRAMES.map((option) => {
                const disabled = qrShape === "circle" && !SAFE_CIRCLE_EYE_FRAMES.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.eyeCard} ${eyeFrameShape === option.value ? styles.active : ""}`}
                    onClick={() => selectEyeFrame(option.value)}
                    aria-pressed={eyeFrameShape === option.value}
                    disabled={disabled}
                    title={disabled ? "Unavailable for circular QR scan safety." : undefined}
                  >
                    <span className={styles.eyeFrameSample} data-shape={option.value} aria-hidden="true"><i /></span>
                    <strong>{option.label}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}><h3>Eye center</h3><span>The solid center of each finder.</span></div>
            <div className={styles.eyeGrid} role="radiogroup" aria-label="Eye center shape">
              {EYE_CENTERS.map((option) => {
                const disabled = qrShape === "circle" && !SAFE_CIRCLE_EYE_CENTERS.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.eyeCard} ${eyeCenterShape === option.value ? styles.active : ""}`}
                    onClick={() => onEyeCenterShapeChange?.(option.value)}
                    aria-pressed={eyeCenterShape === option.value}
                    disabled={disabled}
                    title={disabled ? "Unavailable for circular QR scan safety." : undefined}
                  >
                    <span className={styles.eyeCenterSample} data-shape={option.value} aria-hidden="true" />
                    <strong>{option.label}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "colors" ? (
        <section className={styles.tabPanel} role="tabpanel">
          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}><h3>Body color</h3><span>Dark modules on a light background are required for print reliability.</span></div>
            <div className={styles.modeGrid} role="radiogroup" aria-label="QR color mode">
              {(["solid", "linear", "radial"] as QrColorMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.optionButton} ${colorMode === mode ? styles.active : ""}`}
                  onClick={() => onColorModeChange?.(mode)}
                  aria-pressed={colorMode === mode}
                >
                  {mode === "solid" ? "Single color" : mode === "linear" ? "Linear gradient" : "Radial gradient"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.colorGrid}>
            <ColorControl label="Body color" value={foregroundColor} onChange={onForegroundColorChange} presets={brandColors} />
            {colorMode !== "solid" && onGradientEndColorChange ? <ColorControl label="Gradient end" value={gradientEndColor} onChange={onGradientEndColorChange} presets={brandColors} /> : null}
            <ColorControl label="Eye frame" value={eyeFrameColor} onChange={onEyeFrameColorChange || onForegroundColorChange} presets={brandColors} />
            <ColorControl label="Eye center" value={eyeCenterColor} onChange={onEyeCenterColorChange || onForegroundColorChange} presets={brandColors} />
            <ColorControl label="Background" value={backgroundColor} onChange={onBackgroundColorChange} presets={brandColors} />
          </div>

          <label className={styles.strokeToggle}>
            <input type="checkbox" checked={outerStrokeEnabled} onChange={(event) => onOuterStrokeEnabledChange?.(event.target.checked)} />
            <span><strong>Outer stroke</strong><small>Add an outline around the complete QR artwork.</small></span>
          </label>
          {outerStrokeEnabled && onOuterStrokeColorChange ? <ColorControl label="Stroke color" value={outerStrokeColor} onChange={onOuterStrokeColorChange} presets={brandColors} /> : null}
        </section>
      ) : null}

      {activeTab === "output" ? (
        <section className={styles.tabPanel} role="tabpanel">
          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}>
              <h3>Logo</h3>
              <span>Transparent PNG and SVG backgrounds are preserved. Keep the final logo simple and test-scan it.</span>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => onLogoFileChange(event.currentTarget.files?.[0] || null)}
              className={styles.fileInput}
            />

            <div className={styles.uploadBox}>
              <button type="button" className={styles.uploadLabel} onClick={chooseLogo}>
                {logoFile ? "Replace logo" : "+ Add logo"}
              </button>
              <span className={styles.uploadHint}>
                {logoFile ? logoFile.name : "PNG, JPG, WEBP, or SVG up to 1 MB"}
              </span>
            </div>

            {logoFile ? (
              <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 800 }}>
                    <span>Logo size</span>
                    <output>{safeLogoScale}%</output>
                  </span>
                  <input
                    type="range"
                    min={MIN_LOGO_SCALE}
                    max={MAX_LOGO_SCALE}
                    step={1}
                    value={safeLogoScale}
                    onChange={(event) => onLogoScaleChange?.(Number(event.target.value))}
                    aria-label="Logo size"
                  />
                  <small>Resize the logo from {MIN_LOGO_SCALE}% to {MAX_LOGO_SCALE}% of the encoded QR width. Larger logos require more scan testing.</small>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <button type="button" className={styles.optionButton} onClick={chooseLogo}>Replace logo</button>
                  <button type="button" className={styles.optionButton} onClick={removeLogo}>Remove logo</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.controlBlock}>
            <div className={styles.sectionHeading}><h3>Export size</h3><span>Other formats remain available after creation.</span></div>
            <div className={styles.sizeGrid}>
              {DOWNLOAD_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  className={`${styles.sizeCard} ${downloadSize === size.value ? styles.active : ""}`}
                  onClick={() => onDownloadSizeChange(size.value)}
                  aria-pressed={downloadSize === size.value}
                >
                  <strong>{size.label}</strong><span>{size.size}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <p className={styles.scanNote}>
        {designIssues.length
          ? designIssues[0]
          : logoFile
            ? `Logo enabled at ${safeLogoScale}%. Test-scan the final exported file at its actual print size.`
            : "The design passes structural guardrails. Test-scan the exported file at its actual print size before production."}
      </p>
    </div>
  );
}
