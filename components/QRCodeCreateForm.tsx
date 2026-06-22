"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeUrl } from "@/lib/qr";

interface QRCodeCreateFormProps {
  used: number;
  limit: number;
}

export default function QRCodeCreateForm({ used, limit }: QRCodeCreateFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [destination_url, setDestinationUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    // Validation
    if (!name.trim()) {
      setError("QR name is required.");
      setIsSaving(false);
      return;
    }

    if (!destination_url.trim()) {
      setError("Destination URL is required.");
      setIsSaving(false);
      return;
    }

    // Normalize and validate URL
    const normalizedUrl = normalizeUrl(destination_url);
    try {
      new URL(normalizedUrl);
    } catch {
      setError("Please enter a valid URL (e.g., google.com or https://example.com).");
      setIsSaving(false);
      return;
    }

    if (used >= limit) {
      setError("Account limit reached. Upgrade to QR Pro+ for additional QR codes.");
      setIsSaving(false);
      return;
    }

    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("destination_url", normalizedUrl);

      const response = await fetch("/api/qr/create", {
        method: "POST",
        body: form,
      });

      if (response.ok) {
        await response.json();
        setName("");
        setDestinationUrl("");
        router.refresh();
      } else {
        const body = await response.json();
        setError(body.error || "Failed to create QR code. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="create-form-wrap">
      {error && <p className="alert">Error: {error}</p>}

      <form className="form" onSubmit={handleSubmit}>
        <label className="label">
          QR Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Yard Sign"
            maxLength={100}
            required
            disabled={isSaving}
          />
          <small className="muted">Give your QR code a memorable name.</small>
        </label>

        <label className="label">
          Destination URL
          <input
            className="input"
            value={destination_url}
            onChange={(e) => setDestinationUrl(e.target.value)}
            placeholder="google.com or https://example.com"
            required
            disabled={isSaving}
          />
          <small className="muted">Where should the QR code link to? We'll auto-add https:// if needed.</small>
        </label>

        <button className="btn primary full" type="submit" disabled={isSaving || used >= limit}>
          {isSaving ? "Creating..." : "Create QR"}
        </button>
      </form>

      {used >= limit ? (
        <div className="limit-callout">
          <strong>Account limit reached.</strong>
          <span> Upgrade to QR Pro+ for additional QR codes.</span>
          <a href="https://clutchprintshop.com/pages/qr-pro">View plans</a>
        </div>
      ) : null}

      <div className="usage-meter" aria-label={`${used} of ${limit} QR codes used`}>
        <div className="usage-meter-top">
          <span>Usage</span>
          <strong>{used}/{limit}</strong>
        </div>
        <div className="usage-track">
          <span style={{ width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
