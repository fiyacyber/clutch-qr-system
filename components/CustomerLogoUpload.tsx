"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CustomerLogoUploadProps = {
  customerLogoUrl?: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  no_logo_selected: "Please select a logo file.",
  logo_type_not_supported:
    "File type not supported. Please use PNG, JPG, SVG, or WEBP.",
  logo_too_large: "File is too large. Maximum size is 1 MB.",
  logo_upload_failed: "Failed to upload logo. Please try again.",
  logo_update_failed: "Failed to save logo. Please try again.",
  logo_delete_failed: "Failed to delete logo. Please try again.",
};

export default function CustomerLogoUpload({
  customerLogoUrl,
}: CustomerLogoUploadProps) {
  const [logoError, setLogoError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

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
        setSelectedFile(null);
        return;
      }

      const maxSize = 1024 * 1024; // 1 MB
      if (file.size > maxSize) {
        setLogoError(
          `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum size is 1 MB.`
        );
        setSelectedFile(null);
        return;
      }
    } else {
      setSelectedFile(null);
      setLogoError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLogoError(null);
    setIsUploading(true);

    const form = event.currentTarget;

    try {
      const response = await fetch("/api/customer/logo", {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });

      if (response.redirected) {
        router.push(response.url);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("LOGO UPLOAD ERROR:", error);
      setLogoError("Failed to upload logo. Please try again.");
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove your company logo?")) return;

    setIsDeleting(true);

    try {
      const response = await fetch("/api/customer/logo", {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (response.redirected) {
        router.push(response.url);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("LOGO DELETE ERROR:", error);
      setLogoError("Failed to delete logo. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="card">
      <h3>Company Logo</h3>

      {customerLogoUrl && (
        <div className="logo-display">
          <img src={customerLogoUrl} alt="Company Logo" className="logo-preview" />
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <label className="label">
          Upload Your Company Logo
          <span className="helper-text">
            Used in your QR code center. PNG with transparency recommended. Max 1 MB.
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
          </ul>
        </div>

        <div className="actions">
          <button className="btn primary" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload Logo"}
          </button>
        </div>
      </form>

      {customerLogoUrl && (
        <div className="actions" style={{ marginTop: "12px" }}>
          <button
            className="btn ghost"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Removing..." : "Remove Logo"}
          </button>
        </div>
      )}
    </div>
  );
}
