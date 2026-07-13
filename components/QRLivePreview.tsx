"use client";

import { CheckCircle2 } from "lucide-react";
import StyledQRPreview from "@/components/StyledQRPreview";
import { qrUrl } from "@/lib/qr";
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
  business_cards: "Business cards",
  flyers: "Flyers",
  brochures: "Brochures",
  door_hangers: "Door hangers",
  postcards: "Postcards",
  yard_signs: "Yard signs",
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
  trackingPreview = "Campaign tracking enabled",
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
          <div><span className={styles.previewKicker}>{previewLabel}</span><h3 className={styles.sectionTitle}>Your Clutch Code</h3></div>
          <span className={styles.statusBadge}>{statusLabel}</span>
        </div>

        <div className={styles.previewVisual}>
          <div className={styles.previewGlow} aria-hidden="true" />
          <div className={styles.circularFrame}>
            <span className={styles.topText}>SCAN TO CONNECT</span>
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
            <span className={styles.bottomText}>POWERED BY CLUTCH CODES™</span>
          </div>
        </div>

        <div className={styles.previewTitleRow}>
          <div><p className={styles.metaLabel}>Code name</p><p className={styles.campaignName}>{name || "Untitled Clutch Code"}</p></div>
          <div><p className={styles.metaLabel}>Distribution</p><p className={styles.metaValue}>{PRINT_MOCKUP_LABELS[printMockupType]}</p></div>
        </div>

        <div className={styles.qualityCard}>
          <strong>Scan quality</strong>
          <span><CheckCircle2 size={15} /> Finder patterns preserved</span>
          <span><CheckCircle2 size={15} /> Quiet zone preserved</span>
          <span><CheckCircle2 size={15} /> {downloadSize === "print" ? "Print-ready resolution" : "Digital-ready resolution"}</span>
        </div>

        <div className={styles.previewStrip}>
          <article><span>Status</span><strong>{statusLabel}</strong></article>
          <article><span>Resolution</span><strong>{DOWNLOAD_SIZE_LABELS[downloadSize]}</strong></article>
          <article><span>Allowance</span><strong>{used}/{limit}</strong></article>
        </div>
      </section>

      <div className={styles.destinationPreviewCard}>
        <p><span>Destination type</span><strong>{destinationTypeLabel}</strong></p>
        <p><span>Destination</span><strong>{destinationPreview || "Add destination details in the first step."}</strong></p>
        <p><span>Distribution guidance</span><strong>{trackingPreview}</strong></p>
      </div>
    </div>
  );
}
