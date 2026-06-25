"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRTypeSelector, { QRType } from "@/components/QRTypeSelector";
import QRLivePreview from "@/components/QRLivePreview";
import QRStylePanel, { DownloadSize, ThemePreset } from "@/components/QRStylePanel";
import { normalizeUrl } from "@/lib/qr";
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
  const previewId = "qr-studio-preview";

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic QR Fields
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [qrType, setQrType] = useState<QRType | "connect_profile">("flyers");
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
    } else {
      // All mailing piece types use destination URL
      if (!destinationUrl.trim()) return "";
      baseUrl = normalizeUrl(destinationUrl);
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

  const selectedProfile = useMemo(() => {
    if (!selectedProfileId) return null;
    return connectProfiles.find((item) => item.id === selectedProfileId) || null;
  }, [connectProfiles, selectedProfileId]);

  const destinationSummary = qrType === "connect_profile"
    ? selectedProfile
      ? `${selectedProfile.business_name || selectedProfile.contact_name || selectedProfile.slug} • ${selectedProfile.slug}`
      : "Select a Clutch Connect profile"
    : destinationUrl.trim()
      ? destinationUrl.trim()
      : "Add a destination URL";

  const printPieceLabel = useMemo(() => {
    const selected = PRINT_ASSET_OPTIONS.find((option) => option.value === printAssetType);
    return selected?.label || "Print piece";
  }, [printAssetType]);

  const trackingSummary = useMemo(() => {
    if (!usePrintTracking) return "Tracking disabled";
    const parts = [campaignName || name || "Campaign name pending", campaignOwner, placementNote]
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" • ") : "Auto-attach print campaign UTM tracking";
  }, [campaignName, campaignOwner, placementNote, name, usePrintTracking]);

  const scanSafetyLabel = useMemo(() => {
    if (!finalUrl) return "Scan safe preview";
    if (downloadSize === "print") return "Print-ready scan safe";
    return "Preview ready";
  }, [downloadSize, finalUrl]);

  function scrollToPreview() {
    const element = document.getElementById(previewId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

    if (qrType !== "connect_profile" && !destinationUrl.trim()) {
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
    <form className={styles.container} onSubmit={handleSubmit}>
      <section className={styles.hero}>
        <div>
          <span className={styles.heroKicker}>Create QR</span>
          <h1 className={styles.heroTitle}>Build a trackable QR code in minutes.</h1>
          <p className={styles.heroSubtitle}>
            A mobile-first studio for destinations, print pieces, appearance, and campaign tracking.
          </p>
        </div>

        <div className={styles.heroMeta}>
          <article>
            <span>Usage</span>
            <strong>{used}/{limit}</strong>
          </article>
          <article>
            <span>Mode</span>
            <strong>{isLocked ? "Locked" : canCreate ? "Ready" : "Limited"}</strong>
          </article>
          <article>
            <span>Safe area</span>
            <strong>320px+</strong>
          </article>
        </div>
      </section>

      <section className={styles.previewRail} id={previewId}>
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
          destinationTypeLabel={qrType === "connect_profile" ? "Clutch Connect" : "Website"}
          destinationPreview={destinationSummary}
          printMockupType={printAssetType === "standard_business_card" ? "business_cards" : printAssetType === "flyer" ? "flyers" : printAssetType === "brochure" ? "brochures" : printAssetType === "door_hanger" ? "door_hangers" : printAssetType === "yard_sign" ? "yard_signs" : printAssetType === "poster" ? "postcards" : "business_cards"}
          trackingPreview={trackingSummary}
          downloadSize={downloadSize}
          canCreate={canCreate}
          error={error}
        />
      </section>

      <section className={styles.workspace}>
        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <span className={styles.stepNumber}>Step 1</span>
              <h2>Destination</h2>
            </div>
            <span className={styles.stepPill}>{qrType === "connect_profile" ? "Clutch Connect" : "Website"}</span>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>QR Name</span>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer campaign 2026"
                maxLength={100}
                disabled={isSaving}
              />
            </label>

            {qrType === "connect_profile" ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Clutch Connect Profile</span>
                <select
                  className={styles.select}
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  disabled={isSaving}
                  required
                >
                  <option value="">Select profile</option>
                  {connectProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.business_name || profile.contact_name || profile.slug} ({profile.slug})
                    </option>
                  ))}
                </select>
                <span className={styles.hint}>This QR will open your Clutch Connect profile.</span>
              </label>
            ) : (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Destination URL</span>
                <input
                  type="url"
                  className={styles.input}
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isSaving}
                />
                <span className={styles.hint}>Website, landing page, or tracked destination link.</span>
              </label>
            )}
          </div>

          <div className={styles.destinationMeta}>
            <article>
              <span>Preview</span>
              <strong>{destinationSummary}</strong>
            </article>
            <article>
              <span>Validation</span>
              <strong>{finalUrl ? "Ready" : "Incomplete"}</strong>
            </article>
            <article>
              <span>Redirect</span>
              <strong>{finalUrl ? finalUrl.replace(/^https?:\/\//, "") : "Waiting for input"}</strong>
            </article>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <span className={styles.stepNumber}>Step 2</span>
              <h2>Print Piece</h2>
            </div>
          </div>
          <QRTypeSelector
            value={qrType as QRType}
            onChange={(type) => {
              setQrType(type as QRType | "connect_profile");
              const validTypes = ["flyers", "business_cards", "brochures", "postcards", "door_hangers", "yard_signs", "connect_profile"];
              if (!validTypes.includes(type)) {
                setError("This QR type is coming soon!");
              } else {
                setError(null);
              }
            }}
          />
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <span className={styles.stepNumber}>Step 3</span>
              <h2>Appearance</h2>
            </div>
            <span className={styles.stepPill}>{scanSafetyLabel}</span>
          </div>
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
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <span className={styles.stepNumber}>Step 4</span>
              <h2>Campaign Tracking</h2>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={usePrintTracking}
                onChange={(e) => setUsePrintTracking(e.target.checked)}
                disabled={isSaving}
              />
              <span>Enabled</span>
            </label>
          </div>

          {usePrintTracking ? (
            <div className={styles.trackingFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Print Piece Type</span>
                <select
                  className={styles.select}
                  value={printAssetType}
                  onChange={(e) => setPrintAssetType(e.target.value as PrintAssetType)}
                  disabled={isSaving}
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
                  disabled={isSaving}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Team Member / Owner</span>
                <input
                  type="text"
                  className={styles.input}
                  value={campaignOwner}
                  onChange={(e) => setCampaignOwner(e.target.value)}
                  placeholder="Jane - Sales"
                  disabled={isSaving}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Placement</span>
                <input
                  type="text"
                  className={styles.input}
                  value={placementNote}
                  onChange={(e) => setPlacementNote(e.target.value)}
                  placeholder="Downtown route or lobby"
                  disabled={isSaving}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Notes</span>
                <input
                  type="text"
                  className={styles.input}
                  value={pieceDetail}
                  onChange={(e) => setPieceDetail(e.target.value)}
                  placeholder="Front side, version B"
                  disabled={isSaving}
                />
              </label>
            </div>
          ) : (
            <div className={styles.emptyTracking}>Tracking is off for this QR. Turn it on to add UTM parameters.</div>
          )}
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <span className={styles.stepNumber}>Step 5</span>
              <h2>Review</h2>
            </div>
            <span className={styles.stepPill}>{canCreate ? "Ready to create" : "Needs attention"}</span>
          </div>

          <div className={styles.reviewGrid}>
            <article>
              <span>Destination</span>
              <strong>{destinationSummary}</strong>
            </article>
            <article>
              <span>Campaign</span>
              <strong>{campaignName || name || "Untitled campaign"}</strong>
            </article>
            <article>
              <span>Print Piece</span>
              <strong>{printPieceLabel}</strong>
            </article>
            <article>
              <span>Theme</span>
              <strong>{theme}</strong>
            </article>
            <article>
              <span>Tracking</span>
              <strong>{usePrintTracking ? "Enabled" : "Disabled"}</strong>
            </article>
            <article>
              <span>Scanability</span>
              <strong>{scanSafetyLabel}</strong>
            </article>
          </div>
        </section>
      </section>

      <div className={styles.bottomBar}>
        <button type="button" className={styles.bottomSecondary} onClick={scrollToPreview}>
          Preview
        </button>
        <button type="submit" className={styles.bottomPrimary} disabled={!canCreate || isSaving}>
          {isSaving ? "Creating..." : "Create QR"}
        </button>
      </div>
    </form>
  );
}
