import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PrintOrderWorkflowActions from "@/components/print-orders/PrintOrderWorkflowActions";
import { loadAccountAccess } from "@/lib/account-access-server";
import { requireCustomer } from "@/lib/auth";
import { formatPrintWorkflowState } from "@/lib/print-operations";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function CustomerPrintOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canViewPrintOrders) redirect("/portal?access=print-orders-locked");
  const orderResult = await admin.from("print_order_items").select("*").eq("id", id).eq("customer_id", customer.id).limit(1).maybeSingle();
  if (orderResult.error || !orderResult.data) notFound();
  const [filesResult, proofsResult, activityResult] = await Promise.all([
    admin.from("print_order_files").select("id,file_kind,original_filename,is_current,created_at").eq("print_order_item_id", id).eq("is_current", true).order("created_at", { ascending: false }),
    admin.from("print_proofs").select("id,proof_file_id,revision,status,is_current,sent_at,approved_at,changes_requested_at,customer_notes").eq("print_order_item_id", id).order("revision", { ascending: false }),
    admin.from("order_activity").select("id,action,actor_type,reason,created_at").eq("order_type", "print_order").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  if (filesResult.error || proofsResult.error || activityResult.error) throw new Error("Unable to load your print order.");
  const order = orderResult.data;
  const visibleFiles = (filesResult.data || []).filter((file) => file.file_kind === "customer_artwork" || file.file_kind === "admin_proof");

  return <DashboardShell accountAccess={access}>
    <main className="container">
      <DashboardHeader title={order.product_title} subtitle={`Order ${order.shopify_order_number || order.shopify_order_id} · ${formatPrintWorkflowState(order.workflow_state)}`} />
      <p><Link href="/portal/print-orders">← Back to print orders</Link></p>
      <section className="dashboard-card"><h2>Production status</h2>
        <p>{order.material_type} · Quantity {order.quantity}</p>
        <p>Artwork: {order.artwork_status} · Proof: {order.proof_status}</p>
        <p>Production: {order.production_status} · Fulfillment: {order.fulfillment_status}</p>
        {order.tracking_url ? <p><a href={order.tracking_url} target="_blank" rel="noreferrer">Track shipment</a></p> : null}
      </section>
      <PrintOrderWorkflowActions orderId={id} actorType="customer" workflowState={order.workflow_state} />
      <section className="dashboard-card"><h2>Artwork and proofs</h2>
        {visibleFiles.map((file) => <p key={file.id}><Link href={`/api/print-order-files/${file.id}`}>{file.original_filename}</Link> · {file.file_kind === "admin_proof" ? "Proof" : "Artwork"}</p>)}
        {!visibleFiles.length ? <p>No files are available yet.</p> : null}
      </section>
      <section className="dashboard-card"><h2>Proof history</h2>
        {(proofsResult.data || []).map((proof) => <p key={proof.id}>Revision {proof.revision} · {proof.status}{proof.customer_notes ? ` · ${proof.customer_notes}` : ""}</p>)}
      </section>
      <section className="dashboard-card"><h2>Order activity</h2>
        {(activityResult.data || []).map((event) => <p key={event.id}>{new Date(event.created_at).toLocaleString()} · {formatPrintWorkflowState(event.action)}</p>)}
      </section>
    </main>
  </DashboardShell>;
}
