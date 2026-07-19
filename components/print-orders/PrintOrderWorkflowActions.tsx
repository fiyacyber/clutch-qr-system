"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrintActorType, PrintFileKind, PrintWorkflowAction } from "@/lib/print-operations";
import { formatAdminLabel } from "@/lib/admin-operations";
import styles from "./PrintOrderWorkflowActions.module.css";

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
    const fieldId = `${orderId}-${action}`;
    return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void transition(action, event.currentTarget); }}>
      {fields === "reason" ? <label htmlFor={`${fieldId}-reason`}>Revision notes<textarea id={`${fieldId}-reason`} name="reason" required maxLength={2000} /></label> : null}
      {fields === "supplier" ? <>
        <label htmlFor={`${fieldId}-supplier`}>Supplier<input id={`${fieldId}-supplier`} name="supplier" required maxLength={255} /></label>
        <label htmlFor={`${fieldId}-supplier-order`}>Supplier order ID<input id={`${fieldId}-supplier-order`} name="supplier_order_id" maxLength={255} /></label>
      </> : null}
      {fields === "shipping" ? <>
        <label htmlFor={`${fieldId}-carrier`}>Carrier<input id={`${fieldId}-carrier`} name="carrier" maxLength={255} /></label>
        <label htmlFor={`${fieldId}-tracking-number`}>Tracking number<input id={`${fieldId}-tracking-number`} name="tracking_number" maxLength={255} /></label>
        <label htmlFor={`${fieldId}-tracking-url`}>Tracking URL<input id={`${fieldId}-tracking-url`} name="tracking_url" type="url" maxLength={2000} /></label>
      </> : null}
      <button className={styles.primaryButton} type="submit" disabled={busy}>{label}</button>
    </form>;
  }

  const customerCanUpload = ["awaiting_artwork", "artwork_changes_requested", "proof_changes_requested"].includes(workflowState);
  const adminCanUploadProof = ["proof_preparing", "proof_changes_requested"].includes(workflowState);

  return <section className={styles.panel} aria-busy={busy}>
    <div className={styles.heading}>
      <div><p>Workflow actions</p><h2>{actorType === "admin" ? "Manage this order" : "Your actions"}</h2></div>
      <span>Current state: {formatAdminLabel(workflowState)}</span>
    </div>
    {message ? <p className={styles.message} role="status">{message}</p> : null}

    {actorType === "customer" && customerCanUpload ? <form className={styles.form} onSubmit={(event) => void upload(event, "customer_artwork")}>
      <label htmlFor={`${orderId}-customer-artwork`}>Artwork file<input id={`${orderId}-customer-artwork`} name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.eps,.ai" required /></label>
      <p>PDF, PNG, JPEG, WebP, SVG, EPS, or AI. Maximum 25 MB.</p>
      <button className={styles.primaryButton} type="submit" disabled={busy}>Upload artwork</button>
    </form> : null}

    {actorType === "admin" ? <div className={styles.groups}>
      {["artwork_received", "artwork_review"].includes(workflowState) ? <fieldset className={styles.group}>
        <legend>Artwork review</legend>
        <p>Review the customer artwork and either request a revision or approve it for proof preparation.</p>
        <div className={styles.buttonRow}>
          {workflowState === "artwork_received" ? <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void transition("begin_artwork_review")}>Begin artwork review</button> : null}
          {["artwork_received", "artwork_review"].includes(workflowState) ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void transition("approve_artwork")}>Approve artwork</button> : null}
        </div>
        {actionForm("request_artwork_changes", "Request artwork changes", "reason")}
      </fieldset> : null}

      {adminCanUploadProof || workflowState === "proof_preparing" ? <fieldset className={styles.group}>
        <legend>Proof preparation</legend>
        <p>Upload the current complete proof, record its QR review metadata, then send it to the customer.</p>
        {adminCanUploadProof ? <form className={styles.form} onSubmit={(event) => void upload(event, "admin_proof")}>
          <label htmlFor={`${orderId}-proof-file`}>Proof file<input id={`${orderId}-proof-file`} name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg" required /></label>
          <label htmlFor={`${orderId}-page-labels`}>Page or side labels<input id={`${orderId}-page-labels`} name="page_labels" placeholder="Front, Back" maxLength={500} /></label>
          <label htmlFor={`${orderId}-placement-note`}>QR placement note<textarea id={`${orderId}-placement-note`} name="qr_placement_note" maxLength={500} placeholder="Final QR size and position shown in this proof" /></label>
          <label htmlFor={`${orderId}-scan-status`}>QR scan validation<select id={`${orderId}-scan-status`} name="qr_scan_validation_status" defaultValue="pending"><option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="not_required">Not required</option></select></label>
          <button className={styles.primaryButton} type="submit" disabled={busy}>Upload proof revision</button>
        </form> : null}
        {workflowState === "proof_preparing" ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void transition("send_proof")}>Send proof for approval</button> : null}
      </fieldset> : null}

      {["ready_for_production", "submitted_to_supplier", "in_production", "production_complete"].includes(workflowState) ? <fieldset className={styles.group}>
        <legend>Production files</legend>
        <p>Keep production-ready and supplier-specific files attached to the order.</p>
        {["ready_for_production", "submitted_to_supplier", "in_production"].includes(workflowState) ? <form className={styles.form} onSubmit={(event) => void upload(event, "production_artwork")}>
          <label htmlFor={`${orderId}-production-artwork`}>Production artwork<input id={`${orderId}-production-artwork`} name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.eps,.ai" required /></label>
          <button className={styles.primaryButton} type="submit" disabled={busy}>Upload production artwork</button>
        </form> : null}
        <form className={styles.form} onSubmit={(event) => void upload(event, "supplier_file")}>
          <label htmlFor={`${orderId}-supplier-file`}>Supplier file<input id={`${orderId}-supplier-file`} name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.eps,.ai" required /></label>
          <button className={styles.secondaryButton} type="submit" disabled={busy}>Upload supplier file</button>
        </form>
      </fieldset> : null}

      {["ready_for_production", "submitted_to_supplier", "in_production"].includes(workflowState) ? <fieldset className={styles.group}>
        <legend>Supplier and production</legend>
        <p>Advance only the currently approved proof through the supplier and production stages.</p>
        {workflowState === "ready_for_production" ? actionForm("submit_to_supplier", "Submit to supplier", "supplier") : null}
        <div className={styles.buttonRow}>
          {workflowState === "submitted_to_supplier" ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void transition("start_production")}>Mark in production</button> : null}
          {["submitted_to_supplier", "in_production"].includes(workflowState) ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void transition("complete_production")}>Mark production complete</button> : null}
        </div>
      </fieldset> : null}

      {["production_complete", "fulfilled"].includes(workflowState) ? <fieldset className={styles.group}>
        <legend>Fulfillment</legend>
        <p>Record shipment details, then confirm delivery when the carrier completes the order.</p>
        {workflowState === "production_complete" ? actionForm("fulfill", "Mark fulfilled", "shipping") : null}
        {workflowState === "fulfilled" ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void transition("mark_delivered")}>Mark delivered</button> : null}
      </fieldset> : null}

      {!["delivered", "cancelled"].includes(workflowState) ? <fieldset className={`${styles.group} ${styles.dangerGroup}`}>
        <legend>Cancel order workflow</legend>
        <p>This stops the operational workflow. Use only when the order should not continue.</p>
        <button className={styles.dangerButton} type="button" disabled={busy} onClick={() => void transition("cancel")}>Cancel workflow</button>
      </fieldset> : null}

      {["awaiting_artwork", "artwork_changes_requested", "proof_sent", "proof_changes_requested", "delivered", "cancelled"].includes(workflowState) ? <p className={styles.noAction}>No admin transition is available for this state. Customer or external action may be required.</p> : null}
    </div> : null}
  </section>;
}
