import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  buildHourlyHeatmap,
  buildScansOverTime,
  countBy,
  fetchUnifiedAnalyticsData,
} from "@/lib/clutch-analytics";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import "./analytics.css";

const VALID_TABS = [
  "overview", "qr-codes", "clutch-connect", "analytics",
  "geography", "devices", "activity-heatmap", "leads", "settings",
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) redirect("/login");

  const params = (await searchParams) || {};
  const tab = String(params.tab || "analytics").toLowerCase();
  const activeTab = VALID_TABS.includes(tab) ? tab : "analytics";

  const admin = createSupabaseAdminClient();
  const data = await fetchUnifiedAnalyticsData(admin, customer as any);

  /* ── KPI metrics ── */
  const totalScans     = data.qrScans.length;
  const connectViews   = data.connectEvents.filter(e => e.event_type === "profile_view").length;
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
      profileViews: events.filter(e => e.event_type === "profile_view").length,
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
      cityRows={cityRows}
      deviceRows={deviceRows}
      browserRows={browserRows}
      osRows={osRows}
      heatmap={heatmap}
    />
  );
}
