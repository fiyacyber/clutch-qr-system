import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, Boxes, CheckCircle2, QrCode } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import { requireCustomer } from "@/lib/auth";
import { groupBusinessKitItems, type BusinessKitItem } from "@/lib/business-kits";
import { loadAccountAccess } from "@/lib/account-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "../business-kits.module.css";

function label(value?: string | null) {
  const normalized = String(value || "").replace(/_/g, " ").trim();
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Pending";
}

export default async function BusinessKitDetailPage({ params }: { params: Promise<{ kitKey: string }> }) {
  const { kitKey } = await params;
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
  if (itemsResult.error || provisioningsResult.error) throw new Error("Unable to load Business Kit details.");

  const sourceByItem = new Map((provisioningsResult.data || []).map((row) => [String(row.print_order_item_id), row]));
  const items: BusinessKitItem[] = (itemsResult.data || []).map((item) => ({
    ...item,
    source_type: sourceByItem.get(String(item.id))?.source_type || null,
    qr_code_id: sourceByItem.get(String(item.id))?.qr_code_id || null,
  }));
  const decodedKey = decodeURIComponent(kitKey);
  const kit = groupBusinessKitItems(items).find((group) => group.key === decodedKey);
  if (!kit) notFound();

  const qrIds = kit.items.map((item) => item.qr_code_id).filter((value): value is string => Boolean(value));
  const qrResult = qrIds.length
    ? await admin.from("qr_codes").select("id,name,scan_count").eq("customer_id", customer.id).in("id", qrIds)
    : { data: [], error: null };
  if (qrResult.error) throw new Error("Unable to load Business Kit performance.");
  const qrById = new Map((qrResult.data || []).map((row) => [String(row.id), row]));
  const totalScans = kit.items.reduce((sum, item) => sum + Number(item.qr_code_id ? qrById.get(item.qr_code_id)?.scan_count || 0 : 0), 0);
  const topItem = [...kit.items]
    .map((item) => ({ item, scans: Number(item.qr_code_id ? qrById.get(item.qr_code_id)?.scan_count || 0 : 0) }))
    .sort((a, b) => b.scans - a.scans)[0];

  return (
    <DashboardShell accountAccess={{ ...access, hasBusinessKit: true }} isAdmin={Boolean(customer.is_admin)}>
      <main className={styles.page}>
        <Link href="/portal/business-kits" className={styles.backLink}><ArrowLeft size={16} /> Back to Business Kits</Link>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Business Kit workspace</span>
            <h1>{kit.name}</h1>
            <p>Order {kit.orderNumber} · Prepare every item for production and compare how each print piece performs.</p>
          </div>
          {totalScans > 0 ? <Link href="/portal/analytics" className={styles.shopButton}><BarChart3 size={18} /> Open Analytics</Link> : null}
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <h2>Kit progress</h2>
            <div className={styles.progressLabel}><span>Setup complete</span><strong>{kit.progressPercent}%</strong></div>
            <div className={styles.progressTrack}><span style={{ width: `${kit.progressPercent}%` }} /></div>
            <div className={styles.summaryMetrics}>
              <article><strong>{kit.itemCount}</strong><span>Total items</span></article>
              <article><strong>{kit.readyCount}</strong><span>Ready items</span></article>
              <article><strong>{kit.trackedCount}</strong><span>Tracked items</span></article>
              <article><strong>{kit.attentionCount}</strong><span>Need attention</span></article>
            </div>
          </article>
          <article className={styles.summaryCard}>
            <h2>Kit performance</h2>
            <div className={styles.summaryMetrics}>
              <article><strong>{totalScans}</strong><span>Total scans</span></article>
              <article><strong>{topItem?.scans || 0}</strong><span>Top item scans</span></article>
              <article><strong>{topItem?.item.material_type ? label(topItem.item.material_type) : "—"}</strong><span>Top material</span></article>
              <article><strong>{kit.trackedCount ? `${Math.round(totalScans / kit.trackedCount)}` : "0"}</strong><span>Scans per tracked item</span></article>
            </div>
            <p>Each eligible print item uses its own linked Clutch Code, so business cards, flyers, door hangers, postcards, and signage can be compared inside one campaign.</p>
          </article>
        </section>

        <div className={styles.itemGrid}>
          {kit.items.map((item) => {
            const qr = item.qr_code_id ? qrById.get(item.qr_code_id) : null;
            return (
              <article className={styles.itemCard} key={item.id}>
                <div className={styles.itemHeader}>
                  <div><h3>{item.product_title || item.material_type || "Print item"}</h3><p>{label(item.material_type)} · Quantity {item.quantity || 1}</p></div>
                  <span className={styles.itemStatus}>{item.fulfillment_status === "delivered" ? "Delivered" : item.production_status === "completed" ? "Production complete" : item.proof_status === "sent" ? "Proof ready" : "In setup"}</span>
                </div>
                <div className={styles.workflow}>
                  <article><span>Artwork</span><strong>{label(item.artwork_status)}</strong></article>
                  <article><span>Proof</span><strong>{label(item.proof_status)}</strong></article>
                  <article><span>Production</span><strong>{label(item.production_status)}</strong></article>
                  <article><span>Fulfillment</span><strong>{label(item.fulfillment_status)}</strong></article>
                </div>
                {item.attention_reason ? <p className={styles.attention}>{item.attention_reason}</p> : null}
                <p>{item.tracking_mode === "none" ? "No Clutch Code selected" : item.qr_code_id ? `${Number(qr?.scan_count || 0)} scans · ${qr?.name || "Clutch Code connected"}` : "Clutch Code setup pending"}</p>
                <Link href={`/portal/print-orders/${item.id}`}>{item.proof_status === "sent" ? <CheckCircle2 size={16} /> : item.qr_code_id ? <QrCode size={16} /> : <Boxes size={16} />} Manage item <ArrowRight size={16} /></Link>
              </article>
            );
          })}
        </div>
      </main>
    </DashboardShell>
  );
}
