import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface AdminQaPageProps {
  searchParams?: Promise<{ q?: string }>;
}

type CardOrderRow = {
  id: string;
  shopify_order_id: string | null;
  shopify_order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  engraving_requested: boolean | null;
  engraving_business_name: string | null;
  engraving_title: string | null;
  engraving_phone: string | null;
  engraving_email: string | null;
  custom_details: string | null;
  welcome_email_sent_at: string | null;
  status: string | null;
  created_at: string;
};

type ShopifyOrderRow = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string | null;
  customer_id: string | null;
  customer_email: string | null;
  financial_status: string | null;
  created_at: string;
};

type ShopifyWebhookRow = {
  id: string;
  webhook_id: string;
  topic: string;
  shop_domain: string | null;
  processed_at: string;
};

type CustomerQaRow = {
  id: string;
  email: string | null;
  company_name: string | null;
  onboarding_status: string | null;
  guided_setup_required?: boolean | null;
  created_at: string | null;
};

type ProfileQaRow = {
  id: string;
  customer_id: string;
  is_active: boolean | null;
  setup_completed?: boolean | null;
};

type ChecklistStatus = "PASS" | "WARNING" | "MISSING";

type ChecklistItem = {
  label: string;
  status: ChecklistStatus;
  note?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function safeLower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function hasValue(value: string | null | undefined) {
  return Boolean(String(value || "").trim());
}

function statusClassName(status: ChecklistStatus) {
  if (status === "PASS") return styles.pass;
  if (status === "WARNING") return styles.warning;
  return styles.missing;
}

function hasEngravingDetails(order: CardOrderRow) {
  if (!order.engraving_requested) return true;

  return [
    order.engraving_business_name,
    order.engraving_title,
    order.engraving_phone,
    order.engraving_email,
    order.custom_details,
  ].some(hasValue);
}

function missingRequiredEngravingFields(order: CardOrderRow) {
  if (!order.engraving_requested) return false;

  const requiredFields = [
    order.engraving_business_name,
    order.engraving_title,
    order.engraving_phone,
    order.engraving_email,
  ];

  return requiredFields.some((field) => !hasValue(field));
}

function isMissingColumnError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function buildChecklist(
  order: CardOrderRow,
  orderMap: Map<string, ShopifyOrderRow>,
  customerMap: Map<string, CustomerQaRow>,
  profileMap: Map<string, ProfileQaRow>
) {
  const linkedCustomer = order.customer_id ? customerMap.get(order.customer_id) || null : null;
  const profile = order.customer_id ? profileMap.get(order.customer_id) || null : null;
  const hasGuidedRequired = typeof linkedCustomer?.guided_setup_required === "boolean";
  const hasSetupCompleted = typeof profile?.setup_completed === "boolean";
  const guidedTrackable = Boolean(linkedCustomer && (hasGuidedRequired || hasSetupCompleted));

  const onboardingStatus = safeLower(linkedCustomer?.onboarding_status || "");
  const setupComplete =
    profile?.setup_completed === true ||
    onboardingStatus === "complete" ||
    (linkedCustomer?.guided_setup_required === false && onboardingStatus === "active");

  const setupStarted =
    setupComplete ||
    onboardingStatus === "guided_setup" ||
    onboardingStatus === "active" ||
    onboardingStatus === "needs_help";

  const checklist: ChecklistItem[] = [
    {
      label: "Shopify order received",
      status: order.shopify_order_id && orderMap.has(order.shopify_order_id) ? "PASS" : "MISSING",
    },
    {
      label: "Card order created",
      status: order.id ? "PASS" : "MISSING",
    },
    {
      label: "Engraving details captured",
      status: hasEngravingDetails(order) ? "PASS" : "WARNING",
    },
    {
      label: "Customer linked",
      status: order.customer_id ? "PASS" : "MISSING",
    },
    {
      label: "Draft profile created",
      status: order.customer_id ? (profile ? "PASS" : "MISSING") : "MISSING",
    },
    {
      label: "Welcome email sent",
      status: order.welcome_email_sent_at ? "PASS" : "WARNING",
    },
    {
      label: "Guided Setup started if trackable",
      status: !order.customer_id ? "MISSING" : guidedTrackable ? (setupStarted ? "PASS" : "WARNING") : "WARNING",
      note: !guidedTrackable ? "Tracking columns not available on this record yet" : undefined,
    },
    {
      label: "Guided Setup completed if trackable",
      status: !order.customer_id ? "MISSING" : guidedTrackable ? (setupComplete ? "PASS" : "WARNING") : "WARNING",
      note: !guidedTrackable ? "Tracking columns not available on this record yet" : undefined,
    },
  ];

  return { checklist, setupComplete, guidedTrackable };
}

export default async function AdminQaPage({ searchParams }: AdminQaPageProps) {
  const params = await searchParams;
  const queryText = String(params?.q || "").trim();
  const queryNeedle = queryText.toLowerCase();
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (customer?.must_change_password) redirect("/change-password");

  if (!customer?.is_admin) {
    return (
      <DashboardShell>
        <main className="container">
          <section className={styles.notAuthorized}>
            <h1>Not authorized</h1>
            <p>You do not have admin access for onboarding QA diagnostics.</p>
            <p>
              <Link href="/portal">Return to portal</Link>
            </p>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const last24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    cardOrdersResult,
    webhooks24hResult,
    cardOrdersCountResult,
    missingCustomerCountResult,
    missingEngravingCountResult,
    welcomeSentCountResult,
    welcomeMissingCountResult,
    latestWebhooksResult,
    latestShopifyOrdersResult,
  ] = await Promise.all([
    admin
      .from("card_orders")
      .select(
        "id, shopify_order_id, shopify_order_number, customer_id, customer_name, customer_email, engraving_requested, engraving_business_name, engraving_title, engraving_phone, engraving_email, custom_details, welcome_email_sent_at, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(800),
    admin
      .from("shopify_webhooks")
      .select("id", { count: "exact", head: true })
      .gte("processed_at", last24hIso),
    admin.from("card_orders").select("id", { count: "exact", head: true }),
    admin.from("card_orders").select("id", { count: "exact", head: true }).is("customer_id", null),
    admin
      .from("card_orders")
      .select("id", { count: "exact", head: true })
      .eq("engraving_requested", true)
      .or("engraving_business_name.is.null,engraving_title.is.null,engraving_phone.is.null,engraving_email.is.null"),
    admin.from("card_orders").select("id", { count: "exact", head: true }).not("welcome_email_sent_at", "is", null),
    admin.from("card_orders").select("id", { count: "exact", head: true }).is("welcome_email_sent_at", null),
    admin
      .from("shopify_webhooks")
      .select("id, webhook_id, topic, shop_domain, processed_at")
      .order("processed_at", { ascending: false })
      .limit(20),
    admin
      .from("shopify_orders")
      .select("id, shopify_order_id, shopify_order_number, customer_id, customer_email, financial_status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (
    cardOrdersResult.error ||
    webhooks24hResult.error ||
    cardOrdersCountResult.error ||
    missingCustomerCountResult.error ||
    missingEngravingCountResult.error ||
    welcomeSentCountResult.error ||
    welcomeMissingCountResult.error ||
    latestWebhooksResult.error ||
    latestShopifyOrdersResult.error
  ) {
    return (
      <DashboardShell isAdmin>
        <main className={`container ${styles.page}`}>
          <DashboardHeader
            title="Smart Card Onboarding QA"
            subtitle="There was a problem loading this admin QA view."
          />
          <section className={styles.errorState}>
            <h2>Unable to load QA diagnostics</h2>
            <p>Please refresh. If this continues, review server logs and Supabase connectivity.</p>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const cardOrders = (cardOrdersResult.data || []) as CardOrderRow[];
  const latestWebhooks = (latestWebhooksResult.data || []) as ShopifyWebhookRow[];
  const latestShopifyOrders = (latestShopifyOrdersResult.data || []) as ShopifyOrderRow[];

  const filteredCardOrders = queryNeedle
    ? cardOrders.filter((row) =>
        [
          row.shopify_order_number,
          row.customer_email,
          row.customer_name,
          row.engraving_business_name,
        ]
          .map(safeLower)
          .some((value) => value.includes(queryNeedle))
      )
    : cardOrders;

  const shopifyOrderIds = Array.from(
    new Set(filteredCardOrders.map((order) => String(order.shopify_order_id || "").trim()).filter(Boolean))
  );

  const linkedCustomerIds = Array.from(
    new Set(filteredCardOrders.map((order) => String(order.customer_id || "").trim()).filter(Boolean))
  );

  let matchedShopifyOrders: ShopifyOrderRow[] = [];
  if (shopifyOrderIds.length) {
    const { data } = await admin
      .from("shopify_orders")
      .select("id, shopify_order_id, shopify_order_number, customer_id, customer_email, financial_status, created_at")
      .in("shopify_order_id", shopifyOrderIds.slice(0, 600));

    matchedShopifyOrders = (data || []) as ShopifyOrderRow[];
  }

  let linkedCustomers: CustomerQaRow[] = [];
  if (linkedCustomerIds.length) {
    const primary = await admin
      .from("customers")
      .select("id, email, company_name, onboarding_status, guided_setup_required, created_at")
      .in("id", linkedCustomerIds.slice(0, 600));

    if (primary.error && isMissingColumnError(primary.error)) {
      const fallback = await admin
        .from("customers")
        .select("id, email, company_name, onboarding_status, created_at")
        .in("id", linkedCustomerIds.slice(0, 600));

      linkedCustomers = (fallback.data || []) as CustomerQaRow[];
    } else {
      linkedCustomers = (primary.data || []) as CustomerQaRow[];
    }
  }

  let linkedProfiles: ProfileQaRow[] = [];
  if (linkedCustomerIds.length) {
    const primary = await admin
      .from("profiles")
      .select("id, customer_id, is_active, setup_completed")
      .in("customer_id", linkedCustomerIds.slice(0, 600));

    if (primary.error && isMissingColumnError(primary.error)) {
      const fallback = await admin
        .from("profiles")
        .select("id, customer_id, is_active")
        .in("customer_id", linkedCustomerIds.slice(0, 600));

      linkedProfiles = (fallback.data || []) as ProfileQaRow[];
    } else {
      linkedProfiles = (primary.data || []) as ProfileQaRow[];
    }
  }

  const orderMap = new Map(matchedShopifyOrders.map((row) => [row.shopify_order_id, row]));
  const customerMap = new Map(linkedCustomers.map((row) => [row.id, row]));
  const profileMap = new Map(linkedProfiles.map((row) => [row.customer_id, row]));

  const checklistByOrder = filteredCardOrders.slice(0, 24).map((order) => {
    const computed = buildChecklist(order, orderMap, customerMap, profileMap);
    return {
      order,
      ...computed,
    };
  });

  const missingCustomerOrders = filteredCardOrders.filter((order) => !order.customer_id).slice(0, 20);
  const missingEngravingOrders = filteredCardOrders.filter(missingRequiredEngravingFields).slice(0, 20);
  const missingWelcomeEmailOrders = filteredCardOrders
    .filter((order) => order.customer_id && !order.welcome_email_sent_at)
    .slice(0, 20);

  const customersMissingProfiles = linkedCustomers.filter((linked) => !profileMap.has(linked.id)).slice(0, 20);

  const customersStuckOnboarding = linkedCustomers
    .filter((linked) => {
      const state = safeLower(linked.onboarding_status || "");
      const stillRequired = linked.guided_setup_required === true;
      return stillRequired || ["invited", "welcome_sent", "not_started", "needs_help", "blocked"].includes(state);
    })
    .slice(0, 20);

  const guidedSetupTrackedRows = checklistByOrder.filter((entry) => entry.guidedTrackable);
  const guidedSetupComplete = guidedSetupTrackedRows.filter((entry) => entry.setupComplete).length;
  const guidedSetupIncomplete = guidedSetupTrackedRows.length - guidedSetupComplete;

  const summary = [
    { label: "Webhooks received in last 24 hours", value: webhooks24hResult.count || 0 },
    { label: "Card orders created", value: cardOrdersCountResult.count || 0 },
    { label: "Card orders missing customer_id", value: missingCustomerCountResult.count || 0 },
    { label: "Orders missing engraving fields", value: missingEngravingCountResult.count || 0 },
    { label: "Welcome emails sent", value: welcomeSentCountResult.count || 0 },
    { label: "Welcome emails missing", value: welcomeMissingCountResult.count || 0 },
    { label: "Guided Setup incomplete", value: Math.max(0, guidedSetupIncomplete) },
    { label: "Guided Setup complete", value: guidedSetupComplete },
  ];

  const latestLinkedCustomers = linkedCustomers
    .slice()
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 20);

  const webhookErrorsTracked = false;

  return (
    <DashboardShell isAdmin>
      <main className={`container ${styles.page}`}>
        <DashboardHeader
          title="Smart Card Onboarding QA"
          subtitle="Read-only launch diagnostics for webhook ingestion, customer linking, onboarding email flow, and guided setup completion."
        />

        <section className={styles.searchCard}>
          <form className={styles.searchForm} method="get">
            <input
              className={styles.searchInput}
              type="search"
              name="q"
              defaultValue={queryText}
              placeholder="Search order #, customer email, customer name, business name"
            />
            <button className={styles.searchButton} type="submit">Search</button>
          </form>
          <p className={styles.searchMeta}>
            {queryText ? `Filtered results for \"${queryText}\"` : "Showing latest onboarding records"}
          </p>
        </section>

        <section className={styles.summaryGrid}>
          {summary.map((item) => (
            <article className={styles.summaryCard} key={item.label}>
              <span className={styles.summaryLabel}>{item.label}</span>
              <strong className={styles.summaryValue}>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Onboarding Checklist Per Recent Order</h2>
            <p>PASS, WARNING, and MISSING status for each automation step.</p>
          </div>

          {checklistByOrder.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No recent card orders found</h3>
              <p>After webhook traffic is received, QA checklist cards will populate here.</p>
            </div>
          ) : (
            <div className={styles.checklistGrid}>
              {checklistByOrder.map(({ order, checklist }) => (
                <article key={order.id} className={styles.checklistCard}>
                  <header className={styles.checklistHeader}>
                    <h3>{order.shopify_order_number || "No order number"}</h3>
                    <p>
                      {order.customer_email || "No email"} · {formatDateTime(order.created_at)}
                    </p>
                  </header>

                  <ul className={styles.checklistItems}>
                    {checklist.map((item) => (
                      <li key={item.label} className={styles.checklistItem}>
                        <span>{item.label}</span>
                        <div className={styles.checkStatusWrap}>
                          <span className={`${styles.statusPill} ${statusClassName(item.status)}`}>{item.status}</span>
                          {item.note ? <small>{item.note}</small> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Issue Sections</h2>
            <p>Read-only launch blockers and warnings that need admin follow-up.</p>
          </div>

          <div className={styles.issueGrid}>
            <article className={styles.issueCard}>
              <h3>Orders missing customer_id</h3>
              {missingCustomerOrders.length === 0 ? (
                <p className={styles.emptyLine}>No issues found.</p>
              ) : (
                <ul className={styles.issueList}>
                  {missingCustomerOrders.map((row) => (
                    <li key={row.id}>#{row.shopify_order_number || row.shopify_order_id || row.id} · {row.customer_email || "No email"}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.issueCard}>
              <h3>Orders missing engraving details</h3>
              {missingEngravingOrders.length === 0 ? (
                <p className={styles.emptyLine}>No issues found.</p>
              ) : (
                <ul className={styles.issueList}>
                  {missingEngravingOrders.map((row) => (
                    <li key={row.id}>#{row.shopify_order_number || row.shopify_order_id || row.id} · {row.customer_name || row.customer_email || "Unknown"}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.issueCard}>
              <h3>Orders missing welcome_email_sent_at</h3>
              {missingWelcomeEmailOrders.length === 0 ? (
                <p className={styles.emptyLine}>No issues found.</p>
              ) : (
                <ul className={styles.issueList}>
                  {missingWelcomeEmailOrders.map((row) => (
                    <li key={row.id}>#{row.shopify_order_number || row.shopify_order_id || row.id} · {row.customer_email || "No email"}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.issueCard}>
              <h3>Customers missing profiles</h3>
              {customersMissingProfiles.length === 0 ? (
                <p className={styles.emptyLine}>No issues found.</p>
              ) : (
                <ul className={styles.issueList}>
                  {customersMissingProfiles.map((row) => (
                    <li key={row.id}>{row.email || row.company_name || row.id}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.issueCard}>
              <h3>Customers stuck in onboarding</h3>
              {customersStuckOnboarding.length === 0 ? (
                <p className={styles.emptyLine}>No issues found.</p>
              ) : (
                <ul className={styles.issueList}>
                  {customersStuckOnboarding.map((row) => (
                    <li key={row.id}>{row.email || row.company_name || row.id} · {row.onboarding_status || "unknown"}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.issueCard}>
              <h3>Recent webhook errors if tracked</h3>
              {webhookErrorsTracked ? (
                <p className={styles.emptyLine}>Tracked webhook errors will appear here.</p>
              ) : (
                <p className={styles.emptyLine}>No structured webhook error field is currently tracked in the webhook table.</p>
              )}
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Recent Records</h2>
            <p>Safe diagnostics only: counts, statuses, timestamps, and record ids.</p>
          </div>

          <div className={styles.recordsGrid}>
            <article className={styles.recordsCard}>
              <h3>Latest card_orders</h3>
              {filteredCardOrders.slice(0, 15).length === 0 ? (
                <p className={styles.emptyLine}>No records.</p>
              ) : (
                <ul className={styles.recordsList}>
                  {filteredCardOrders.slice(0, 15).map((row) => (
                    <li key={row.id}>
                      <strong>{row.shopify_order_number || row.shopify_order_id || row.id}</strong>
                      <span>{row.customer_email || "No email"}</span>
                      <small>{formatDateTime(row.created_at)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.recordsCard}>
              <h3>Latest shopify_orders</h3>
              {latestShopifyOrders.length === 0 ? (
                <p className={styles.emptyLine}>No records.</p>
              ) : (
                <ul className={styles.recordsList}>
                  {latestShopifyOrders.map((row) => (
                    <li key={row.id}>
                      <strong>{row.shopify_order_number || row.shopify_order_id}</strong>
                      <span>{row.customer_email || "No email"} · {row.financial_status || "unknown"}</span>
                      <small>{formatDateTime(row.created_at)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.recordsCard}>
              <h3>Latest shopify_webhooks</h3>
              {latestWebhooks.length === 0 ? (
                <p className={styles.emptyLine}>No records.</p>
              ) : (
                <ul className={styles.recordsList}>
                  {latestWebhooks.map((row) => (
                    <li key={row.id}>
                      <strong>{row.webhook_id}</strong>
                      <span>{row.topic} · {row.shop_domain || "unknown shop"}</span>
                      <small>{formatDateTime(row.processed_at)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.recordsCard}>
              <h3>Latest linked customers</h3>
              {latestLinkedCustomers.length === 0 ? (
                <p className={styles.emptyLine}>No records.</p>
              ) : (
                <ul className={styles.recordsList}>
                  {latestLinkedCustomers.map((row) => (
                    <li key={row.id}>
                      <strong>{row.email || row.company_name || row.id}</strong>
                      <span>{row.onboarding_status || "unknown"}</span>
                      <small>{formatDateTime(row.created_at)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
