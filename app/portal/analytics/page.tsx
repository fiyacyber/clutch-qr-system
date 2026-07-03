import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { PLAN_DEFINITIONS, getCustomerPlan, getEffectiveQrLimit, hasEntitlement } from "@/lib/plans";
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
import RetryNotice from "@/components/dashboard/RetryNotice";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import "./analytics.css";

const VALID_TABS = [
  "overview", "qr-codes", "campaign-performance", "clutch-connect", "analytics",
  "geography", "technology", "devices", "activity-heatmap", "settings",
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "No taps yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No taps yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) redirect("/login");

  const params = (await searchParams) || {};
  const tab = String(params.tab || "analytics").toLowerCase();
  const normalizedTab = tab === "devices" || tab === "leads" ? "analytics" : tab;
  const activeTab = VALID_TABS.includes(normalizedTab) ? normalizedTab : "analytics";

  if (activeTab === "settings") {
    redirect("/portal/settings");
  }

  const admin = createSupabaseAdminClient();
  const analyticsDataResult = await runGuardedDashboardTask({
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
  });
  const data = analyticsDataResult.data;
  const plan = getCustomerPlan(customer as any);
  const hasHeatmap = hasEntitlement(customer as any, "heatmapAnalytics") || plan.code === "admin";
  const hasDynamicQr = hasEntitlement(customer as any, "dynamicQr") || plan.code === "admin";
  const campaignQrCodes = data.qrCodes.filter((code) => code.is_system !== true);
  const systemSmartCardQrCodes = data.qrCodes.filter((code) => code.is_system === true && code.qr_type === "smart_card");
  const qrUsageUsed = campaignQrCodes.length;
  const qrUsageLimit = plan.code === "admin" ? null : getEffectiveQrLimit(customer as any);
  const managePlanHref = plan.checkoutUrl;
  const latestQrCode = campaignQrCodes[0] || null;
  const systemSmartCardQrIds = new Set(systemSmartCardQrCodes.map((code) => code.id));
  const campaignQrIds = new Set(campaignQrCodes.map((code) => code.id));
  const campaignQrScans = data.qrScans.filter((scan) => campaignQrIds.has(scan.qr_code_id));
  const systemSmartCardScans = data.qrScans.filter((scan) => systemSmartCardQrIds.has(scan.qr_code_id));
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Account holder";
  const planLabel = plan.code === "admin" ? "Admin" : plan.code === "agency" ? "Agency" : "Clutch Connect";
  const authenticationStatus = customer.must_change_password ? "Password reset required" : "Password login active";
  const memberSince = formatDate(customer.created_at);
  const lastLogin = formatDate(user.last_sign_in_at);
  const companyName = customer.company_name || "—";
  const latestQrForeground = latestQrCode?.foreground_color || "#384862";
  const latestQrBackground = latestQrCode?.background_color || "#ffffff";

  /* ── KPI metrics ── */
  const totalScans     = campaignQrScans.length;
  const connectViews   = data.connectEvents.filter(isCountedProfileView).length;
  const linkClicks     = data.connectEvents.filter(e => e.event_type === "link_click").length;
  const leadsCaptured  = data.connectEvents.filter(e => e.event_type === "lead_submit").length;
  const activeQrCodes  = campaignQrCodes.filter(q => q.is_active !== false).length;
  const uniqueVisitors = new Set(
    [...campaignQrScans.map(r => r.ip_hash), ...data.connectEvents.map(r => r.ip_hash || r.visitor_id)].filter(Boolean)
  ).size;
  const smartCardTotalTaps = systemSmartCardScans.length || systemSmartCardQrCodes.reduce((sum, code) => sum + (code.scan_count || 0), 0);
  const smartCardLastTap = systemSmartCardScans[0]?.created_at || null;

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

  const smartCardDeviceRows = countBy(systemSmartCardScans.map((scan) => scan.device_type)).filter(r => r.label !== "Unknown").slice(0, 4);
  const smartCardBrowserRows = countBy(systemSmartCardScans.map((scan) => scan.browser)).filter(r => r.label !== "Unknown").slice(0, 4);
  const smartCardOsRows = countBy(systemSmartCardScans.map((scan) => scan.operating_system)).filter(r => r.label !== "Unknown").slice(0, 4);
  const smartCardLocationRows = countBy(systemSmartCardScans.map((scan) => {
    const parts = [scan.city, scan.region, scan.country].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  })).filter(r => r.label !== "Unknown").slice(0, 5);
  const smartCardRecentRows = systemSmartCardScans.slice(0, 8).map((scan) => ({
    id: scan.id,
    when: formatDateTime(scan.created_at),
    location: [scan.city, scan.region, scan.country].filter(Boolean).join(", ") || "Location unavailable",
    device: [scan.device_type, scan.browser].filter(Boolean).join(" / ") || "Device unavailable",
  }));

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      {analyticsDataResult.failed ? (
        <main className="container" style={{ marginBottom: 16 }}>
          <RetryNotice
            title="Analytics data is temporarily unavailable"
            description="We could not load full analytics right now. You can retry safely."
          />
        </main>
      ) : null}
      <main className="container" style={{ marginBottom: 16 }}>
        <CurrentPlanBadge
          planCode={plan.code}
          planName={plan.name}
          priceLabel={plan.price}
          description={plan.description}
          usageLabel={hasHeatmap ? "Analytics dashboard unlocked" : "Analytics dashboard locked"}
          subscriptionStatus={String(customer.subscription_status || customer.plan_status || "active")}
          trialStatus={String(customer.trial_status || "none")}
        />
        {!hasHeatmap ? (
          <LockedFeatureCard
            title="Unlock Analytics"
            description="Advanced analytics and heatmaps are available on Clutch Connect+ and higher."
            requiredPlan="Clutch Connect+"
            requiredPlanPrice="$9.99/mo"
            ctaLabel="Upgrade for $9.99/mo"
            ctaHref={PLAN_DEFINITIONS.connect_plus.checkoutUrl}
            featureList={[
              "Engagement dashboard",
              "Geography and device analytics",
              "Heatmap command center",
            ]}
            variant="connect_plus"
          />
        ) : null}
      </main>
      {!hasHeatmap ? (
        <main className="container analytics-smart-card-shell" style={{ marginBottom: 24 }}>
          <section className="analytics-smart-card-activity">
            <div className="analytics-smart-card-header">
              <span>Basic included</span>
              <h1>Smart Card Activity</h1>
              <p>Your smart card QR is automatically connected to your Clutch Connect profile. You do not need to create a QR code.</p>
            </div>

            <div className="analytics-smart-card-metrics">
              <article><span>Total card taps</span><strong>{smartCardTotalTaps.toLocaleString()}</strong><p>{smartCardTotalTaps ? "Tracked from your system-managed smart card QR." : "No card taps yet."}</p></article>
              <article><span>Last tap</span><strong>{formatDateTime(smartCardLastTap)}</strong><p>Taps will appear here after your smart card is scanned.</p></article>
              <article><span>Profile views</span><strong>{connectViews.toLocaleString()}</strong><p>Views of your connected public profile.</p></article>
              <article><span>Leads</span><strong>{leadsCaptured.toLocaleString()}</strong><p>Lead form submissions from your profile.</p></article>
            </div>

            {smartCardTotalTaps ? (
              <div className="analytics-smart-card-grid">
                <article className="analytics-smart-card-panel">
                  <h2>Recent taps</h2>
                  <ul className="analytics-smart-card-list">
                    {smartCardRecentRows.map((row) => (
                      <li key={row.id}>
                        <div><strong>{row.when}</strong><span>{row.location}</span></div>
                        <p>{row.device}</p>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="analytics-smart-card-panel">
                  <h2>Tap breakdowns</h2>
                  <div className="analytics-smart-card-breakdowns">
                    {[
                      { title: "Devices", rows: smartCardDeviceRows },
                      { title: "Browsers", rows: smartCardBrowserRows },
                      { title: "Operating systems", rows: smartCardOsRows },
                      { title: "Locations", rows: smartCardLocationRows },
                    ].map((group) => (
                      <div key={group.title}>
                        <h3>{group.title}</h3>
                        {group.rows.length ? (
                          <ul>
                            {group.rows.map((row) => <li key={row.label}><span>{row.label}</span><strong>{row.value}</strong></li>)}
                          </ul>
                        ) : <p>No data yet</p>}
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : (
              <div className="analytics-smart-card-empty">
                <h2>No card taps yet</h2>
                <p>Taps will appear here after your smart card is scanned.</p>
              </div>
            )}
          </section>
        </main>
      ) : null}
      {hasHeatmap ? (
        <AnalyticsDashboard
          activeTab={activeTab}
          accountName={fullName}
          accountEmail={user.email || null}
          companyName={companyName}
          accountType={planLabel}
          memberSince={memberSince}
          lastLogin={lastLogin}
          authenticationStatus={authenticationStatus}
          planName={plan.name}
          planCode={plan.code}
          managePlanHref={managePlanHref}
          qrUsageUsed={qrUsageUsed}
          qrUsageLimit={qrUsageLimit}
          latestQrName={latestQrCode?.name || null}
          latestQrForeground={latestQrForeground}
          latestQrBackground={latestQrBackground}
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
