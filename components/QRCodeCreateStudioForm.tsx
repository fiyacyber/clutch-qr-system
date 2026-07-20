"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, Link2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import QRLivePreview from "@/components/QRLivePreview";
import QRStylePanel, { type DownloadSize } from "@/components/QRStylePanel";
import { clutchConnectProfileUrl, normalizeUrl } from "@/lib/qr";
import {
  DEFAULT_QR_DESIGN,
  legacyCornerStyle,
  legacyDotStyle,
  type QrBodyPattern,
  type QrCanvasShape,
  type QrColorMode,
  type QrEyeCenterShape,
  type QrEyeFrameShape,
} from "@/lib/qr-design";
import styles from "./QRCodeCreateStudioForm.module.css";

type DestinationMode = "url" | "connect_profile";

const STEPS = [
  { label: "Destination", helper: "Name, link, and print piece" },
  { label: "Design", helper: "Shape, eyes, colors, and logo" },
  { label: "Tracking", helper: "Optional campaign details" },
  { label: "Review", helper: "Confirm and create" },
] as const;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function appendCampaignParams({
  url,
  campaignName,
  printPiece,
  owner,
  notes,
  placement,
}: {
  url: string;
  campaignName: string;
  printPiece?: string;
  owner?: string;
  notes?: string;
  placement?: string;
}) {
  const parsed = new URL(normalizeUrl(url));
  parsed.searchParams.set("utm_source", slugify(printPiece || "print") || "print");
  parsed.searchParams.set("utm_medium", "print");
  parsed.searchParams.set("utm_campaign", slugify(campaignName) || "print-campaign");

  const contentParts = [owner?.trim(), notes?.trim()].filter(Boolean);
  if (contentParts.length) parsed.searchParams.set("utm_content", contentParts.join(" | "));
  if (placement?.trim()) parsed.searchParams.set("utm_term", slugify(placement) || placement.trim());
  return parsed.toString();
}

type QRCodeCreateStudioFormProps = {
  used: number;
  limit: number;
  planName?: string;
  isLocked?: boolean;
  lockMessage?: string;
  connectProfiles?: Array<{
    id: string;
    slug: string;
    business_name?: string | null;
    contact_name?: string | null;
  }>;
};

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
  const [previewOpen, setPreviewOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [destinationMode, setDestinationMode] = useState<DestinationMode>("url");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [printPiece, setPrintPiece] = useState("");

  const [qrShape, setQrShape] = useState<QrCanvasShape>(DEFAULT_QR_DESIGN.qrShape);
  const [bodyPattern, setBodyPattern] = useState<QrBodyPattern>(DEFAULT_QR_DESIGN.bodyPattern);
  const [eyeFrameShape, setEyeFrameShape] = useState<QrEyeFrameShape>(DEFAULT_QR_DESIGN.eyeFrameShape);
  const [eyeCenterShape, setEyeCenterShape] = useState<QrEyeCenterShape>(DEFAULT_QR_DESIGN.eyeCenterShape);
  const [colorMode, setColorMode] = useState<QrColorMode>(DEFAULT_QR_DESIGN.colorMode);
  const [foregroundColor, setForegroundColor] = useState(DEFAULT_QR_DESIGN.bodyColor);
  const [gradientEndColor, setGradientEndColor] = useState(DEFAULT_QR_DESIGN.gradientEndColor);
  const [eyeFrameColor, setEyeFrameColor] = useState(DEFAULT_QR_DESIGN.eyeFrameColor);
  const [eyeCenterColor, setEyeCenterColor] = useState(DEFAULT_QR_DESIGN.eyeCenterColor);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_QR_DESIGN.backgroundColor);
  const [outerStrokeEnabled, setOuterStrokeEnabled] = useState(DEFAULT_QR_DESIGN.outerStrokeEnabled);
  const [outerStrokeColor, setOuterStrokeColor] = useState(DEFAULT_QR_DESIGN.outerStrokeColor);
  const [downloadSize, setDownloadSize] = useState<DownloadSize>("print");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>();

  const [usePrintTracking, setUsePrintTracking] = useState(true);
  const [campaignName, setCampaignName] = useState("");
  const [campaignOwner, setCampaignOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [placementNote, setPlacementNote] = useState("");

  const dotStyle = legacyDotStyle(bodyPattern);
  const cornerStyle = legacyCornerStyle(eyeFrameShape);
  const canCreate = !isLocked && used < limit;
  const usesDecorativeStyle =
    qrShape === "circle" ||
    !["square", "circle", "rounded"].includes(bodyPattern) ||
    eyeFrameShape === "octagon" ||
    eyeFrameShape === "diamond" ||
    eyeCenterShape === "star";

  useEffect(() => {
    if (!logoFile) {
      setPreviewLogoUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewLogoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  const selectedProfile = useMemo(() => {
    if (!selectedProfileId) return null;
    return connectProfiles.find((item) => item.id === selectedProfileId) || null;
  }, [connectProfiles, selectedProfileId]);

  const baseDestinationUrl = useMemo(() => {
    if (destinationMode === "connect_profile") {
      return selectedProfile ? clutchConnectProfileUrl(selectedProfile.slug) : "";
    }
    const raw = destinationUrl.trim();
    if (!raw) return "";
    try {
      const normalized = normalizeUrl(raw);
      new URL(normalized);
      return normalized;
    } catch {
      return "";
    }
  }, [destinationMode, destinationUrl, selectedProfile]);

  const finalUrl = useMemo(() => {
    if (!baseDestinationUrl) return "";
    if (!usePrintTracking) return baseDestinationUrl;
    try {
      return appendCampaignParams({
        url: baseDestinationUrl,
        campaignName: campaignName || name || "print-campaign",
        printPiece,
        owner: campaignOwner,
        notes,
        placement: placementNote,
      });
    } catch {
      return "";
    }
  }, [baseDestinationUrl, usePrintTracking, campaignName, name, printPiece, campaignOwner, notes, placementNote]);

  const destinationSummary = destinationMode === "connect_profile"
    ? selectedProfile
      ? `${selectedProfile.business_name || selectedProfile.contact_name || selectedProfile.slug} • ${selectedProfile.slug}`
      : "Select a Clutch Connect profile"
    : destinationUrl.trim() || "Add a destination URL";

  const printPieceLabel = printPiece.trim() || "Not specified";
  const trackingSummary = useMemo(() => {
    if (!usePrintTracking) return "Tracking disabled";
    const parts = [campaignName || name || "Campaign name pending", campaignOwner, placementNote]
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" • ") : "Campaign name pending";
  }, [campaignName, campaignOwner, placementNote, name, usePrintTracking]);

  const scanSafetyLabel = !baseDestinationUrl
    ? "Needs destination"
    : usesDecorativeStyle
      ? "Test scan"
      : downloadSize === "print"
        ? "Print ready"
        : "Preview ready";

  function focusEditor() {
    window.setTimeout(() => document.getElementById(editorId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function validateDestinationStep() {
    if (!name.trim()) {
      setError("Add a clear QR name so you can identify it later.");
      return false;
    }
    if (destinationMode === "connect_profile") {
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
        setError("Enter a complete destination URL, such as https://example.com.");
        return false;
      }
    }
    setError(null);
    return true;
  }

  function changeStep(nextStep: number) {
    const bounded = Math.max(0, Math.min(STEPS.length - 1, nextStep));
    if (bounded > activeStep && bounded > 0 && !validateDestinationStep()) {
      setActiveStep(0);
      focusEditor();
      return;
    }
    setError(null);
    setActiveStep(bounded);
    focusEditor();
  }

  function advanceStep() {
    if (activeStep === 0 && !validateDestinationStep()) return;
    changeStep(activeStep + 1);
  }

  function scrollToPreview() {
    setPreviewOpen(true);
    window.setTimeout(() => document.getElementById(previewId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
    if (!finalUrl) {
      setError("Enter a complete destination URL before creating the QR code.");
      setActiveStep(0);
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("destination_url", finalUrl);
      formData.append("qr_type", destinationMode);
      if (selectedProfileId) formData.append("profile_id", selectedProfileId);
      formData.append("foreground_color", foregroundColor);
      formData.append("background_color", backgroundColor);
      formData.append("dot_style", dotStyle);
      formData.append("corner_style", cornerStyle);
      formData.append("qr_shape", qrShape);
      formData.append("body_pattern", bodyPattern);
      formData.append("eye_frame_shape", eyeFrameShape);
      formData.append("eye_center_shape", eyeCenterShape);
      formData.append("color_mode", colorMode);
      formData.append("gradient_end_color", gradientEndColor);
      formData.append("eye_frame_color", eyeFrameColor);
      formData.append("eye_center_color", eyeCenterColor);
      formData.append("outer_stroke_enabled", String(outerStrokeEnabled));
      formData.append("outer_stroke_color", outerStrokeColor);
      formData.append("download_size", downloadSize);
      formData.append("print_piece", printPiece.trim());
      formData.append("tracking_enabled", String(usePrintTracking));
      formData.append("campaign_name", (campaignName || name).trim());
      formData.append("campaign_owner", campaignOwner.trim());
      formData.append("placement", placementNote.trim());
      formData.append("notes", notes.trim());
      if (logoFile) formData.append("logo", logoFile);

      const response = await fetch("/api/qr/create", { method: "POST", body: formData, credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Failed to create QR code. Please try again.");
        setIsSaving(false);
        return;
      }
      router.push("/portal/qr");
      router.refresh();
    } catch (submitError) {
      console.error("[QRCodeCreateStudioForm] QR creation failed", submitError);
      setError("Unexpected error while creating QR code. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <section className={styles.studioIntro}>
        <div>
          <span className={styles.studioKicker}>Guided QR Builder</span>
          <h2>Create your code in four quick steps.</h2>
          <p>Only the name and destination are required. Design and tracking are optional.</p>
        </div>
        <div className={styles.accountSummary} aria-label="Current QR plan and usage">
          <span>{planName}</span><strong>{used}/{limit} codes used</strong>
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
              <span className={styles.stepCopy}><strong>{step.label}</strong><small>{step.helper}</small></span>
            </button>
          );
        })}
      </nav>

      <div className={styles.studioGrid}>
        <details className={styles.previewRail} id={previewId} open={previewOpen} onToggle={(event) => setPreviewOpen(event.currentTarget.open)}>
          <summary className={styles.previewSummary}><span><Eye size={17} /> Live preview</span><strong>{scanSafetyLabel}</strong></summary>
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
              destinationTypeLabel={destinationMode === "connect_profile" ? "Clutch Connect" : "Website"}
              destinationPreview={destinationSummary}
              printPieceLabel={printPieceLabel}
              trackingPreview={trackingSummary}
              downloadSize={downloadSize}
              canCreate={canCreate && Boolean(finalUrl) && Boolean(name.trim())}
              error={error}
              qrShape={qrShape}
              bodyPattern={bodyPattern}
              eyeFrameShape={eyeFrameShape}
              eyeCenterShape={eyeCenterShape}
              colorMode={colorMode}
              gradientEndColor={gradientEndColor}
              eyeFrameColor={eyeFrameColor}
              eyeCenterColor={eyeCenterColor}
              outerStrokeEnabled={outerStrokeEnabled}
              outerStrokeColor={outerStrokeColor}
            />
          </div>
        </details>

        <section className={styles.editorColumn} id={editorId}>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          {activeStep === 0 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div><span className={styles.stepNumber}>Step 1 of 4</span><h2>Where should this QR code go?</h2><p>Name the code, add its destination, and describe where it will be used.</p></div>
                <span className={styles.stepPill}>{destinationMode === "connect_profile" ? "Profile" : "Website"}</span>
              </div>

              {connectProfiles.length ? (
                <div className={styles.destinationMode} role="radiogroup" aria-label="Destination type">
                  <button type="button" className={destinationMode === "url" ? styles.destinationModeActive : ""} onClick={() => { setDestinationMode("url"); setError(null); }} aria-pressed={destinationMode === "url"}>
                    <Link2 size={18} /><span><strong>Website</strong><small>Send scans to any URL</small></span>
                  </button>
                  <button type="button" className={destinationMode === "connect_profile" ? styles.destinationModeActive : ""} onClick={() => { setDestinationMode("connect_profile"); setError(null); }} aria-pressed={destinationMode === "connect_profile"}>
                    <UserRound size={18} /><span><strong>Clutch Connect</strong><small>Open a digital profile</small></span>
                  </button>
                </div>
              ) : null}

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>QR Name</span>
                  <input type="text" className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Summer postcard campaign" maxLength={100} disabled={isSaving} autoFocus />
                  <span className={styles.hint}>Customers never see this. Use a name you will recognize in analytics.</span>
                </label>
                {destinationMode === "connect_profile" ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Clutch Connect Profile</span>
                    <select className={styles.select} value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} disabled={isSaving} required>
                      <option value="">Select profile</option>
                      {connectProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.business_name || profile.contact_name || profile.slug} ({profile.slug})</option>)}
                    </select>
                    <span className={styles.hint}>This QR will open the selected digital profile.</span>
                  </label>
                ) : (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Destination URL</span>
                    <input type="url" className={styles.input} value={destinationUrl} onChange={(event) => { setDestinationUrl(event.target.value); if (error) setError(null); }} placeholder="https://yourwebsite.com/offer" disabled={isSaving} inputMode="url" />
                    <span className={styles.hint}>You can change this destination later without reprinting the QR code.</span>
                  </label>
                )}
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.fieldLabel}>Print Piece or Placement</span>
                  <input type="text" className={styles.input} value={printPiece} onChange={(event) => setPrintPiece(event.target.value)} placeholder="Postcard, flyer, yard sign, front counter display..." maxLength={100} disabled={isSaving} />
                  <span className={styles.hint}>Optional. Type the exact item or location to organize reporting.</span>
                </label>
              </div>
              <div className={styles.destinationMeta}>
                <article><span>Destination</span><strong>{destinationSummary}</strong></article>
                <article><span>Print piece</span><strong>{printPieceLabel}</strong></article>
              </div>
            </section>
          ) : null}

          {activeStep === 1 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div><span className={styles.stepNumber}>Step 2 of 4</span><h2>Design your QR code.</h2><p>Shape, body modules, finder eyes, colors, gradients, stroke, logo, and output size.</p></div>
                <span className={styles.stepPill}>{scanSafetyLabel}</span>
              </div>
              <QRStylePanel
                foregroundColor={foregroundColor}
                onForegroundColorChange={setForegroundColor}
                backgroundColor={backgroundColor}
                onBackgroundColorChange={setBackgroundColor}
                dotStyle={dotStyle}
                onDotStyleChange={() => undefined}
                cornerStyle={cornerStyle}
                onCornerStyleChange={() => undefined}
                downloadSize={downloadSize}
                onDownloadSizeChange={setDownloadSize}
                logoFile={logoFile}
                onLogoFileChange={setLogoFile}
                qrShape={qrShape}
                onQrShapeChange={setQrShape}
                bodyPattern={bodyPattern}
                onBodyPatternChange={setBodyPattern}
                eyeFrameShape={eyeFrameShape}
                onEyeFrameShapeChange={setEyeFrameShape}
                eyeCenterShape={eyeCenterShape}
                onEyeCenterShapeChange={setEyeCenterShape}
                colorMode={colorMode}
                onColorModeChange={setColorMode}
                gradientEndColor={gradientEndColor}
                onGradientEndColorChange={setGradientEndColor}
                eyeFrameColor={eyeFrameColor}
                onEyeFrameColorChange={setEyeFrameColor}
                eyeCenterColor={eyeCenterColor}
                onEyeCenterColorChange={setEyeCenterColor}
                outerStrokeEnabled={outerStrokeEnabled}
                onOuterStrokeEnabledChange={setOuterStrokeEnabled}
                outerStrokeColor={outerStrokeColor}
                onOuterStrokeColorChange={setOuterStrokeColor}
              />
            </section>
          ) : null}

          {activeStep === 2 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div><span className={styles.stepNumber}>Step 3 of 4</span><h2>Add campaign tracking.</h2><p>These optional details make reports easier to understand later.</p></div>
                <label className={styles.toggle}><input type="checkbox" checked={usePrintTracking} onChange={(event) => setUsePrintTracking(event.target.checked)} disabled={isSaving} /><span>{usePrintTracking ? "Enabled" : "Disabled"}</span></label>
              </div>
              {usePrintTracking ? (
                <div className={styles.trackingFields}>
                  <label className={styles.field}><span className={styles.fieldLabel}>Campaign Name</span><input type="text" className={styles.input} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder={name || "Summer campaign 2026"} disabled={isSaving} /></label>
                  <label className={styles.field}><span className={styles.fieldLabel}>Team Member or Owner</span><input type="text" className={styles.input} value={campaignOwner} onChange={(event) => setCampaignOwner(event.target.value)} placeholder="Jane — Sales" disabled={isSaving} /></label>
                  <label className={styles.field}><span className={styles.fieldLabel}>Placement</span><input type="text" className={styles.input} value={placementNote} onChange={(event) => setPlacementNote(event.target.value)} placeholder="Front counter, mail route, event table" disabled={isSaving} /></label>
                  <label className={styles.field}><span className={styles.fieldLabel}>Internal Notes</span><input type="text" className={styles.input} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Version B, front side, July promotion" disabled={isSaving} /></label>
                </div>
              ) : <div className={styles.emptyTracking}>The QR will still count scans. Campaign tags and placement details will not be attached.</div>}
            </section>
          ) : null}

          {activeStep === 3 ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <div><span className={styles.stepNumber}>Step 4 of 4</span><h2>Review and create.</h2><p>Confirm the destination and design before publishing.</p></div>
                <span className={styles.stepPill}>{canCreate && finalUrl ? "Ready" : "Needs attention"}</span>
              </div>
              <div className={styles.reviewGrid}>
                <article><span>QR Name</span><strong>{name || "Not added"}</strong></article>
                <article><span>Destination</span><strong>{destinationSummary}</strong></article>
                <article><span>Print Piece</span><strong>{printPieceLabel}</strong></article>
                <article><span>Design</span><strong>{qrShape === "circle" ? "Circle" : "Square"} · {bodyPattern.replace(/-/g, " ")} · {eyeFrameShape} eyes</strong></article>
                <article><span>Tracking</span><strong>{usePrintTracking ? trackingSummary : "Disabled"}</strong></article>
                <article><span>Export Size</span><strong>{downloadSize === "print" ? "2400 × 2400" : downloadSize === "card" ? "600 × 600" : "512 × 512"}</strong></article>
              </div>
              <div className={styles.reviewNotice}><Check size={18} /><div><strong>Your destination can be edited later.</strong><span>The printed QR image stays the same while Clutch redirects scans to the updated URL.</span></div></div>
            </section>
          ) : null}

          <div className={styles.editorActions}>
            <button type="button" className={styles.previewButton} onClick={scrollToPreview}><Eye size={17} />Preview</button>
            <div className={styles.primaryActions}>
              {activeStep > 0 ? <button type="button" className={styles.backButton} onClick={() => changeStep(activeStep - 1)} disabled={isSaving}><ChevronLeft size={18} />Back</button> : null}
              {activeStep < STEPS.length - 1 ? (
                <button type="button" className={styles.nextButton} onClick={advanceStep} disabled={isSaving}>Continue<ChevronRight size={18} /></button>
              ) : (
                <button type="submit" className={styles.createButton} disabled={!canCreate || !finalUrl || !name.trim() || isSaving}>{isSaving ? "Creating..." : "Create QR"}</button>
              )}
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
