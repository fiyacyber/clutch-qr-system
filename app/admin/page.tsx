import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, FileWarning, PackageCheck, Truck, Workflow } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { formatAdminLabel, formatOrderAge, getAdminStatusTone } from "@/lib/admin-operations";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_title: string;
  workflow_state: string;
  artwork_status: string;
  proof_status: string;
  production_status: string;
  fulfillment_status: string;
  provisioning_status: string;
  attention_reason: string | null;
  created_at: string;
  workflow_updated_at: string;
};

type ActivityRow = {
  id: string;
  order_id: string;
  action: string;
  actor_type: string;
  reason: string | null;
  created_at: string;
};

const ORDER_SELECTION = "id,shopify_order_id,shopify_order_number,customer_name,customer_email,product_title,workflow_state,artwork_status,proof_status,production_status,fulfillment_status,provisioning_status,attention_reason,created_at,workflow_updated_at";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ value }: { value: string }) {
  const tone = getAdminStatusTone(value);
  return <span className={`${styles.status} ${styles[tone]}`}>{formatAdminLabel(value)}</span>;
}

export default async function AdminOperationsOverview() {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (customer?.must_change_password) redirect("/change-password");
  if (!customer?.is_admin) redirect("/portal");

  const admin = createSupabaseAdminClient();
  const countQuery = () => admin.from("print_order_items").select("id", { count: "exact", head: true });

  const [
    attentionCountResult,
    missingArtworkCountResult,
    proofActionCountResult,
    readyProductionCountResult,
    unfulfilledCountResult,
    qrSetupCountResult,
    artworkNeededCountResult,
    proofPreparationCountResult,
    awaitingCustomerCountResult,
    readyPipelineCountResult,
    inProductionCountResult,
    readyFulfillCountResult,
    attentionOrdersResult,
    recentOrdersResult,
    recentActivityResult,
    failuresResult,
  ] = await Promise.all([
    countQuery().in("provisioning_status", ["needs_attention", "failed"]),
    countQuery().eq("artwork_status", "not_received"),
    countQuery().in("proof_status", ["preparing", "sent", "changes_requested"]),
    countQuery().or("workflow_state.eq.ready_for_production,production_status.eq.ready"),
    countQuery().in("fulfillment_status", ["unfulfilled", "partial"]),
    countQuery().in("qr_setup_status", ["setup_required", "draft"]),
    countQuery().in("workflow_state", ["awaiting_artwork", "artwork_changes_requested"]),
    countQuery().eq("workflow_state", "proof_preparing"),
    countQuery().eq("workflow_state", "proof_sent"),
    countQuery().eq("workflow_state", "ready_for_production"),
    countQuery().in("workflow_state", ["submitted_to_supplier", "in_production"]),
    countQuery().eq("workflow_state", "production_complete"),
    admin.from("print_order_items").select(ORDER_SELECTION).in("provisioning_status", ["needs_attention", "failed"]).order("workflow_updated_at", { ascending: true }).limit(12),
    admin.from("print_order_items").select(ORDER_SELECTION).order("created_at", { ascending: false }).limit(8),
    admin.from("order_activity").select("id,order_id,action,actor_type,reason,created_at").order("created_at", { ascending: false }).limit(8),
    admin.from("print_order_items").select(ORDER_SELECTION).eq("provisioning_status", "failed").order("workflow_updated_at", { ascending: false }).limit(6),
  ]);

  const results = [
    attentionCountResult,
    missingArtworkCountResult,
    proofActionCountResult,
    readyProductionCountResult,
    unfulfilledCountResult,
    qrSetupCountResult,
    artworkNeededCountResult,
    proofPreparationCountResult,
    awaitingCustomerCountResult,
    readyPipelineCountResult,
    inProductionCountResult,
    readyFulfillCountResult,
    attentionOrdersResult,
    recentOrdersResult,
    recentActivityResult,
    failuresResult,
  ];
  if (results.some((result) => result.error)) throw new Error("Unable to load the admin operations overview.");

  const attentionOrders = (attentionOrdersResult.data || []) as OrderRow[];
  const recentOrders = (recentOrdersResult.data || []) as OrderRow[];
  const recentActivity = (recentActivityResult.data || []) as ActivityRow[];
  const failures = (failuresResult.data || []) as OrderRow[];
  const orderLabels = new Map([...attentionOrders, ...recentOrders, ...failures].map((order) => [order.id, order.shopify_order_number || order.shopify_order_id]));

  const metrics = [
    { label: "Failed or attention-required", value: attentionCountResult.count || 0, icon: AlertTriangle },
    { label: "Missing artwork", value: missingArtworkCountResult.count || 0, icon: FileWarning },
    { label: "Proofs awaiting action", value: proofActionCountResult.count || 0, icon: Workflow },
    { label: "Ready for production", value: readyProductionCountResult.count || 0, icon: PackageCheck },
    { label: "Unfulfilled orders", value: unfulfilledCountResult.count || 0, icon: Truck },
  ];

  const pipeline = [
    ["QR setup needed", qrSetupCountResult.count || 0],
    ["Artwork needed", artworkNeededCountResult.count || 0],
    ["Proof preparation", proofPreparationCountResult.count || 0],
    ["Awaiting customer", awaitingCustomerCountResult.count || 0],
    ["Ready for production", readyPipelineCountResult.count || 0],
    ["In production", inProductionCountResult.count || 0],
    ["Ready to fulfill", readyFulfillCountResult.count || 0],
  ] as const;

  return (
    <DashboardShell isAdmin>
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1>Operations Overview</h1>
            <p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p>
          </div>
          <Link href="/admin/print-orders" className={styles.primaryAction}>Open Order Queue <ArrowRight size={16} /></Link>
        </header>

        <section className={styles.metricGrid} aria-label="Operations metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className={styles.metricCard} key={metric.label}>
                <Icon size={18} aria-hidden="true" />
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            );
          })}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div><h2>Needs Attention</h2><p>Orders with an explicit provisioning failure or attention state.</p></div>
            <Link href="/admin/print-orders?view=attention">View queue</Link>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Order</th><th>Customer</th><th>Issue</th><th>Workflow stage</th><th>Age</th><th>Action</th></tr></thead>
              <tbody>
                {attentionOrders.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/admin/print-orders/${order.id}`}>{order.shopify_order_number || order.shopify_order_id}</Link><small>{order.product_title}</small></td>
                    <td>{order.customer_name || order.customer_email || "Guest"}</td>
                    <td><StatusBadge value={order.provisioning_status} /><small>{formatAdminLabel(order.attention_reason, "No reason supplied")}</small></td>
                    <td><StatusBadge value={order.workflow_state} /></td>
                    <td>{formatOrderAge(order.created_at)}</td>
                    <td><Link className={styles.rowAction} href={`/admin/print-orders/${order.id}`}>Review</Link></td>
                  </tr>
                ))}
                {!attentionOrders.length ? <tr><td colSpan={6} className={styles.empty}>No orders currently require attention.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}><div><h2>Production Pipeline</h2><p>Current order counts by operational stage.</p></div></div>
          <div className={styles.pipeline}>
            {pipeline.map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}
          </div>
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.panel}>
            <div className={styles.sectionHeader}><div><h2>Recent Orders</h2><p>Newest print-order records.</p></div><Link href="/admin/print-orders">All orders</Link></div>
            <ul className={styles.compactList}>
              {recentOrders.map((order) => <li key={order.id}><div><Link href={`/admin/print-orders/${order.id}`}>{order.shopify_order_number || order.shopify_order_id}</Link><span>{order.customer_name || order.customer_email || "Guest"}</span></div><StatusBadge value={order.workflow_state} /></li>)}
              {!recentOrders.length ? <li className={styles.empty}>No print orders yet.</li> : null}
            </ul>
          </article>

          <article className={styles.panel}>
            <div className={styles.sectionHeader}><div><h2>Recent Activity</h2><p>Latest recorded workflow events.</p></div><Link href="/admin/activity">View activity</Link></div>
            <ul className={styles.activityList}>
              {recentActivity.map((event) => <li key={event.id}><div><strong>{formatAdminLabel(event.action)}</strong><span>{orderLabels.get(event.order_id) || "Print order"} · {formatAdminLabel(event.actor_type)}</span></div><time>{formatDateTime(event.created_at)}</time></li>)}
              {!recentActivity.length ? <li className={styles.empty}>No operational activity yet.</li> : null}
            </ul>
          </article>

          <article className={styles.panel}>
            <div className={styles.sectionHeader}><div><h2>Provisioning Failures</h2><p>Orders with a failed provisioning state.</p></div></div>
            <ul className={styles.failureList}>
              {failures.map((order) => <li key={order.id}><AlertTriangle size={16} aria-hidden="true" /><div><Link href={`/admin/print-orders/${order.id}`}>{order.shopify_order_number || order.shopify_order_id}</Link><span>{formatAdminLabel(order.attention_reason, "Failure reason unavailable")}</span></div></li>)}
              {!failures.length ? <li className={styles.empty}>No provisioning failures.</li> : null}
            </ul>
          </article>
        </section>
      </main>
    </DashboardShell>
  );
}
