import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { summarizeAdminCustomerEvidence } from "@/lib/admin-customer-detail";
import { assertAdminCustomerQueriesSucceeded } from "@/lib/admin-customer-data";
import { formatAdminLabel, getAdminStatusTone } from "@/lib/admin-operations";
import { normalizeRelation } from "@/lib/account-evidence";
import { requireCustomer } from "@/lib/auth";
import { isCanonicalCustomerId } from "@/lib/customer-identifiers";
import { getCustomerPlan } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

const CUSTOMER_DETAIL_LIST_LIMIT = 50;
const CUSTOMER_ACTIVITY_LIMIT = 25;

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ value }: { value?: string | null }) {
  const tone = getAdminStatusTone(value);
  return <span className={`${styles.status} ${styles[tone]}`}>{formatAdminLabel(value)}</span>;
}

function formatRecordSummary(visible: number, total: number, label: string) {
  return total > visible ? `Showing ${visible} of ${total} ${label}` : `${total} ${label}`;
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = await params;
  const { user, customer: currentCustomer } = await requireCustomer();
  if (!user) redirect("/login");
  if (currentCustomer?.must_change_password) redirect("/change-password");
  if (!currentCustomer?.is_admin) redirect("/portal");
  if (!isCanonicalCustomerId(routeId)) notFound();

  const id = routeId;
  const admin = createSupabaseAdminClient();
  const customerResult = await admin
    .from("customers")
    .select("*, customer_groups(id, name)")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  assertAdminCustomerQueriesSucceeded([
    { name: "customer account", error: customerResult.error },
  ]);

  if (!customerResult.data) notFound();

  const [
    qrCodesResult,
    profilesResult,
    printOrdersResult,
    provisioningsResult,
    cardOrdersResult,
    shopifyOrdersResult,
    entitlementEventsResult,
    usedQrCountResult,
    smartCardQrCountResult,
    activeProfileCountResult,
    completedProvisioningCountResult,
    includedProvisioningCountResult,
    trackedProvisioningCountResult,
    businessKitProvisioningCountResult,
  ] = await Promise.all([
    admin.from("qr_codes").select("id,name,slug,destination_url,scan_count,is_active,is_system,qr_type,counts_toward_capacity,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("profiles").select("id,slug,business_name,contact_name,is_active,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("print_order_items").select("id,shopify_order_number,product_title,material_type,workflow_state,provisioning_status,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("print_qr_provisionings").select("id,print_order_item_id,qr_code_id,source_type,access_type,material_type,provisioning_status,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("card_orders").select("id,shopify_order_number,product_title,status,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("shopify_orders").select("id,shopify_order_number,total_price,financial_status,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("shopify_entitlement_events").select("id,action,plan_code,status,error_message,created_at", { count: "exact" }).eq("customer_id", id).order("created_at", { ascending: false }).limit(CUSTOMER_DETAIL_LIST_LIMIT),
    admin.from("qr_codes").select("id", { count: "exact", head: true }).eq("customer_id", id).or("counts_toward_capacity.is.null,counts_toward_capacity.eq.true"),
    admin.from("qr_codes").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("is_system", true).eq("qr_type", "smart_card"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("is_active", true),
    admin.from("print_qr_provisionings").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("provisioning_status", "completed"),
    admin.from("print_qr_provisionings").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("provisioning_status", "completed").eq("access_type", "included_permanent"),
    admin.from("print_qr_provisionings").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("provisioning_status", "completed").eq("source_type", "tracked_print"),
    admin.from("print_qr_provisionings").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("provisioning_status", "completed").eq("source_type", "business_kit"),
  ]);

  assertAdminCustomerQueriesSucceeded([
    { name: "customer QR codes", error: qrCodesResult.error },
    { name: "customer profiles", error: profilesResult.error },
    { name: "customer print orders", error: printOrdersResult.error },
    { name: "customer print provisionings", error: provisioningsResult.error },
    { name: "customer card orders", error: cardOrdersResult.error },
    { name: "customer Shopify orders", error: shopifyOrdersResult.error },
    { name: "customer entitlement events", error: entitlementEventsResult.error },
    { name: "customer used QR count", error: usedQrCountResult.error },
    { name: "customer Smart Card QR count", error: smartCardQrCountResult.error },
    { name: "customer active profile count", error: activeProfileCountResult.error },
    { name: "customer completed provisioning count", error: completedProvisioningCountResult.error },
    { name: "customer included provisioning count", error: includedProvisioningCountResult.error },
    { name: "customer tracked print evidence", error: trackedProvisioningCountResult.error },
    { name: "customer Business Kit evidence", error: businessKitProvisioningCountResult.error },
  ]);

  const printOrderIds = (printOrdersResult.data || []).map((order) => order.id);
  const emptyResult = { data: [], error: null };
  const orderActivityResult = printOrderIds.length
    ? await admin.from("order_activity").select("id,order_id,action,actor_type,reason,created_at").eq("order_type", "print_order").in("order_id", printOrderIds).order("created_at", { ascending: false }).limit(CUSTOMER_ACTIVITY_LIMIT)
    : emptyResult;

  assertAdminCustomerQueriesSucceeded([
    { name: "customer order activity", error: orderActivityResult.error },
  ]);

  const customer: any = customerResult.data;
  const qrCodes = qrCodesResult.data || [];
  const profiles = profilesResult.data || [];
  const printOrders = printOrdersResult.data || [];
  const provisionings = provisioningsResult.data || [];
  const cardOrders = cardOrdersResult.data || [];
  const shopifyOrders = shopifyOrdersResult.data || [];
  const entitlementEvents = entitlementEventsResult.data || [];
  const orderActivity = orderActivityResult.data || [];
  const qrCodeCount = qrCodesResult.count ?? 0;
  const profileCount = profilesResult.count ?? 0;
  const printOrderCount = printOrdersResult.count ?? 0;
  const provisioningCount = provisioningsResult.count ?? 0;
  const cardOrderCount = cardOrdersResult.count ?? 0;
  const shopifyOrderCount = shopifyOrdersResult.count ?? 0;
  const entitlementEventCount = entitlementEventsResult.count ?? 0;
  const group = normalizeRelation(customer.customer_groups)[0];
  const plan = getCustomerPlan(customer);
  const evidence = summarizeAdminCustomerEvidence({
    customer,
    qrCodes,
    profiles,
    cardOrders,
    printOrders,
    provisionings,
    exact: {
      qrCodes: qrCodeCount,
      usedQrCodes: usedQrCountResult.count ?? 0,
      activeProfiles: activeProfileCountResult.count ?? 0,
      cardOrders: cardOrderCount,
      printOrders: printOrderCount,
      completedProvisionings: completedProvisioningCountResult.count ?? 0,
      includedPrintQr: includedProvisioningCountResult.count ?? 0,
      hasSmartCardSystemQr: (smartCardQrCountResult.count ?? 0) > 0,
      hasTrackedPrint: (trackedProvisioningCountResult.count ?? 0) > 0,
      hasBusinessKit: (businessKitProvisioningCountResult.count ?? 0) > 0,
    },
  });
  const visibleOrderRecords = printOrders.length + cardOrders.length + shopifyOrders.length;
  const totalOrderRecords = printOrderCount + cardOrderCount + shopifyOrderCount;
  const visibleActivityCount = orderActivity.length + Math.min(entitlementEvents.length, CUSTOMER_ACTIVITY_LIMIT);

  return (
    <DashboardShell isAdmin>
      <main className={`${styles.page} container admin-page`}>
        <Link className={styles.backLink} href="/admin/customers">← Back to customers</Link>

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Customer account</p>
            <h1>{customer.company_name || customer.email}</h1>
            <p>{customer.email} · Created {formatDate(customer.created_at)}</p>
          </div>
          <StatusBadge value={customer.subscription_status || customer.plan_status || "active"} />
        </header>

        <section className={styles.metrics} aria-label="Customer evidence summary">
          <article><span>QR codes</span><strong>{evidence.counts.qrCodes}</strong></article>
          <article><span>Print orders</span><strong>{evidence.counts.printOrders}</strong></article>
          <article><span>Active profiles</span><strong>{evidence.counts.activeProfiles}</strong></article>
          <article><span>Smart Card orders</span><strong>{evidence.counts.cardOrders}</strong></article>
        </section>

        <div className={styles.columns}>
          <div className={styles.primaryColumn}>
            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <h2>Orders</h2>
                <span>{formatRecordSummary(visibleOrderRecords, totalOrderRecords, "records")}</span>
              </div>
              {printOrders.length ? (
                <div className={styles.tableRegion} role="region" aria-label="Customer print orders" tabIndex={0}>
                  <table>
                    <thead><tr><th>Order</th><th>Product</th><th>Material</th><th>Workflow</th><th>Provisioning</th><th>Created</th></tr></thead>
                    <tbody>{printOrders.map((order) => (
                      <tr key={order.id}>
                        <td><Link href={`/admin/print-orders/${order.id}`}>{order.shopify_order_number || order.id}</Link></td>
                        <td>{order.product_title}</td>
                        <td>{formatAdminLabel(order.material_type)}</td>
                        <td><StatusBadge value={order.workflow_state} /></td>
                        <td><StatusBadge value={order.provisioning_status} /></td>
                        <td>{formatDate(order.created_at)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className={styles.empty}>No print orders are linked to this customer.</p>}
              {cardOrders.length ? <div className={styles.recordList}>{cardOrders.map((order) => (
                <article key={order.id}><strong>Smart Card · {order.shopify_order_number || order.id}</strong><span>{order.product_title || "Smart Card order"} · {formatAdminLabel(order.status)} · {formatDate(order.created_at)}</span></article>
              ))}</div> : null}
              {shopifyOrders.length ? <div className={styles.recordList}>{shopifyOrders.map((order) => (
                <article key={order.id}><strong>Shopify · {order.shopify_order_number || order.id}</strong><span>{formatAdminLabel(order.financial_status)} · {order.total_price == null ? "Total unavailable" : `$${Number(order.total_price).toFixed(2)}`} · {formatDate(order.created_at)}</span></article>
              ))}</div> : null}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <h2>QR and profile evidence</h2>
                <span>
                  {formatRecordSummary(qrCodes.length, qrCodeCount, "QR codes")}
                  {" · "}
                  {formatRecordSummary(profiles.length, profileCount, "profiles")}
                </span>
              </div>
              {qrCodes.length ? <div className={styles.recordList}>{qrCodes.map((qr) => (
                <article key={qr.id}>
                  <strong>{qr.name}</strong>
                  <span>{qr.slug} · {formatAdminLabel(qr.qr_type)} · {qr.scan_count || 0} scans · {qr.is_active ? "Active" : "Inactive"}</span>
                  <span className={styles.destination}>{qr.destination_url}</span>
                </article>
              ))}</div> : <p className={styles.empty}>No QR codes are linked to this customer.</p>}
              {profiles.length ? <div className={styles.recordList}>{profiles.map((profile) => (
                <article key={profile.id}>
                  <strong>{profile.business_name || profile.contact_name || profile.slug}</strong>
                  <span>{profile.slug} · {profile.is_active ? "Active" : "Inactive"} · Created {formatDate(profile.created_at)}</span>
                </article>
              ))}</div> : <p className={styles.empty}>No Clutch Connect profile evidence is linked to this customer.</p>}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <h2>Recent activity</h2>
                <span>{visibleActivityCount} recent events from listed orders and entitlements</span>
              </div>
              {(orderActivity.length || entitlementEvents.length) ? <div className={styles.timeline}>
                {orderActivity.slice(0, 25).map((event) => <article key={event.id}>
                  <span>{formatDate(event.created_at)}</span>
                  <strong>{formatAdminLabel(event.action)}</strong>
                  <p>{formatAdminLabel(event.actor_type)}{event.reason ? ` · ${formatAdminLabel(event.reason)}` : ""}</p>
                </article>)}
                {entitlementEvents.slice(0, 25).map((event) => <article key={event.id}>
                  <span>{formatDate(event.created_at)}</span>
                  <strong>{formatAdminLabel(event.action)}</strong>
                  <p>Entitlement · {formatAdminLabel(event.status)}{event.error_message ? ` · ${event.error_message}` : ""}</p>
                </article>)}
              </div> : <p className={styles.empty}>No order or entitlement activity is recorded.</p>}
            </section>
          </div>

          <aside className={styles.secondaryColumn}>
            <section className={styles.card}>
              <h2>Account</h2>
              <dl className={styles.details}>
                <div><dt>Customer ID</dt><dd>{customer.id}</dd></div>
                <div><dt>Auth user ID</dt><dd>{customer.auth_user_id || "Not linked"}</dd></div>
                <div><dt>Company</dt><dd>{customer.company_name || "Not provided"}</dd></div>
                <div><dt>Group</dt><dd>{group?.name || "Ungrouped"}</dd></div>
                <div><dt>Onboarding</dt><dd>{formatAdminLabel(customer.onboarding_status, "Not Started")}</dd></div>
                <div><dt>Shopify customer</dt><dd>{customer.shopify_customer_id || "Not linked"}</dd></div>
              </dl>
            </section>

            <section className={styles.card}>
              <h2>Access and entitlements</h2>
              <dl className={styles.details}>
                <div><dt>Base profile plan</dt><dd>{plan.name}</dd></div>
                <div><dt>Active products</dt><dd>{evidence.access.activeProductLabels.join(", ") || "None"}</dd></div>
                <div><dt>QR capacity</dt><dd>{evidence.access.usedQrCount}/{evidence.access.effectiveQrCapacity === null ? "Unlimited" : evidence.access.effectiveQrCapacity}</dd></div>
                <div><dt>Included print QR</dt><dd>{evidence.access.includedPrintQrCount}</dd></div>
                <div><dt>Tracked print</dt><dd>{evidence.access.hasTrackedPrint ? "Yes" : "No"}</dd></div>
                <div><dt>Business Kit</dt><dd>{evidence.access.hasBusinessKit ? "Yes" : "No"}</dd></div>
                <div><dt>Connect+</dt><dd>{evidence.access.hasConnectPlus ? "Active" : "No"}</dd></div>
                <div><dt>Clutch Codes</dt><dd>{evidence.access.clutchCodesPlanName || "None"}</dd></div>
              </dl>
              {evidence.access.warnings.length ? <ul className={styles.warnings}>{evidence.access.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <h2>Provisioning evidence</h2>
                <span>{formatRecordSummary(provisionings.length, provisioningCount, "records")}</span>
              </div>
              {provisionings.length ? <div className={styles.recordList}>{provisionings.map((row) => (
                <article key={row.id}>
                  <strong>{formatAdminLabel(row.source_type)} · {formatAdminLabel(row.access_type)}</strong>
                  <span>{formatAdminLabel(row.material_type)} · {formatAdminLabel(row.provisioning_status)} · {formatDate(row.created_at)}</span>
                </article>
              ))}</div> : <p className={styles.empty}>No completed or pending print provisioning evidence.</p>}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <h2>Subscription evidence</h2>
                <span>{formatRecordSummary(entitlementEvents.length, entitlementEventCount, "events")}</span>
              </div>
              {entitlementEvents.length ? <div className={styles.recordList}>{entitlementEvents.map((event) => (
                <article key={event.id}>
                  <strong>{formatAdminLabel(event.action)}</strong>
                  <span>{formatAdminLabel(event.plan_code, "No plan")} · {formatAdminLabel(event.status)} · {formatDate(event.created_at)}</span>
                </article>
              ))}</div> : <p className={styles.empty}>No Shopify entitlement events are linked to this customer.</p>}
            </section>
          </aside>
        </div>
      </main>
    </DashboardShell>
  );
}
