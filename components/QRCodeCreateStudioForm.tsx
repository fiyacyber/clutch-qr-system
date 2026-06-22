"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StyledQRPreview from "@/components/StyledQRPreview";
import { normalizeUrl, qrUrl } from "@/lib/qr";

type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

type CornerStyle = "square" | "dot" | "extra-rounded";

type QRCodeCreateStudioFormProps = {
  used: number;
  limit: number;
  isLocked?: boolean;
  lockMessage?: string;
  connectProfiles?: Array<{ id: string; slug: string; business_name?: string | null; contact_name?: string | null }>;
};

function appendCampaignParams(url: string, campaignName: string, teamMember = "") {
  const safe = normalizeUrl(url);
  const parsed = new URL(safe);
  parsed.searchParams.set("utm_source", "business_card");
  parsed.searchParams.set("utm_medium", "print");
  parsed.searchParams.set(
    "utm_campaign",
    campaignName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "business-card-campaign"
  );
  if (teamMember.trim()) parsed.searchParams.set("utm_content", teamMember.trim());
  return parsed.toString();
}

export default function QRCodeCreateStudioForm({
  used,
  limit,
  isLocked = false,
  lockMessage,
  connectProfiles = [],
}: QRCodeCreateStudioFormProps) {
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [qrType, setQrType] = useState<"url" | "connect_profile">("url");
  const [selectedProfileId, setSelectedProfileId] = useState("");

  const [foregroundColor, setForegroundColor] = useState("#384862");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("square");

  const [useBusinessCampaign, setUseBusinessCampaign] = useState(true);
  const [campaignName, setCampaignName] = useState("");
  const [teamMember, setTeamMember] = useState("");
  const [businessTitle, setBusinessTitle] = useState("");
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>(undefined);

  const canCreate = !isLocked && used < limit;

  const finalUrl = useMemo(() => {
    if (qrType === "connect_profile") {
      const profile = connectProfiles.find((item) => item.id === selectedProfileId);
      return profile ? `https://connect.clutchprintshop.com/u/${profile.slug}` : "";
    }

    if (!destinationUrl.trim()) return "";
    const normalized = normalizeUrl(destinationUrl);
    if (!useBusinessCampaign) return normalized;
    return appendCampaignParams(normalized, campaignName || name || "business-card", teamMember);
  }, [qrType, selectedProfileId, connectProfiles, destinationUrl, useBusinessCampaign, campaignName, name, teamMember]);

  useEffect(() => {
    if (!logoFile) {
      setPreviewLogoUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewLogoUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [logoFile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isLocked) {
      setError(lockMessage || "Your subscription is currently locked.");
      return;
    }

    if (used >= limit) {
      setError("Account limit reached. Upgrade plan to create more QR codes.");
      return;
    }

    if (!name.trim()) {
      setError("QR name is required.");
      return;
    }

    if (qrType === "url" && !destinationUrl.trim()) {
      setError("Destination URL is required.");
      return;
    }

    if (qrType === "connect_profile" && !selectedProfileId) {
      setError("Select a Clutch Connect profile.");
      return;
    }

    let validatedUrl = "";
    try {
      validatedUrl = finalUrl || normalizeUrl(destinationUrl);
      new URL(validatedUrl);
    } catch {
      setError("Please enter a valid destination URL.");
      return;
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("destination_url", validatedUrl);
      formData.append("qr_type", qrType);
      if (selectedProfileId) formData.append("profile_id", selectedProfileId);
      formData.append("foreground_color", foregroundColor);
      formData.append("background_color", backgroundColor);
      formData.append("dot_style", dotStyle);
      formData.append("corner_style", cornerStyle);
      formData.append("business_title", businessTitle.trim());
      if (logoFile) formData.append("logo", logoFile);

      const response = await fetch("/api/qr/create", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create QR code.");
        setIsSaving(false);
        return;
      }

      router.push("/portal");
      router.refresh();
    } catch (err) {
      setError("Unexpected error while creating QR code.");
      setIsSaving(false);
      console.error(err);
    }
  }

  return (
    <div className="create-studio-grid">
      <div className="create-studio-preview">
        <p className="eyebrow">Live Preview</p>
        <StyledQRPreview
          url={qrUrl("preview")}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
          dotStyle={dotStyle}
          cornerStyle={cornerStyle}
          logoUrl={previewLogoUrl}
        />

        <div className="create-studio-summary">
          <p><span>Campaign URL</span><strong>{finalUrl || "Add destination URL"}</strong></p>
          <p><span>Usage</span><strong>{used}/{limit} QR codes</strong></p>
        </div>
      </div>

      <form className="form qr-controls create-studio-form" onSubmit={handleSubmit}>
        {error ? <div className="error-message">{error}</div> : null}

        <label className="label">
          QR Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business Card - Front Desk"
            maxLength={100}
            required
          />
        </label>

        <label className="label">
          QR Destination Type
          <select className="input" value={qrType} onChange={(e) => setQrType(e.target.value as "url" | "connect_profile")}>
            <option value="url">Standard URL Destination</option>
            <option value="connect_profile">Clutch Connect Profile</option>
          </select>
        </label>

        {qrType === "connect_profile" ? (
          <label className="label">
            Clutch Connect Profile
            <select
              className="input"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              required
            >
              <option value="">Select profile</option>
              {connectProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.business_name || profile.contact_name || profile.slug} ({profile.slug})
                </option>
              ))}
            </select>
            <span className="helper-text">This QR will open your Clutch Connect public profile.</span>
          </label>
        ) : null}

        <label className="label">
          Destination URL
          <input
            className="input"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            onBlur={(e) => setDestinationUrl(normalizeUrl(e.target.value))}
            placeholder="https://your-link.com"
            required={qrType === "url"}
            disabled={qrType === "connect_profile"}
          />
          <span className="helper-text">This is where scans will redirect.</span>
        </label>

        <div className="business-card-panel">
          <p className="eyebrow">Business Card Campaign</p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={useBusinessCampaign}
              onChange={(e) => setUseBusinessCampaign(e.target.checked)}
            />
            Auto-attach business-card campaign UTM tracking
          </label>

          {useBusinessCampaign ? (
            <div className="business-card-fields">
              <label className="label">
                Campaign Name
                <input
                  className="input"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="summer-networking-2026"
                />
              </label>

              <label className="label">
                Team Member / Card Owner
                <input
                  className="input"
                  value={teamMember}
                  onChange={(e) => setTeamMember(e.target.value)}
                  placeholder="Jane - Sales"
                />
              </label>

              <label className="label">
                Business Card Title (optional)
                <input
                  className="input"
                  value={businessTitle}
                  onChange={(e) => setBusinessTitle(e.target.value)}
                  placeholder="Senior Account Manager"
                />
              </label>
            </div>
          ) : null}
        </div>

        <details className="advanced-options" open>
          <summary>Design & Customization</summary>
          <div className="advanced-options-body">
            <div className="color-grid">
              <label className="label color-label">
                QR Color
                <input
                  type="color"
                  value={foregroundColor}
                  onChange={(e) => setForegroundColor(e.target.value)}
                />
              </label>

              <label className="label color-label">
                Background
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                />
              </label>
            </div>

            <label className="label">
              Dot Style
              <select className="input" value={dotStyle} onChange={(e) => setDotStyle(e.target.value as DotStyle)}>
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
              <select className="input" value={cornerStyle} onChange={(e) => setCornerStyle(e.target.value as CornerStyle)}>
                <option value="square">Square</option>
                <option value="dot">Dot</option>
                <option value="extra-rounded">Extra Rounded</option>
              </select>
            </label>

            <label className="label upload-box">
              Upload Logo
              <span className="helper-text">PNG/JPG/WEBP/SVG up to 1 MB.</span>
              <input
                className="input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => setLogoFile(e.currentTarget.files?.[0] || null)}
              />
            </label>
          </div>
        </details>

        <div className="actions">
          <button className="btn primary full" disabled={isSaving || !canCreate}>
            {isSaving ? "Creating..." : "Create QR Code"}
          </button>
        </div>

        {!canCreate ? (
          <div className="limit-callout">
            <strong>Creation unavailable</strong>
            <span>{lockMessage || "You have reached your QR code limit."}</span>
            <a href="https://clutchprintshop.com/pages/qr-pro">View plan options</a>
          </div>
        ) : null}
      </form>
    </div>
  );
}
