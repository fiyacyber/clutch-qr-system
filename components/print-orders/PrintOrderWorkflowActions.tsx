"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrintActorType, PrintFileKind, PrintWorkflowAction } from "@/lib/print-operations";

type Props = {
  orderId: string;
  actorType: PrintActorType;
  workflowState: string;
};

export default function PrintOrderWorkflowActions({ orderId, actorType, workflowState }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>, kind: PrintFileKind) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("file_kind", kind);
    const response = await fetch(`/api/print-orders/${orderId}/files`, { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Upload failed.");
    setMessage("File saved.");
    event.currentTarget.reset();
    router.refresh();
  }

  async function transition(action: PrintWorkflowAction, form?: HTMLFormElement) {
    setBusy(true);
    setMessage("");
    const values = form ? new FormData(form) : null;
    const response = await fetch(`/api/print-orders/${orderId}/workflow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        reason: values?.get("reason") || "",
        supplier: values?.get("supplier") || "",
        supplierOrderId: values?.get("supplier_order_id") || "",
        carrier: values?.get("carrier") || "",
        trackingNumber: values?.get("tracking_number") || "",
        trackingUrl: values?.get("tracking_url") || "",
      }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Workflow update failed.");
    setMessage("Workflow updated.");
    router.refresh();
  }

  function actionForm(action: PrintWorkflowAction, label: string, fields?: "reason" | "supplier" | "shipping") {
    return <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void transition(action, event.currentTarget); }}>
      {fields === "reason" ? <label>Revision notes<textarea name="reason" required maxLength={2000} /></label> : null}
      {fields === "supplier" ? <>
        <label>Supplier<input name="supplier" required maxLength={255} /></label>
        <label>Supplier order ID<input name="supplier_order_id" maxLength={255} /></label>
      </> : null}
      {fields === "shipping" ? <>
        <label>Carrier<input name="carrier" maxLength={255} /></label>
        <label>Tracking number<input name="tracking_number" maxLength={255} /></label>
        <label>Tracking URL<input name="tracking_url" type="url" maxLength={2000} /></label>
      </> : null}
      <button type="submit" disabled={busy}>{label}</button>
    </form>;
  }

  const customerCanUpload = ["awaiting_artwork", "artwork_changes_requested", "proof_changes_requested"].includes(workflowState);
  const adminCanUploadProof = ["proof_preparing", "proof_changes_requested"].includes(workflowState);

  return <section className="dashboard-card" aria-busy={busy}>
    <h2>{actorType === "admin" ? "Workflow controls" : "Your actions"}</h2>
    {message ? <p role="status">{message}</p> : null}

    {actorType === "customer" && customerCanUpload ? <form className="admin-form" onSubmit={(event) => void upload(event, "customer_artwork")}>
      <label>Artwork file<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.eps,.ai" required /></label>
      <p>PDF, PNG, JPEG, WebP, SVG, EPS, or AI. Maximum 25 MB.</p>
      <button type="submit" disabled={busy}>Upload artwork</button>
    </form> : null}

    {actorType === "admin" ? <div className="admin-form-grid">
      {workflowState === "artwork_received" ? <button type="button" disabled={busy} onClick={() => void transition("begin_artwork_review")}>Begin artwork review</button> : null}
      {["artwork_received", "artwork_review"].includes(workflowState) ? actionForm("request_artwork_changes", "Request artwork changes", "reason") : null}
      {["artwork_received", "artwork_review"].includes(workflowState) ? <button type="button" disabled={busy} onClick={() => void transition("approve_artwork")}>Approve artwork</button> : null}
      {adminCanUploadProof ? <form className="admin-form" onSubmit={(event) => void upload(event, "admin_proof")}>
        <label>Proof file<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg" required /></label>
        <label>Page or side labels<input name="page_labels" placeholder="Front, Back" maxLength={500} /></label>
        <label>QR placement note<textarea name="qr_placement_note" maxLength={500} placeholder="Final QR size and position shown in this proof" /></label>
        <label>QR scan validation<select name="qr_scan_validation_status" defaultValue="pending"><option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="not_required">Not required</option></select></label>
        <button type="submit" disabled={busy}>Upload proof revision</button>
      </form> : null}
      {["ready_for_production", "submitted_to_supplier", "in_production"].includes(workflowState) ? <form className="admin-form" onSubmit={(event) => void upload(event, "production_artwork")}>
        <label>Production artwork<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.eps,.ai" required /></label>
        <button type="submit" disabled={busy}>Upload production artwork</button>
      </form> : null}
      {["ready_for_production", "submitted_to_supplier", "in_production", "production_complete"].includes(workflowState) ? <form className="admin-form" onSubmit={(event) => void upload(event, "supplier_file")}>
        <label>Supplier file<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.eps,.ai" required /></label>
        <button type="submit" disabled={busy}>Upload supplier file</button>
      </form> : null}
      {workflowState === "proof_preparing" ? <button type="button" disabled={busy} onClick={() => void transition("send_proof")}>Send proof for approval</button> : null}
      {workflowState === "ready_for_production" ? actionForm("submit_to_supplier", "Submit to supplier", "supplier") : null}
      {workflowState === "submitted_to_supplier" ? <button type="button" disabled={busy} onClick={() => void transition("start_production")}>Mark in production</button> : null}
      {["submitted_to_supplier", "in_production"].includes(workflowState) ? <button type="button" disabled={busy} onClick={() => void transition("complete_production")}>Mark production complete</button> : null}
      {workflowState === "production_complete" ? actionForm("fulfill", "Mark fulfilled", "shipping") : null}
      {workflowState === "fulfilled" ? <button type="button" disabled={busy} onClick={() => void transition("mark_delivered")}>Mark delivered</button> : null}
      {!["delivered", "cancelled"].includes(workflowState) ? <button type="button" disabled={busy} onClick={() => void transition("cancel")}>Cancel workflow</button> : null}
    </div> : null}
  </section>;
}
