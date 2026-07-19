import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PrintOrderWorkflowActions from "@/components/print-orders/PrintOrderWorkflowActions";
import { formatAdminLabel, getAdminStatusTone } from "@/lib/admin-operations";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value?: number | null) {
  if (!value) return "—";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ value }: { value?: string | null }) {
  const tone = getAdminStatusTone(value);
  return <span className={`${styles.status} ${styles[tone]}`}>{formatAdminLabel(value)}</span>;
}

function DetailList({ items }: { items: Array<[string, string | number | null | undefined]> }) {
  return <dl className={styles.details}>{items.map(([label, value]) => (
    <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>
  ))}</dl>;
}

export default async function AdminPrintOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer?.is_admin) redirect("/portal");
  const admin = createSupabaseAdminClient();
  const [orderResult, filesResult, proofsResult, activityResult, qrVersionsResult] = await Promise.all([
    admin.from("print_order_items").select("*").eq("id", id).limit(1).maybeSingle(),
    admin.from("print_order_files").select("id,file_kind,original_filename,size_bytes,is_current,created_at").eq("print_order_item_id", id).order("created_at", { ascending: false }),
    admin.from("print_proofs").select("id,proof_file_id,revision,status,is_current,sent_at,approved_at,changes_requested_at,customer_notes,created_at").eq("print_order_item_id", id).order("revision", { ascending: false }),
    admin.from("order_activity").select("id,action,actor_type,reason,created_at").eq("order_type", "print_order").eq("order_id", id).order("created_at", { ascending: false }),
    admin.from("print_qr_artwork_versions").select("id,print_order_file_id,qr_code_id,revision,status,artwork_use_status,is_current,submitted_at,placement_snapshot,destination_url_snapshot").eq("print_order_item_id", id).order("revision", { ascending: false }),
  ]);
  if (orderResult.error || !orderResult.data) notFound();
  if (filesResult.error || proofsResult.error || activityResult.error || qrVersionsResult.error) throw new Error("Unable to load print operations details.");
  const order = orderResult.data;
  const files = filesResult.data || [];
  const proofs = proofsResult.data || [];
  const activity = activityResult.data || [];
  const qrVersions = qrVersionsResult.data || [];
  const currentProof = proofs.find((proof) => proof.is_current);
  const currentQrVersion = qrVersions.find((version) => version.is_current);
  const workflowSteps = [
    ["QR setup", order.qr_setup_status],
    ["Artwork", order.artwork_status],
    ["Proof", order.proof_status],
    ["Production", order.production_status],
    ["Fulfillment", order.fulfillment_status],
  ];

  return <DashboardShell isAdmin>
    <main className={`${styles.page} container admin-page`}>
      <Link className={styles.backLink} href="/admin/print-orders">← Back to print orders</Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Print operations</p>
          <div className={styles.titleRow}>
            <h1>Order {order.shopify_order_number || order.shopify_order_id}</h1>
            <StatusBadge value={order.workflow_state} />
          </div>
          <p>{order.customer_name || order.customer_email || "Guest customer"} · {order.product_title}</p>
        </div>
        <div className={styles.headerMeta}>
          <span>Last workflow update</span>
          <strong>{formatDate(order.workflow_updated_at || order.updated_at)}</strong>
        </div>
      </header>

      <section className={styles.stepper} aria-label="Order workflow status">
        {workflowSteps.map(([label, value], index) => {
          const tone = getAdminStatusTone(String(value || ""));
          return <div className={styles.step} key={label}>
            <span className={`${styles.stepMarker} ${styles[tone]}`}>{index + 1}</span>
            <div><strong>{label}</strong><span>{formatAdminLabel(String(value || ""))}</span></div>
          </div>;
        })}
      </section>

      <div className={styles.columns}>
        <div className={styles.primaryColumn}>
          <PrintOrderWorkflowActions orderId={id} actorType="admin" workflowState={order.workflow_state} />

          <section className={styles.card}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Artwork assets</p><h2>Files and revisions</h2></div>
              <span>{files.length} files</span>
            </div>
            {files.length ? <div className={styles.tableRegion} role="region" aria-label="Private order files" tabIndex={0}>
              <table>
                <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Version</th><th>Uploaded</th></tr></thead>
                <tbody>{files.map((file) => <tr key={file.id}>
                  <td><Link href={`/api/print-order-files/${file.id}`}>{file.original_filename}</Link></td>
                  <td>{formatAdminLabel(file.file_kind)}</td>
                  <td>{formatBytes(file.size_bytes)}</td>
                  <td>{file.is_current ? "Current" : "Superseded"}</td>
                  <td>{formatDate(file.created_at)}</td>
                </tr>)}</tbody>
              </table>
            </div> : <p className={styles.empty}>No private files have been uploaded.</p>}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Proof review</p><h2>Proof history</h2></div>
              {currentProof ? <StatusBadge value={currentProof.status} /> : null}
            </div>
            {proofs.length ? <div className={styles.recordList}>{proofs.map((proof) => <article key={proof.id}>
              <div><strong>Revision {proof.revision}</strong>{proof.is_current ? <span className={styles.currentTag}>Current</span> : null}</div>
              <p>{formatAdminLabel(proof.status)} · Created {formatDate(proof.created_at)} · Sent {formatDate(proof.sent_at)}</p>
              {proof.customer_notes ? <p>Customer note: {proof.customer_notes}</p> : null}
              <Link href={`/api/print-order-files/${proof.proof_file_id}`}>View proof file</Link>
            </article>)}</div> : <p className={styles.empty}>No proof revisions have been created.</p>}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Immutable QR assets</p><h2>QR artwork revisions</h2></div>
              {currentQrVersion ? <span>Current revision {currentQrVersion.revision}</span> : null}
            </div>
            {qrVersions.length ? <div className={styles.recordList}>{qrVersions.map((version) => {
              const placement = version.placement_snapshot as Record<string, string> | null;
              return <article key={version.id}>
                <div><strong>Revision {version.revision}</strong>{version.is_current ? <span className={styles.currentTag}>Current</span> : null}</div>
                <p>{formatAdminLabel(version.status)} · {formatAdminLabel(version.artwork_use_status)} · Submitted {formatDate(version.submitted_at)}</p>
                <p>Destination: {version.destination_url_snapshot || "—"}</p>
                <p>Placement: {placement?.placementMode === "clutch_choice" ? "Clutch choice" : [placement?.artworkSide, placement?.preferredPosition, placement?.preferredPrintSize, placement?.placementInstructions].filter(Boolean).map((value) => formatAdminLabel(value)).join(" · ") || "—"}</p>
                <Link href={`/api/print-order-files/${version.print_order_file_id}`}>Download frozen SVG</Link>
              </article>;
            })}</div> : <p className={styles.empty}>The customer has not submitted a frozen QR artwork revision.</p>}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Audit trail</p><h2>Order activity</h2></div><span>{activity.length} events</span></div>
            {activity.length ? <div className={styles.timeline}>{activity.map((event) => <article key={event.id}>
              <span>{formatDate(event.created_at)}</span>
              <strong>{formatAdminLabel(event.action)}</strong>
              <p>{formatAdminLabel(event.actor_type)}{event.reason ? ` · ${formatAdminLabel(event.reason)}` : ""}</p>
            </article>)}</div> : <p className={styles.empty}>No activity has been recorded.</p>}
          </section>
        </div>

        <aside className={styles.secondaryColumn}>
          <section className={styles.card}>
            <h2>Order</h2>
            <DetailList items={[
              ["Order ID", order.shopify_order_number || order.shopify_order_id],
              ["Line item", order.shopify_line_item_id],
              ["Product", order.product_title],
              ["Variant", order.variant_title],
              ["SKU", order.sku],
              ["Material", formatAdminLabel(order.material_type)],
              ["Quantity", order.quantity],
              ["Created", formatDate(order.created_at)],
            ]} />
          </section>

          <section className={styles.card}>
            <h2>Artwork</h2>
            <DetailList items={[
              ["Method", formatAdminLabel(order.artwork_method, "Not specified")],
              ["Status", formatAdminLabel(order.artwork_status)],
              ["Reorder", order.reorder_reference],
              ["Instructions", order.artwork_instructions],
            ]} />
          </section>

          <section className={styles.card}>
            <h2>QR placement</h2>
            <DetailList items={[
              ["Setup", formatAdminLabel(order.qr_setup_status)],
              ["Mode", formatAdminLabel(order.placement_mode)],
              ["Side", formatAdminLabel(order.artwork_side)],
              ["Position", formatAdminLabel(order.preferred_position)],
              ["Print size", order.preferred_print_size],
              ["Instructions", order.placement_instructions || order.qr_placement_instructions],
            ]} />
          </section>

          <section className={styles.card}>
            <h2>Proof</h2>
            <DetailList items={[
              ["Status", formatAdminLabel(order.proof_status)],
              ["Current revision", currentProof?.revision],
              ["Sent", formatDate(currentProof?.sent_at)],
              ["Approved", formatDate(currentProof?.approved_at)],
            ]} />
          </section>

          <section className={styles.card}>
            <h2>Production</h2>
            <DetailList items={[
              ["Status", formatAdminLabel(order.production_status)],
              ["Workflow", formatAdminLabel(order.workflow_state)],
              ["Attention", order.attention_reason],
            ]} />
          </section>

          <section className={styles.card}>
            <h2>Fulfillment</h2>
            <DetailList items={[
              ["Status", formatAdminLabel(order.fulfillment_status)],
              ["Carrier", order.carrier],
              ["Tracking number", order.tracking_number],
              ["Tracking URL", order.tracking_url],
            ]} />
          </section>

          <section className={styles.card}>
            <h2>Supplier</h2>
            <DetailList items={[
              ["Supplier", order.supplier],
              ["Supplier order", order.supplier_order_id],
            ]} />
          </section>
        </aside>
      </div>
    </main>
  </DashboardShell>;
}
