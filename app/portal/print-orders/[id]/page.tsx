import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PrintOrderWorkflowActions from "@/components/print-orders/PrintOrderWorkflowActions";
import OrderQrSetup from "@/components/print-orders/OrderQrSetup";
import { loadAccountAccess } from "@/lib/account-access-server";
import { requireCustomer } from "@/lib/auth";
import { formatPrintWorkflowState } from "@/lib/print-operations";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { qrUrl } from "@/lib/qr";

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
  const [filesResult, proofsResult, activityResult, provisioningResult, qrVersionsResult] = await Promise.all([
    admin.from("print_order_files").select("id,file_kind,original_filename,is_current,created_at").eq("print_order_item_id", id).eq("is_current", true).order("created_at", { ascending: false }),
    admin.from("print_proofs").select("id,proof_file_id,revision,status,is_current,sent_at,approved_at,changes_requested_at,customer_notes").eq("print_order_item_id", id).order("revision", { ascending: false }),
    admin.from("order_activity").select("id,action,actor_type,reason,created_at").eq("order_type", "print_order").eq("order_id", id).order("created_at", { ascending: false }),
    admin.from("print_qr_provisionings").select("qr_code_id").eq("print_order_item_id", id).limit(1).maybeSingle(),
    admin.from("print_qr_artwork_versions").select("id,print_order_file_id,revision,status,artwork_use_status,is_current,submitted_at").eq("print_order_item_id", id).order("revision", { ascending: false }),
  ]);
  if (filesResult.error || proofsResult.error || activityResult.error || qrVersionsResult.error) throw new Error("Unable to load your print order.");
  const order = orderResult.data;
  const codeAccess = provisioningResult.data?.qr_code_id
    ? await loadOrderLinkedQrAccess(admin, customer, provisioningResult.data.qr_code_id)
    : null;
  const { data: qrCode } = provisioningResult.data?.qr_code_id
    ? await admin.from("qr_codes").select("id,name,slug,destination_url,foreground_color,background_color,dot_style,corner_style,style_config,logo_url").eq("id", provisioningResult.data.qr_code_id).eq("customer_id", customer.id).eq("print_order_item_id", id).maybeSingle()
    : { data: null };
  const currentQrVersion = (qrVersionsResult.data || []).find((version) => version.is_current) || null;
  const styleConfig = (qrCode?.style_config && typeof qrCode.style_config === "object" ? qrCode.style_config : {}) as Record<string, unknown>;
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
      {codeAccess ? <section className="dashboard-card"><h2>Clutch Codes™ access</h2>
        {codeAccess.state === "expired_included_access" || codeAccess.state === "view_only" ? <>
          <h3>Your Included Access Has Ended</h3>
          <p>Your printed Clutch Code is still active. Subscribe to Clutch Codes™ to edit its destination and view scan analytics again.</p>
          <p><Link className="btn primary" href="/portal/subscription">View Clutch Codes™ Plans</Link> <Link href="/portal/print-orders">Return to Print Orders</Link></p>
        </> : <p>Management access is active{codeAccess.accessExpiresAt ? ` through ${new Date(codeAccess.accessExpiresAt).toLocaleString()}` : ""}.</p>}
      </section> : null}
      {qrCode?.slug && codeAccess ? <OrderQrSetup
        orderId={id}
        shortUrl={qrUrl(qrCode.slug)}
        canEdit={codeAccess.canEditDestination}
        canUploadLogo={access.canUploadQrLogo}
        proofApproved={order.proof_status === "approved"}
        submittedRevision={currentQrVersion?.revision || order.qr_setup_current_revision || null}
        submittedAt={currentQrVersion?.submitted_at || order.qr_setup_submitted_at || null}
        currentFileId={currentQrVersion?.print_order_file_id || null}
        initial={{
          codeName: qrCode.name,
          campaignName: String(styleConfig.campaignName || order.campaign_name || qrCode.name),
          destinationUrl: qrCode.destination_url,
          foregroundColor: qrCode.foreground_color || "#384862",
          backgroundColor: qrCode.background_color || "#ffffff",
          dotStyle: (["square", "rounded", "dots"].includes(String(qrCode.dot_style)) ? qrCode.dot_style : "square") as "square" | "rounded" | "dots",
          cornerStyle: (["square", "dot", "extra-rounded"].includes(String(qrCode.corner_style)) ? qrCode.corner_style : "square") as "square" | "dot" | "extra-rounded",
          frameStyle: (["none", "outline", "label"].includes(String(styleConfig.frameStyle)) ? styleConfig.frameStyle : "none") as "none" | "outline" | "label",
          frameColor: String(styleConfig.frameColor || "#384862"),
          frameLabel: String(styleConfig.frameLabel || "SCAN ME"),
          logoUrl: qrCode.logo_url,
        }}
      /> : null}
      <PrintOrderWorkflowActions orderId={id} actorType="customer" workflowState={order.workflow_state} />
      <section className="dashboard-card"><h2>Artwork and proofs</h2>
        {visibleFiles.map((file) => <p key={file.id}><Link href={`/api/print-order-files/${file.id}`}>{file.original_filename}</Link> · {file.file_kind === "admin_proof" ? "Proof" : "Artwork"}</p>)}
        {!visibleFiles.length ? <p>No files are available yet.</p> : null}
      </section>
      <section className="dashboard-card"><h2>Proof history</h2>
        {(proofsResult.data || []).map((proof) => <p key={proof.id}>Revision {proof.revision} · {proof.status}{proof.customer_notes ? ` · ${proof.customer_notes}` : ""}</p>)}
      </section>
      <section className="dashboard-card"><h2>QR artwork versions</h2>
        {(qrVersionsResult.data || []).map((version) => <p key={version.id}>Revision {version.revision} · {version.status} · {version.artwork_use_status} · <Link href={`/api/print-order-files/${version.print_order_file_id}`}>View frozen SVG</Link></p>)}
        {!qrVersionsResult.data?.length ? <p>No QR has been submitted for artwork yet.</p> : null}
      </section>
      <section className="dashboard-card"><h2>Order activity</h2>
        {(activityResult.data || []).map((event) => <p key={event.id}>{new Date(event.created_at).toLocaleString()} · {formatPrintWorkflowState(event.action)}</p>)}
      </section>
    </main>
  </DashboardShell>;
}
