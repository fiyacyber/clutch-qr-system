"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Contact, Globe2, Palette, Send } from "lucide-react";
import QRTypeSelector, { type QRType } from "@/components/QRTypeSelector";
import QRLivePreview from "@/components/QRLivePreview";
import QRStylePanel, { type DownloadSize, type ThemePreset } from "@/components/QRStylePanel";
import { clutchConnectProfileUrl, normalizeUrl } from "@/lib/qr";
import styles from "./QRCodeCreateStudioForm.module.css";

type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerStyle = "square" | "dot" | "extra-rounded";
type DestinationType = "url" | "connect_profile";
type StudioStep = "destination" | "customize" | "distribute";

type QRCodeCreateStudioFormProps = {
  used: number;
  limit: number;
  isLocked?: boolean;
  lockMessage?: string;
  connectProfiles?: Array<{ id: string; slug: string; business_name?: string | null; contact_name?: string | null }>;
};

const DISTRIBUTION_TO_ASSET: Record<QRType, string> = {
  flyers: "flyer",
  business_cards: "standard_business_card",
  brochures: "brochure",
  postcards: "direct_mail",
  door_hangers: "door_hanger",
  yard_signs: "yard_sign",
};

const DISTRIBUTION_LABELS: Record<QRType, string> = {
  flyers: "Flyers",
  business_cards: "Business cards",
  brochures: "Brochures",
  postcards: "Direct mail",
  door_hangers: "Door hangers",
  yard_signs: "Signs and banners",
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function appendCampaignParams({
  url,
  campaignName,
  distribution,
  owner,
  pieceDetail,
  placement,
}: {
  url: string;
  campaignName: string;
  distribution: QRType;
  owner?: string;
  pieceDetail?: string;
  placement?: string;
}) {
  const parsed = new URL(normalizeUrl(url));
  parsed.searchParams.set("utm_source", DISTRIBUTION_TO_ASSET[distribution]);
  parsed.searchParams.set("utm_medium", "print");
  parsed.searchParams.set("utm_campaign", slugify(campaignName) || `clutch-${distribution.replace(/_/g, "-")}`);
  const contentParts = [owner?.trim(), pieceDetail?.trim()].filter(Boolean);
  if (contentParts.length) parsed.searchParams.set("utm_content", contentParts.join(" | "));
  if (placement?.trim()) parsed.searchParams.set("utm_term", slugify(placement) || placement.trim());
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
  const [activeStep, setActiveStep] = useState<StudioStep>("destination");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("url");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [foregroundColor, setForegroundColor] = useState("#384862");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("square");
  const [theme, setTheme] = useState<ThemePreset>("default");
  const [downloadSize, setDownloadSize] = useState<DownloadSize>("print");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>();
  const [distribution, setDistribution] = useState<QRType>("business_cards");
  const [useCampaignTracking, setUseCampaignTracking] = useState(true);
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
    setForegroundColor(presets[theme].fg);
    setBackgroundColor(presets[theme].bg);
  }, [theme]);

  useEffect(() => {
    if (!logoFile) {
      setPreviewLogoUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewLogoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  const selectedProfile = useMemo(
    () => connectProfiles.find((item) => item.id === selectedProfileId) || null,
    [connectProfiles, selectedProfileId]
  );

  const baseDestination = useMemo(() => {
    if (destinationType === "connect_profile") return selectedProfile ? clutchConnectProfileUrl(selectedProfile.slug) : "";
    return destinationUrl.trim() ? normalizeUrl(destinationUrl) : "";
  }, [destinationType, selectedProfile, destinationUrl]);

  const finalUrl = useMemo(() => {
    if (!baseDestination) return "";
    if (!useCampaignTracking) return baseDestination;
    return appendCampaignParams({
      url: baseDestination,
      campaignName: campaignName || name || "clutch-campaign",
      distribution,
      owner: campaignOwner,
      pieceDetail,
      placement: placementNote,
    });
  }, [baseDestination, useCampaignTracking, campaignName, name, distribution, campaignOwner, pieceDetail, placementNote]);

  const destinationSummary = destinationType === "connect_profile"
    ? selectedProfile
      ? `${selectedProfile.business_name || selectedProfile.contact_name || selectedProfile.slug} · ${selectedProfile.slug}`
      : "Select a Clutch Connect profile"
    : destinationUrl.trim() || "Add a website destination";

  const trackingSummary = useCampaignTracking
    ? `${campaignName || name || "Campaign name pending"} · ${DISTRIBUTION_LABELS[distribution]}`
    : `${DISTRIBUTION_LABELS[distribution]} · campaign tags off`;

  function validate() {
    if (isLocked) return lockMessage || "Your Clutch Codes subscription is currently locked.";
    if (used >= limit) return "Your Clutch Code allowance is full. Upgrade or archive an unused code before creating another.";
    if (!name.trim()) return "Give this Clutch Code a name.";
    if (destinationType === "connect_profile" && !selectedProfileId) return "Select a Clutch Connect profile.";
    if (destinationType === "url" && !destinationUrl.trim()) return "Add the website this Clutch Code should open.";
    try {
      const parsed = new URL(finalUrl || baseDestination);
      if (!["http:", "https:"].includes(parsed.protocol)) return "Use an HTTP or HTTPS destination.";
    } catch {
      return "Enter a valid website destination.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setActiveStep(validationError.toLowerCase().includes("name") || validationError.toLowerCase().includes("destination") || validationError.toLowerCase().includes("profile") ? "destination" : activeStep);
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("destination_url", finalUrl || baseDestination);
      formData.append("qr_type", destinationType);
      if (selectedProfileId) formData.append("profile_id", selectedProfileId);
      formData.append("foreground_color", foregroundColor);
      formData.append("background_color", backgroundColor);
      formData.append("dot_style", dotStyle);
      formData.append("corner_style", cornerStyle);
      formData.append("theme", theme);
      formData.append("download_size", downloadSize);
      if (logoFile) formData.append("logo", logoFile);

      const response = await fetch("/api/qr/create", { method: "POST", body: formData, credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Clutch Code creation failed.");
        setIsSaving(false);
        return;
      }
      router.push(data.qr?.id ? `/portal/qr/${data.qr.id}/edit` : "/portal/qr");
      router.refresh();
    } catch (creationError) {
      console.error(creationError);
      setError("Clutch Code creation failed. Try again.");
      setIsSaving(false);
    }
  }

  const steps: Array<{ key: StudioStep; number: string; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "destination", number: "1", label: "Create", icon: Send },
    { key: "customize", number: "2", label: "Customize", icon: Palette },
    { key: "distribute", number: "3", label: "Distribute", icon: Globe2 },
  ];

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <section className={styles.flowTabs} aria-label="Clutch Code creation steps">
        {steps.map(({ key, number, label, icon: Icon }) => (
          <button key={key} type="button" className={activeStep === key ? styles.activeFlowTab : ""} onClick={() => setActiveStep(key)}>
            <span>{number}</span><Icon size={17} /><strong>{label}</strong>
          </button>
        ))}
      </section>

      <div className={styles.builderGrid}>
        <section className={styles.workspace}>
          {activeStep === "destination" ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}><div><span className={styles.stepNumber}>Step 1</span><h2>What should this Clutch Code do?</h2></div><span className={styles.stepPill}>{destinationType === "connect_profile" ? "Clutch Connect" : "Website"}</span></div>
              <div className={styles.destinationChoices}>
                <button type="button" className={destinationType === "url" ? styles.activeDestination : ""} onClick={() => setDestinationType("url")}><Globe2 size={22} /><strong>Website</strong><small>Send customers to any HTTPS page.</small></button>
                <button type="button" className={destinationType === "connect_profile" ? styles.activeDestination : ""} onClick={() => setDestinationType("connect_profile")}><Contact size={22} /><strong>Clutch Connect</strong><small>Open your digital profile or smart-card destination.</small></button>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}><span className={styles.fieldLabel}>Clutch Code name</span><input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Summer postcard campaign" maxLength={100} disabled={isSaving} /><span className={styles.hint}>Use a name you will recognize in Analytics and Print Orders.</span></label>
                {destinationType === "connect_profile" ? (
                  <label className={styles.field}><span className={styles.fieldLabel}>Clutch Connect profile</span><select className={styles.select} value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} disabled={isSaving}><option value="">Select profile</option>{connectProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.business_name || profile.contact_name || profile.slug}</option>)}</select><span className={styles.hint}>The code will always open the current published version of this profile.</span></label>
                ) : (
                  <label className={styles.field}><span className={styles.fieldLabel}>Send people to</span><input type="url" className={styles.input} value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} placeholder="https://example.com/offer" disabled={isSaving} /><span className={styles.hint}>You can update the destination later without reprinting the code.</span></label>
                )}
              </div>
              <div className={styles.destinationMeta}><article><span>Destination</span><strong>{destinationSummary}</strong></article><article><span>Code status</span><strong>{baseDestination ? "Ready" : "Needs destination"}</strong></article><article><span>Dynamic redirect</span><strong>Editable after creation</strong></article></div>
              <button type="button" className={styles.nextButton} onClick={() => setActiveStep("customize")}>Continue to Customize</button>
            </section>
          ) : null}

          {activeStep === "customize" ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}><div><span className={styles.stepNumber}>Step 2</span><h2>Make it recognizable and scan-safe.</h2></div><span className={styles.stepPill}>Live preview</span></div>
              <QRStylePanel theme={theme} onThemeChange={setTheme} foregroundColor={foregroundColor} onForegroundColorChange={setForegroundColor} backgroundColor={backgroundColor} onBackgroundColorChange={setBackgroundColor} dotStyle={dotStyle} onDotStyleChange={setDotStyle} cornerStyle={cornerStyle} onCornerStyleChange={setCornerStyle} downloadSize={downloadSize} onDownloadSizeChange={setDownloadSize} logoFile={logoFile} onLogoFileChange={setLogoFile} />
              <button type="button" className={styles.nextButton} onClick={() => setActiveStep("distribute")}>Continue to Distribute</button>
            </section>
          ) : null}

          {activeStep === "distribute" ? (
            <section className={styles.stepCard}>
              <div className={styles.stepHeader}><div><span className={styles.stepNumber}>Step 3</span><h2>Where will customers see this code?</h2></div><span className={styles.stepPill}>{DISTRIBUTION_LABELS[distribution]}</span></div>
              <QRTypeSelector value={distribution} onChange={setDistribution} />
              <div className={styles.guidanceBox}>
                <strong>Distribution guidance</strong>
                <p><CheckCircle2 size={16} /> Keep a clear margin around the code.</p>
                <p><CheckCircle2 size={16} /> Test-scan at the final printed or displayed size.</p>
                <p><CheckCircle2 size={16} /> Use a clear call-to-action near the code.</p>
              </div>
              <label className={styles.toggle}><input type="checkbox" checked={useCampaignTracking} onChange={(event) => setUseCampaignTracking(event.target.checked)} /><span>Add print campaign tags to the destination</span></label>
              {useCampaignTracking ? <div className={styles.trackingFields}>
                <label className={styles.field}><span className={styles.fieldLabel}>Campaign name</span><input className={styles.input} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder={name || "Summer campaign"} /></label>
                <label className={styles.field}><span className={styles.fieldLabel}>Team member or owner</span><input className={styles.input} value={campaignOwner} onChange={(event) => setCampaignOwner(event.target.value)} placeholder="Jane · Sales" /></label>
                <label className={styles.field}><span className={styles.fieldLabel}>Placement</span><input className={styles.input} value={placementNote} onChange={(event) => setPlacementNote(event.target.value)} placeholder="Bottom-right corner or downtown route" /></label>
                <label className={styles.field}><span className={styles.fieldLabel}>Campaign notes</span><input className={styles.input} value={pieceDetail} onChange={(event) => setPieceDetail(event.target.value)} placeholder="Front side · Version B" /></label>
              </div> : <div className={styles.emptyTracking}>The Clutch Code will still count scans. Campaign UTM tags will not be added to the destination.</div>}
              <div className={styles.reviewGrid}><article><span>Code</span><strong>{name || "Untitled Clutch Code"}</strong></article><article><span>Destination</span><strong>{destinationSummary}</strong></article><article><span>Distribution</span><strong>{DISTRIBUTION_LABELS[distribution]}</strong></article><article><span>Design</span><strong>{theme}</strong></article><article><span>Tracking</span><strong>{useCampaignTracking ? "Campaign tags on" : "Scan tracking only"}</strong></article><article><span>Export</span><strong>{downloadSize}</strong></article></div>
            </section>
          ) : null}
        </section>

        <aside className={styles.previewRail} id="clutch-code-preview">
          <QRLivePreview finalUrl={finalUrl} foregroundColor={foregroundColor} backgroundColor={backgroundColor} dotStyle={dotStyle} cornerStyle={cornerStyle} logoUrl={previewLogoUrl} used={used} limit={limit} isLocked={isLocked} name={name} destinationTypeLabel={destinationType === "connect_profile" ? "Clutch Connect" : "Website"} destinationPreview={destinationSummary} printMockupType={distribution} trackingPreview={trackingSummary} downloadSize={downloadSize} canCreate={canCreate} error={error} />
        </aside>
      </div>

      <div className={styles.bottomBar}>
        <button type="button" className={styles.bottomSecondary} onClick={() => document.getElementById("clutch-code-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Preview</button>
        <button type="submit" className={styles.bottomPrimary} disabled={!canCreate || isSaving}>{isSaving ? "Creating…" : "Create Clutch Code"}</button>
      </div>
    </form>
  );
}
