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
const LOGO_ALPHA_THRESHOLD = 8;
const MAX_OPTIMIZED_LOGO_DIMENSION = 1200;

function loadLogoImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Logo image could not be loaded."));
    };
    image.src = objectUrl;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Logo image could not be optimized."));
    }, "image/png");
  });
}

async function trimTransparentLogo(file: File) {
  if (file.type !== "image/png" && file.type !== "image/webp") {
    return { file, trimmed: false };
  }

  const image = await loadLogoImage(file);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !sourceCanvas.width || !sourceCanvas.height) {
    return { file, trimmed: false };
  }

  sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;

  let minX = sourceCanvas.width;
  let minY = sourceCanvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceCanvas.height; y += 1) {
    for (let x = 0; x < sourceCanvas.width; x += 1) {
      const alpha = pixels[(y * sourceCanvas.width + x) * 4 + 3];
      if (alpha <= LOGO_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return { file, trimmed: false };

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padding = Math.max(2, Math.round(Math.max(contentWidth, contentHeight) * 0.02));
  const sourceX = Math.max(0, minX - padding);
  const sourceY = Math.max(0, minY - padding);
  const sourceWidth = Math.min(sourceCanvas.width - sourceX, contentWidth + padding * 2);
  const sourceHeight = Math.min(sourceCanvas.height - sourceY, contentHeight + padding * 2);

  const removesMeaningfulPadding =
    sourceWidth < sourceCanvas.width * 0.96 || sourceHeight < sourceCanvas.height * 0.96;
  if (!removesMeaningfulPadding) return { file, trimmed: false };

  const scale = Math.min(1, MAX_OPTIMIZED_LOGO_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.max(1, Math.round(sourceWidth * scale));
  outputCanvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) return { file, trimmed: false };

  outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  );

  const blob = await canvasToPngBlob(outputCanvas);
  const optimizedName = `${file.name.replace(/\.[^.]+$/, "")}.png`;
  return {
    file: new File([blob], optimizedName, {
      type: "image/png",
      lastModified: file.lastModified,
    }),
    trimmed: true,
  };
}

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
  const [isPreparingLogo, setIsPreparingLogo] = useState(false);
  const [logoPreparationMessage, setLogoPreparationMessage] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoSelectionRef = useRef(0);
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

  async function handleLogoSelection(file: File | null) {
    const selectionId = logoSelectionRef.current + 1;
    logoSelectionRef.current = selectionId;
    setLogoPreparationMessage(null);

    if (!file) {
      onLogoFileChange(null);
      return;
    }

    setIsPreparingLogo(true);
    try {
      const result = await trimTransparentLogo(file);
      if (logoSelectionRef.current !== selectionId) return;
      onLogoFileChange(result.file);
      setLogoPreparationMessage(
        result.trimmed
          ? "Transparent padding was removed so the visible logo fills the selected size."
          : file.type === "image/png" || file.type === "image/webp"
            ? "The visible artwork already fills the image canvas."
            : null
      );
    } catch (error) {
      console.warn("QR logo auto-fit failed; using the original upload.", error);
      if (logoSelectionRef.current !== selectionId) return;
      onLogoFileChange(file);
      setLogoPreparationMessage("The original logo was used because automatic fitting was unavailable.");
    } finally {
      if (logoSelectionRef.current === selectionId) setIsPreparingLogo(false);
    }
  }

  function removeLogo() {
    logoSelectionRef.current += 1;
    if (logoInputRef.current) logoInputRef.current.value = "";
    setIsPreparingLogo(false);
    setLogoPreparationMessage(null);
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
              <span>Transparent PNG and WebP padding is fitted automatically. SVG transparency is preserved.</span>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => void handleLogoSelection(event.currentTarget.files?.[0] || null)}
              className={styles.fileInput}
            />

            <div className={styles.uploadBox}>
              <button type="button" className={styles.uploadLabel} onClick={chooseLogo} disabled={isPreparingLogo}>
                {isPreparingLogo ? "Fitting logo..." : logoFile ? "Replace logo" : "+ Add logo"}
              </button>
              <span className={styles.uploadHint}>
                {isPreparingLogo ? "Removing unused transparent space" : logoFile ? logoFile.name : "PNG, JPG, WEBP, or SVG up to 1 MB"}
              </span>
              {logoPreparationMessage ? <small>{logoPreparationMessage}</small> : null}
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
                  <small>Size is based on the visible, fitted artwork rather than unused transparent canvas space. Larger logos require more scan testing.</small>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <button type="button" className={styles.optionButton} onClick={chooseLogo} disabled={isPreparingLogo}>Replace logo</button>
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
