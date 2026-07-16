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
  const [logo, setLogo] = useState<File | null>(null);
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
      if (logo) body.set("logo", logo);
      if (idempotencyKey.current) body.set("idempotencyKey", idempotencyKey.current);
      const response = await fetch(`/api/print-orders/${props.orderId}/qr-artwork`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "QR setup could not be saved.");
      setNotice({ tone: "success", text: result.message || (action === "validate" ? "Destination is valid." : "QR setup saved.") });
      if (action === "submit") {
        idempotencyKey.current = null;
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
      <p className="order-qr-intro">Configure the destination and scan-safe appearance for this print item. Saving a draft updates the live code. Submitting creates a frozen, versioned SVG for the artwork team.</p>

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

          {notice ? <p className={`order-qr-notice is-${notice.tone}`} role="status" aria-live="polite">{notice.text}</p> : null}
          {!props.canEdit ? <p className="order-qr-notice is-error">Your protected editing access has ended. The submitted artwork asset and printed redirect remain available.</p> : null}
          {props.proofApproved ? <p className="order-qr-notice">The proof is approved, so QR artwork revisions are locked.</p> : null}
          <div className="order-qr-actions">
            <button type="button" className="btn ghost" onClick={() => void perform("validate")} disabled={!props.canEdit || busy !== null}>{busy === "validate" ? <LoaderCircle className="spin" size={17} /> : <ExternalLink size={17} />} Validate destination</button>
            <button type="submit" className="btn secondary" disabled={!props.canEdit || busy !== null}>{busy === "draft" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Save draft</button>
            <button type="button" className="btn primary" onClick={() => void perform("submit")} disabled={!props.canEdit || props.proofApproved || busy !== null}>{busy === "submit" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {props.submittedRevision ? "Submit new revision" : "Submit QR for artwork"}</button>
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
    </section>
  );
}
