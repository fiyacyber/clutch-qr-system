"use client";

import { useEffect, useState } from "react";
import CopyValueButton from "@/components/dashboard/CopyValueButton";
import StyledQRPreview from "@/components/StyledQRPreview";

type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

type CornerStyle = "square" | "dot" | "extra-rounded";
type FinderEyes = "square" | "rounded" | "circle";
type FrameStyle = "none" | "circular" | "premium_circle";

type SmartCardStyleConfig = {
  preset?: string;
  dotStyle?: DotStyle;
  cornerStyle?: CornerStyle;
  finderEyes?: FinderEyes;
  frameStyle?: FrameStyle;
  frameColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
  logoPath?: string | null;
  logoSize?: number;
};

type SmartCardQrCardProps = {
  qrId: string;
  slug: string;
  scanUrl: string;
  scanUrlDisplay: string;
  destinationDisplay: string;
  connectedProfileText: string;
  orderAssociation: string;
  lastUpdated: string;
  initialForegroundColor?: string | null;
  initialBackgroundColor?: string | null;
  initialStyleConfig?: SmartCardStyleConfig | null;
};

const DEFAULT_FOREGROUND = "#384862";
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_FRAME = "#0b1f35";
const DEFAULT_ACCENT = "#ffa665";
const DOT_STYLE_VALUES: DotStyle[] = ["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"];
const CORNER_STYLE_VALUES: CornerStyle[] = ["square", "dot", "extra-rounded"];
const FINDER_EYE_VALUES: FinderEyes[] = ["square", "rounded", "circle"];
const FRAME_STYLE_VALUES: FrameStyle[] = ["none", "circular", "premium_circle"];

function pickEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeHex(value: string, fallback: string) {
  const normalized = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function mapFinderToCorner(value: FinderEyes): CornerStyle {
  if (value === "rounded") return "extra-rounded";
  if (value === "circle") return "dot";
  return "square";
}

function mapCornerToFinder(value: CornerStyle): FinderEyes {
  if (value === "extra-rounded") return "rounded";
  if (value === "dot") return "circle";
  return "square";
}

function luminance(hex: string) {
  const normalized = sanitizeHex(hex, "#000000");
  const parts = normalized
    .slice(1)
    .match(/.{2}/g)
    ?.map((part) => Number.parseInt(part, 16) / 255) || [0, 0, 0];

  const toLinear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

  const [r, g, b] = parts.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string) {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function blobToImage(blob: Blob): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to load image."));
      nextImage.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SmartCardQrCard({
  qrId,
  slug,
  scanUrl,
  scanUrlDisplay,
  destinationDisplay,
  connectedProfileText,
  orderAssociation,
  lastUpdated,
  initialForegroundColor,
  initialBackgroundColor,
  initialStyleConfig,
}: SmartCardQrCardProps) {
  const startingConfig = initialStyleConfig || {};

  const [foregroundColor, setForegroundColor] = useState(
    sanitizeHex(initialForegroundColor || DEFAULT_FOREGROUND, DEFAULT_FOREGROUND)
  );
  const [backgroundColor, setBackgroundColor] = useState(
    sanitizeHex(initialBackgroundColor || DEFAULT_BACKGROUND, DEFAULT_BACKGROUND)
  );
  const [frameColor, setFrameColor] = useState(
    sanitizeHex(startingConfig.frameColor || DEFAULT_FRAME, DEFAULT_FRAME)
  );
  const [accentColor, setAccentColor] = useState(
    sanitizeHex(startingConfig.accentColor || DEFAULT_ACCENT, DEFAULT_ACCENT)
  );
  const [dotStyle, setDotStyle] = useState<DotStyle>(
    pickEnumValue(startingConfig.dotStyle, DOT_STYLE_VALUES, "square")
  );
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>(
    pickEnumValue(startingConfig.cornerStyle, CORNER_STYLE_VALUES, "square")
  );
  const [finderEyes, setFinderEyes] = useState<FinderEyes>(
    pickEnumValue(
      startingConfig.finderEyes,
      FINDER_EYE_VALUES,
      mapCornerToFinder(pickEnumValue(startingConfig.cornerStyle, CORNER_STYLE_VALUES, "square"))
    )
  );
  const [frameStyle, setFrameStyle] = useState<FrameStyle>(
    pickEnumValue(startingConfig.frameStyle, FRAME_STYLE_VALUES, "circular")
  );
  const [preset, setPreset] = useState(startingConfig.preset || "clutch_default");
  const [logoUrl, setLogoUrl] = useState<string | null>(startingConfig.logoUrl || null);
  const [logoPath, setLogoPath] = useState<string | null>(startingConfig.logoPath || null);
  const [logoSize, setLogoSize] = useState<number>(
    Number.isFinite(startingConfig.logoSize) ? Number(startingConfig.logoSize) : 28
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(logoUrl);

  useEffect(() => {
    if (removeLogo) {
      setPreviewLogoUrl(null);
      return;
    }

    if (!logoFile) {
      setPreviewLogoUrl(logoUrl);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewLogoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile, logoUrl, removeLogo]);

  const contrast = contrastRatio(foregroundColor, backgroundColor);
  const showContrastWarning = contrast < 3.1;

  const frameClass = frameStyle === "premium_circle" ? "premium" : "";
  const logoFileName = logoFile?.name || (logoUrl ? "Current logo" : "No file chosen");

  function applyPreset(nextPreset: string) {
    setPreset(nextPreset);

    switch (nextPreset) {
      case "classic":
        setDotStyle("square");
        setCornerStyle("square");
        setFinderEyes("square");
        setForegroundColor("#000000");
        setBackgroundColor("#ffffff");
        setFrameStyle("none");
        break;
      case "rounded":
        setDotStyle("rounded");
        setCornerStyle("extra-rounded");
        setFinderEyes("rounded");
        setFrameStyle("none");
        break;
      case "dots":
        setDotStyle("dots");
        setCornerStyle("dot");
        setFinderEyes("circle");
        setFrameStyle("none");
        break;
      case "circular_frame":
        setDotStyle("rounded");
        setCornerStyle("square");
        setFinderEyes("square");
        setFrameStyle("circular");
        break;
      case "premium_circle":
        setDotStyle("extra-rounded");
        setCornerStyle("dot");
        setFinderEyes("circle");
        setFrameStyle("premium_circle");
        setAccentColor("#ffa665");
        break;
      case "clutch_default":
      default:
        setDotStyle("square");
        setCornerStyle("square");
        setFinderEyes("square");
        setForegroundColor(DEFAULT_FOREGROUND);
        setBackgroundColor(DEFAULT_BACKGROUND);
        setFrameStyle("circular");
        setFrameColor(DEFAULT_FRAME);
        setAccentColor(DEFAULT_ACCENT);
        break;
    }
  }

  function onFinderEyesChange(next: FinderEyes) {
    setFinderEyes(next);
    setCornerStyle(mapFinderToCorner(next));
  }

  function onLogoFileChange(file: File | null) {
    setLogoFile(file);
    setRemoveLogo(false);
    setError(null);
  }

  async function saveStyle() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const styleConfig: SmartCardStyleConfig = {
        preset,
        dotStyle,
        cornerStyle,
        finderEyes,
        frameStyle,
        frameColor,
        accentColor,
        logoUrl: removeLogo ? null : logoUrl,
        logoPath: removeLogo ? null : logoPath,
        logoSize,
      };

      const formData = new FormData();
      formData.set("foreground_color", foregroundColor);
      formData.set("background_color", backgroundColor);
      formData.set("style_config", JSON.stringify(styleConfig));
      formData.set("remove_logo", String(removeLogo));
      if (logoFile) {
        formData.set("logo", logoFile);
      }

      const response = await fetch(`/api/qr/${encodeURIComponent(qrId)}/style`, {
        method: "PATCH",
        body: formData,
        credentials: "same-origin",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to save style.");
      }

      setForegroundColor(sanitizeHex(payload.qr?.foreground_color || foregroundColor, foregroundColor));
      setBackgroundColor(sanitizeHex(payload.qr?.background_color || backgroundColor, backgroundColor));

      const nextConfig = (payload.qr?.style_config || styleConfig) as SmartCardStyleConfig;
      setPreset(nextConfig.preset || preset);
      const nextCornerStyle = pickEnumValue(nextConfig.cornerStyle, CORNER_STYLE_VALUES, cornerStyle);
      setDotStyle(pickEnumValue(nextConfig.dotStyle, DOT_STYLE_VALUES, dotStyle));
      setCornerStyle(nextCornerStyle);
      setFinderEyes(
        pickEnumValue(nextConfig.finderEyes, FINDER_EYE_VALUES, mapCornerToFinder(nextCornerStyle))
      );
      setFrameStyle(pickEnumValue(nextConfig.frameStyle, FRAME_STYLE_VALUES, frameStyle));
      setFrameColor(sanitizeHex(nextConfig.frameColor || frameColor, frameColor));
      setAccentColor(sanitizeHex(nextConfig.accentColor || accentColor, accentColor));
      setLogoUrl(nextConfig.logoUrl || null);
      setLogoPath(nextConfig.logoPath || null);
      setLogoSize(Number.isFinite(nextConfig.logoSize) ? Number(nextConfig.logoSize) : logoSize);
      setLogoFile(null);
      setRemoveLogo(false);

      setSuccess("QR customization saved.");
      setIsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save style.");
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadStyledPng() {
    setIsDownloading(true);
    setError(null);

    try {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      const qrCode = new QRCodeStyling({
        width: 1200,
        height: 1200,
        type: "canvas",
        data: scanUrl,
        image: removeLogo ? undefined : previewLogoUrl || undefined,
        margin: 8,
        qrOptions: {
          errorCorrectionLevel: "H",
        },
        dotsOptions: {
          color: foregroundColor,
          type: dotStyle,
        },
        backgroundOptions: {
          color: backgroundColor,
        },
        cornersSquareOptions: {
          color: foregroundColor,
          type: cornerStyle,
        },
        cornersDotOptions: {
          color: foregroundColor,
          type: cornerStyle === "square" ? "square" : "dot",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 6,
          imageSize: Math.max(0.16, Math.min(0.4, logoSize / 100)),
        },
      });

      const rawData = await qrCode.getRawData("png");
      if (!(rawData instanceof Blob)) {
        throw new Error("Unable to prepare PNG file.");
      }

      if (frameStyle === "none") {
        downloadBlob(rawData, `smart-card-qr-${slug}.png`);
        return;
      }

      const canvas = document.createElement("canvas");
      const size = 1400;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas is not available.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);

      const center = size / 2;
      const radius = 620;
      const borderWidth = 42;

      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();

      context.lineWidth = borderWidth;
      context.strokeStyle = frameColor;
      context.stroke();

      if (frameStyle === "premium_circle") {
        context.beginPath();
        context.arc(center, center, radius - 64, 0, Math.PI * 2);
        context.lineWidth = 14;
        context.strokeStyle = accentColor;
        context.stroke();
      }

      const qrImage = await blobToImage(rawData);
      const qrSize = 900;
      const qrOffset = (size - qrSize) / 2;
      context.drawImage(qrImage as CanvasImageSource, qrOffset, qrOffset, qrSize, qrSize);

      const outputBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to generate image."));
            return;
          }
          resolve(blob);
        }, "image/png");
      });

      downloadBlob(outputBlob, `smart-card-qr-${slug}.png`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download PNG.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <div className="portal-overview-smart-qr-grid">
        <div className="portal-overview-smart-qr-preview-wrap">
          <div
            className={`portal-overview-smart-qr-circle ${frameClass}`}
            style={{
              borderColor: frameColor,
              boxShadow:
                frameStyle === "premium_circle"
                  ? `0 14px 30px rgba(11, 31, 53, 0.14), inset 0 0 0 8px ${accentColor}33`
                  : undefined,
            }}
          >
            <StyledQRPreview
              url={scanUrl}
              foregroundColor={foregroundColor}
              backgroundColor={backgroundColor}
              dotStyle={dotStyle}
              cornerStyle={cornerStyle}
              logoUrl={removeLogo ? null : previewLogoUrl}
              showExportMenu={false}
              embedded
            />
          </div>
          <p className="portal-overview-smart-qr-helper">Circular preview shown for display. Download includes the full scan-safe QR.</p>
          {success ? <p className="portal-overview-smart-qr-feedback success">{success}</p> : null}
          {error ? <p className="portal-overview-smart-qr-feedback error">{error}</p> : null}
        </div>

        <div className="portal-overview-smart-qr-details">
          <div className="portal-overview-smart-qr-meta">
            <p><strong>Scan/tracking URL:</strong> <span>{scanUrlDisplay}</span></p>
            <p><strong>Destination URL:</strong> <span>{destinationDisplay}</span></p>
            <p><strong>Connected profile:</strong> <span>{connectedProfileText}</span></p>
            <p><strong>Order association:</strong> <span>{orderAssociation}</span></p>
            <p><strong>Last updated:</strong> <span>{lastUpdated}</span></p>
            <p className="portal-overview-smart-qr-note">Customize the QR shown in your dashboard and downloads. Fulfillment uses a scan-safe black SVG for production.</p>
          </div>

          <div className="portal-overview-smart-qr-actions">
            <button className="btn secondary" type="button" onClick={() => setIsOpen(true)}>
              Customize QR
            </button>
            <CopyValueButton value={scanUrl} label="Copy Scan Link" className="btn ghost portal-overview-card-btn" />
            <button className="btn secondary" type="button" onClick={downloadStyledPng} disabled={isDownloading}>
              {isDownloading ? "Preparing PNG..." : "Download QR PNG"}
            </button>
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="smart-card-qr-modal-overlay" role="presentation" onClick={() => !isSaving && setIsOpen(false)}>
          <div className="smart-card-qr-modal" role="dialog" aria-modal="true" aria-label="Customize Smart Card QR" onClick={(event) => event.stopPropagation()}>
            <div className="smart-card-qr-modal-head">
              <h3>Customize Smart Card QR</h3>
              <button className="btn ghost smart-card-qr-close-btn" type="button" onClick={() => setIsOpen(false)} disabled={isSaving}>
                Close
              </button>
            </div>

            <div className="smart-card-qr-modal-grid">
              <section className="smart-card-qr-preview-panel">
                <div
                  className={`portal-overview-smart-qr-circle ${frameClass}`}
                  style={{
                    borderColor: frameColor,
                    boxShadow:
                      frameStyle === "premium_circle"
                        ? `0 14px 30px rgba(11, 31, 53, 0.14), inset 0 0 0 8px ${accentColor}33`
                        : undefined,
                  }}
                >
                  <StyledQRPreview
                    url={scanUrl}
                    foregroundColor={foregroundColor}
                    backgroundColor={backgroundColor}
                    dotStyle={dotStyle}
                    cornerStyle={cornerStyle}
                    logoUrl={removeLogo ? null : previewLogoUrl}
                    showExportMenu={false}
                    embedded
                  />
                </div>
                <p className="portal-overview-smart-qr-helper">Live preview uses your tracking URL. Fulfillment uses a scan-safe black SVG.</p>
                {showContrastWarning ? (
                  <p className="portal-overview-smart-qr-feedback warning">Low contrast detected. Increase contrast for reliable scanning.</p>
                ) : null}
              </section>

              <section className="smart-card-qr-controls">
                <article className="smart-card-qr-control-group">
                  <h4>Style</h4>

                  <label>
                    Preset
                    <select value={preset} onChange={(event) => applyPreset(event.target.value)}>
                      <option value="clutch_default">Clutch Default</option>
                      <option value="classic">Classic</option>
                      <option value="rounded">Rounded</option>
                      <option value="dots">Dots</option>
                      <option value="circular_frame">Circular Frame</option>
                      <option value="premium_circle">Premium Circle</option>
                    </select>
                  </label>

                  <label>
                    Finder eyes
                    <select value={finderEyes} onChange={(event) => onFinderEyesChange(event.target.value as FinderEyes)}>
                      <option value="square">Square</option>
                      <option value="rounded">Rounded</option>
                      <option value="circle">Circle</option>
                    </select>
                  </label>

                  <label>
                    Frame style
                    <select value={frameStyle} onChange={(event) => setFrameStyle(event.target.value as FrameStyle)}>
                      <option value="none">None</option>
                      <option value="circular">Circular</option>
                      <option value="premium_circle">Premium Circle</option>
                    </select>
                  </label>
                </article>

                <article className="smart-card-qr-control-group">
                  <h4>Colors</h4>

                  <div className="smart-card-qr-color-row">
                    <div>
                      <span className="smart-card-qr-control-label">QR color</span>
                      <small>{foregroundColor.toUpperCase()}</small>
                    </div>
                    <input
                      className="smart-card-qr-color-input"
                      type="color"
                      value={foregroundColor}
                      onChange={(event) => setForegroundColor(event.target.value)}
                      aria-label="QR color"
                    />
                  </div>

                  <div className="smart-card-qr-color-row">
                    <div>
                      <span className="smart-card-qr-control-label">Background color</span>
                      <small>{backgroundColor.toUpperCase()}</small>
                    </div>
                    <input
                      className="smart-card-qr-color-input"
                      type="color"
                      value={backgroundColor}
                      onChange={(event) => setBackgroundColor(event.target.value)}
                      aria-label="Background color"
                    />
                  </div>

                  <div className="smart-card-qr-color-row">
                    <div>
                      <span className="smart-card-qr-control-label">Frame color</span>
                      <small>{frameColor.toUpperCase()}</small>
                    </div>
                    <input
                      className="smart-card-qr-color-input"
                      type="color"
                      value={frameColor}
                      onChange={(event) => setFrameColor(event.target.value)}
                      aria-label="Frame color"
                    />
                  </div>

                  <div className="smart-card-qr-color-row">
                    <div>
                      <span className="smart-card-qr-control-label">Accent color</span>
                      <small>{accentColor.toUpperCase()}</small>
                    </div>
                    <input
                      className="smart-card-qr-color-input"
                      type="color"
                      value={accentColor}
                      onChange={(event) => setAccentColor(event.target.value)}
                      aria-label="Accent color"
                    />
                  </div>
                </article>

                <article className="smart-card-qr-control-group">
                  <h4>Logo</h4>

                  <div className="smart-card-qr-upload-row">
                    <input
                      id={`smart-card-logo-upload-${qrId}`}
                      className="smart-card-qr-file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => onLogoFileChange(event.target.files?.[0] || null)}
                    />
                    <label className="btn ghost smart-card-qr-upload-btn" htmlFor={`smart-card-logo-upload-${qrId}`}>
                      Choose Logo
                    </label>
                    <span className="smart-card-qr-file-name">{logoFileName}</span>
                  </div>
                  <p className="smart-card-qr-upload-helper">Use a simple PNG or SVG. Large logos can reduce scan reliability.</p>

                  <label>
                    Logo size
                    <input
                      type="range"
                      min={16}
                      max={40}
                      step={1}
                      value={logoSize}
                      onChange={(event) => setLogoSize(Number(event.target.value))}
                    />
                  </label>

                  <label className="smart-card-qr-checkbox-row">
                    <input
                      type="checkbox"
                      checked={removeLogo}
                      onChange={(event) => {
                        setRemoveLogo(event.target.checked);
                        if (event.target.checked) {
                          setLogoFile(null);
                        }
                      }}
                    />
                    Remove logo
                  </label>
                </article>
              </section>
            </div>

            <div className="smart-card-qr-modal-actions">
              <button className="btn ghost" type="button" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancel</button>
              <button className="btn primary" type="button" onClick={saveStyle} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save QR Design"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
