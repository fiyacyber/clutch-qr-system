"use client";

import StyledQRPreview from "@/components/StyledQRPreview";
import { qrUrl } from "@/lib/qr";
import styles from "./QRLivePreview.module.css";

type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerStyle = "square" | "dot" | "extra-rounded";
type DownloadSize = "social" | "card" | "print";
type PrintMockupType = "business_cards" | "flyers" | "brochures" | "door_hangers" | "postcards" | "yard_signs";

const DOWNLOAD_SIZE_LABELS: Record<DownloadSize, string> = {
  social: "512 x 512",
  card: "600 x 600",
  print: "2400 x 2400",
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
  trackingPreview?: string;
  downloadSize: DownloadSize;
  isLocked?: boolean;
  onNameChange?: (name: string) => void;
  destinationUrl?: string;
  onDestinationUrlChange?: (url: string) => void;
  onSubmit?: (event: any) => void;
  isSaving?: boolean;
  canCreate?: boolean;
  error?: string | null;
};

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
  trackingPreview = "Campaign tags enabled",
  downloadSize,
  isLocked,
  canCreate,
  error,
}: QRLivePreviewProps) {
  const previewLabel = finalUrl ? "Live preview" : "Draft preview";
  const statusLabel = isLocked ? "Locked" : canCreate ? "Scan safe" : "Needs input";

  return (
    <div className={styles.container}>
      {error ? <div className={styles.errorMessage}>{error}</div> : null}
      <section className={styles.heroPreviewCard}>
        <div className={styles.previewHeader}>
          <div>
            <span className={styles.previewKicker}>{previewLabel}</span>
            <h3 className={styles.sectionTitle}>Live QR Preview</h3>
          </div>
          <span className={styles.statusBadge}>{statusLabel}</span>
        </div>

        <div className={styles.previewVisual}>
          <div className={styles.previewGlow} aria-hidden="true" />
          <div className={styles.previewCanvas}>
            <StyledQRPreview
              url={finalUrl || qrUrl("preview")}
              foregroundColor={foregroundColor}
              backgroundColor={backgroundColor}
              dotStyle={dotStyle}
              cornerStyle={cornerStyle}
              logoUrl={logoUrl}
              showExportMenu={false}
            />
          </div>
        </div>

        <div className={styles.previewTitleRow}>
          <div>
            <p className={styles.metaLabel}>Campaign Name</p>
            <p className={styles.campaignName}>{name || "Untitled QR Campaign"}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Print Piece</p>
            <p className={styles.metaValue}>{PRINT_MOCKUP_LABELS[printMockupType]}</p>
          </div>
        </div>

        <div className={styles.previewStrip}>
          <article>
            <span>Scan Safe</span>
            <strong>{statusLabel}</strong>
          </article>
          <article>
            <span>Resolution</span>
            <strong>{DOWNLOAD_SIZE_LABELS[downloadSize]}</strong>
          </article>
          <article>
            <span>Usage</span>
            <strong>{used}/{limit}</strong>
          </article>
        </div>
      </section>

      <div className={styles.destinationPreviewCard}>
        <p>
          <span>Type</span>
          <strong>{destinationTypeLabel}</strong>
        </p>
        <p>
          <span>Preview</span>
          <strong>{destinationPreview || "Add destination details in the destination section."}</strong>
        </p>
        <p>
          <span>Tracking</span>
          <strong>{trackingPreview}</strong>
        </p>
        <p>
          <span>Destination</span>
          <strong>{finalUrl || "No destination yet"}</strong>
        </p>
      </div>

      <div className={styles.exportCard}>
        <p>
          <span>Recommended resolution</span>
          <strong>{DOWNLOAD_SIZE_LABELS[downloadSize]}</strong>
        </p>
        <p>
          <span>Formats</span>
          <strong>PNG, SVG, JPG, PDF</strong>
        </p>
        <small>Once this QR is created, export options are available from the QR manager and editor.</small>
      </div>
    </div>
  );
}
