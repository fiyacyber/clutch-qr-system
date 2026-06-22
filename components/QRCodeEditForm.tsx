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
    qr_type?: "url" | "connect_profile" | null;
    profile_id?: string | null;
    scan_count?: number | null;
    updated_at?: string | null;
    foreground_color?: string | null;
    background_color?: string | null;
    dot_style?: DotStyle | null;
    corner_style?: CornerStyle | null;
    logo_url?: string | null;
  };
  connectProfiles?: Array<{ id: string; slug: string; business_name?: string | null; contact_name?: string | null }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  logo_type_not_supported:
    "File type not supported. Please use PNG, JPG, SVG, or WEBP.",
  logo_too_large: "File is too large. Maximum size is 1 MB.",
  logo_upload_failed: "Failed to upload logo. Please try again.",
  qr_save_failed: "Failed to save QR code. Please try again.",
};

export default function QRCodeEditForm({ code, connectProfiles = [] }: QRCodeEditFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState(code.name);
  const [destinationUrl, setDestinationUrl] = useState(code.destination_url);
  const [qrType, setQrType] = useState<"url" | "connect_profile">(
    code.qr_type === "connect_profile" ? "connect_profile" : "url"
  );
  const [profileId, setProfileId] = useState(code.profile_id || "");
  const [foregroundColor, setForegroundColor] = useState(code.foreground_color || "#384862");
  const [backgroundColor, setBackgroundColor] = useState(code.background_color || "#ffffff");
  const [dotStyle, setDotStyle] = useState<DotStyle>(code.dot_style as DotStyle || "square");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>(code.corner_style as CornerStyle || "square");
  const [shapePreset, setShapePreset] = useState<string>(() => {
    if (code.dot_style === "square" && code.corner_style === "square") return "square";
    if (code.dot_style === "rounded" && code.corner_style === "square") return "rounded";
    if (code.dot_style === "dots" && code.corner_style === "dot") return "dots";
    if (code.dot_style === "classy" && code.corner_style === "square") return "classy";
    if (code.dot_style === "classy-rounded" && code.corner_style === "dot") return "classy-rounded";
    if (code.dot_style === "extra-rounded" && code.corner_style === "dot") return "extra-rounded";
    return "custom";
  });
  const [logoUrl, setLogoUrl] = useState(code.logo_url);
  const [removeLogoChecked, setRemoveLogoChecked] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && ERROR_MESSAGES[error]) {
      setLogoError(ERROR_MESSAGES[error]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (shapePreset === "custom") return;

    switch (shapePreset) {
      case "square":
        setDotStyle("square");
        setCornerStyle("square");
        break;
      case "rounded":
        setDotStyle("rounded");
        setCornerStyle("square");
        break;
      case "dots":
        setDotStyle("dots");
        setCornerStyle("dot");
        break;
      case "classy":
        setDotStyle("classy");
        setCornerStyle("square");
        break;
      case "classy-rounded":
        setDotStyle("classy-rounded");
        setCornerStyle("dot");
        break;
      case "extra-rounded":
        setDotStyle("extra-rounded");
        setCornerStyle("dot");
        break;
    }
  }, [shapePreset]);

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

      const data = await response.json();

      if (response.ok) {
        // Success - reload page to show updates
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        // Error - show message in form
        setLogoError(data.error || "Failed to save QR code. Please try again.");
        setIsSaving(false);
      }
    } catch (error) {
      console.error("QR SAVE ERROR:", error);
      setLogoError("An unexpected error occurred. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <div className="qr-editor">
      <div className="qr-preview-panel">
        <StyledQRPreview
          url={qrUrl(code.slug)}
          foregroundColor={removeLogoChecked ? undefined : foregroundColor}
          backgroundColor={backgroundColor}
          dotStyle={dotStyle}
          cornerStyle={cornerStyle}
          logoUrl={removeLogoChecked ? undefined : logoUrl}
        />

        <div className="scan-summary">
          <span>Total scans</span>
          <strong>{code.scan_count || 0}</strong>
        </div>

        <div className="qr-meta-stack">
          <p>
            <span>Destination</span>
            <strong>{destinationUrl}</strong>
          </p>
          <p>
            <span>Last updated</span>
            <strong>
              {code.updated_at
                ? new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(code.updated_at))
                : "Not available"}
            </strong>
          </p>
        </div>
      </div>

      <form
        className="form qr-controls"
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
          Destination Type
          <select
            className="input"
            name="qr_type"
            value={qrType}
            onChange={(e) => setQrType(e.target.value as "url" | "connect_profile")}
          >
            <option value="url">Standard URL Destination</option>
            <option value="connect_profile">Clutch Connect Profile</option>
          </select>
        </label>

        {qrType === "connect_profile" ? (
          <label className="label">
            Clutch Connect Profile
            <select
              className="input"
              name="profile_id"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              required
            >
              <option value="">Select profile</option>
              {connectProfiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.business_name || profile.contact_name || profile.slug} ({profile.slug})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="label">
          Destination URL
          <input
            className="input"
            name="destination_url"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            onBlur={(e) => setDestinationUrl(normalizeUrl(e.target.value))}
            disabled={qrType === "connect_profile"}
          />
        </label>

        <details className="advanced-options">
          <summary>Advanced Design Options</summary>

          <div className="advanced-options-body">
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
              QR Shape
              <select
                className="input"
                name="shape_preset"
                value={shapePreset}
                onChange={(e) => setShapePreset(e.target.value)}
              >
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="dots">Dots</option>
                <option value="classy">Classy</option>
                <option value="classy-rounded">Classy Rounded</option>
                <option value="extra-rounded">Extra Rounded</option>
                <option value="custom">Custom</option>
              </select>
              <span className="helper-text">
                Change the module and corner style of the QR code.
              </span>
            </label>

            <label className="label">
              Dot Style
              <select
                className="input"
                name="dot_style"
                value={dotStyle}
                onChange={(e) => {
                  setDotStyle(e.target.value as DotStyle);
                  setShapePreset("custom");
                }}
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
                onChange={(e) => {
                  setCornerStyle(e.target.value as CornerStyle);
                  setShapePreset("custom");
                }}
              >
                <option value="square">Square</option>
                <option value="dot">Dot</option>
                <option value="extra-rounded">Extra Rounded</option>
              </select>
            </label>

            <label className="label upload-box">
              Upload Your Logo
              <span className="helper-text">
                Drop in a square logo or choose a file. Transparent PNG recommended.
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
                <li>Recommended size: 300 x 300 px or larger</li>
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
          </div>
        </details>

        <div className="actions">
          <button className="btn primary full" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
