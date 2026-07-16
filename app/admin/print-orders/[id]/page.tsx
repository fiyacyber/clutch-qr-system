import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminDashboardTabs from "@/components/admin/AdminDashboardTabs";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PrintOrderWorkflowActions from "@/components/print-orders/PrintOrderWorkflowActions";
import { requireCustomer } from "@/lib/auth";
import { formatPrintWorkflowState } from "@/lib/print-operations";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

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
    admin.from("print_qr_artwork_versions").select("id,print_order_file_id,qr_code_id,revision,status,artwork_use_status,is_current,submitted_at").eq("print_order_item_id", id).order("revision", { ascending: false }),
  ]);
  if (orderResult.error || !orderResult.data) notFound();
  if (filesResult.error || proofsResult.error || activityResult.error || qrVersionsResult.error) throw new Error("Unable to load print operations details.");
  const order = orderResult.data;

  return <DashboardShell isAdmin>
    <main className="container admin-page">
      <DashboardHeader title={order.product_title} subtitle={`Order ${order.shopify_order_number || order.shopify_order_id} · ${formatPrintWorkflowState(order.workflow_state)}`} />
      <AdminDashboardTabs activeTab="print-orders" />
      <p><Link href="/admin/print-orders">← Back to print orders</Link></p>
      <section className="dashboard-card">
        <h2>Order details</h2>
        <p>Customer: {order.customer_name || order.customer_email || "Guest"}</p>
        <p>{order.material_type} · Quantity {order.quantity} · SKU {order.sku || "—"}</p>
        <p>Artwork method: {order.artwork_method || "Not specified"}{order.reorder_reference ? ` · Reorder ${order.reorder_reference}` : ""}</p>
        {order.artwork_instructions ? <p>Artwork instructions: {order.artwork_instructions}</p> : null}
        {order.qr_placement_instructions ? <p>QR placement: {order.qr_placement_instructions}</p> : null}
        <p>Artwork: {order.artwork_status} · Proof: {order.proof_status} · Production: {order.production_status} · Fulfillment: {order.fulfillment_status}</p>
        <p>Supplier: {order.supplier || "—"} · Supplier order: {order.supplier_order_id || "—"}</p>
        <p>Shipment: {order.carrier || "—"} · {order.tracking_number || "No tracking number"}</p>
      </section>
      <PrintOrderWorkflowActions orderId={id} actorType="admin" workflowState={order.workflow_state} />
      <section className="dashboard-card"><h2>QR ready for artwork</h2>
        {(qrVersionsResult.data || []).map((version) => <p key={version.id}>Revision {version.revision} · {version.status} · {version.artwork_use_status} · {version.is_current ? "Current" : "Superseded"} · <Link href={`/api/print-order-files/${version.print_order_file_id}`}>Download frozen SVG</Link></p>)}
        {!qrVersionsResult.data?.length ? <p>The customer has not submitted a QR asset yet.</p> : null}
      </section>
      <section className="dashboard-card"><h2>Private files</h2>
        {(filesResult.data || []).map((file) => <p key={file.id}><Link href={`/api/print-order-files/${file.id}`}>{file.original_filename}</Link> · {file.file_kind} · {file.is_current ? "Current" : "Superseded"}</p>)}
        {!filesResult.data?.length ? <p>No files uploaded.</p> : null}
      </section>
      <section className="dashboard-card"><h2>Proof history</h2>
        {(proofsResult.data || []).map((proof) => <p key={proof.id}>Revision {proof.revision} · {proof.status}{proof.customer_notes ? ` · ${proof.customer_notes}` : ""}</p>)}
        {!proofsResult.data?.length ? <p>No proofs created.</p> : null}
      </section>
      <section className="dashboard-card"><h2>Audit activity</h2>
        {(activityResult.data || []).map((event) => <p key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.action} · {event.actor_type}{event.reason ? ` · ${event.reason}` : ""}</p>)}
      </section>
    </main>
  </DashboardShell>;
}
