"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, LoaderCircle, Save, Send } from "lucide-react";
import StyledQRPreview from "@/components/StyledQRPreview";

type OrderQrSetupProps = {
  orderId: string;
  shortUrl: string;
  canEdit: boolean;
  canUploadLogo: boolean;
  proofApproved: boolean;
  submittedRevision: number | null;
  submittedAt: string | null;
  currentFileId: string | null;
  initialPlacement: {
    placementMode: "clutch_choice" | "customer_preference";
    artworkSide: "front" | "back" | "either" | "not_applicable";
    preferredPosition: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "centered" | "custom" | "";
    placementInstructions: string;
    preferredPrintSize: string;
  };
  initial: {
    codeName: string;
    campaignName: string;
    destinationUrl: string;
    foregroundColor: string;
    backgroundColor: string;
    dotStyle: "square" | "rounded" | "dots";
    cornerStyle: "square" | "dot" | "extra-rounded";
    frameStyle: "none" | "outline" | "label";
    frameColor: string;
    frameLabel: string;
    logoUrl?: string | null;
  };
};

export default function OrderQrSetup(props: OrderQrSetupProps) {
  const router = useRouter();
  const [design, setDesign] = useState(props.initial);
  const [placement, setPlacement] = useState(props.initialPlacement);
  const [logo, setLogo] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"validate" | "draft" | "submit" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const logoPreview = useMemo(() => logo ? URL.createObjectURL(logo) : design.logoUrl || undefined, [logo, design.logoUrl]);
  const safeTestUrl = useMemo(() => {
    try {
      const parsed = new URL(design.destinationUrl);
      return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.toString() : null;
    } catch { return null; }
  }, [design.destinationUrl]);

  useEffect(() => () => {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  useEffect(() => {
    if (!confirming) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setConfirming(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirming]);

  function update<K extends keyof typeof design>(key: K, value: (typeof design)[K]) {
    setDesign((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  async function perform(action: "validate" | "draft" | "submit") {
    setBusy(action);
    setNotice(null);
    try {
      if (action === "submit" && !idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      const body = new FormData();
      body.set("action", action);
      body.set("design", JSON.stringify(design));
      body.set("placement", JSON.stringify(placement));
      if (logo) body.set("logo", logo);
      if (idempotencyKey.current) body.set("idempotencyKey", idempotencyKey.current);
      const response = await fetch(`/api/print-orders/${props.orderId}/qr-artwork`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "QR setup could not be saved.");
      setNotice({ tone: "success", text: result.message || (action === "validate" ? "Destination is valid." : "QR setup saved.") });
      if (action === "draft" && result.design) {
        setDesign(result.design);
        setLogo(null);
      }
      if (action === "submit") {
        idempotencyKey.current = null;
        setConfirming(false);
        router.refresh();
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "QR setup could not be saved." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="order-qr-setup" id="qr-setup" aria-labelledby="order-qr-setup-title">
      <div className="unified-section-heading">
        <div><p className="unified-kicker">QR Setup</p><h2 id="order-qr-setup-title">Set up QR for artwork</h2></div>
        {props.submittedRevision ? <span className="order-qr-status"><CheckCircle2 size={16} /> Submitted · Revision {props.submittedRevision}</span> : <span className="order-qr-status is-draft">Setup required</span>}
      </div>
      <p className="order-qr-intro">Configure the destination, scan-safe appearance, and placement preference for this print item. Saving a draft updates the working code without changing a submitted revision.</p>

      <div className="order-qr-layout">
        <form className="order-qr-form" onSubmit={(event) => { event.preventDefault(); void perform("draft"); }}>
          <div className="order-qr-field-grid">
            <label><span>Customer-facing code name</span><input value={design.codeName} onChange={(event) => update("codeName", event.target.value)} disabled={!props.canEdit} maxLength={80} required /></label>
            <label><span>Campaign name</span><input value={design.campaignName} onChange={(event) => update("campaignName", event.target.value)} disabled={!props.canEdit} maxLength={100} required /></label>
          </div>
          <label><span>Destination URL</span><div className="order-qr-url-row"><input type="url" value={design.destinationUrl} onChange={(event) => update("destinationUrl", event.target.value)} disabled={!props.canEdit} placeholder="https://example.com" required />{safeTestUrl ? <a href={safeTestUrl} target="_blank" rel="noreferrer" className="order-qr-test-link"><ExternalLink size={16} /> Test</a> : <span className="order-qr-test-link" aria-disabled="true">Add valid URL</span>}</div></label>
          <div className="order-qr-field-grid">
            <label><span>QR color</span><input type="color" value={design.foregroundColor} onChange={(event) => update("foregroundColor", event.target.value)} disabled={!props.canEdit} /></label>
            <label><span>Background color</span><input type="color" value={design.backgroundColor} onChange={(event) => update("backgroundColor", event.target.value)} disabled={!props.canEdit} /></label>
            <label><span>Module style</span><select value={design.dotStyle} onChange={(event) => update("dotStyle", event.target.value as typeof design.dotStyle)} disabled={!props.canEdit}><option value="square">Square</option><option value="rounded">Rounded</option><option value="dots">Dots</option></select></label>
            <label><span>Finder pattern</span><select value={design.cornerStyle} onChange={(event) => update("cornerStyle", event.target.value as typeof design.cornerStyle)} disabled={!props.canEdit}><option value="square">Square</option><option value="dot">Dot</option><option value="extra-rounded">Extra rounded</option></select></label>
            <label><span>Frame</span><select value={design.frameStyle} onChange={(event) => update("frameStyle", event.target.value as typeof design.frameStyle)} disabled={!props.canEdit}><option value="none">No frame</option><option value="outline">Outline</option><option value="label">Frame and label</option></select></label>
            <label><span>Frame color</span><input type="color" value={design.frameColor} onChange={(event) => update("frameColor", event.target.value)} disabled={!props.canEdit || design.frameStyle === "none"} /></label>
          </div>
          {design.frameStyle === "label" ? <label><span>Frame label</span><input value={design.frameLabel} onChange={(event) => update("frameLabel", event.target.value)} disabled={!props.canEdit} maxLength={40} /></label> : null}
          {props.canUploadLogo ? <label><span>Logo (optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0] || null)} disabled={!props.canEdit} /><small>PNG, JPG, or WEBP up to 1 MB. High error correction is applied automatically.</small></label> : null}

          <fieldset className="order-qr-placement">
            <legend>Placement</legend>
            <label><input type="radio" name="placement-mode" checked={placement.placementMode === "clutch_choice"} onChange={() => setPlacement({ placementMode: "clutch_choice", artworkSide: "not_applicable", preferredPosition: "", placementInstructions: "", preferredPrintSize: "" })} disabled={!props.canEdit} /> Let Clutch choose the best placement</label>
            <label><input type="radio" name="placement-mode" checked={placement.placementMode === "customer_preference"} onChange={() => setPlacement((current) => ({ ...current, placementMode: "customer_preference", artworkSide: current.artworkSide === "not_applicable" ? "either" : current.artworkSide, preferredPosition: current.preferredPosition || "centered" }))} disabled={!props.canEdit} /> I have a placement preference</label>
            {placement.placementMode === "customer_preference" ? <div className="order-qr-field-grid">
              <label><span>Artwork side</span><select value={placement.artworkSide} onChange={(event) => setPlacement((current) => ({ ...current, artworkSide: event.target.value as typeof current.artworkSide }))} disabled={!props.canEdit}><option value="front">Front</option><option value="back">Back</option><option value="either">Either</option></select></label>
              <label><span>Preferred position</span><select value={placement.preferredPosition} onChange={(event) => setPlacement((current) => ({ ...current, preferredPosition: event.target.value as typeof current.preferredPosition }))} disabled={!props.canEdit}><option value="top_left">Top left</option><option value="top_right">Top right</option><option value="bottom_left">Bottom left</option><option value="bottom_right">Bottom right</option><option value="centered">Centered</option><option value="custom">Custom</option></select></label>
              <label><span>Preferred print size (optional)</span><input value={placement.preferredPrintSize} onChange={(event) => setPlacement((current) => ({ ...current, preferredPrintSize: event.target.value }))} maxLength={100} disabled={!props.canEdit} placeholder='Example: 1.5" square' /></label>
              <label className="order-qr-placement-instructions"><span>Placement instructions</span><textarea value={placement.placementInstructions} onChange={(event) => setPlacement((current) => ({ ...current, placementInstructions: event.target.value }))} maxLength={2000} disabled={!props.canEdit} placeholder="Tell the artwork team what should be kept clear or aligned." /></label>
            </div> : null}
          </fieldset>

          <p className="order-qr-explanation">We’ll place this QR into your design and send you a complete artwork proof showing its final size and position. Nothing will be printed until you approve that proof.</p>

          {notice ? <p className={`order-qr-notice is-${notice.tone}`} role="status" aria-live="polite">{notice.text}</p> : null}
          {!props.canEdit ? <p className="order-qr-notice is-error">Your protected editing access has ended. The submitted artwork asset and printed redirect remain available.</p> : null}
          {props.proofApproved ? <p className="order-qr-notice">The proof is approved, so QR artwork revisions are locked.</p> : null}
          <div className="order-qr-actions">
            <button type="button" className="btn ghost" onClick={() => void perform("validate")} disabled={!props.canEdit || busy !== null}>{busy === "validate" ? <LoaderCircle className="spin" size={17} /> : <ExternalLink size={17} />} Validate destination</button>
            <button type="submit" className="btn secondary" disabled={!props.canEdit || busy !== null}>{busy === "draft" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Save draft</button>
            <button type="button" className="btn primary" onClick={() => setConfirming(true)} disabled={!props.canEdit || props.proofApproved || busy !== null}>{busy === "submit" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Send QR to Artwork</button>
          </div>
        </form>

        <aside className="order-qr-preview" aria-label="Live scan-safe QR preview">
          <span className="order-qr-preview-label">Live scan-safe preview</span>
          <StyledQRPreview url={props.shortUrl} foregroundColor={design.foregroundColor} backgroundColor={design.backgroundColor} dotStyle={design.dotStyle} cornerStyle={design.cornerStyle} logoUrl={logoPreview} showExportMenu={false} />
          <strong>{design.codeName || "Printed Clutch Code"}</strong>
          <small>The short URL and QR slug are permanent. Destination changes do not require reprinting.</small>
          {props.currentFileId ? <a className="btn ghost" href={`/api/print-order-files/${props.currentFileId}`}>View submitted QR asset</a> : null}
          {props.submittedAt ? <small>Submitted {new Date(props.submittedAt).toLocaleString()}</small> : null}
        </aside>
      </div>
      {confirming ? <div className="order-qr-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setConfirming(false); }}>
        <div className="order-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="send-qr-dialog-title">
          <h3 id="send-qr-dialog-title">Send this QR to the artwork team?</h3>
          <p>Clutch Print Shop will use this QR design and your placement preferences to prepare your complete artwork proof. You will review the QR’s final size and position before anything goes to production.</p>
          {logo ? <p className="order-qr-notice is-error">Save your draft first so the selected logo is included.</p> : null}
          <div className="order-qr-actions">
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)} disabled={busy !== null} autoFocus>Continue Editing</button>
            <button type="button" className="btn primary" onClick={() => void perform("submit")} disabled={busy !== null || Boolean(logo)}>{busy === "submit" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Send to Artwork</button>
          </div>
        </div>
      </div> : null}
    </section>
  );
}
