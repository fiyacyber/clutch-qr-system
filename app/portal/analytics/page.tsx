import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { PLAN_DEFINITIONS, getCustomerPlan, getEffectiveQrLimit } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  buildHourlyHeatmap,
  buildScansOverTime,
  countBy,
  fetchUnifiedAnalyticsData,
  isCountedProfileView,
  type UnifiedAnalyticsData,
} from "@/lib/clutch-analytics";
import { parseCoordinate } from "@/lib/analytics";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import "./analytics.css";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { resolvePortalAnalyticsMode } from "@/lib/order-linked-portal-analytics";

const VALID_TABS = [
  "overview", "qr-codes", "campaign-performance", "clutch-connect", "analytics",
  "geography", "technology", "devices", "activity-heatmap",
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) {
    return (
      <DashboardShell>
        <PortalCustomerLookupUnavailable />
      </DashboardShell>
    );
  }
  if (!customer) return <PortalAccountNotActive />;

  const params = (await searchParams) || {};
  const tab = String(params.tab || "analytics").toLowerCase();
  const normalizedTab = tab === "devices" || tab === "leads" ? "analytics" : tab;
  const activeTab = VALID_TABS.includes(normalizedTab) ? normalizedTab : "analytics";

  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  const accessNow = new Date();
  const analyticsMode = await resolvePortalAnalyticsMode({
    isAdmin: Boolean(customer.is_admin),
    hasActivePaidSubscription: hasActiveClutchCodesSubscription(customer),
    accountAccess: access,
    dependencies: {
      fetchFull: async () => runGuardedDashboardTask({
        route: "/portal/analytics",
        endpoint: "analytics:fetchUnifiedAnalyticsData",
        customerId: customer.id,
        fallback: {
          isAdmin: Boolean(customer.is_admin),
          qrCodes: [],
          profiles: [],
          qrScans: [],
          connectEvents: [],
        } as UnifiedAnalyticsData,
        task: () => fetchUnifiedAnalyticsData(admin, customer as any),
      }),
      listOwnedCodes: async () => admin.from("qr_codes").select("id, name, slug").eq("customer_id", customer.id),
      listScans: async (codeIds) => admin.from("qr_scans").select("qr_code_id, created_at")
        .in("qr_code_id", codeIds).order("created_at", { ascending: true }),
      resolveCodeAccess: (codeId) => loadOrderLinkedQrAccess(admin, customer, codeId, accessNow, { throwOnError: true }),
    },
  });
  if (analyticsMode.kind === "locked") redirect("/portal?access=analytics-locked");
  if (analyticsMode.kind === "basic") {
    return (
      <DashboardShell accountAccess={access} isAdmin={false}>
        <main className="container analytics-container">
          <h1>Clutch Codes™ Basic Analytics</h1>
          <p>Included access shows aggregate scan activity for each included code.</p>
          {analyticsMode.status === "error" ? (
            <RetryNotice title="Included analytics are temporarily unavailable" description={analyticsMode.message} />
          ) : null}
          {analyticsMode.status === "empty" ? <p>No active included-code analytics are available.</p> : null}
          {analyticsMode.status === "ready" ? analyticsMode.rows.map((row) => <section className="chart-container" key={row.code.id}>
            <h2>{row.code.name}</h2>
            <p><strong>{row.totalScans}</strong> total scans</p>
            <p>First scan: {row.firstScanAt ? new Date(row.firstScanAt).toLocaleString("en-US", { timeZone: "UTC" }) : "—"}</p>
            <p>Last scan: {row.lastScanAt ? new Date(row.lastScanAt).toLocaleString("en-US", { timeZone: "UTC" }) : "—"}</p>
            {row.scansByUtcDay.map((day) => <p key={day.date}>{day.date}: {day.count}</p>)}
          </section>) : null}
        </main>
      </DashboardShell>
    );
  }
  const data = analyticsMode.data;
  const plan = getCustomerPlan(customer as any);
  const campaignCandidates = data.qrCodes.filter((code) => code.is_system !== true || ["tracked_print", "business_kit"].includes(String(code.qr_type)));
  const campaignAccessEntries = await Promise.all(campaignCandidates.map(async (code) => ({ code, access: await loadOrderLinkedQrAccess(admin, customer, code.id) })));
  const accessibleCampaignCodes = campaignAccessEntries.filter((entry) => entry.access.canViewBasicAnalytics).map((entry) => entry.code);
  const hasDynamicQr = accessibleCampaignCodes.length > 0;
  const hasHeatmap = access.canUseProfileAnalytics || hasDynamicQr;
  const isCampaignTab = activeTab === "campaign-performance" || activeTab === "qr-codes";
  const isCampaignUnlocked = isCampaignTab && hasDynamicQr;
  const isAnalyticsUnlocked = !isCampaignTab && hasHeatmap;
  const showLockedCampaign = isCampaignTab && !hasDynamicQr;
  const showLockedAnalytics = !isCampaignTab && !hasHeatmap;
  const shouldRenderAnalyticsDashboard = isCampaignUnlocked || isAnalyticsUnlocked;
  const campaignQrCodes = accessibleCampaignCodes;
  const qrUsageUsed = campaignQrCodes.length;
  const qrUsageLimit = plan.code === "admin" ? null : getEffectiveQrLimit(customer as any);
  const latestQrCode = campaignQrCodes[0] || null;
  const campaignQrIds = new Set(campaignQrCodes.map((code) => code.id));
  const campaignQrScans = data.qrScans.filter((scan) => campaignQrIds.has(scan.qr_code_id));
  const planLabel = plan.code === "admin" ? "Admin" : plan.code === "agency" ? "Agency" : "Clutch Connect";

  /* ── KPI metrics ── */
  const totalScans     = campaignQrScans.length;
  const connectViews   = data.connectEvents.filter(isCountedProfileView).length;
  const linkClicks     = data.connectEvents.filter(e => e.event_type === "link_click").length;
  const leadsCaptured  = data.connectEvents.filter(e => e.event_type === "lead_submit").length;
  const activeQrCodes  = campaignQrCodes.filter(q => q.is_active !== false).length;
  const uniqueVisitors = new Set(
    [...campaignQrScans.map(r => r.ip_hash), ...data.connectEvents.map(r => r.ip_hash || r.visitor_id)].filter(Boolean)
  ).size;

  /* ── QR rows ── */
  const scansByQr = new Map<string, typeof data.qrScans>();
  for (const s of campaignQrScans) {
    const rows = scansByQr.get(s.qr_code_id) || [];
    rows.push(s);
    scansByQr.set(s.qr_code_id, rows);
  }
  const profileById = new Map(data.profiles.map(p => [p.id, p]));
  const qrByProfile = new Map<string, typeof data.qrCodes>();
  for (const qr of campaignQrCodes) {
    const pid = (qr as any).connect_profile_id || qr.profile_id;
    if (!pid) continue;
    const rows = qrByProfile.get(pid) || [];
    rows.push(qr);
    qrByProfile.set(pid, rows);
  }

  const qrRows = campaignQrCodes.map(code => {
    const scans = scansByQr.get(code.id) || [];
    const pid = (code as any).connect_profile_id || code.profile_id || null;
    const profile = pid ? profileById.get(pid) : null;
    return {
      id: code.id,
      name: code.name,
      destination: code.destination_url,
      totalScans: scans.length,
      uniqueVisitors: new Set(scans.map(s => s.ip_hash).filter(Boolean)).size,
      lastScan: scans[0]?.created_at || null,
      linkedProfileName: profile
        ? profile.business_name || profile.contact_name || profile.slug
        : null,
    };
  });

  /* ── Connect rows ── */
  const eventsByProfile = new Map<string, typeof data.connectEvents>();
  for (const e of data.connectEvents) {
    const rows = eventsByProfile.get(e.profile_id) || [];
    rows.push(e);
    eventsByProfile.set(e.profile_id, rows);
  }

  const connectRows = data.profiles.map(profile => {
    const events = eventsByProfile.get(profile.id) || [];
    const linkClickEvents = events.filter(e => e.event_type === "link_click");
    const topLinkCounts = linkClickEvents.reduce<Record<string, number>>((acc, e) => {
      const k = e.link_label || e.link_url || "Unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const topClickedLink = Object.entries(topLinkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const linkedQr = qrByProfile.get(profile.id)?.[0] || null;
    return {
      id: profile.id,
      profileName: profile.business_name || profile.contact_name || profile.slug,
      profileViews: events.filter(isCountedProfileView).length,
      linkClicks: linkClickEvents.length,
      topClickedLink,
      leadsCaptured: events.filter(e => e.event_type === "lead_submit").length,
      linkedQrCode: linkedQr ? linkedQr.name : null,
    };
  });

  /* ── Charts ── */
  const scansOverTime = buildScansOverTime(campaignQrScans.map(r => r.created_at));
  const heatmap = buildHourlyHeatmap([
    ...campaignQrScans.map(r => r.created_at),
    ...data.connectEvents.map(r => r.created_at),
  ]);

  const cityPointMap = new Map<
    string,
    {
      lat: number;
      lon: number;
      scans: number;
      visitors: Set<string>;
      label: string;
      city: string;
      region: string;
      country: string;
      campaignCounts: Map<string, number>;
    }
  >();

  const qrNameById = new Map(campaignQrCodes.map(q => [q.id, q.name]));

  const geographyRows = campaignQrScans
    .map((scan: any) => {
      const city = scan.city || "Unknown";
      const region = scan.region || "Unknown";
      const country = scan.country || "Unknown";
      const latitude = parseCoordinate(scan.latitude);
      const longitude = parseCoordinate(scan.longitude);
      return {
        id: scan.id,
        qrId: scan.qr_code_id,
        campaign: qrNameById.get(scan.qr_code_id) || "Unnamed Campaign",
        city,
        region,
        country,
        locationLabel: [city, region, country].filter(Boolean).join(", "),
        createdAt: scan.created_at,
        latitude,
        longitude,
        location_source: scan.location_source || null,
      };
    })
    .filter((row) => row.qrId);

  for (const scan of campaignQrScans as any[]) {
    const lat = parseCoordinate(scan.latitude);
    const lon = parseCoordinate(scan.longitude);
    if (lat === null || lon === null) continue;

    const city = scan.city || "Unknown city";
    const region = scan.region || "";
    const country = scan.country || "";
    const campaign = qrNameById.get(scan.qr_code_id) || "Unnamed Campaign";
    const label = [city, region, country].filter(Boolean).join(", ");
    const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${label}`;
    const existing = cityPointMap.get(key);
    if (existing) {
      existing.scans += 1;
      if (scan.ip_hash) existing.visitors.add(scan.ip_hash);
      existing.campaignCounts.set(campaign, (existing.campaignCounts.get(campaign) || 0) + 1);
    } else {
      cityPointMap.set(key, {
        lat,
        lon,
        scans: 1,
        visitors: new Set(scan.ip_hash ? [scan.ip_hash] : []),
        label,
        city,
        region,
        country,
        campaignCounts: new Map([[campaign, 1]]),
      });
    }
  }

  const mapPoints = Array.from(cityPointMap.values()).map((p) => ({
    lat: p.lat,
    lon: p.lon,
    scans: p.scans,
    uniqueVisitors: p.visitors.size,
    label: p.label,
    city: p.city,
    region: p.region,
    country: p.country,
    topCampaign:
      Array.from(p.campaignCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
  }));

  /* ── Geo / device breakdown ── */
  const countryData = Object.entries(
    [...campaignQrScans, ...data.connectEvents].reduce<Record<string, number>>((acc, r) => {
      if (r.country) acc[r.country] = (acc[r.country] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, scans]) => ({ name, scans })).sort((a, b) => b.scans - a.scans);

  const cityRows = countBy(
    [...campaignQrScans, ...data.connectEvents].map(r => {
      const parts = [r.city, r.region, r.country].filter(Boolean);
      return parts.length ? parts.join(", ") : null;
    })
  ).filter(r => r.label !== "Unknown");

  const deviceRows = countBy([
    ...campaignQrScans.map(r => r.device_type),
    ...data.connectEvents.map(r => r.device_type),
  ]).filter(r => r.label !== "Unknown");

  const browserRows = countBy([
    ...campaignQrScans.map(r => r.browser),
    ...data.connectEvents.map(r => r.browser),
  ]).filter(r => r.label !== "Unknown");

  const osRows = countBy([
    ...campaignQrScans.map(r => r.operating_system),
    ...data.connectEvents.map(r => r.os),
  ]).filter(r => r.label !== "Unknown");

  return (
    <DashboardShell
      accountAccess={access}
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      {analyticsMode.failed ? (
        <main className="container" style={{ marginBottom: 16 }}>
          <RetryNotice
            title="Analytics data is temporarily unavailable"
            description="We could not load full analytics right now. You can retry safely."
          />
        </main>
      ) : null}
      <main className="container" style={{ marginBottom: 16 }}>
        {showLockedCampaign || showLockedAnalytics ? (
          <DashboardHeader
            title={isCampaignTab ? "Campaign Performance" : "Analytics"}
            subtitle={
              isCampaignTab
                ? "Compare QR campaigns, scan activity, and marketing performance."
                : "Understand profile engagement, device activity, and visitor behavior."
            }
          />
        ) : null}
        <CurrentPlanBadge
          planCode={plan.code}
          planName={plan.name}
          priceLabel={plan.price}
          description={plan.description}
          usageLabel={isCampaignTab ? (hasDynamicQr ? "Campaign analytics unlocked" : "Campaign analytics locked") : (hasHeatmap ? "Analytics dashboard unlocked" : "Analytics dashboard locked")}
          subscriptionStatus={String(customer.subscription_status || customer.plan_status || "active")}
          trialStatus={String(customer.trial_status || "none")}
        />
        {showLockedCampaign ? (
          <LockedFeatureCard
            title="Upgrade Available"
            description="Compare campaign performance and optimize top-performing QR destinations."
            requiredPlan="QR Pro"
            requiredPlanPrice="$14.99/mo"
            ctaLabel="Upgrade to QR Pro"
            ctaHref={PLAN_DEFINITIONS.qr_pro.checkoutUrl}
            featureList={[
              "Campaign comparison",
              "Best-performing QR codes",
              "Scan trends",
              "Source-aware reporting",
              "Conversion tracking",
            ]}
            variant="qr_pro"
          />
        ) : null}
        {showLockedAnalytics ? (
          <LockedFeatureCard
            title="Upgrade Available"
            description="Advanced analytics and heatmaps are available on Clutch Connect+ and higher tiers."
            requiredPlan="Clutch Connect+"
            requiredPlanPrice="$9.99/mo"
            ctaLabel="Try Connect+"
            ctaHref={PLAN_DEFINITIONS.connect_plus.checkoutUrl}
            featureList={[
              "Profile engagement analytics",
              "Device and browser breakdown",
              "Visitor behavior insights",
              "Geography and heatmap reporting",
            ]}
            variant="connect_plus"
          />
        ) : null}
        {showLockedAnalytics ? (
          <p className="muted" style={{ margin: "8px 4px 0", fontSize: "0.82rem", fontWeight: 700 }}>
            14 Day Free Trial · Cancel Anytime
          </p>
        ) : null}
      </main>
      {shouldRenderAnalyticsDashboard ? (
        <AnalyticsDashboard
          activeTab={activeTab}
          totalScans={totalScans}
          connectViews={connectViews}
          linkClicks={linkClicks}
          uniqueVisitors={uniqueVisitors}
          leadsCaptured={leadsCaptured}
          activeQrCodes={activeQrCodes}
          qrRows={qrRows}
          connectRows={connectRows}
          scansOverTime={scansOverTime}
          countryData={countryData}
          mapPoints={mapPoints}
          cityRows={cityRows}
          deviceRows={deviceRows}
          browserRows={browserRows}
          osRows={osRows}
          heatmap={heatmap}
          geographyRows={geographyRows}
        />
      ) : null}
    </DashboardShell>
  );
}
