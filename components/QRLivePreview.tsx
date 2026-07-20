"use client";

import StyledQRPreview from "@/components/StyledQRPreview";
import { qrUrl } from "@/lib/qr";
import {
  getQrDesignScanIssues,
  type AdvancedQrDesign,
  type QrBodyPattern,
  type QrCanvasShape,
  type QrColorMode,
  type QrEyeCenterShape,
  type QrEyeFrameShape,
} from "@/lib/qr-design";
import styles from "./QRLivePreview.module.css";

type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerStyle = "square" | "dot" | "extra-rounded";
type DownloadSize = "social" | "card" | "print";
type PrintMockupType = "business_cards" | "flyers" | "brochures" | "door_hangers" | "postcards" | "yard_signs";

const DOWNLOAD_SIZE_LABELS: Record<DownloadSize, string> = {
  social: "512 × 512",
  card: "600 × 600",
  print: "2400 × 2400",
};

const PRINT_MOCKUP_LABELS: Record<PrintMockupType, string> = {
  business_cards: "Business Cards",
  flyers: "Flyers",
  brochures: "Brochures",
  door_hangers: "Door Hangers",
  postcards: "Postcards",
  yard_signs: "Yard Signs",
};

type QRLivePreviewProps = {
  finalUrl: string;
  foregroundColor: string;
  backgroundColor: string;
  dotStyle: DotStyle;
  cornerStyle: CornerStyle;
  logoUrl?: string;
  used: number;
  limit: number;
  name: string;
  destinationTypeLabel?: string;
  destinationPreview?: string;
  printMockupType?: PrintMockupType;
  printPieceLabel?: string;
  trackingPreview?: string;
  downloadSize: DownloadSize;
  isLocked?: boolean;
  canCreate?: boolean;
  error?: string | null;
  compact?: boolean;
  qrShape?: QrCanvasShape;
  bodyPattern?: QrBodyPattern;
  eyeFrameShape?: QrEyeFrameShape;
  eyeCenterShape?: QrEyeCenterShape;
  colorMode?: QrColorMode;
  gradientEndColor?: string;
  eyeFrameColor?: string;
  eyeCenterColor?: string;
  outerStrokeEnabled?: boolean;
  outerStrokeColor?: string;
};

function bodyPatternFromLegacy(dotStyle: DotStyle): QrBodyPattern {
  if (dotStyle === "dots") return "circle";
  if (dotStyle === "rounded" || dotStyle === "classy" || dotStyle === "classy-rounded" || dotStyle === "extra-rounded") return "rounded";
  return "square";
}

function eyeFrameFromLegacy(cornerStyle: CornerStyle): QrEyeFrameShape {
  if (cornerStyle === "dot") return "circle";
  if (cornerStyle === "extra-rounded") return "rounded";
  return "square";
}

export default function QRLivePreview({
  finalUrl,
  foregroundColor,
  backgroundColor,
  dotStyle,
  cornerStyle,
  logoUrl,
  used,
  limit,
  name,
  destinationTypeLabel = "Website",
  destinationPreview = "",
  printMockupType = "business_cards",
  printPieceLabel,
  trackingPreview = "Campaign tags enabled",
  downloadSize,
  isLocked,
  canCreate,
  error,
  compact = false,
  qrShape = "square",
  bodyPattern,
  eyeFrameShape,
  eyeCenterShape = "square",
  colorMode = "solid",
  gradientEndColor = "#ff7a1a",
  eyeFrameColor,
  eyeCenterColor,
  outerStrokeEnabled = false,
  outerStrokeColor = "#384862",
}: QRLivePreviewProps) {
  const resolvedBodyPattern = bodyPattern || bodyPatternFromLegacy(dotStyle);
  const resolvedEyeFrame = eyeFrameShape || eyeFrameFromLegacy(cornerStyle);
  const design: AdvancedQrDesign = {
    qrShape,
    bodyPattern: resolvedBodyPattern,
    eyeFrameShape: resolvedEyeFrame,
    eyeCenterShape,
    colorMode,
    bodyColor: foregroundColor,
    gradientEndColor,
    eyeFrameColor: eyeFrameColor || foregroundColor,
    eyeCenterColor: eyeCenterColor || foregroundColor,
    backgroundColor,
    outerStrokeEnabled,
    outerStrokeColor,
  };
  const designIssues = getQrDesignScanIssues(design);
  const previewLabel = finalUrl ? "Live preview" : "Draft preview";
  const statusLabel = isLocked
    ? "Locked"
    : !canCreate
      ? "Needs input"
      : designIssues.length
        ? "Adjust design"
        : "Test scan required";
  const displayedPrintPiece = printPieceLabel?.trim() || PRINT_MOCKUP_LABELS[printMockupType];

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
      {error ? <div className={styles.errorMessage}>{error}</div> : null}
      {canCreate && designIssues.length ? (
        <div className={styles.errorMessage}>{designIssues[0]}</div>
      ) : null}

      <section className={styles.heroPreviewCard}>
        <div className={styles.previewHeader}>
          <div>
            <span className={styles.previewKicker}>{previewLabel}</span>
            <h3 className={styles.sectionTitle}>QR Preview</h3>
          </div>
          <span className={styles.statusBadge}>{statusLabel}</span>
        </div>

        <div className={styles.previewVisual}>
          <div className={styles.previewGlow} aria-hidden="true" />
          <div
            className={styles.previewCanvas}
            style={{
              width: "min(100%, 280px)",
              marginInline: "auto",
              justifySelf: "center",
            }}
          >
            <StyledQRPreview
              url={finalUrl || qrUrl("preview")}
              foregroundColor={foregroundColor}
              backgroundColor={backgroundColor}
              dotStyle={dotStyle}
              cornerStyle={cornerStyle}
              logoUrl={logoUrl}
              showExportMenu={false}
              qrShape={qrShape}
              bodyPattern={resolvedBodyPattern}
              eyeFrameShape={resolvedEyeFrame}
              eyeCenterShape={eyeCenterShape}
              colorMode={colorMode}
              gradientEndColor={gradientEndColor}
              eyeFrameColor={eyeFrameColor}
              eyeCenterColor={eyeCenterColor}
              outerStrokeEnabled={outerStrokeEnabled}
              outerStrokeColor={outerStrokeColor}
            />
          </div>
        </div>

        <div className={styles.previewTitleRow}>
          <div>
            <p className={styles.metaLabel}>QR Name</p>
            <p className={styles.campaignName}>{name || "Untitled QR"}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Print Piece</p>
            <p className={styles.metaValue}>{displayedPrintPiece || "Not specified"}</p>
          </div>
        </div>

        <div className={styles.previewStrip}>
          <article><span>Status</span><strong>{statusLabel}</strong></article>
          <article><span>Resolution</span><strong>{DOWNLOAD_SIZE_LABELS[downloadSize]}</strong></article>
          <article><span>Usage</span><strong>{used}/{limit}</strong></article>
        </div>
      </section>

      {compact ? (
        <div className={styles.compactDetails}>
          <p><span>Destination</span><strong>{destinationPreview || "Add a destination"}</strong></p>
          <p><span>Type</span><strong>{destinationTypeLabel}</strong></p>
          <p><span>Tracking</span><strong>{trackingPreview}</strong></p>
        </div>
      ) : (
        <>
          <div className={styles.destinationPreviewCard}>
            <p><span>Type</span><strong>{destinationTypeLabel}</strong></p>
            <p><span>Preview</span><strong>{destinationPreview || "Add destination details in the destination section."}</strong></p>
            <p><span>Tracking</span><strong>{trackingPreview}</strong></p>
            <p><span>Destination</span><strong>{finalUrl || "No destination yet"}</strong></p>
          </div>
          <div className={styles.exportCard}>
            <p><span>Recommended resolution</span><strong>{DOWNLOAD_SIZE_LABELS[downloadSize]}</strong></p>
            <p><span>Formats</span><strong>PNG, SVG, JPG, PDF</strong></p>
            <small>Test-scan the downloaded file at its final printed size before production.</small>
          </div>
        </>
      )}
    </div>
  );
}
