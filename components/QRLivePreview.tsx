"use client";

import { FormEvent, useState } from "react";
import StyledQRPreview from "@/components/StyledQRPreview";
import { normalizeUrl, qrUrl } from "@/lib/qr";
import styles from "./QRLivePreview.module.css";

type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerStyle = "square" | "dot" | "extra-rounded";
type DownloadSize = "social" | "card" | "print";

const DOWNLOAD_SIZES = {
  social: 512,
  card: 600,
  print: 2400,
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
  isLocked?: boolean;
  name: string;
  onNameChange: (name: string) => void;
  destinationUrl: string;
  onDestinationUrlChange: (url: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSaving?: boolean;
  canCreate?: boolean;
  error?: string | null;
  downloadSize: DownloadSize;
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
  isLocked = false,
  name,
  onNameChange,
  destinationUrl,
  onDestinationUrlChange,
  onSubmit,
  isSaving = false,
  canCreate = true,
  error = null,
  downloadSize,
}: QRLivePreviewProps) {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const handleDownload = async (format: "png" | "svg" | "jpeg" | "pdf") => {
    // For now, just log. The QRExportMenu component handles actual downloads.
    console.log(`Download as ${format}`);
    setShowDownloadMenu(false);
  };

  const getPreviewUrl = () => {
    const baseUrl = qrUrl("preview");
    const url = new URL(baseUrl);
    url.searchParams.set("fg", foregroundColor.replace("#", ""));
    url.searchParams.set("bg", backgroundColor.replace("#", ""));
    url.searchParams.set("dotStyle", dotStyle);
    url.searchParams.set("cornerStyle", cornerStyle);
    return url.toString();
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={onSubmit}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* QR Preview Card */}
        <div className={styles.previewCard}>
          <StyledQRPreview
            url={finalUrl || qrUrl("preview")}
            foregroundColor={foregroundColor}
            backgroundColor={backgroundColor}
            dotStyle={dotStyle}
            cornerStyle={cornerStyle}
            logoUrl={logoUrl}
          />

          <div className={styles.previewMeta}>
            <p className={styles.metaLabel}>Usage</p>
            <p className={styles.metaValue}>
              {used}/{limit} QR codes
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div className={styles.formSection}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>QR Name</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Yard Sign - Spring Promo"
              maxLength={100}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Destination URL</span>
            <input
              type="url"
              className={styles.input}
              value={destinationUrl}
              onChange={(e) => onDestinationUrlChange(e.target.value)}
              onBlur={(e) => onDestinationUrlChange(normalizeUrl(e.target.value))}
              placeholder="https://your-link.com"
              required
            />
            <span className={styles.hint}>Where scans will redirect</span>
          </label>

          {finalUrl && (
            <div className={styles.finalUrl}>
              <span className={styles.finalUrlLabel}>Final URL with tracking</span>
              <span className={styles.finalUrlValue}>{finalUrl}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={isSaving || !canCreate}
          >
            {isSaving ? "Creating..." : "Create QR Code"}
          </button>

          {!canCreate && isLocked && (
            <div className={styles.lockCallout}>
              <strong>Creation unavailable</strong>
              <span>Your subscription is currently locked.</span>
            </div>
          )}
          {!canCreate && used >= limit && (
            <div className={styles.lockCallout}>
              <strong>Account limit reached</strong>
              <span>Upgrade your plan to create more QR codes.</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
