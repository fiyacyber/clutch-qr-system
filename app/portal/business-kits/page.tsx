import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, PackageCheck, ShoppingBag } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import { requireCustomer } from "@/lib/auth";
import { groupBusinessKitItems, type BusinessKitItem } from "@/lib/business-kits";
import { loadAccountAccess } from "@/lib/account-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./business-kits.module.css";

function formatDate(value?: string | null) {
  if (!value) return "Recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export default async function BusinessKitsPage() {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) return <DashboardShell><PortalCustomerLookupUnavailable /></DashboardShell>;
  if (!customer) return <PortalAccountNotActive />;

  const admin = createSupabaseAdminClient();
  const [access, itemsResult, provisioningsResult] = await Promise.all([
    loadAccountAccess(admin, customer),
    admin.from("print_order_items")
      .select("id,shopify_order_id,shopify_order_number,product_title,variant_title,material_type,quantity,tracking_mode,campaign_name,artwork_status,proof_status,production_status,fulfillment_status,provisioning_status,attention_reason,normalized_properties,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    admin.from("print_qr_provisionings")
      .select("print_order_item_id,source_type,qr_code_id")
      .eq("customer_id", customer.id),
  ]);

  if (itemsResult.error || provisioningsResult.error) throw new Error("Unable to load Business Kits.");
  const sourceByItem = new Map((provisioningsResult.data || []).map((row) => [String(row.print_order_item_id), row]));
  const items: BusinessKitItem[] = (itemsResult.data || []).map((item) => ({
    ...item,
    source_type: sourceByItem.get(String(item.id))?.source_type || null,
    qr_code_id: sourceByItem.get(String(item.id))?.qr_code_id || null,
  }));
  const kits = groupBusinessKitItems(items);

  return (
    <DashboardShell accountAccess={{ ...access, hasBusinessKit: kits.length > 0 || access.hasBusinessKit }} isAdmin={Boolean(customer.is_admin)}>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Business Kits</span>
            <h1>One campaign. Every print piece.</h1>
            <p>Prepare artwork, assign included Clutch Codes, approve proofs, and compare performance across every item in your kit.</p>
          </div>
          <a className={styles.shopButton} href="https://clutchprintshop.com/pages/business-kits"><ShoppingBag size={18} /> Shop Business Kits</a>
        </header>

        {kits.length ? (
          <div className={styles.kitGrid}>
            {kits.map((kit) => (
              <article className={styles.kitCard} key={kit.key}>
                <div className={styles.kitTop}>
                  <span className={styles.kitIcon}><Boxes size={24} /></span>
                  <span className={styles.statusPill}>{kit.progressPercent === 100 ? "Ready" : "Setup in progress"}</span>
                </div>
                <h2>{kit.name}</h2>
                <p>Order {kit.orderNumber} · Purchased {formatDate(kit.createdAt)}</p>
                <div className={styles.progressLabel}><span>Kit setup</span><strong>{kit.readyCount} of {kit.itemCount} items ready</strong></div>
                <div className={styles.progressTrack}><span style={{ width: `${kit.progressPercent}%` }} /></div>
                <div className={styles.metrics}>
                  <article><strong>{kit.trackedCount}</strong><span>Tracked items</span></article>
                  <article><strong>{kit.proofActionCount}</strong><span>Proof actions</span></article>
                  <article><strong>{kit.attentionCount}</strong><span>Need attention</span></article>
                </div>
                <Link href={`/portal/business-kits/${encodeURIComponent(kit.key)}`}>Open Kit workspace <ArrowRight size={16} /></Link>
              </article>
            ))}
          </div>
        ) : (
          <section className={styles.emptyState}>
            <span className={styles.emptyIcon}><Boxes size={34} /></span>
            <h2>No Business Kits yet</h2>
            <p>Business Kits combine coordinated print pieces, included tracking, and one dashboard for artwork, proofs, production, fulfillment, and campaign comparison.</p>
            <a className={styles.primaryButton} href="https://clutchprintshop.com/pages/business-kits"><PackageCheck size={18} /> Explore Business Kits</a>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
