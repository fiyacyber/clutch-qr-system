import Link from "next/link";
import { redirect } from "next/navigation";
import AdminDashboardTabs from "@/components/admin/AdminDashboardTabs";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function AdminPrintOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer?.is_admin) redirect("/portal");
  const filters = await searchParams;
  const admin = createSupabaseAdminClient();
  let query = admin.from("print_order_items").select("*, print_qr_provisionings(qr_code_id, provisioning_status)").order("created_at", { ascending: false });
  if (filters.view === "attention") query = query.eq("provisioning_status", "needs_attention");
  if (filters.tracking === "tracked") query = query.neq("tracking_mode", "none");
  if (filters.tracking === "none") query = query.eq("tracking_mode", "none");
  for (const key of ["artwork_status", "proof_status", "production_status", "fulfillment_status"] as const) {
    if (filters[key]) query = query.eq(key, filters[key]!);
  }
  const { data, error } = await query.limit(250);
  if (error) throw new Error("Unable to load the print-order queue.");
  return <DashboardShell isAdmin>
    <main className="container admin-page">
      <DashboardHeader title="Print Orders" subtitle="Read-only tracked-print, artwork, proof, production, and fulfillment queue." />
      <AdminDashboardTabs activeTab="print-orders" />
      <div className="dashboard-actions">
        <Link href="/admin/print-orders">All</Link><Link href="/admin/print-orders?view=attention">Needs attention</Link>
        <Link href="/admin/print-orders?tracking=tracked">Tracked print</Link><Link href="/admin/print-orders?tracking=none">No tracking</Link>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>SKU / material</th><th>Qty</th><th>Tracking</th><th>Campaign</th><th>Artwork</th><th>Proof</th><th>Production</th><th>Fulfillment</th><th>Provisioning</th><th>QR</th><th>Attention</th><th>Created</th></tr></thead>
        <tbody>{(data || []).map((item: any) => <tr key={item.id}><td>{item.shopify_order_number || item.shopify_order_id}</td><td>{item.customer_name || item.customer_email || "Guest"}</td><td>{item.product_title}{item.variant_title ? ` — ${item.variant_title}` : ""}</td><td>{item.sku || "—"}<br />{item.material_type}</td><td>{item.quantity}</td><td>{item.tracking_mode}</td><td>{item.campaign_name || "—"}</td><td>{item.artwork_status}</td><td>{item.proof_status}</td><td>{item.production_status}</td><td>{item.fulfillment_status}</td><td>{item.provisioning_status}</td><td>{item.print_qr_provisionings?.[0]?.provisioning_status || "—"}</td><td>{item.attention_reason || "—"}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody>
      </table></div>
      {!data?.length ? <p className="empty-state">No print orders match these filters.</p> : null}
    </main>
  </DashboardShell>;
}
