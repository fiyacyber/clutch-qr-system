"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import QRTypeSelector, { QRType } from "@/components/QRTypeSelector";
import QRLivePreview from "@/components/QRLivePreview";
import QRStylePanel, { DownloadSize, ThemePreset } from "@/components/QRStylePanel";
import { clutchConnectProfileUrl, normalizeUrl } from "@/lib/qr";
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

const STEPS = [
  { label: "Destination", helper: "Name, link, and print piece" },
  { label: "Design", helper: "Colors, pattern, and logo" },
  { label: "Tracking", helper: "Optional campaign details" },
  { label: "Review", helper: "Confirm and create" },
] as const;

const QR_TYPE_TO_PRINT_ASSET: Record<string, PrintAssetType> = {
  business_cards: "standard_business_card",
  flyers: "flyer",
  brochures: "brochure",
  postcards: "direct_mail",
  door_hangers: "door_hanger",
  yard_signs: "yard_sign",
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type QRCodeCreateStudioFormProps = {
  used: number;
  limit: number;
  planName?: string;
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
  planName = "Clutch Codes",
  isLocked = false,
  lockMessage,
  connectProfiles = [],
}: QRCodeCreateStudioFormProps) {
  const router = useRouter();
  const previewId = "qr-studio-preview";
  const editorId = "qr-studio-editor";

  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [qrType, setQrType] = useState<QRType | "connect_profile">("flyers");
  const [selectedProfileId, setSelectedProfileId] = useState("");

  const [foregroundColor, setForegroundColor] = useState("#384862");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("square");
  const [theme, setTheme] = useState<ThemePreset>("default");
  const [downloadSize, setDownloadSize] = useState<DownloadSize>("print");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>(undefined);

  const [usePrintTracking, setUsePrintTracking] = useState(true);
  const [printAssetType, setPrintAssetType] = useState<PrintAssetType>("flyer");
  const [campaignName, setCampaignName] = useState("");
  const [campaignOwner, setCampaignOwner] = useState("");
  const [pieceDetail, setPieceDetail] = useState("");
  const [placementNote, setPlacementNote] = useState("");

  const canCreate = !isLocked && used < limit;

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

  const finalUrl = useMemo(() => {
    let baseUrl = "";

    if (qrType === "connect_profile") {
      const profile = connectProfiles.find((item) => item.id === selectedProfileId);
      baseUrl = profile ? clutchConnectProfileUrl(profile.slug) : "";
    } else {
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
    if (!finalUrl) return "Needs destination";
    if (downloadSize === "print") return "Print ready";
    return "Preview ready";
  }, [downloadSize, finalUrl]);

  function focusEditor() {
    window.setTimeout(() => {
      document.getElementById(editorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function validateDestinationStep() {
    if (!name.trim()) {
      setError("Add a clear QR name so you can identify it later.");
      return false;
    }

    if (qrType === "connect_profile") {
      if (!selectedProfileId) {
        setError("Select the Clutch Connect profile this QR should open.");
        return false;
      }
    } else {
      if (!destinationUrl.trim()) {
        setError("Add the website or landing-page URL this QR should open.");
        return false;
      }

      try {
        new URL(normalizeUrl(destinationUrl));
      } catch {
        setError("Enter a valid destination URL.");
        return false;
      }
    }

    setError(null);
    return true;
  }

  function changeStep(nextStep: number) {
    if (nextStep > 0 && !validateDestinationStep()) {
      setActiveStep(0);
      focusEditor();
      return;
    }

    setError(null);
    setActiveStep(Math.max(0, Math.min(STEPS.length - 1, nextStep)));
    focusEditor();
  }

  function advanceStep() {
    if (activeStep === 0 && !validateDestinationStep()) return;
    changeStep(activeStep + 1);
  }

  function scrollToPreview() {
    const element = document.getElementById(previewId);
    element?.setAttribute("open", "");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeStep < STEPS.length - 1) {
      advanceStep();
      return;
    }

    setError(null);

    if (isLocked) {
      setError(lockMessage || "Your subscription is currently locked.");
      return;
    }

    if (used >= limit) {
      setError("Account limit reached. Upgrade your plan to create more QR codes.");
      return;
    }

    if (!validateDestinationStep()) {
      setActiveStep(0);
      return;
    }

    let validatedUrl = "";
    try {
      validatedUrl = finalUrl || normalizeUrl(destinationUrl);
      new URL(validatedUrl);
    } catch {
      setError("Please enter a valid destination URL.");
      setActiveStep(0);
      return;
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("destination_url", validatedUrl);
      formData.append("qr_type", qrType === "connect_profile" ? "connect_profile" : "url");
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

      router.push("/portal/qr");
      router.refresh();
    } catch (err) {
      setError("Unexpected error while creating QR code.");
      setIsSaving(false);
      console.error(err);
    }
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <section className={styles.studioIntro}>
        <div>
          <span className={styles.studioKicker}>Guided QR Builder</span>
          <h2>Create your code in four quick steps.</h2>
          <p>Only the name and destination are required. Design and campaign tracking are optional.</p>
        </div>
        <div className={styles.accountSummary} aria-label="Current QR plan and usage">
          <span>{planName}</span>
          <strong>{used}/{limit} codes used</strong>
        </div>
      </section>

      <nav className={styles.stepper} aria-label="QR creation progress">
        {STEPS.map((step, index) => {
          const isActive = activeStep === index;
          const isComplete = index < activeStep;

          return (
            <button
              key={step.label}
              type="button"
              className={`${styles.stepButton} ${isActive ? styles.stepButtonActive : ""} ${isComplete ? styles.stepButtonComplete : ""}`}
              onClick={() => changeStep(index)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className={styles.stepIndex}>{isComplete ? <Check size={16} /> : index + 1}</span>
              <span className={styles.stepCopy}>
                <strong>{step.label}</strong>
                <small>{step.helper}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className={styles.studioGrid}>
        <details className={styles.previewRail} id={previewId}>
          <summary className={styles.previewSummary}>
            <span><Eye size={17} /> Live preview</span>
            <strong>{scanSafetyLabel}</strong>
          </summary>
          <div className={styles.previewSticky}>
            <QRLivePreview
              compact
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
              canCreate={canCreate && Boolean(finalUrl) && Boolean(name.trim())}
              error={error}
            />
          </div>
        </details>

        <section className={styles.editorColumn} id={editorId}>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          {activeStep === 0 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div>
                  <span className={styles.stepNumber}>Step 1 of 4</span>
                  <h2>Where should this QR code go?</h2>
                  <p>Name the code, add its destination, and choose where it will be printed.</p>
                </div>
                <span className={styles.stepPill}>{qrType === "connect_profile" ? "Profile" : "Website"}</span>
              </div>

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>QR Name</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Summer postcard campaign"
                    maxLength={100}
                    disabled={isSaving}
                    autoFocus
                  />
                  <span className={styles.hint}>Customers never see this. Use a name you will recognize in analytics.</span>
                </label>

                {qrType === "connect_profile" ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Clutch Connect Profile</span>
                    <select
                      className={styles.select}
                      value={selectedProfileId}
                      onChange={(event) => setSelectedProfileId(event.target.value)}
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
                    <span className={styles.hint}>This QR will open the selected digital profile.</span>
                  </label>
                ) : (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Destination URL</span>
                    <input
                      type="url"
                      className={styles.input}
                      value={destinationUrl}
                      onChange={(event) => setDestinationUrl(event.target.value)}
                      placeholder="https://yourwebsite.com/offer"
                      disabled={isSaving}
                    />
                    <span className={styles.hint}>You can change this destination later without reprinting the QR code.</span>
                  </label>
                )}
              </div>

              <div className={styles.subsectionHeader}>
                <div>
                  <span>Print piece</span>
                  <h3>Where will customers scan it?</h3>
                </div>
                <small>This helps label the campaign correctly.</small>
              </div>

              <QRTypeSelector
                value={qrType as QRType}
                onChange={(type) => {
                  const nextType = type as QRType | "connect_profile";
                  setQrType(nextType);
                  const mappedAsset = QR_TYPE_TO_PRINT_ASSET[String(type)];
                  if (mappedAsset) setPrintAssetType(mappedAsset);

                  const validTypes = ["flyers", "business_cards", "brochures", "postcards", "door_hangers", "yard_signs", "connect_profile"];
                  if (!validTypes.includes(type)) {
                    setError("This QR type is coming soon.");
                  } else {
                    setError(null);
                  }
                }}
              />

              <div className={styles.destinationMeta}>
                <article>
                  <span>Destination</span>
                  <strong>{destinationSummary}</strong>
                </article>
                <article>
                  <span>Print piece</span>
                  <strong>{printPieceLabel}</strong>
                </article>
              </div>
            </section>
          ) : null}

          {activeStep === 1 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div>
                  <span className={styles.stepNumber}>Step 2 of 4</span>
                  <h2>Choose the QR appearance.</h2>
                  <p>The default design is already print-safe. Customize only what you need.</p>
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
          ) : null}

          {activeStep === 2 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div>
                  <span className={styles.stepNumber}>Step 3 of 4</span>
                  <h2>Add campaign tracking.</h2>
                  <p>These optional details make reports easier to understand later.</p>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={usePrintTracking}
                    onChange={(event) => setUsePrintTracking(event.target.checked)}
                    disabled={isSaving}
                  />
                  <span>{usePrintTracking ? "Enabled" : "Disabled"}</span>
                </label>
              </div>

              {usePrintTracking ? (
                <div className={styles.trackingFields}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Print Piece Type</span>
                    <select
                      className={styles.select}
                      value={printAssetType}
                      onChange={(event) => setPrintAssetType(event.target.value as PrintAssetType)}
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
                      onChange={(event) => setCampaignName(event.target.value)}
                      placeholder={name || "Summer campaign 2026"}
                      disabled={isSaving}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Team Member / Owner</span>
                    <input
                      type="text"
                      className={styles.input}
                      value={campaignOwner}
                      onChange={(event) => setCampaignOwner(event.target.value)}
                      placeholder="Jane — Sales"
                      disabled={isSaving}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Placement</span>
                    <input
                      type="text"
                      className={styles.input}
                      value={placementNote}
                      onChange={(event) => setPlacementNote(event.target.value)}
                      placeholder="Front counter, mail route, event table"
                      disabled={isSaving}
                    />
                  </label>

                  <label className={`${styles.field} ${styles.fieldWide}`}>
                    <span className={styles.fieldLabel}>Internal Notes</span>
                    <input
                      type="text"
                      className={styles.input}
                      value={pieceDetail}
                      onChange={(event) => setPieceDetail(event.target.value)}
                      placeholder="Version B, front side, July promotion"
                      disabled={isSaving}
                    />
                  </label>
                </div>
              ) : (
                <div className={styles.emptyTracking}>
                  The QR will still count scans. Campaign tags and placement details will not be attached.
                </div>
              )}
            </section>
          ) : null}

          {activeStep === 3 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div>
                  <span className={styles.stepNumber}>Step 4 of 4</span>
                  <h2>Review and create.</h2>
                  <p>Confirm the destination and campaign details before publishing.</p>
                </div>
                <span className={styles.stepPill}>{canCreate && finalUrl ? "Ready" : "Needs attention"}</span>
              </div>

              <div className={styles.reviewGrid}>
                <article>
                  <span>QR Name</span>
                  <strong>{name || "Not added"}</strong>
                </article>
                <article>
                  <span>Destination</span>
                  <strong>{destinationSummary}</strong>
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
                  <strong>{usePrintTracking ? trackingSummary : "Disabled"}</strong>
                </article>
                <article>
                  <span>Export Size</span>
                  <strong>{downloadSize === "print" ? "2400 × 2400" : downloadSize === "card" ? "600 × 600" : "512 × 512"}</strong>
                </article>
              </div>

              <div className={styles.reviewNotice}>
                <Check size={18} />
                <div>
                  <strong>Your destination can be edited later.</strong>
                  <span>The printed QR image stays the same while Clutch redirects scans to the updated URL.</span>
                </div>
              </div>
            </section>
          ) : null}

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.previewButton}
              onClick={scrollToPreview}
            >
              <Eye size={17} />
              Preview
            </button>

            {activeStep > 0 ? (
              <button
                type="button"
                className={styles.backButton}
                onClick={() => changeStep(activeStep - 1)}
                disabled={isSaving}
              >
                <ChevronLeft size={18} />
                Back
              </button>
            ) : null}

            {activeStep < STEPS.length - 1 ? (
              <button
                type="button"
                className={styles.nextButton}
                onClick={advanceStep}
                disabled={isSaving}
              >
                Continue
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="submit"
                className={styles.nextButton}
                disabled={!canCreate || isSaving || !finalUrl || !name.trim()}
              >
                {isSaving ? "Creating..." : "Create QR"}
              </button>
            )}
          </div>
        </section>
      </div>
    </form>
  );
}
