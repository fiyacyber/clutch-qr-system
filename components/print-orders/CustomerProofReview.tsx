"use client";
/* eslint-disable @next/next/no-img-element -- Private signed proof URLs cannot be fetched by the Next image optimizer with the customer's session. */

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Minus, Plus } from "lucide-react";

type Proof = {
  id: string;
  proofFileId: string;
  revision: number;
  status: string;
  mimeType: string;
  filename: string;
  pageLabels: string[];
  qrPlacementNote: string | null;
  qrDestination: string | null;
  qrRevision: number | null;
  scanValidationStatus: string;
};

const APPROVAL_CONFIRMATION = "I have reviewed the complete artwork, including the QR code’s destination, size, placement, spelling, and design, and approve it for production.";

export default function CustomerProofReview({ orderId, proof }: { orderId: string; proof: Proof | null }) {
  const router = useRouter();
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [approving, setApproving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!approving) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setApproving(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [approving, busy]);
  if (!proof) return <section className="dashboard-card"><h2>Complete artwork proof</h2><p>Your complete artwork proof will appear here when it is ready to review.</p></section>;

  const inlineUrl = `/api/print-order-files/${proof.proofFileId}?inline=1`;
  const canRespond = proof.status === "sent";

  async function transition(action: "approve_proof" | "request_proof_revision", reason = "") {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/print-orders/${orderId}/workflow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Proof response could not be saved.");
    setApproving(false);
    setMessage(action === "approve_proof" ? "Artwork approved for production." : "Changes requested.");
    router.refresh();
  }

  function requestChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
    void transition("request_proof_revision", reason);
  }

  return <section className="dashboard-card proof-review" aria-labelledby="proof-review-title">
    <div className="unified-section-heading">
      <h2 id="proof-review-title">Review the complete artwork</h2>
      <span className="order-qr-status"><CheckCircle2 size={16} /> Revision {proof.revision} · {proof.status.replaceAll("_", " ")}</span>
    </div>
    <div className="proof-review-labels">{proof.pageLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    <div className="proof-review-toolbar" aria-label="Proof zoom controls">
      <button type="button" className="btn ghost" onClick={() => setZoom((value) => Math.max(50, value - 25))} aria-label="Zoom out"><Minus size={16} /></button>
      <output>{zoom}%</output>
      <button type="button" className="btn ghost" onClick={() => setZoom((value) => Math.min(200, value + 25))} aria-label="Zoom in"><Plus size={16} /></button>
      <a className="btn ghost" href={`/api/print-order-files/${proof.proofFileId}`}>Open original</a>
    </div>
    <div className="proof-review-viewport">
      {proof.mimeType === "application/pdf"
        ? <iframe title={`Complete artwork proof revision ${proof.revision}`} src={`${inlineUrl}#zoom=${zoom}`} />
        : <img src={inlineUrl} alt={`Complete artwork proof revision ${proof.revision}`} style={{ width: `${zoom}%` }} />}
    </div>
    <dl className="proof-review-details">
      <div><dt>File</dt><dd>{proof.filename}</dd></div>
      <div><dt>QR placement note</dt><dd>{proof.qrPlacementNote || "No QR placement note supplied."}</dd></div>
      <div><dt>QR destination</dt><dd>{proof.qrDestination ? <a href={proof.qrDestination} target="_blank" rel="noreferrer">{proof.qrDestination}</a> : "No QR is associated with this proof."}</dd></div>
      <div><dt>QR revision used</dt><dd>{proof.qrRevision ? `Revision ${proof.qrRevision}` : "Not applicable"}</dd></div>
      <div><dt>Scan validation</dt><dd>{proof.scanValidationStatus.replaceAll("_", " ")}</dd></div>
    </dl>
    {message ? <p role="status" className="order-qr-notice">{message}</p> : null}
    {canRespond ? <div className="proof-review-actions">
      <form className="admin-form" onSubmit={requestChanges}>
        <label>What should change?<textarea name="reason" required maxLength={2000} /></label>
        <button type="submit" className="btn secondary" disabled={busy}>Request Changes</button>
      </form>
      <button type="button" className="btn primary" disabled={busy} onClick={() => { setConfirmed(false); setApproving(true); }}>Approve Artwork for Production</button>
    </div> : null}
    {approving ? <div className="order-qr-dialog-backdrop" role="presentation">
      <div className="order-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="approve-proof-title">
        <h3 id="approve-proof-title">Approve artwork for production?</h3>
        <label className="proof-approval-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> <span>{APPROVAL_CONFIRMATION}</span></label>
        <div className="order-qr-actions">
          <button type="button" className="btn ghost" onClick={() => setApproving(false)} disabled={busy} autoFocus>Continue Reviewing</button>
          <button type="button" className="btn primary" onClick={() => void transition("approve_proof")} disabled={busy || !confirmed}>Approve Artwork for Production</button>
        </div>
      </div>
    </div> : null}
  </section>;
}
