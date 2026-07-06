import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Clock3,
  Globe2,
  Link2,
  Map as MapIcon,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import CustomerLogoUpload from "@/components/CustomerLogoUpload";
import AnalyticsCard from "@/components/dashboard/AnalyticsCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import EmptyState from "@/components/dashboard/EmptyState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import StatCard from "@/components/dashboard/StatCard";
import SmartCardQrCard from "@/components/dashboard/SmartCardQrCard";
import CopyPublicProfileButton from "@/components/connect/CopyPublicProfileButton";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { isConnectProfilePublished, isConnectSetupComplete } from "@/lib/connect";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import {
  hasEntitlement,
  getCustomerPlan,
  getCustomerSubscriptionStatus,
  getEffectiveQrLimit,
  getSubscriptionLockMessage,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";
import { clutchConnectDisplayUrl, clutchConnectProfileUrl, qrUrl } from "@/lib/qr";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

interface PortalPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function formatDate(value?: string | null) {
  if (!value) return "Just now";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "No taps yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLabel(value?: string | null, fallback = "Pending") {
  const normalized = String(value || "")
    .replace(/_/g, " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const setupMessage = Array.isArray(resolvedSearchParams?.setup)
    ? resolvedSearchParams?.setup[0]
    : resolvedSearchParams?.setup;

  if (!customer) {
    return (
      <main className="container">
        <div className="card">
          <h1>Account not active yet</h1>
          <p className="muted">
            Use the same email from your Clutch Connect checkout. If you just purchased,
            wait a minute and refresh.
          </p>
        </div>
      </main>
    );
  }

  if (customer.must_change_password) {
    redirect("/change-password");
  }

  const admin = createSupabaseAdminClient();
  const { data: connectProfile } = await admin
    .from("profiles")
    .select("id, business_name, contact_name, title, slug, is_active, phone, email, website, builder_config, theme_color")
    .eq("customer_id", customer.id)
    .maybeSingle();

  const [qrCodesResult, connectProfilesResult] = await Promise.all([
    runGuardedDashboardTask({
      route: "/portal",
      endpoint: "supabase:qr_codes.select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string; name: string; slug: string | null; scan_count: number | null; created_at: string | null; updated_at: string | null; is_active: boolean | null; is_system?: boolean | null; qr_type?: string | null; card_order_id?: string | null; destination_url?: string | null; profile_id?: string | null; connect_profile_id?: string | null; foreground_color?: string | null; background_color?: string | null; style_config?: Record<string, unknown> | null }>,
      task: () =>
        admin
          .from("qr_codes")
          .select("id, name, slug, scan_count, created_at, updated_at, is_active, is_system, qr_type, card_order_id, destination_url, profile_id, connect_profile_id, foreground_color, background_color, style_config")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false }),
    }),
    runGuardedDashboardTask({
      route: "/portal",
      endpoint: "supabase:profiles.select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string; slug: string | null; business_name: string | null; contact_name: string | null }>,
      task: () =>
        admin
          .from("profiles")
          .select("id, slug, business_name, contact_name")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false }),
    }),
  ]);

  const cardOrdersResult = await runGuardedDashboardTask({
    route: "/portal",
    endpoint: "supabase:card_orders.select",
    customerId: customer.id,
    fallback: [] as Array<{
      id: string;
      shopify_order_id: string | null;
      shopify_order_number: string | null;
      product_title: string | null;
      variant_title: string | null;
      status: string | null;
      fulfillment_status: string | null;
      approval_status: string | null;
      engraving_requested: boolean | null;
      engraving_business_name: string | null;
      engraving_title: string | null;
      engraving_phone: string | null;
      engraving_email: string | null;
      proof_url: string | null;
      tracking_url: string | null;
      tracking_number: string | null;
      created_at: string | null;
    }>,
    task: () =>
      admin
        .from("card_orders")
        .select(
          "id, shopify_order_id, shopify_order_number, product_title, variant_title, status, fulfillment_status, approval_status, engraving_requested, engraving_business_name, engraving_title, engraving_phone, engraving_email, proof_url, tracking_url, tracking_number, created_at"
        )
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(12),
  });

  const shopifyOrdersResult = await runGuardedDashboardTask({
    route: "/portal",
    endpoint: "supabase:shopify_orders.select",
    customerId: customer.id,
    fallback: [] as Array<{
      shopify_order_id: string;
      raw_payload: { order_status_url?: string | null } | null;
    }>,
    task: () =>
      admin
        .from("shopify_orders")
        .select("shopify_order_id, raw_payload")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(25),
  });

  const panelIssues: string[] = [];
  if (qrCodesResult.failed) panelIssues.push("Campaign statistics are temporarily unavailable.");
  if (connectProfilesResult.failed) panelIssues.push("Clutch Connect profile status is temporarily unavailable.");
  if (cardOrdersResult.failed) panelIssues.push("Order details are temporarily unavailable.");
  if (shopifyOrdersResult.failed) panelIssues.push("Shopify order tracking is temporarily unavailable.");

  const codes = qrCodesResult.data || [];
  const qrIds = codes.map((code) => code.id);
  const scanRowsResult = qrIds.length
    ? await runGuardedDashboardTask({
        route: "/portal",
        endpoint: "supabase:qr_scans.select",
        customerId: customer.id,
        fallback: [] as Array<{ id: string; qr_code_id: string; created_at: string | null; city: string | null; region: string | null; country: string | null; device_type?: string | null; browser?: string | null; operating_system?: string | null }>,
        task: () =>
          admin
            .from("qr_scans")
            .select("id, qr_code_id, created_at, city, region, country, device_type, browser, operating_system")
            .in("qr_code_id", qrIds)
            .order("created_at", { ascending: false })
            .limit(250),
      })
    : { data: [] as Array<{ id: string; qr_code_id: string; created_at: string | null; city: string | null; region: string | null; country: string | null; device_type?: string | null; browser?: string | null; operating_system?: string | null }>, failed: false };
  if (scanRowsResult.failed) panelIssues.push("Recent scan activity is temporarily unavailable.");

  const scans = scanRowsResult.data || [];
  const campaignCodes = codes.filter((code: any) => code.is_system !== true);
  const campaignCodeIds = new Set(campaignCodes.map((code) => code.id));
  const campaignScans = scans.filter((scan) => campaignCodeIds.has(scan.qr_code_id));
  const smartCardCodes = codes.filter((code: any) => code.is_system === true && code.qr_type === "smart_card");
  const smartCardCodeIds = new Set(smartCardCodes.map((code) => code.id));
  const smartCardScans = scans.filter((scan) => smartCardCodeIds.has(scan.qr_code_id));
  const smartCardTotalTaps = smartCardScans.length || smartCardCodes.reduce((sum, code) => sum + (code.scan_count || 0), 0);
  const smartCardLastTap = smartCardScans[0]?.created_at || null;
  const used = campaignCodes.length;
  const activeQrCodes = campaignCodes.filter((code) => code.is_active !== false).length;
  const limit = getEffectiveQrLimit(customer);
  const plan = getCustomerPlan(customer);
  const subscriptionStatus = getCustomerSubscriptionStatus(customer);
  const subscriptionLocked = isCustomerSubscriptionLocked(customer);
  const subscriptionLockMessage = getSubscriptionLockMessage(customer);
  const totalScans = campaignCodes.reduce((sum, code) => sum + (code.scan_count || 0), 0);
  const remaining = Math.max(limit - used, 0);
  const remainingLabel = plan.code === "admin" ? "Unlimited" : String(remaining);
  const isConnectBasicPlan = plan.code === "connect_basic";
  const hasDynamicQr = hasEntitlement(customer, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer, "heatmapAnalytics") || plan.code === "admin";
  const hasConnectProfile = Boolean(connectProfile?.id);
  const setupChecklistComplete = isConnectSetupComplete(customer, connectProfile || null, { requirePublished: false });
  const hasPublicProfile = isConnectProfilePublished(connectProfile || null) && Boolean(connectProfile?.slug);
  const setupComplete = hasPublicProfile;
  const smartCardPrimaryCtaHref = hasPublicProfile ? "/portal/connect" : "/portal/connect/setup";
  const connectProfileId = connectProfile?.id ? String(connectProfile.id) : "";
  const publicProfileUrl = hasPublicProfile ? clutchConnectProfileUrl(String(connectProfile?.slug || "")) : "";

  function summarizeRows(values: Array<string | null | undefined>) {
    return Object.entries(values.reduce<Record<string, number>>((acc, value) => {
      const label = String(value || "Unknown").trim() || "Unknown";
      if (label !== "Unknown") acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}))
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }

  const smartCardRecentActivity = smartCardScans.slice(0, 6).map((scan) => {
    const location = [scan.city, scan.region, scan.country].filter(Boolean).join(", ");
    return {
      id: scan.id,
      title: "Smart card tap",
      date: formatDateTime(scan.created_at),
      location: location || "Location unavailable",
    };
  });
  const smartCardDeviceRows = summarizeRows(smartCardScans.map((scan) => scan.device_type)).slice(0, 4);
  const smartCardBrowserRows = summarizeRows(smartCardScans.map((scan) => scan.browser)).slice(0, 4);
  const smartCardOsRows = summarizeRows(smartCardScans.map((scan) => scan.operating_system)).slice(0, 4);
  const smartCardLocationRows = summarizeRows(smartCardScans.map((scan) => [scan.city, scan.region, scan.country].filter(Boolean).join(", "))).slice(0, 5);

  let leadInboxCount = 0;
  let profileViewCount = 0;
  if (connectProfile?.id) {
    const [{ count: leadCount, error: leadError }, { count: viewsCount, error: viewsError }] = await Promise.all([
      admin
        .from("profile_leads")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", connectProfile.id),
      admin
        .from("profile_click_events")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", connectProfile.id)
        .eq("event_type", "profile_view"),
    ]);

    if (!leadError) {
      leadInboxCount = leadCount || 0;
    } else {
      panelIssues.push("Lead Inbox totals are temporarily unavailable.");
    }

    if (!viewsError) {
      profileViewCount = viewsCount || 0;
    } else {
      panelIssues.push("Profile view totals are temporarily unavailable.");
    }
  }

  const usageLabel = plan.code === "connect_basic"
    ? "Digital profile access included"
    : plan.code === "connect_plus"
      ? "Profile tools unlocked"
      : plan.code === "agency"
        ? `${used} / 250+ QR codes used`
        : plan.code === "admin"
          ? `${used} / Unlimited QR codes used`
          : `${used} / ${limit} QR codes used`;

  const nextStepCard = plan.code === "connect_plus"
      ? {
          title: "Unlock QR Pro",
          description: "Create and track up to 100 dynamic QR campaigns.",
          requiredPlan: "QR Pro",
          requiredPlanPrice: "$14.99/mo",
          ctaLabel: "Upgrade for $14.99/mo",
          ctaHref: "/portal/settings",
          featureList: [
            "100 dynamic QR codes",
            "Editable destinations",
            "QR customization",
            "QR exports",
            "Campaign analytics",
          ],
          variant: "qr_pro" as const,
        }
      : plan.code === "qr_pro" && used >= 90
        ? {
            title: "Need more QR codes?",
            description: "Agency unlocks 250+ QR codes, higher-volume tracking, and client reporting.",
            requiredPlan: "Agency",
            requiredPlanPrice: "Custom",
            ctaLabel: "Request Agency Access",
            ctaHref: "/portal/settings",
            featureList: [
              "250+ QR codes",
              "Client reporting",
              "Advanced campaign reports",
              "Priority setup",
            ],
            variant: "agency" as const,
          }
        : null;

  const qrNameMap = new Map(campaignCodes.map((code) => [code.id, code.name]));
  const recentActivity = campaignScans.map((scan) => {
    const location = [scan.city, scan.region, scan.country].filter(Boolean).join(", ");
    return {
      id: scan.id,
      title: qrNameMap.get(scan.qr_code_id) || "QR Campaign",
      date: formatDate(scan.created_at),
      location: location || "Location unavailable",
    };
  });

  const profiles = connectProfilesResult.data || [];
  const cardOrders = cardOrdersResult.data || [];
  const latestCardOrder = cardOrders[0] || null;
  const matchedSmartCardQr = latestCardOrder?.id
    ? smartCardCodes.find((code: any) => code.card_order_id && String(code.card_order_id) === String(latestCardOrder.id))
    : null;
  const selectedSmartCardQr = matchedSmartCardQr || smartCardCodes[0] || null;
  const associatedCardOrder = selectedSmartCardQr?.card_order_id
    ? cardOrders.find((order) => String(order.id) === String(selectedSmartCardQr.card_order_id)) || null
    : null;
  const smartCardScanUrl = selectedSmartCardQr?.slug ? qrUrl(String(selectedSmartCardQr.slug)) : "";
  const smartCardScanUrlDisplay = selectedSmartCardQr?.slug ? smartCardScanUrl.replace(/^https?:\/\//, "") : "";
  const smartCardDestinationUrl = hasPublicProfile && connectProfile?.slug
    ? clutchConnectProfileUrl(String(connectProfile.slug))
    : String(selectedSmartCardQr?.destination_url || "");
  const smartCardDestinationDisplay = smartCardDestinationUrl
    ? smartCardDestinationUrl.replace(/^https?:\/\//, "")
    : hasPublicProfile && connectProfile?.slug
      ? clutchConnectDisplayUrl(String(connectProfile.slug))
      : "Not connected yet";
  const smartCardQrDate = selectedSmartCardQr?.updated_at || selectedSmartCardQr?.created_at || null;
  const shopifyOrderStatusUrlById = new Map(
    (shopifyOrdersResult.data || []).map((order) => [
      String(order.shopify_order_id),
      typeof order.raw_payload?.order_status_url === "string" ? order.raw_payload.order_status_url : null,
    ])
  );
  const checklistItems = [
    { label: "Create your first campaign", done: used > 0 },
    { label: "Add your company logo", done: Boolean(customer.logo_url) },
    { label: "Set up your Clutch Connect profile", done: profiles.length > 0 },
    { label: "View insights after your first scan", done: totalScans > 0 },
  ];

  const smartCardChecklistItems = [
    { label: "Guided setup is included with your smart card.", done: true },
    { label: "Finish Guided Setup to publish your smart card profile.", done: hasPublicProfile },
    { label: "Share your profile link from this dashboard.", done: hasPublicProfile },
    { label: "Lead Inbox is ready for customer submissions.", done: setupChecklistComplete },
  ];
  const visibleCardOrders = cardOrders.slice(0, 3);
  const overflowCardOrders = cardOrders.slice(3);
  const latestOrderStatus = formatLabel(latestCardOrder?.status, "Setup Pending");
  const smartCardLaunchChecklistItems = [
    { label: "Profile published", done: hasPublicProfile },
    { label: "Lead Inbox active", done: setupChecklistComplete },
    { label: "Smart card QR connected", done: Boolean(selectedSmartCardQr?.slug) },
    { label: "Profile link ready", done: hasPublicProfile },
  ];
  const smartCardLaunchChecklistComplete = smartCardLaunchChecklistItems.every((item) => item.done);

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navVariant={isConnectBasicPlan ? "connect-basic" : "default"}
      showGuidedSetup={!hasPublicProfile}
      showLeadInbox={hasConnectProfile}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container portal-overview-shell">
        {errorMessage ? (
          <div className="alert">
            <strong>Error:</strong> {errorMessage}
          </div>
        ) : null}

        {setupMessage === "complete" ? (
          <div className="success-message">Clutch Connect setup complete. Your dashboard is now unlocked.</div>
        ) : null}

        {panelIssues.length ? (
          <RetryNotice
            title="Some dashboard data is temporarily unavailable"
            description={panelIssues[0]}
            details={panelIssues.slice(1)}
          />
        ) : null}

        <DashboardHeader
          title={isConnectBasicPlan ? "Smart Business Card Dashboard" : "Clutch Connect Platform"}
          subtitle={
            isConnectBasicPlan
              ? hasPublicProfile
                ? "Your profile is live. Manage your smart card, profile, leads, and order status."
                : "Finish guided setup to publish your smart card profile."
              : "Launch campaigns, track scans, capture leads, and see where your marketing works."
          }
          actions={(
            <div className="portal-overview-header-actions">
              {isConnectBasicPlan ? (
                <>
                  <Link className="btn secondary" href={smartCardPrimaryCtaHref}>
                    Edit Profile
                  </Link>
                  <Link className="btn ghost" href="/portal/connect/leads">Lead Inbox</Link>
                </>
              ) : (
                <>
                  <Link className="btn primary" href="/portal/create">Create Campaign</Link>
                  <Link className="btn secondary" href="/portal/qr">Stored QR Codes</Link>
                  <Link className="btn secondary" href="/portal/analytics">View Insights</Link>
                  <Link className="btn ghost" href="/portal/connect/build">Edit Clutch Connect</Link>
                </>
              )}
            </div>
          )}
        />

        {isConnectBasicPlan ? (
          <section className="portal-overview-plan-mini">
            <strong>Plan: Basic</strong>
            <span>Free</span>
            <span>{subscriptionStatus}</span>
          </section>
        ) : (
          <CurrentPlanBadge
            planCode={plan.code}
            planName={plan.name}
            priceLabel={plan.price}
            description={plan.description}
            usageLabel={usageLabel}
            subscriptionStatus={subscriptionStatus}
            locked={subscriptionLocked}
            trialStatus={String(customer.trial_status || "none")}
          />
        )}

        {!isConnectBasicPlan && nextStepCard ? <LockedFeatureCard {...nextStepCard} /> : null}

        {!isConnectBasicPlan ? (
          <AnalyticsCard title="Recent Order Status">
            {visibleCardOrders.length ? (
              <ul className="portal-overview-order-list">
                {visibleCardOrders.map((order) => {
                  const shopifyStatusUrl = order.shopify_order_id
                    ? shopifyOrderStatusUrlById.get(String(order.shopify_order_id)) || null
                    : null;
                  const engravingDetails = order.engraving_requested
                    ? order.engraving_business_name || order.engraving_title || order.engraving_phone || order.engraving_email
                      ? [order.engraving_business_name, order.engraving_title, order.engraving_phone, order.engraving_email]
                          .filter(Boolean)
                          .join(" • ")
                      : "Requested"
                    : "Not requested";

                  return (
                    <li key={order.id} className="portal-overview-order-row">
                      <div className="portal-overview-order-row-head">
                        <strong className="portal-overview-order-number">{order.shopify_order_number || "Order in progress"}</strong>
                        <span className="portal-overview-order-chip">{formatLabel(order.status, "Setup Pending")}</span>
                      </div>
                      <div className="portal-overview-order-row-grid">
                        <p><strong>Product:</strong> {order.product_title || "Clutch Smart Business Card"}{order.variant_title ? ` (${order.variant_title})` : ""}</p>
                        <p><strong>Placed:</strong> {formatDate(order.created_at)}</p>
                        <p><strong>Engraving:</strong> {engravingDetails}</p>
                        <p><strong>Proof:</strong> {formatLabel(order.approval_status, "Not Ready")}</p>
                        <p><strong>Fulfillment:</strong> {formatLabel(order.fulfillment_status, "Not Sent")}</p>
                        <p><strong>Status:</strong> {formatLabel(order.status, "Setup Pending")}</p>
                      </div>

                      <div className="portal-overview-order-row-actions">
                        {shopifyStatusUrl ? <Link className="btn ghost" href={shopifyStatusUrl} target="_blank" rel="noreferrer">View Order Details</Link> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState description="No smart card orders found yet. Once an order is processed, details and status updates will appear here." />
            )}
            {overflowCardOrders.length ? (
              <details className="portal-overview-order-more">
                <summary>View all orders</summary>
                <ul className="portal-overview-order-list portal-overview-order-list-more">
                  {overflowCardOrders.map((order) => (
                    <li key={order.id} className="portal-overview-order-row">
                      <div className="portal-overview-order-row-head">
                        <strong className="portal-overview-order-number">{order.shopify_order_number || "Order in progress"}</strong>
                        <span className="portal-overview-order-chip">{formatLabel(order.status, "Setup Pending")}</span>
                      </div>
                      <div className="portal-overview-order-row-grid">
                        <p><strong>Product:</strong> {order.product_title || "Clutch Smart Business Card"}{order.variant_title ? ` (${order.variant_title})` : ""}</p>
                        <p><strong>Placed:</strong> {formatDate(order.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </AnalyticsCard>
        ) : null}

        {subscriptionLocked ? (
          <section className="locked-upgrade-card">
            <div>
              <p className="eyebrow">Billing Attention</p>
              <h2>Paid QR features are locked.</h2>
              <p>{subscriptionLockMessage}</p>
            </div>
            <Link className="btn primary" href="https://clutchprintshop.com/pages/qr-pro">
              View Plans
            </Link>
          </section>
        ) : null}

        {isConnectBasicPlan ? (
          <>
            <section className="portal-overview-live-strip">
              <div>
                <span className={hasPublicProfile ? "is-live" : "is-draft"}>{hasPublicProfile ? "LIVE" : "DRAFT"}</span>
                <strong>{hasPublicProfile ? clutchConnectDisplayUrl(String(connectProfile?.slug || "")) : "Finish setup to publish your profile."}</strong>
              </div>
              <div className="portal-overview-live-strip-actions">
                {hasPublicProfile ? (
                  <>
                    <CopyPublicProfileButton url={publicProfileUrl} />
                    <Link className="btn ghost" href={publicProfileUrl} target="_blank" rel="noreferrer">View Public Profile</Link>
                  </>
                ) : (
                  <Link className="btn secondary" href="/portal/connect/setup">Continue Guided Setup</Link>
                )}
              </div>
            </section>

            <AnalyticsCard className="portal-overview-smart-qr-card">
              <div className="portal-overview-section-head">
                <h2>Your Smart Card QR</h2>
                <p>This QR/NFC link was created for your smart card order.</p>
              </div>

              {selectedSmartCardQr?.slug ? (
                <SmartCardQrCard
                  qrId={String(selectedSmartCardQr.id)}
                  slug={String(selectedSmartCardQr.slug)}
                  scanUrl={smartCardScanUrl}
                  scanUrlDisplay={smartCardScanUrlDisplay}
                  destinationDisplay={smartCardDestinationDisplay}
                  connectedProfileText={hasPublicProfile ? "Connected to your live profile" : "Finish setup to connect this QR to your live profile"}
                  orderAssociation={associatedCardOrder?.shopify_order_number || associatedCardOrder?.id || "Not linked to a specific order"}
                  lastUpdated={formatDateTime(smartCardQrDate)}
                  initialForegroundColor={selectedSmartCardQr.foreground_color || "#384862"}
                  initialBackgroundColor={selectedSmartCardQr.background_color || "#ffffff"}
                  initialStyleConfig={(selectedSmartCardQr as any).style_config || {}}
                />
              ) : (
                <div className="portal-overview-smart-empty">
                  <QrCode size={22} />
                  <h3>Smart card QR not ready yet</h3>
                  <p>Your smart card QR will appear here after your order is created.</p>
                </div>
              )}
            </AnalyticsCard>

            <section id="recent-order-status">
              <AnalyticsCard title="Recent Order Status">
                {visibleCardOrders.length ? (
                <ul className="portal-overview-order-list">
                  {visibleCardOrders.map((order) => {
                    const shopifyStatusUrl = order.shopify_order_id
                      ? shopifyOrderStatusUrlById.get(String(order.shopify_order_id)) || null
                      : null;
                    const engravingDetails = order.engraving_requested
                      ? order.engraving_business_name || order.engraving_title || order.engraving_phone || order.engraving_email
                        ? [order.engraving_business_name, order.engraving_title, order.engraving_phone, order.engraving_email]
                            .filter(Boolean)
                            .join(" • ")
                        : "Requested"
                      : "Not requested";

                    return (
                      <li key={order.id} className="portal-overview-order-row">
                        <div className="portal-overview-order-row-head">
                          <strong className="portal-overview-order-number">{order.shopify_order_number || "Order in progress"}</strong>
                          <span className="portal-overview-order-chip">{formatLabel(order.status, "Setup Pending")}</span>
                        </div>
                        <div className="portal-overview-order-row-grid">
                          <p><strong>Product:</strong> {order.product_title || "Clutch Smart Business Card"}{order.variant_title ? ` (${order.variant_title})` : ""}</p>
                          <p><strong>Placed:</strong> {formatDate(order.created_at)}</p>
                          <p><strong>Engraving:</strong> {engravingDetails}</p>
                          <p><strong>Proof:</strong> {formatLabel(order.approval_status, "Not Ready")}</p>
                          <p><strong>Fulfillment:</strong> {formatLabel(order.fulfillment_status, "Not Sent")}</p>
                          <p><strong>Status:</strong> {formatLabel(order.status, "Setup Pending")}</p>
                        </div>

                        <div className="portal-overview-order-row-actions">
                          {shopifyStatusUrl ? <Link className="btn ghost portal-overview-card-btn" href={shopifyStatusUrl} target="_blank" rel="noreferrer">View Order Details</Link> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState description="No smart card orders found yet. Once an order is processed, details and status updates will appear here." />
              )}
                {overflowCardOrders.length ? (
                <details className="portal-overview-order-more">
                  <summary>View all orders</summary>
                  <ul className="portal-overview-order-list portal-overview-order-list-more">
                    {overflowCardOrders.map((order) => (
                      <li key={order.id} className="portal-overview-order-row">
                        <div className="portal-overview-order-row-head">
                          <strong className="portal-overview-order-number">{order.shopify_order_number || "Order in progress"}</strong>
                          <span className="portal-overview-order-chip">{formatLabel(order.status, "Setup Pending")}</span>
                        </div>
                        <div className="portal-overview-order-row-grid">
                          <p><strong>Product:</strong> {order.product_title || "Clutch Smart Business Card"}{order.variant_title ? ` (${order.variant_title})` : ""}</p>
                          <p><strong>Placed:</strong> {formatDate(order.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
                ) : null}
              </AnalyticsCard>
            </section>

            <section className="ds-stat-grid">
              <StatCard
                label="Profile Views"
                value={profileViewCount.toLocaleString()}
              />
              <StatCard
                label="Card Taps"
                value={smartCardTotalTaps.toLocaleString()}
              />
              <StatCard
                label="Leads"
                value={leadInboxCount.toLocaleString()}
              />
              <StatCard
                label="Order Status"
                value={latestOrderStatus}
                description={latestCardOrder?.shopify_order_number ? String(latestCardOrder.shopify_order_number) : undefined}
              />
            </section>

            <AnalyticsCard className="portal-overview-smart-card-activity-card">
              <div className="portal-overview-section-head">
                <h2>Smart Card Activity</h2>
                <p>Latest smart card taps and profile activity.</p>
              </div>

              {smartCardTotalTaps ? (
                <div className="portal-overview-smart-panel portal-overview-smart-panel-compact">
                  <div className="portal-overview-smart-panel-head"><Clock3 size={16} /><h3>Recent taps</h3></div>
                  <ul className="portal-overview-activity-list">
                    {smartCardRecentActivity.slice(0, 6).map((item) => {
                      const scan = smartCardScans.find((row) => row.id === item.id);
                      const device = scan?.device_type ? formatLabel(scan.device_type, "Unknown") : "Unknown device";
                      return (
                        <li key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{device} • {item.location}</p>
                          </div>
                          <span>{item.date}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="portal-overview-smart-empty">
                  <QrCode size={22} />
                  <p>No card taps yet. Taps will appear after your smart card is scanned.</p>
                </div>
              )}
            </AnalyticsCard>

            <AnalyticsCard className="portal-overview-actions-card">
              <div className="portal-overview-section-head">
                <h2>Quick Actions</h2>
                <p>Secondary tools for wallet cards, order tracking, and support.</p>
              </div>

              <div className="portal-overview-actions-grid portal-overview-actions-grid-smart portal-overview-actions-grid-compact">
                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><Sparkles size={17} /></div>
                  <h3>Wallet Card</h3>
                  <p>Save your contact card to Apple Wallet or Google Wallet for fast sharing.</p>
                  {hasConnectProfile && connectProfileId ? (
                    <div className="portal-overview-wallet-actions">
                      <Link className="btn ghost portal-overview-card-btn" href={`/api/wallet/apple/${connectProfileId}`}>Apple Wallet</Link>
                      <Link className="btn ghost portal-overview-card-btn" href={`/api/wallet/google/${connectProfileId}`}>Google Wallet</Link>
                    </div>
                  ) : (
                    <p className="portal-overview-inline-note">Finish Guided Setup to enable wallet cards.</p>
                  )}
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><Link2 size={17} /></div>
                  <h3>Order Tracking</h3>
                  <p>Review order proof, fulfillment status, and shipment updates.</p>
                  <a className="btn ghost portal-overview-card-btn" href="#recent-order-status">Jump to Orders</a>
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><CheckCircle2 size={17} /></div>
                  <h3>Support</h3>
                  <p>Need help with setup or publishing? Our team is ready to help.</p>
                  <Link className="btn ghost portal-overview-card-btn" href="mailto:support@clutchprintshop.com">Contact Support</Link>
                </article>
              </div>
            </AnalyticsCard>

            <section className="portal-overview-lower-grid">
              <AnalyticsCard title={smartCardLaunchChecklistComplete ? "Setup Complete" : "Setup Checklist"}>
                <ul className="portal-overview-checklist portal-overview-checklist-compact">
                  {smartCardLaunchChecklistItems.map((item) => (
                    <li key={item.label} className={item.done ? "done" : "pending"}>
                      {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </AnalyticsCard>

              <AnalyticsCard title="Upgrade to Clutch Connect+" className="portal-overview-upgrade-card">
                <div className="portal-overview-brand-card">
                  <p>Unlock advanced profile customization, deeper engagement analytics, enhanced lead tools, and premium profile sections.</p>
                  <Link className="btn ghost portal-overview-card-btn" href="/portal/settings">Try Connect+</Link>
                  <span className="portal-overview-inline-note">14 Day Free Trial · Cancel Anytime</span>
                </div>
              </AnalyticsCard>
            </section>
          </>
        ) : (
          <>
            <section className="ds-stat-grid">
              <StatCard
                label="Active Campaigns"
                value={activeQrCodes}
                description="Live trackable campaigns currently active in your account."
              />
              <StatCard
                label="Total Scans"
                value={totalScans.toLocaleString()}
                description="Lifetime scans across all QR campaigns."
              />
              <StatCard
                label="Remaining Campaign Limit"
                value={<span className="portal-overview-limit-value">{remainingLabel}</span>}
                description={
                  plan.code === "admin"
                    ? "Admin includes unlimited active campaigns."
                    : `${remaining} of ${limit} campaigns remaining.`
                }
              />
              <StatCard
                label="Account Plan"
                value={plan.shortName}
                description={`${plan.name} • ${subscriptionStatus}`}
              />
            </section>

            <AnalyticsCard className="portal-overview-actions-card">
              <div className="portal-overview-section-head">
                <h2>Launch Your Next Campaign</h2>
                <p>Everything you need to create, publish, and measure campaigns in one place.</p>
              </div>
              <div className="portal-overview-actions-grid">
                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><QrCode size={17} /></div>
                  <h3>Create Campaign</h3>
                  <p>Start a new dynamic QR campaign with full tracking.</p>
                  <Link className="btn primary" href="/portal/create">Open Studio</Link>
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><QrCode size={17} /></div>
                  <h3>Stored QR Library</h3>
                  <p>Search, filter, and manage all saved QR campaigns.</p>
                  <Link className="btn secondary" href="/portal/qr">Open Library</Link>
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><Link2 size={17} /></div>
                  <h3>Build Clutch Connect Profile</h3>
                  <p>Update your smart profile, links, and public details.</p>
                  <Link className="btn secondary" href="/portal/connect/build">Open Profile Builder</Link>
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><BarChart3 size={17} /></div>
                  <h3>View Insights</h3>
                  <p>Track marketing performance, geography, and engagement trends.</p>
                  <Link className="btn secondary" href="/portal/analytics">Open Insights</Link>
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><MapIcon size={17} /></div>
                  <h3>Open Heatmap</h3>
                  <p>Review where your print campaigns are generating engagement.</p>
                  <Link className="btn secondary" href="/portal/heatmap">Open Heatmap</Link>
                </article>

                <article className="portal-overview-action-item">
                  <div className="portal-overview-action-icon"><Users size={17} /></div>
                  <h3>Capture Leads</h3>
                  <p>Review profile submissions and follow up with prospects.</p>
                  <Link className="btn secondary" href="/portal/connect/leads">View Leads</Link>
                </article>
              </div>
            </AnalyticsCard>

            <section className="portal-overview-lower-grid">
              <AnalyticsCard title="Recent Activity">
                {recentActivity.length ? (
                  <ul className="portal-overview-activity-list">
                    {recentActivity.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.location}</p>
                        </div>
                        <span>{item.date}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState description="No activity yet. Create and scan your first campaign to start tracking." />
                )}
              </AnalyticsCard>

              <AnalyticsCard title="Setup Checklist">
                <ul className="portal-overview-checklist">
                  {checklistItems.map((item) => (
                    <li key={item.label} className={item.done ? "done" : "pending"}>
                      {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="portal-overview-brand-card">
                  <div className="portal-overview-brand-title">
                    <Sparkles size={15} />
                    <h3>Brand Assets</h3>
                  </div>
                  <p>Upload your logo once and apply it across QR designs.</p>
                  <CustomerLogoUpload customerLogoUrl={customer.logo_url} />
                </div>
              </AnalyticsCard>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
