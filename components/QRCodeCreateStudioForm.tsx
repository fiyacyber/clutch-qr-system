"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRTypeSelector, { QRType } from "@/components/QRTypeSelector";
import QRLivePreview from "@/components/QRLivePreview";
import QRStylePanel, { DownloadSize, ThemePreset } from "@/components/QRStylePanel";
import { normalizeUrl, qrUrl } from "@/lib/qr";
import styles from "./QRCodeCreateStudioForm.module.css";

type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

type CornerStyle = "square" | "dot" | "extra-rounded";

type PrintAssetType =
  | "standard_business_card"
  | "flyer"
  | "yard_sign"
  | "poster"
  | "brochure"
  | "door_hanger"
  | "direct_mail"
  | "table_tent"
  | "other_print";

const PRINT_ASSET_OPTIONS: Array<{ value: PrintAssetType; label: string }> = [
  { value: "standard_business_card", label: "Standard Business Card" },
  { value: "flyer", label: "Flyer" },
  { value: "yard_sign", label: "Yard Sign" },
  { value: "poster", label: "Poster" },
  { value: "brochure", label: "Brochure" },
  { value: "door_hanger", label: "Door Hanger" },
  { value: "direct_mail", label: "Direct Mail" },
  { value: "table_tent", label: "Table Tent" },
  { value: "other_print", label: "Other Print Piece" },
];

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type QRCodeCreateStudioFormProps = {
  used: number;
  limit: number;
  isLocked?: boolean;
  lockMessage?: string;
  connectProfiles?: Array<{ id: string; slug: string; business_name?: string | null; contact_name?: string | null }>;
};

function appendCampaignParams({
  url,
  campaignName,
  assetType,
  owner,
  pieceDetail,
  placement,
}: {
  url: string;
  campaignName: string;
  assetType: PrintAssetType;
  owner?: string;
  pieceDetail?: string;
  placement?: string;
}) {
  const safe = normalizeUrl(url);
  const parsed = new URL(safe);
  parsed.searchParams.set("utm_source", assetType);
  parsed.searchParams.set("utm_medium", "print");
  parsed.searchParams.set(
    "utm_campaign",
    slugify(campaignName) || `print-${assetType.replace(/_/g, "-")}`
  );

  const contentParts = [owner?.trim(), pieceDetail?.trim()].filter(Boolean);
  if (contentParts.length > 0) {
    parsed.searchParams.set("utm_content", contentParts.join(" | "));
  }

  if (placement?.trim()) {
    parsed.searchParams.set("utm_term", slugify(placement) || placement.trim());
  }

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

  // Basic QR Fields
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [qrType, setQrType] = useState<QRType>("url");
  const [selectedProfileId, setSelectedProfileId] = useState("");

  // Style Fields
  const [foregroundColor, setForegroundColor] = useState("#384862");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("square");
  const [theme, setTheme] = useState<ThemePreset>("default");
  const [downloadSize, setDownloadSize] = useState<DownloadSize>("print");

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>(undefined);

  // Print Tracking
  const [usePrintTracking, setUsePrintTracking] = useState(true);
  const [printAssetType, setPrintAssetType] = useState<PrintAssetType>("standard_business_card");
  const [campaignName, setCampaignName] = useState("");
  const [campaignOwner, setCampaignOwner] = useState("");
  const [pieceDetail, setPieceDetail] = useState("");
  const [placementNote, setPlacementNote] = useState("");

  const canCreate = !isLocked && used < limit;

  // Apply theme presets
  useEffect(() => {
    const presets: Record<ThemePreset, { fg: string; bg: string }> = {
      default: { fg: "#384862", bg: "#ffffff" },
      paper: { fg: "#6b5344", bg: "#f5dcc8" },
      midnight: { fg: "#ffffff", bg: "#1e2a3a" },
      pastel: { fg: "#384862", bg: "#ffd4b4" },
    };

    if (presets[theme]) {
      setForegroundColor(presets[theme].fg);
      setBackgroundColor(presets[theme].bg);
    }
  }, [theme]);

  const finalUrl = useMemo(() => {
    let baseUrl = "";

    if (qrType === "connect_profile") {
      const profile = connectProfiles.find((item) => item.id === selectedProfileId);
      baseUrl = profile ? `https://connect.clutchprintshop.com/u/${profile.slug}` : "";
    } else if (qrType === "url") {
      if (!destinationUrl.trim()) return "";
      baseUrl = normalizeUrl(destinationUrl);
    } else {
      // Other QR types not yet supported
      return "";
    }

    if (!baseUrl) return "";
    if (!usePrintTracking) return baseUrl;

    return appendCampaignParams({
      url: baseUrl,
      campaignName: campaignName || name || "print-campaign",
      assetType: printAssetType,
      owner: campaignOwner,
      pieceDetail,
      placement: placementNote,
    });
  }, [
    qrType,
    selectedProfileId,
    connectProfiles,
    destinationUrl,
    usePrintTracking,
    campaignName,
    name,
    printAssetType,
    campaignOwner,
    pieceDetail,
    placementNote,
  ]);

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
      formData.append("theme", theme);
      formData.append("download_size", downloadSize);
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
    <div className={styles.container}>
      {/* Left Column: QR Type Selector */}
      <div className={styles.leftColumn}>
        <QRTypeSelector
          value={qrType}
          onChange={(type) => {
            setQrType(type);
            if (type !== "url" && type !== "connect_profile") {
              setError("This QR type is coming soon!");
            } else {
              setError(null);
            }
          }}
        />
      </div>

      {/* Center Column: Live Preview + Form */}
      <div className={styles.centerColumn}>
        <QRLivePreview
          finalUrl={finalUrl}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
          dotStyle={dotStyle}
          cornerStyle={cornerStyle}
          logoUrl={previewLogoUrl}
          used={used}
          limit={limit}
          isLocked={isLocked}
          name={name}
          onNameChange={setName}
          destinationUrl={destinationUrl}
          onDestinationUrlChange={setDestinationUrl}
          onSubmit={handleSubmit}
          isSaving={isSaving}
          canCreate={canCreate}
          error={error}
          downloadSize={downloadSize}
        />

        {/* Additional Fields Below Preview */}
        {qrType === "connect_profile" && (
          <div className={styles.additionalFields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Clutch Connect Profile</span>
              <select
                className={styles.select}
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
              <span className={styles.hint}>This QR will open your Clutch Connect profile</span>
            </label>
          </div>
        )}

        {/* Print Tracking Section */}
        <details className={styles.expandableSection} open>
          <summary className={styles.summary}>Print Campaign Tracking</summary>
          <div className={styles.sectionBody}>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={usePrintTracking}
                onChange={(e) => setUsePrintTracking(e.target.checked)}
              />
              Auto-attach print campaign UTM tracking
            </label>

            {usePrintTracking && (
              <div className={styles.trackingFields}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Print Piece Type</span>
                  <select
                    className={styles.select}
                    value={printAssetType}
                    onChange={(e) => setPrintAssetType(e.target.value as PrintAssetType)}
                  >
                    {PRINT_ASSET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Campaign Name</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="summer-campaign-2026"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Team Member / Owner (optional)</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={campaignOwner}
                    onChange={(e) => setCampaignOwner(e.target.value)}
                    placeholder="Jane - Sales"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Piece Detail (optional)</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={pieceDetail}
                    onChange={(e) => setPieceDetail(e.target.value)}
                    placeholder="Front side, version B"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Placement Note (optional)</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={placementNote}
                    onChange={(e) => setPlacementNote(e.target.value)}
                    placeholder="Downtown route or lobby"
                  />
                </label>

                <p className={styles.hint}>
                  UTM mapping: source = piece type, medium = print, campaign = campaign name,
                  content = owner + detail, term = placement.
                </p>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Right Column: Style Panel */}
      <div className={styles.rightColumn}>
        <QRStylePanel
          theme={theme}
          onThemeChange={setTheme}
          foregroundColor={foregroundColor}
          onForegroundColorChange={setForegroundColor}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          dotStyle={dotStyle}
          onDotStyleChange={setDotStyle}
          cornerStyle={cornerStyle}
          onCornerStyleChange={setCornerStyle}
          downloadSize={downloadSize}
          onDownloadSizeChange={setDownloadSize}
          logoFile={logoFile}
          onLogoFileChange={setLogoFile}
        />
      </div>
    </div>
  );
}
