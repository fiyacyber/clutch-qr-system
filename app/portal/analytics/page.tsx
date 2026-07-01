import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { getCustomerPlan, getEffectiveQrLimit } from "@/lib/plans";
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
  const qrUsageUsed = data.qrCodes.length;
  const qrUsageLimit = plan.code === "admin" ? null : getEffectiveQrLimit(customer as any);
  const managePlanHref = plan.checkoutUrl;
  const latestQrCode = data.qrCodes[0] || null;
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Account holder";
  const planLabel = plan.code === "admin" ? "Admin" : plan.code === "qr_pro_plus" ? "Agency" : "QR Pro";
  const authenticationStatus = customer.must_change_password ? "Password reset required" : "Password login active";
  const memberSince = formatDate(customer.created_at);
  const lastLogin = formatDate(user.last_sign_in_at);
  const companyName = customer.company_name || "—";
  const latestQrForeground = latestQrCode?.foreground_color || "#384862";
  const latestQrBackground = latestQrCode?.background_color || "#ffffff";

  /* ── KPI metrics ── */
  const totalScans     = data.qrScans.length;
  const connectViews   = data.connectEvents.filter(isCountedProfileView).length;
  const linkClicks     = data.connectEvents.filter(e => e.event_type === "link_click").length;
  const leadsCaptured  = data.connectEvents.filter(e => e.event_type === "lead_submit").length;
  const activeQrCodes  = data.qrCodes.filter(q => q.is_active !== false).length;
  const uniqueVisitors = new Set(
    [...data.qrScans.map(r => r.ip_hash), ...data.connectEvents.map(r => r.ip_hash || r.visitor_id)].filter(Boolean)
  ).size;

  /* ── QR rows ── */
  const scansByQr = new Map<string, typeof data.qrScans>();
  for (const s of data.qrScans) {
    const rows = scansByQr.get(s.qr_code_id) || [];
    rows.push(s);
    scansByQr.set(s.qr_code_id, rows);
  }
  const profileById = new Map(data.profiles.map(p => [p.id, p]));
  const qrByProfile = new Map<string, typeof data.qrCodes>();
  for (const qr of data.qrCodes) {
    const pid = (qr as any).connect_profile_id || qr.profile_id;
    if (!pid) continue;
    const rows = qrByProfile.get(pid) || [];
    rows.push(qr);
    qrByProfile.set(pid, rows);
  }

  const qrRows = data.qrCodes.map(code => {
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
  const scansOverTime = buildScansOverTime(data.qrScans.map(r => r.created_at));
  const heatmap = buildHourlyHeatmap([
    ...data.qrScans.map(r => r.created_at),
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

  const qrNameById = new Map(data.qrCodes.map(q => [q.id, q.name]));

  const geographyRows = data.qrScans
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

  for (const scan of data.qrScans as any[]) {
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
    [...data.qrScans, ...data.connectEvents].reduce<Record<string, number>>((acc, r) => {
      if (r.country) acc[r.country] = (acc[r.country] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, scans]) => ({ name, scans })).sort((a, b) => b.scans - a.scans);

  const cityRows = countBy(
    [...data.qrScans, ...data.connectEvents].map(r => {
      const parts = [r.city, r.region, r.country].filter(Boolean);
      return parts.length ? parts.join(", ") : null;
    })
  ).filter(r => r.label !== "Unknown");

  const deviceRows = countBy([
    ...data.qrScans.map(r => r.device_type),
    ...data.connectEvents.map(r => r.device_type),
  ]).filter(r => r.label !== "Unknown");

  const browserRows = countBy([
    ...data.qrScans.map(r => r.browser),
    ...data.connectEvents.map(r => r.browser),
  ]).filter(r => r.label !== "Unknown");

  const osRows = countBy([
    ...data.qrScans.map(r => r.operating_system),
    ...data.connectEvents.map(r => r.os),
  ]).filter(r => r.label !== "Unknown");

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      {analyticsDataResult.failed ? (
        <main className="container" style={{ marginBottom: 16 }}>
          <RetryNotice
            title="Analytics data is temporarily unavailable"
            description="We could not load full analytics right now. You can retry safely."
          />
        </main>
      ) : null}
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
    </DashboardShell>
  );
}
