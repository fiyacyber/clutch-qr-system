"use client";

import { FormEvent, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StyledQRPreview from "@/components/StyledQRPreview";
import { qrUrl, normalizeUrl } from "@/lib/qr";

type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

type CornerStyle = "square" | "dot" | "extra-rounded";

type QRCodeEditFormProps = {
  code: {
    id: string;
    name: string;
    destination_url: string;
    slug: string;
    scan_count?: number | null;
    foreground_color?: string | null;
    background_color?: string | null;
    dot_style?: DotStyle | null;
    corner_style?: CornerStyle | null;
    logo_url?: string | null;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  logo_type_not_supported:
    "File type not supported. Please use PNG, JPG, SVG, or WEBP.",
  logo_too_large: "File is too large. Maximum size is 1 MB.",
  logo_upload_failed: "Failed to upload logo. Please try again.",
  qr_save_failed: "Failed to save QR code. Please try again.",
};

export default function QRCodeEditForm({ code }: QRCodeEditFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState(code.name);
  const [destinationUrl, setDestinationUrl] = useState(code.destination_url);
  const [foregroundColor, setForegroundColor] = useState(code.foreground_color || "#384862");
  const [backgroundColor, setBackgroundColor] = useState(code.background_color || "#ffffff");
  const [dotStyle, setDotStyle] = useState<DotStyle>(code.dot_style as DotStyle || "square");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>(code.corner_style as CornerStyle || "square");
  const [logoUrl, setLogoUrl] = useState(code.logo_url);
  const [removeLogoChecked, setRemoveLogoChecked] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && ERROR_MESSAGES[error]) {
      setLogoError(ERROR_MESSAGES[error]);
    }
  }, [searchParams]);

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      setSelectedFile(file);
      setLogoError(null);

      // Client-side validation
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
      ];

      if (!allowedTypes.includes(file.type)) {
        setLogoError("File type not supported. Please use PNG, JPG, SVG, or WEBP.");
        return;
      }

      const maxSize = 1024 * 1024; // 1 MB
      if (file.size > maxSize) {
        setLogoError(
          `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum size is 1 MB.`
        );
        return;
      }
    } else {
      setSelectedFile(null);
      setLogoError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear any previous errors
    setLogoError(null);

    const form = event.currentTarget;
    setIsSaving(true);

    try {
      const response = await fetch("/api/qr/update", {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });

      window.location.assign(response.redirected ? response.url : "/portal");
    } catch (error) {
      console.error("QR SAVE ERROR:", error);
      window.location.assign("/portal?error=qr_save_failed");
    }
  }

  return (
    <>
      <StyledQRPreview
        url={qrUrl(code.slug)}
        foregroundColor={removeLogoChecked ? undefined : foregroundColor}
        backgroundColor={backgroundColor}
        dotStyle={dotStyle}
        cornerStyle={cornerStyle}
        logoUrl={removeLogoChecked ? undefined : logoUrl}
      />

      <p>
        <strong>Scans:</strong> {code.scan_count || 0}
      </p>

      <form
        className="form"
        action="/api/qr/update"
        method="post"
        encType="multipart/form-data"
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="id" value={code.id} />

        <label className="label">
          Name
          <input
            className="input"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="label">
          Destination URL
          <input
            className="input"
            name="destination_url"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            onBlur={(e) => setDestinationUrl(normalizeUrl(e.target.value))}
          />
        </label>

        <div className="color-grid">
          <label className="label color-label">
            QR Color
            <input
              type="color"
              name="foreground_color"
              value={foregroundColor}
              onChange={(e) => setForegroundColor(e.target.value)}
            />
          </label>

          <label className="label color-label">
            Background Color
            <input
              type="color"
              name="background_color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
            />
          </label>
        </div>

        <label className="label">
          Dot Style
          <select
            className="input"
            name="dot_style"
            value={dotStyle}
            onChange={(e) => setDotStyle(e.target.value as DotStyle)}
          >
            <option value="square">Square</option>
            <option value="rounded">Rounded</option>
            <option value="dots">Dots</option>
            <option value="classy">Classy</option>
            <option value="classy-rounded">Classy Rounded</option>
            <option value="extra-rounded">Extra Rounded</option>
          </select>
        </label>

        <label className="label">
          Corner Style
          <select
            className="input"
            name="corner_style"
            value={cornerStyle}
            onChange={(e) => setCornerStyle(e.target.value as CornerStyle)}
          >
            <option value="square">Square</option>
            <option value="dot">Dot</option>
            <option value="extra-rounded">Extra Rounded</option>
          </select>
        </label>

        <label className="label">
          Upload Your Logo
          <span className="helper-text">
            Use a square PNG with transparent background for best results. Max 1 MB.
          </span>
          <input
            className="input"
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleLogoChange}
          />
        </label>

        {logoError && (
          <div className="error-message">
            <strong>Error:</strong> {logoError}
          </div>
        )}

        {selectedFile && !logoError && (
          <div className="success-message">
            <strong>Selected:</strong> {selectedFile.name}
          </div>
        )}

        <div className="requirements-section">
          <p className="requirements-title">Logo Requirements:</p>
          <ul className="requirements-list">
            <li>PNG, JPG, SVG, or WEBP only</li>
            <li>Max file size: 1 MB</li>
            <li>Recommended size: 300 × 300 px or larger</li>
            <li>Square logos work best</li>
            <li>Avoid detailed full-background images</li>
          </ul>
        </div>

        {logoUrl && !removeLogoChecked ? (
          <label className="label checkbox-row">
            <input
              type="checkbox"
              name="remove_logo"
              value="true"
              checked={removeLogoChecked}
              onChange={(e) => setRemoveLogoChecked(e.target.checked)}
            />
            Remove uploaded logo
          </label>
        ) : null}

        <div className="actions">
          <button className="btn primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </>
  );
}
