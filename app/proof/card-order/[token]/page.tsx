import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

interface ProofPageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ result?: string }>;
}

type ProofOrderRow = {
  id: string;
  shopify_order_number: string | null;
  proof_token: string | null;
  proof_url: string | null;
  approval_status: string | null;
  proof_sent_at: string | null;
  proof_viewed_at: string | null;
  customer_approved_at: string | null;
  changes_requested_at: string | null;
  approval_notes: string | null;
  engraving_business_name: string | null;
  engraving_title: string | null;
  engraving_phone: string | null;
  engraving_email: string | null;
  custom_details: string | null;
  status: string | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toApprovalStatusLabel(value: string | null | undefined) {
  if (!value) return "Not Ready";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ProofReviewPage({ params, searchParams }: ProofPageProps) {
  const { token } = await params;
  const search = await searchParams;
  const message = String(search?.result || "").trim();

  if (!token || token.length < 12) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Proof link is invalid</h1>
          <p>Please check the proof link and try again.</p>
        </section>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("card_orders")
    .select(
      "id, shopify_order_number, proof_token, proof_url, approval_status, proof_sent_at, proof_viewed_at, customer_approved_at, changes_requested_at, approval_notes, engraving_business_name, engraving_title, engraving_phone, engraving_email, custom_details, status"
    )
    .eq("proof_token", token)
    .maybeSingle();

  if (error || !data) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Proof link is invalid</h1>
          <p>This proof link does not exist or may have expired.</p>
        </section>
      </main>
    );
  }

  const order = data as ProofOrderRow;

  if (!order.proof_viewed_at) {
    const patch: Record<string, any> = {
      proof_viewed_at: new Date().toISOString(),
    };

    if (order.approval_status === "sent") {
      patch.approval_status = "viewed";
    }

    await admin.from("card_orders").update(patch).eq("id", order.id);

    order.proof_viewed_at = patch.proof_viewed_at;
    if (patch.approval_status) {
      order.approval_status = patch.approval_status;
    }
  }

  async function approveProof() {
    "use server";

    const actionAdmin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const { data: latest } = await actionAdmin
      .from("card_orders")
      .select("id")
      .eq("proof_token", token)
      .maybeSingle();

    if (!latest?.id) {
      redirect(`/proof/card-order/${encodeURIComponent(token)}?result=invalid`);
    }

    await actionAdmin
      .from("card_orders")
      .update({
        approval_status: "approved",
        status: "approved",
        customer_approved_at: nowIso,
      })
      .eq("id", latest.id);

    redirect(`/proof/card-order/${encodeURIComponent(token)}?result=approved`);
  }

  async function requestChanges(formData: FormData) {
    "use server";

    const notes = String(formData.get("approval_notes") || "").trim();
    if (!notes) {
      redirect(`/proof/card-order/${encodeURIComponent(token)}?result=missing_notes`);
    }

    const actionAdmin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const { data: latest } = await actionAdmin
      .from("card_orders")
      .select("id")
      .eq("proof_token", token)
      .maybeSingle();

    if (!latest?.id) {
      redirect(`/proof/card-order/${encodeURIComponent(token)}?result=invalid`);
    }

    await actionAdmin
      .from("card_orders")
      .update({
        approval_status: "changes_requested",
        status: "changes_requested",
        changes_requested_at: nowIso,
        approval_notes: notes,
      })
      .eq("id", latest.id);

    redirect(`/proof/card-order/${encodeURIComponent(token)}?result=changes_requested`);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Review Card Proof</h1>

        {message === "approved" ? (
          <p className={styles.success}>Proof approved. Your card is ready for production.</p>
        ) : null}

        {message === "changes_requested" ? (
          <p className={styles.warning}>Changes requested. We’ll review your notes and send an updated proof.</p>
        ) : null}

        {message === "missing_notes" ? (
          <p className={styles.warning}>Please include notes before requesting changes.</p>
        ) : null}

        <div className={styles.grid}>
          <div><strong>Order Number</strong><p>{order.shopify_order_number || "-"}</p></div>
          <div><strong>Business Name</strong><p>{order.engraving_business_name || "-"}</p></div>
          <div><strong>Title</strong><p>{order.engraving_title || "-"}</p></div>
          <div><strong>Business Phone</strong><p>{order.engraving_phone || "-"}</p></div>
          <div><strong>Business Email</strong><p>{order.engraving_email || "-"}</p></div>
          <div><strong>Current Approval Status</strong><p>{toApprovalStatusLabel(order.approval_status)}</p></div>
          <div className={styles.full}><strong>Custom Details</strong><p>{order.custom_details || "-"}</p></div>
          <div className={styles.full}><strong>Proof URL</strong><p>{order.proof_url ? <a href={order.proof_url} target="_blank" rel="noreferrer">Open proof preview</a> : "-"}</p></div>
          <div><strong>Proof Sent</strong><p>{formatDateTime(order.proof_sent_at)}</p></div>
          <div><strong>Proof Viewed</strong><p>{formatDateTime(order.proof_viewed_at)}</p></div>
          <div><strong>Approved At</strong><p>{formatDateTime(order.customer_approved_at)}</p></div>
          <div><strong>Changes Requested At</strong><p>{formatDateTime(order.changes_requested_at)}</p></div>
          <div className={styles.full}><strong>Notes</strong><p>{order.approval_notes || "-"}</p></div>
        </div>

        <form action={approveProof} className={styles.actionRow}>
          <button type="submit" className={styles.primary}>Approve Proof</button>
        </form>

        <form action={requestChanges} className={styles.requestForm}>
          <label htmlFor="approval_notes">Request Changes Notes</label>
          <textarea id="approval_notes" name="approval_notes" placeholder="Tell us what should change in the proof..." required />
          <button type="submit" className={styles.secondary}>Request Changes</button>
        </form>
      </section>
    </main>
  );
}
