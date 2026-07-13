import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";

export default async function CustomerPrintOrdersPage() {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canViewPrintOrders) redirect("/portal?access=print-orders-locked");
  const { data, error } = await admin.from("print_order_items")
    .select("*, print_qr_provisionings(qr_code_id, qr_codes(slug))")
    .eq("customer_id", customer.id).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load your print orders.");
  return <DashboardShell accountAccess={access}>
    <main className="container">
      <DashboardHeader title="Print Orders" subtitle="Track artwork, proof, production, fulfillment, and order-linked Clutch Codes." />
      {!data?.length ? <section className="dashboard-card"><h2>No print orders yet</h2><p>Eligible paid print orders will appear here.</p></section> : null}
      {(data || []).map((item: any) => {
        const qr = item.print_qr_provisionings?.[0]?.qr_codes;
        return <section className="dashboard-card" key={item.id}>
          <h2><Link href={`/portal/print-orders/${item.id}`}>{item.product_title}</Link></h2><p>Order {item.shopify_order_number || item.shopify_order_id} · {item.material_type} · Qty {item.quantity}</p>
          <p>Tracking: {item.tracking_mode} · Campaign: {item.campaign_name || "—"}</p>
          {item.destination_url ? <p>Destination: <a href={item.destination_url} rel="noreferrer" target="_blank">{item.destination_url}</a></p> : null}
          <p>Artwork: {item.artwork_status} · Proof: {item.proof_status} · Production: {item.production_status} · Fulfillment: {item.fulfillment_status}</p>
          {item.attention_reason ? <p className="alert">Needs attention: {item.attention_reason}</p> : null}
          {qr?.slug ? <Link href={`/portal/qr/${item.print_qr_provisionings[0].qr_code_id}/edit`}>Manage Clutch Code</Link> : null}
          {item.tracking_url ? <p><a href={item.tracking_url} rel="noreferrer" target="_blank">Track shipment</a></p> : null}
          <p><Link href={`/portal/print-orders/${item.id}`}>View order workflow</Link></p>
        </section>;
      })}
    </main>
  </DashboardShell>;
}
