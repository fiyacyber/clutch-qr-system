import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatAdminLabel, getAdminStatusTone } from "@/lib/admin-operations";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

function StatusBadge({ value }: { value: string | null | undefined }) {
  const tone = getAdminStatusTone(value);
  return <span className={`${styles.status} ${styles[tone]}`}>{formatAdminLabel(value)}</span>;
}

export default async function AdminPrintOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer?.is_admin) redirect("/portal");
  const filters = await searchParams;
  const admin = createSupabaseAdminClient();
  let query = admin.from("print_order_items").select("*, print_qr_provisionings(qr_code_id, provisioning_status)").order("created_at", { ascending: false });
  const searchQuery = String(filters.q || "").trim().replace(/[^a-zA-Z0-9@# .+\-]/g, "");
  if (searchQuery) {
    query = query.or(`shopify_order_number.ilike.%${searchQuery}%,shopify_order_id.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_email.ilike.%${searchQuery}%`);
  }
  if (filters.view === "attention") query = query.eq("provisioning_status", "needs_attention");
  if (filters.tracking === "tracked") query = query.neq("tracking_mode", "none");
  if (filters.tracking === "none") query = query.eq("tracking_mode", "none");
  for (const key of ["artwork_status", "proof_status", "production_status", "fulfillment_status"] as const) {
    if (filters[key]) query = query.eq(key, filters[key]!);
  }
  const { data, error } = await query.limit(250);
  if (error) throw new Error("Unable to load the print-order queue.");

  return (
    <DashboardShell isAdmin>
      <main className={styles.page}>
        <header className={styles.header}>
          <div><h1>Print Orders</h1><p>Artwork, proof, production, and fulfillment operations queue.</p></div>
          <Link href="/admin/card-orders" className={styles.secondaryAction}>Card Orders</Link>
        </header>

        <nav className={styles.filters} aria-label="Print order filters">
          <Link className={!filters.view && !filters.tracking ? styles.activeFilter : ""} href="/admin/print-orders">All</Link>
          <Link className={filters.view === "attention" ? styles.activeFilter : ""} href="/admin/print-orders?view=attention">Needs Attention</Link>
          <Link className={filters.tracking === "tracked" ? styles.activeFilter : ""} href="/admin/print-orders?tracking=tracked">Tracked Print</Link>
          <Link className={filters.tracking === "none" ? styles.activeFilter : ""} href="/admin/print-orders?tracking=none">No Tracking</Link>
        </nav>

        <section className={styles.tablePanel}>
          <div className={styles.tableMeta}><strong>{data?.length || 0} orders</strong>{searchQuery ? <span>Search: “{searchQuery}”</span> : null}</div>
          <div
            className={styles.tableScroll}
            role="region"
            aria-label="Print orders table. Use Shift plus mouse wheel or the horizontal scrollbar to view all columns."
            tabIndex={0}
          >
            <table>
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Product</th><th>SKU / Material</th><th>Qty</th><th>Tracking</th><th>Campaign</th><th>Artwork method</th><th>Artwork</th><th>Proof</th><th>Production</th><th>Fulfillment</th><th>Provisioning</th><th>QR</th><th>Attention</th><th>Created</th></tr>
              </thead>
              <tbody>
                {(data || []).map((item: any) => (
                  <tr key={item.id}>
                    <td><Link className={styles.orderLink} href={`/admin/print-orders/${item.id}`}>{item.shopify_order_number || item.shopify_order_id}</Link></td>
                    <td>{item.customer_name || item.customer_email || "Guest"}</td>
                    <td className={styles.productCell}>{item.product_title}{item.variant_title ? <small>{item.variant_title}</small> : null}</td>
                    <td>{item.sku || "—"}<small>{formatAdminLabel(item.material_type)}</small></td>
                    <td>{item.quantity}</td>
                    <td><StatusBadge value={item.tracking_mode} /></td>
                    <td>{item.campaign_name || "—"}</td>
                    <td>{formatAdminLabel(item.artwork_method)}{item.reorder_reference ? <small>{item.reorder_reference}</small> : null}</td>
                    <td><StatusBadge value={item.artwork_status} /></td>
                    <td><StatusBadge value={item.proof_status} /></td>
                    <td><StatusBadge value={item.production_status} /></td>
                    <td><StatusBadge value={item.fulfillment_status} /></td>
                    <td><StatusBadge value={item.provisioning_status} /></td>
                    <td><StatusBadge value={item.print_qr_provisionings?.[0]?.provisioning_status} /></td>
                    <td className={styles.attentionCell}>{formatAdminLabel(item.attention_reason)}</td>
                    <td>{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.length ? <p className={styles.empty}>No print orders match these filters.</p> : null}
        </section>
      </main>
    </DashboardShell>
  );
}
