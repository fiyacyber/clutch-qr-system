import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import MarketingAnalyticsHub, {
  type LeadProfileAnalyticsRow,
  type LocationAnalyticsRow,
  type MarketingAssetAnalyticsRow,
} from "@/components/analytics/MarketingAnalyticsHub";
import { requireCustomer } from "@/lib/auth";
import {
  buildHourlyHeatmap,
  buildScansOverTime,
  countBy,
  fetchUnifiedAnalyticsData,
  isCountedProfileView,
  type UnifiedAnalyticsData,
} from "@/lib/clutch-analytics";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { loadAccountAccess } from "@/lib/account-access-server";
import { loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { projectAuthorizedAnalyticsDomains, resolvePortalAnalyticsMode } from "@/lib/order-linked-portal-analytics";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import "../analytics/analytics.css";

const TAB_ALIASES: Record<string, string> = {
  analytics: "overview",
  overview: "overview",
  "qr-codes": "qr-codes",
  "campaign-performance": "qr-codes",
  "nfc-cards": "nfc-cards",
  leads: "leads",
  "clutch-connect": "leads",
  locations: "locations",
  geography: "locations",
  devices: "devices",
  technology: "devices",
  activity: "activity",
  "activity-heatmap": "activity",
};

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => value ? new Date(value).getTime() : Number.NaN)
    .filter(Number.isFinite);
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export default async function MarketingAnalyticsHubPage({
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
  const requestedTab = String(params.tab || "overview").toLowerCase();
  const activeTab = TAB_ALIASES[requestedTab] || "overview";

  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  const accessNow = new Date();
  const isClutchCustomer = access.isAdmin || access.activeProductLabels.length > 0;

  const analyticsMode = await resolvePortalAnalyticsMode({
    isAdmin: Boolean(customer.is_admin),
    hasFullCampaignAnalytics: isClutchCustomer,
    hasFullProfileAnalytics: isClutchCustomer,
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
      listOwnedCodes: async () => admin
        .from("qr_codes")
        .select("id, name, slug")
        .eq("customer_id", customer.id),
      listScans: async (codeIds) => admin
        .from("qr_scans")
        .select("qr_code_id, created_at")
        .in("qr_code_id", codeIds)
        .order("created_at", { ascending: true }),
      resolveCodeAccess: (codeId) => loadOrderLinkedQrAccess(admin, customer, codeId, accessNow, { throwOnError: true }),
    },
  });

  if (analyticsMode.kind === "locked") redirect("/portal?access=analytics-locked");

  if (analyticsMode.kind === "basic") {
    const readyRows = analyticsMode.status === "ready" ? analyticsMode.rows : [];
    const assets: MarketingAssetAnalyticsRow[] = readyRows.map((row) => ({
      id: row.code.id,
      name: row.code.name || "Clutch Code",
      destination: "Included Clutch Code",
      assetType: "QR Code",
      isActive: true,
      totalInteractions: row.totalScans,
      uniqueVisitors: 0,
      lastActivity: row.lastScanAt,
      linkedProfileName: null,
    }));

    const dailyCounts = new Map<string, number>();
    readyRows.forEach((row) => {
      row.scansByUtcDay.forEach((day) => {
        dailyCounts.set(day.date, (dailyCounts.get(day.date) || 0) + day.count);
      });
    });

    return (
      <DashboardShell accountAccess={access} isAdmin={false}>
        {analyticsMode.status === "error" ? (
          <main className="container" style={{ marginBottom: 16 }}>
            <RetryNotice title="Analytics are temporarily unavailable" description={analyticsMode.message} />
          </main>
        ) : null}
        <MarketingAnalyticsHub
          activeTab={activeTab}
          assets={assets}
          leadProfiles={[]}
          scansOverTime={Array.from(dailyCounts.entries()).map(([date, scans]) => ({ date, scans }))}
          locationRows={[]}
          deviceRows={[]}
          browserRows={[]}
          osRows={[]}
          heatmap={[]}
        />
      </DashboardShell>
    );
  }

  const data = projectAuthorizedAnalyticsDomains(analyticsMode.data, {
    campaign: isClutchCustomer,
    profile: isClutchCustomer,
  });
  const campaignCodes = data.qrCodes.filter((code) =>
    code.is_system !== true || ["tracked_print", "business_kit", "smart_card"].includes(String(code.qr_type))
  );
  const campaignCodeIds = new Set(campaignCodes.map((code) => code.id));
  const campaignScans = data.qrScans.filter((scan) => campaignCodeIds.has(scan.qr_code_id));

  const scansByCode = new Map<string, typeof data.qrScans>();
  campaignScans.forEach((scan) => {
    const rows = scansByCode.get(scan.qr_code_id) || [];
    rows.push(scan);
    scansByCode.set(scan.qr_code_id, rows);
  });

  const profileById = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const qrByProfile = new Map<string, typeof data.qrCodes>();
  campaignCodes.forEach((code) => {
    const profileId = (code as any).connect_profile_id || code.profile_id;
    if (!profileId) return;
    const rows = qrByProfile.get(profileId) || [];
    rows.push(code);
    qrByProfile.set(profileId, rows);
  });

  const assets: MarketingAssetAnalyticsRow[] = campaignCodes.map((code) => {
    const scans = scansByCode.get(code.id) || [];
    const profileId = (code as any).connect_profile_id || code.profile_id || null;
    const profile = profileId ? profileById.get(profileId) : null;
    return {
      id: code.id,
      name: String(code.name || "Clutch Code"),
      destination: String(code.destination_url || "No destination"),
      assetType: code.qr_type === "smart_card" ? "NFC Card" : "QR Code",
      isActive: code.is_active !== false,
      totalInteractions: scans.length,
      uniqueVisitors: new Set(scans.map((scan) => scan.ip_hash).filter(Boolean)).size,
      lastActivity: latestTimestamp(scans.map((scan) => scan.created_at)),
      linkedProfileName: profile
        ? String(profile.business_name || profile.contact_name || profile.slug || "Clutch Connect Profile")
        : null,
    };
  });

  const eventsByProfile = new Map<string, typeof data.connectEvents>();
  data.connectEvents.forEach((event) => {
    const rows = eventsByProfile.get(event.profile_id) || [];
    rows.push(event);
    eventsByProfile.set(event.profile_id, rows);
  });

  const leadProfiles: LeadProfileAnalyticsRow[] = data.profiles.map((profile) => {
    const events = eventsByProfile.get(profile.id) || [];
    const linkEvents = events.filter((event) => event.event_type === "link_click");
    const linkCounts = linkEvents.reduce<Record<string, number>>((counts, event) => {
      const label = event.link_label || event.link_url || "Unknown link";
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {});
    const topClickedLink = Object.entries(linkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const linkedQr = qrByProfile.get(profile.id)?.[0] || null;

    return {
      id: profile.id,
      profileName: String(profile.business_name || profile.contact_name || profile.slug || "Clutch Connect Profile"),
      profileViews: events.filter(isCountedProfileView).length,
      linkClicks: linkEvents.length,
      leadsCaptured: events.filter((event) => event.event_type === "lead_submit").length,
      topClickedLink,
      linkedQrCode: linkedQr ? String(linkedQr.name || "Clutch Code") : null,
    };
  });

  const locationMap = new Map<string, {
    label: string;
    city: string;
    region: string;
    country: string;
    interactions: number;
    visitors: Set<string>;
  }>();

  const locationEvents = [
    ...campaignScans.map((scan) => ({
      city: scan.city,
      region: scan.region,
      country: scan.country,
      visitor: scan.ip_hash,
    })),
    ...data.connectEvents.map((event) => ({
      city: event.city,
      region: event.region,
      country: event.country,
      visitor: event.ip_hash || event.visitor_id,
    })),
  ];

  locationEvents.forEach((event) => {
    const city = String(event.city || "Unknown city");
    const region = String(event.region || "");
    const country = String(event.country || "Unknown country");
    const label = [city, region, country].filter(Boolean).join(", ");
    const existing = locationMap.get(label);
    if (existing) {
      existing.interactions += 1;
      if (event.visitor) existing.visitors.add(String(event.visitor));
      return;
    }
    locationMap.set(label, {
      label,
      city,
      region: region || "—",
      country,
      interactions: 1,
      visitors: new Set(event.visitor ? [String(event.visitor)] : []),
    });
  });

  const locationRows: LocationAnalyticsRow[] = Array.from(locationMap.values())
    .map((location) => ({
      label: location.label,
      city: location.city,
      region: location.region,
      country: location.country,
      interactions: location.interactions,
      uniqueVisitors: location.visitors.size,
    }))
    .sort((a, b) => b.interactions - a.interactions);

  const deviceRows = countBy([
    ...campaignScans.map((scan) => scan.device_type),
    ...data.connectEvents.map((event) => event.device_type),
  ]).filter((row) => row.label !== "Unknown");
  const browserRows = countBy([
    ...campaignScans.map((scan) => scan.browser),
    ...data.connectEvents.map((event) => event.browser),
  ]).filter((row) => row.label !== "Unknown");
  const osRows = countBy([
    ...campaignScans.map((scan) => scan.operating_system),
    ...data.connectEvents.map((event) => event.os),
  ]).filter((row) => row.label !== "Unknown");

  const scansOverTime = buildScansOverTime(campaignScans.map((scan) => scan.created_at));
  const heatmap = buildHourlyHeatmap([
    ...campaignScans.map((scan) => scan.created_at),
    ...data.connectEvents.map((event) => event.created_at),
  ]);

  return (
    <DashboardShell
      accountAccess={access}
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !isClutchCustomer,
        analytics: !isClutchCustomer,
        heatmap: !isClutchCustomer,
      }}
    >
      {analyticsMode.failed ? (
        <main className="container" style={{ marginBottom: 16 }}>
          <RetryNotice
            title="Analytics data is temporarily unavailable"
            description="Some analytics could not be loaded. The dashboard is showing the data currently available."
          />
        </main>
      ) : null}
      <MarketingAnalyticsHub
        activeTab={activeTab}
        assets={assets}
        leadProfiles={leadProfiles}
        scansOverTime={scansOverTime}
        locationRows={locationRows}
        deviceRows={deviceRows}
        browserRows={browserRows}
        osRows={osRows}
        heatmap={heatmap}
      />
    </DashboardShell>
  );
}
