import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ContactRound,
  Megaphone,
  PackageCheck,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import EmptyState from "@/components/dashboard/EmptyState";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import UnifiedDashboardInteractive, { type PerformancePoint } from "@/components/dashboard/UnifiedDashboardInteractive";
import { requireCustomer } from "@/lib/auth";
import { loadAccountAccess } from "@/lib/account-access-server";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

interface PortalPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstName(value?: string | null) {
  const token = String(value || "").replace(/[._-]+/g, " ").trim().split(/\s+/)[0];
  return token ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : "there";
}

function formatDate(value?: string | null, includeTime = false) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", includeTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function humanize(value?: string | null, fallback = "In progress") {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : fallback;
}

function buildPerformancePoints(scans: Array<{ created_at: string | null; qr_code_id: string }>, smartCardIds: Set<string>): PerformancePoint[] {
  const points = new Map<string, PerformancePoint>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    points.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
      qr: 0,
      nfc: 0,
    });
  }
  for (const scan of scans) {
    const key = String(scan.created_at || "").slice(0, 10);
    const point = points.get(key);
    if (!point) continue;
    if (smartCardIds.has(scan.qr_code_id)) point.nfc += 1;
    else point.qr += 1;
  }
  return [...points.values()];
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) return <DashboardShell><PortalCustomerLookupUnavailable /></DashboardShell>;
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const params = searchParams ? await searchParams : {};
  const errorMessage = Array.isArray(params.error) ? params.error[0] : params.error;
  const setupMessage = Array.isArray(params.setup) ? params.setup[0] : params.setup;
  const admin = createSupabaseAdminClient();
  const accountAccess = await loadAccountAccess(admin, customer);

  const [codesResult, profilesResult, printOrdersResult, cardOrdersResult] = await Promise.all([
    runGuardedDashboardTask({
      route: "/portal", endpoint: "supabase:qr_codes.unified-dashboard", customerId: customer.id, fallback: [] as any[],
      task: () => admin.from("qr_codes")
        .select("id, name, slug, destination_url, scan_count, is_active, is_system, qr_type, created_at, updated_at, print_order_item_id")
        .eq("customer_id", customer.id).order("updated_at", { ascending: false }),
    }),
    runGuardedDashboardTask({
      route: "/portal", endpoint: "supabase:profiles.unified-dashboard", customerId: customer.id, fallback: [] as any[],
      task: () => admin.from("profiles").select("id, business_name, contact_name, slug, is_active, updated_at")
        .eq("customer_id", customer.id).order("updated_at", { ascending: false }),
    }),
    runGuardedDashboardTask({
      route: "/portal", endpoint: "supabase:print_order_items.unified-dashboard", customerId: customer.id, fallback: [] as any[],
      task: () => admin.from("print_order_items")
        .select("id, shopify_order_number, product_title, material_type, tracking_mode, provisioning_status, workflow_state, artwork_status, proof_status, production_status, fulfillment_status, qr_setup_status, qr_setup_submitted_at, created_at, updated_at")
        .eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(50),
    }),
    runGuardedDashboardTask({
      route: "/portal", endpoint: "supabase:card_orders.unified-dashboard", customerId: customer.id, fallback: [] as any[],
      task: () => admin.from("card_orders")
        .select("id, shopify_order_number, product_title, status, fulfillment_status, approval_status, created_at")
        .eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(25),
    }),
  ]);

  const issues: string[] = [];
  if (codesResult.failed) issues.push("Marketing asset totals are temporarily unavailable.");
  if (profilesResult.failed) issues.push("Profile data is temporarily unavailable.");
  if (printOrdersResult.failed || cardOrdersResult.failed) issues.push("Order data is temporarily unavailable.");

  const allCodes = codesResult.data || [];
  const accessPairs = await Promise.all(allCodes.map(async (code: any) => [
    code.id,
    await loadOrderLinkedQrAccess(admin, customer, code.id),
  ] as const));
  const codeAccess = new Map(accessPairs);
  const visibleCodes = allCodes.filter((code: any) => code.qr_type === "smart_card" || codeAccess.get(code.id)?.canView);
  const analyticsCodes = visibleCodes.filter((code: any) => code.qr_type === "smart_card" || codeAccess.get(code.id)?.canViewBasicAnalytics);
  const analyticsIds = analyticsCodes.map((code: any) => code.id);
  const scansResult = analyticsIds.length ? await runGuardedDashboardTask({
    route: "/portal", endpoint: "supabase:qr_scans.unified-dashboard", customerId: customer.id, fallback: [] as any[],
    task: () => admin.from("qr_scans").select("id, qr_code_id, created_at")
      .in("qr_code_id", analyticsIds).order("created_at", { ascending: false }).limit(1000),
  }) : { data: [] as any[], failed: false };
  if (scansResult.failed) issues.push("Performance and recent scan activity are temporarily unavailable.");

  const profiles = profilesResult.data || [];
  const profileIds = profiles.map((profile: any) => profile.id);
  const leadsResult = profileIds.length ? await runGuardedDashboardTask({
    route: "/portal", endpoint: "supabase:profile_leads.unified-dashboard", customerId: customer.id, fallback: [] as any[],
    task: () => admin.from("profile_leads").select("id, profile_id, name, email, status, created_at")
      .in("profile_id", profileIds).order("created_at", { ascending: false }).limit(100),
  }) : { data: [] as any[], failed: false };
  if (leadsResult.failed) issues.push("Lead totals are temporarily unavailable.");

  const printOrders = printOrdersResult.data || [];
  const cardOrders = cardOrdersResult.data || [];
  const orderIds = printOrders.map((order: any) => order.id);
  const activityResult = orderIds.length ? await runGuardedDashboardTask({
    route: "/portal", endpoint: "supabase:order_activity.unified-dashboard", customerId: customer.id, fallback: [] as any[],
    task: () => admin.from("order_activity").select("id, order_id, action, actor_type, created_at")
      .eq("order_type", "print_order").in("order_id", orderIds).order("created_at", { ascending: false }).limit(25),
  }) : { data: [] as any[], failed: false };
  if (activityResult.failed) issues.push("Recent order activity is temporarily unavailable.");

  const scans = scansResult.data || [];
  const smartCardIds = new Set(visibleCodes.filter((code: any) => code.qr_type === "smart_card").map((code: any) => code.id));
  const performance = buildPerformancePoints(scans, smartCardIds);
  const totalScans = analyticsCodes.reduce((sum: number, code: any) => sum + Number(code.scan_count || 0), 0);
  const activeAssets = visibleCodes.filter((code: any) => code.is_active !== false).length + profiles.filter((profile: any) => profile.is_active !== false).length;
  const leads = leadsResult.data || [];
  const openPrintOrders = printOrders.filter((order: any) => !["delivered", "cancelled"].includes(String(order.workflow_state)));
  const openCardOrders = cardOrders.filter((order: any) => !["fulfilled", "delivered", "cancelled"].includes(String(order.fulfillment_status || order.status)));
  const currentOrderCount = openPrintOrders.length + openCardOrders.length;
  const recentCampaigns = visibleCodes.filter((code: any) => code.qr_type !== "smart_card").slice(0, 5);
  const orderById = new Map(printOrders.map((order: any) => [order.id, order]));
  const qrTasks = printOrders.filter((order: any) => order.tracking_mode !== "none" && ["setup_required", "draft"].includes(String(order.qr_setup_status)));
  const proofTasks = printOrders.filter((order: any) => order.proof_status === "sent");
  const actionTasks = [
    ...qrTasks.map((order: any) => ({
      id: `qr-${order.id}`, label: "Set up QR for artwork", detail: order.product_title || humanize(order.material_type), href: `/portal/print-orders/${order.id}#qr-setup`, priority: "QR setup",
    })),
    ...proofTasks.map((order: any) => ({
      id: `proof-${order.id}`, label: "Review your print proof", detail: order.product_title || humanize(order.material_type), href: `/portal/print-orders/${order.id}#proof`, priority: "Proof ready",
    })),
  ].slice(0, 6);
  const qrName = new Map(visibleCodes.map((code: any) => [code.id, code.name]));
  const recentActivity = [
    ...scans.slice(0, 8).map((scan: any) => ({
      id: `scan-${scan.id}`, label: smartCardIds.has(scan.qr_code_id) ? "NFC item tapped" : "Clutch Code scanned", detail: qrName.get(scan.qr_code_id) || "Marketing asset", at: scan.created_at,
    })),
    ...(activityResult.data || []).slice(0, 8).map((event: any) => ({
      id: `order-${event.id}`, label: humanize(event.action), detail: orderById.get(event.order_id)?.product_title || "Print order", at: event.created_at,
    })),
  ].sort((a, b) => Date.parse(b.at || "") - Date.parse(a.at || "")).slice(0, 8);
  const displayName = firstName((customer as any).first_name || (customer as any).name || String(user.email || "").split("@")[0]);

  return (
    <DashboardShell accountAccess={accountAccess} isAdmin={customer.is_admin}>
      <DashboardHeader
        pretitle="Clutch Print Shop"
        title={`Welcome back, ${displayName}`}
        subtitle="See what is working, finish important setup tasks, and keep your marketing moving."
        actions={(
          <UnifiedDashboardInteractive
            performance={performance}
            showChart={false}
            createCapabilities={{
              clutchCode: { href: "/portal/create", enabled: accountAccess.canCreateQr, reason: "Requires an active Clutch Codes plan" },
              campaign: { href: "/portal/create", enabled: accountAccess.canCreateQr, reason: "Requires general Clutch Codes capacity" },
              nfc: { href: "/portal/connect", enabled: accountAccess.hasSmartCard || accountAccess.hasConnectPlus, reason: "Available with an eligible NFC product" },
              leadForm: { href: "/portal/connect/build", enabled: accountAccess.canUseProfileBuilder, reason: "Available with Clutch Connect+" },
              profile: { href: "/portal/connect/setup", enabled: accountAccess.hasConnectBasic || accountAccess.hasConnectPlus, reason: "Available with Smart Card or Connect access" },
            }}
          />
        )}
      />

      {errorMessage ? <RetryNotice title="Something needs attention" description={errorMessage} /> : null}
      {setupMessage ? <RetryNotice title="Setup update" description={setupMessage} /> : null}
      {issues.length ? <RetryNotice title="Some dashboard data could not load" description="Your account is still available. Retry to refresh the affected panels." details={issues} /> : null}

      <section className="unified-metric-grid" aria-label="Account overview">
        <Link href="/portal/analytics" className="unified-metric-card">
          <span className="unified-metric-icon"><QrCode size={20} /></span><span>Total Scans & Taps</span><strong>{totalScans.toLocaleString()}</strong><small>Across assets you can currently analyze</small>
        </Link>
        <Link href="/portal/qr" className="unified-metric-card">
          <span className="unified-metric-icon"><Megaphone size={20} /></span><span>Active Marketing Assets</span><strong>{activeAssets.toLocaleString()}</strong><small>Live codes and profiles</small>
        </Link>
        <Link href="/portal/connect/leads" className="unified-metric-card">
          <span className="unified-metric-icon"><ContactRound size={20} /></span><span>Leads Captured</span><strong>{leads.length.toLocaleString()}</strong><small>From your connected lead forms</small>
        </Link>
        <Link href="/portal/print-orders" className="unified-metric-card">
          <span className="unified-metric-icon"><ShoppingBag size={20} /></span><span>Current Orders</span><strong>{currentOrderCount.toLocaleString()}</strong><small>Open print and NFC orders</small>
        </Link>
      </section>

      <UnifiedDashboardInteractive
        performance={performance}
        showButton={false}
        createCapabilities={{
          clutchCode: { href: "/portal/create", enabled: accountAccess.canCreateQr },
          campaign: { href: "/portal/create", enabled: accountAccess.canCreateQr },
          nfc: { href: "/portal/connect", enabled: accountAccess.hasSmartCard || accountAccess.hasConnectPlus },
          leadForm: { href: "/portal/connect/build", enabled: accountAccess.canUseProfileBuilder },
          profile: { href: "/portal/connect/setup", enabled: accountAccess.hasConnectBasic || accountAccess.hasConnectPlus },
        }}
      />

      <div className="unified-dashboard-grid">
        <section className="unified-panel unified-action-panel" id="actions">
          <div className="unified-section-heading"><div><p className="unified-kicker">Next steps</p><h2>Action Required</h2></div><Clock3 size={20} /></div>
          {actionTasks.length ? <ul className="unified-list">{actionTasks.map((task) => (
            <li key={task.id}><span className="unified-list-icon"><PackageCheck size={18} /></span><span><small>{task.priority}</small><strong>{task.label}</strong><span>{task.detail}</span></span><Link href={task.href} aria-label={`${task.label}: ${task.detail}`}><ArrowRight size={18} /></Link></li>
          ))}</ul> : <div className="unified-complete-state"><CheckCircle2 size={24} /><div><strong>You are all caught up</strong><span>New setup, artwork, and proof tasks will appear here.</span></div></div>}
        </section>

        <section className="unified-panel">
          <div className="unified-section-heading"><div><p className="unified-kicker">Marketing</p><h2>Active Campaigns</h2></div><Link href="/portal/qr">View all</Link></div>
          {recentCampaigns.length ? <ul className="unified-list">{recentCampaigns.map((code: any) => (
            <li key={code.id}><span className="unified-list-icon"><QrCode size={18} /></span><span><small>{humanize(code.qr_type, "Clutch Code")}</small><strong>{code.name}</strong><span>{Number(code.scan_count || 0).toLocaleString()} scans · {code.is_active === false ? "Paused" : "Active"}</span></span><Link href={`/portal/analytics/${code.id}`} aria-label={`View analytics for ${code.name}`}><ArrowRight size={18} /></Link></li>
          ))}</ul> : <EmptyState title="No active campaigns" description={accountAccess.canCreateQr ? "Create a Clutch Code to start measuring your marketing." : "Eligible order-linked codes and marketing assets will appear here."} />}
        </section>

        <section className="unified-panel">
          <div className="unified-section-heading"><div><p className="unified-kicker">Contacts</p><h2>Recent Leads</h2></div><Link href="/portal/connect/leads">View all</Link></div>
          {leads.length ? <ul className="unified-list">{leads.slice(0, 5).map((lead: any) => (
            <li key={lead.id}><span className="unified-list-icon"><ContactRound size={18} /></span><span><small>{humanize(lead.status, "New lead")}</small><strong>{lead.name || lead.email || "New contact"}</strong><span>{formatDate(lead.created_at, true)}</span></span></li>
          ))}</ul> : <EmptyState title="No leads yet" description="New contacts captured through your eligible lead forms will appear here." />}
        </section>

        <section className="unified-panel">
          <div className="unified-section-heading"><div><p className="unified-kicker">Timeline</p><h2>Recent Activity</h2></div></div>
          {recentActivity.length ? <ul className="unified-list">{recentActivity.map((event) => (
            <li key={event.id}><span className="unified-list-icon"><CheckCircle2 size={18} /></span><span><small>{formatDate(event.at, true)}</small><strong>{event.label}</strong><span>{event.detail}</span></span></li>
          ))}</ul> : <EmptyState title="No recent activity" description="Scans, taps, and order updates will appear here." />}
        </section>
      </div>
    </DashboardShell>
  );
}
