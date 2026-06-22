"use client";

import { MouseEvent, useState } from "react";
import { exportQrCode, type QRExportFormat } from "@/lib/qrExport";
import styles from "./QRExportMenu.module.css";

const EXPORT_OPTIONS: Array<{ format: QRExportFormat; label: string }> = [
  { format: "png", label: "PNG" },
  { format: "svg", label: "SVG" },
  { format: "jpeg", label: "JPEG" },
  { format: "pdf", label: "PDF" },
];

type QRExportMenuProps = {
  slug: string;
};

export default function QRExportMenu({ slug }: QRExportMenuProps) {
  const [activeFormat, setActiveFormat] = useState<QRExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(
    event: MouseEvent<HTMLButtonElement>,
    format: QRExportFormat
  ) {
    event.preventDefault();
    setActiveFormat(format);
    setError(null);

    try {
      await exportQrCode(slug, format);
    } catch (exportError) {
      console.error("QR EXPORT ERROR:", exportError);
      setError("Export failed. Please try again.");
    } finally {
      setActiveFormat(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Export QR</p>
      <div className={styles.buttonGrid}>
        {EXPORT_OPTIONS.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            onClick={(event) => handleExport(event, format)}
            disabled={activeFormat !== null}
          >
            {activeFormat === format ? "..." : label}
          </button>
        ))}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
