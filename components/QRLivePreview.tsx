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
  error,
}: QRLivePreviewProps) {
  return (
    <div className={styles.container}>
      {error ? <div className={styles.errorMessage}>{error}</div> : null}
      <h3 className={styles.sectionTitle}>Live QR Preview</h3>
      <div className={styles.previewCard}>
        <StyledQRPreview
          url={finalUrl || qrUrl("preview")}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
          dotStyle={dotStyle}
          cornerStyle={cornerStyle}
          logoUrl={logoUrl}
          showExportMenu={false}
        />

        <div className={styles.previewMeta}>
          <p className={styles.metaLabel}>Usage</p>
          <p className={styles.metaValue}>
            {used}/{limit} QR codes
          </p>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Destination Preview</h3>
      <div className={styles.destinationPreviewCard}>
        <p>
          <span>Type</span>
          <strong>{destinationTypeLabel}</strong>
        </p>
        <p>
          <span>Preview</span>
          <strong>{destinationPreview || "Add destination details in the left panel."}</strong>
        </p>
        <p>
          <span>Tracking</span>
          <strong>{trackingPreview}</strong>
        </p>
      </div>

      <h3 className={styles.sectionTitle}>Print Mockup Preview</h3>
      <div className={styles.mockupCard}>
        <div className={`${styles.mockupVisual} ${styles[printMockupType]}`}>
          <div className={styles.mockupQrBadge}>
            <div className={styles.mockupQrMini} style={{ background: foregroundColor }} />
            <div>
              <strong>{name || "Untitled QR Campaign"}</strong>
              <span>{PRINT_MOCKUP_LABELS[printMockupType]}</span>
            </div>
          </div>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Export</h3>
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
