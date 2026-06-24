import Link from "next/link";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { buildHourlyHeatmap, countBy, fetchUnifiedAnalyticsData } from "@/lib/clutch-analytics";
import "./analytics.css";

const TABS = [
  "overview",
  "qr-codes",
  "clutch-connect",
  "geography",
  "devices",
  "activity-heatmap",
] as const;

type TabId = (typeof TABS)[number];

function prettyDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function locationLabel(country?: string | null, region?: string | null, city?: string | null) {
  const parts = [city, region, country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) redirect("/login");

  const params = (await searchParams) || {};
  const requestedTab = String(params.tab || "overview").toLowerCase();
  const activeTab = (TABS.includes(requestedTab as TabId) ? requestedTab : "overview") as TabId;

  const admin = createSupabaseAdminClient();
  const data = await fetchUnifiedAnalyticsData(admin, customer as any);

  const scansByQr = new Map<string, any[]>();
  for (const scan of data.qrScans) {
    const rows = scansByQr.get(scan.qr_code_id) || [];
    rows.push(scan);
    scansByQr.set(scan.qr_code_id, rows);
  }

  const connectByProfile = new Map<string, any[]>();
  for (const event of data.connectEvents) {
    const rows = connectByProfile.get(event.profile_id) || [];
    rows.push(event);
    connectByProfile.set(event.profile_id, rows);
  }

  const qrByProfile = new Map<string, any[]>();
  for (const qr of data.qrCodes) {
    const profileId = qr.connect_profile_id || qr.profile_id;
    if (!profileId) continue;
    const rows = qrByProfile.get(profileId) || [];
    rows.push(qr);
    qrByProfile.set(profileId, rows);
  }

  const profileById = new Map(data.profiles.map((profile) => [profile.id, profile]));

  const totalScans = data.qrScans.length;
  const connectViews = data.connectEvents.filter((row) => row.event_type === "profile_view").length;
  const linkClicks = data.connectEvents.filter((row) => row.event_type === "link_click").length;
  const leadsCaptured = data.connectEvents.filter((row) => row.event_type === "lead_submit").length;
  const activeQrCodes = data.qrCodes.filter((row) => row.is_active !== false).length;
  const uniqueVisitors = new Set(
    [...data.qrScans.map((row) => row.ip_hash), ...data.connectEvents.map((row) => row.ip_hash || row.visitor_id)].filter(Boolean)
  ).size;

  const qrRows = data.qrCodes.map((code) => {
    const scans = scansByQr.get(code.id) || [];
    const linkedProfileId = code.connect_profile_id || code.profile_id || null;
    const linkedProfile = linkedProfileId ? profileById.get(linkedProfileId) : null;

    return {
      id: code.id,
      name: code.name,
      destination: code.destination_url,
      totalScans: scans.length,
      uniqueVisitors: new Set(scans.map((scan) => scan.ip_hash).filter(Boolean)).size,
      lastScan: scans[0]?.created_at || null,
      linkedProfileName: linkedProfile
        ? linkedProfile.business_name || linkedProfile.contact_name || linkedProfile.slug
        : null,
    };
  });

  const connectRows = data.profiles.map((profile) => {
    const events = connectByProfile.get(profile.id) || [];
    const profileViews = events.filter((event) => event.event_type === "profile_view").length;
    const rowLinkClicks = events.filter((event) => event.event_type === "link_click").length;
    const rowLeads = events.filter((event) => event.event_type === "lead_submit").length;
    const topLinkCounter = events
      .filter((event) => event.event_type === "link_click")
      .reduce<Record<string, number>>((acc, event) => {
        const key = event.link_label || event.link_url || "Unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    const topClickedLink = Object.entries(topLinkCounter).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const linkedQr = qrByProfile.get(profile.id)?.[0] || null;

    return {
      id: profile.id,
      profileName: profile.business_name || profile.contact_name || profile.slug,
      profileViews,
      linkClicks: rowLinkClicks,
      topClickedLink,
      leadsCaptured: rowLeads,
      linkedQrCode: linkedQr ? linkedQr.name : null,
    };
  });

  const geographyRows = countBy([
    ...data.qrScans.map((row) => locationLabel(row.country, row.region, row.city)),
    ...data.connectEvents.map((row) => locationLabel(row.country, row.region, row.city)),
  ]).filter((row) => row.label !== "Unknown");

  const deviceRows = countBy([
    ...data.qrScans.map((row) => row.device_type || "Unknown"),
    ...data.connectEvents.map((row) => row.device_type || "Unknown"),
  ]);

  const browserRows = countBy([
    ...data.qrScans.map((row) => row.browser || "Unknown"),
    ...data.connectEvents.map((row) => row.browser || "Unknown"),
  ]);

  const osRows = countBy([
    ...data.qrScans.map((row) => row.operating_system || "Unknown"),
    ...data.connectEvents.map((row) => row.os || "Unknown"),
  ]);

  const heatmap = buildHourlyHeatmap([
    ...data.qrScans.map((row) => row.created_at),
    ...data.connectEvents.map((row) => row.created_at),
  ]);
  const maxHeat = Math.max(...heatmap.map((cell) => cell.count), 0);

  const hasAnyActivity = totalScans > 0 || connectViews > 0 || linkClicks > 0 || leadsCaptured > 0;

  return (
    <main className="analytics-container analytics-premium">
      <Header />

      <section className="analytics-hero">
        <p className="analytics-eyebrow">Performance Hub</p>
        <h1>Clutch Analytics</h1>
        <p className="analytics-subtitle">
          Track QR scans, Clutch Connect profile views, link clicks, and lead activity.
        </p>
      </section>

      <section className="metrics-grid metrics-grid-six">
        <article className="metric-card"><span className="metric-label">Total Scans</span><span className="metric-value">{totalScans}</span></article>
        <article className="metric-card"><span className="metric-label">Clutch Connect Views</span><span className="metric-value">{connectViews}</span></article>
        <article className="metric-card"><span className="metric-label">Link Clicks</span><span className="metric-value">{linkClicks}</span></article>
        <article className="metric-card"><span className="metric-label">Unique Visitors</span><span className="metric-value">{uniqueVisitors}</span></article>
        <article className="metric-card"><span className="metric-label">Leads Captured</span><span className="metric-value">{leadsCaptured}</span></article>
        <article className="metric-card"><span className="metric-label">Active QR Codes</span><span className="metric-value">{activeQrCodes}</span></article>
      </section>

      <nav className="analytics-tabs" aria-label="Analytics sections">
        <Link href="/portal/analytics?tab=overview" className={activeTab === "overview" ? "active" : ""}>Overview</Link>
        <Link href="/portal/analytics?tab=qr-codes" className={activeTab === "qr-codes" ? "active" : ""}>QR Codes</Link>
        <Link href="/portal/analytics?tab=clutch-connect" className={activeTab === "clutch-connect" ? "active" : ""}>Clutch Connect</Link>
        <Link href="/portal/analytics?tab=geography" className={activeTab === "geography" ? "active" : ""}>Geography</Link>
        <Link href="/portal/analytics?tab=devices" className={activeTab === "devices" ? "active" : ""}>Devices</Link>
        <Link href="/portal/analytics?tab=activity-heatmap" className={activeTab === "activity-heatmap" ? "active" : ""}>Activity Heatmap</Link>
      </nav>

      {activeTab === "overview" ? (
        <section className="chart-container">
          <h2 className="chart-title">Combined Overview</h2>
          {!hasAnyActivity ? (
            <div className="analytics-empty">
              No activity yet. Scan a QR code or view a Clutch Connect profile to start tracking.
            </div>
          ) : (
            <div className="analytics-two-col">
              <article className="analytics-card">
                <h3>Top QR Campaigns</h3>
                <ul className="analytics-list">
                  {qrRows
                    .sort((a, b) => b.totalScans - a.totalScans)
                    .slice(0, 6)
                    .map((row) => (
                      <li key={row.id}><span>{row.name}</span><strong>{row.totalScans}</strong></li>
                    ))}
                </ul>
              </article>
              <article className="analytics-card">
                <h3>Top Connect Profiles</h3>
                <ul className="analytics-list">
                  {connectRows
                    .sort((a, b) => b.profileViews - a.profileViews)
                    .slice(0, 6)
                    .map((row) => (
                      <li key={row.id}><span>{row.profileName}</span><strong>{row.profileViews}</strong></li>
                    ))}
                </ul>
              </article>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "qr-codes" ? (
        <section className="chart-container">
          <h2 className="chart-title">QR Codes</h2>
          {qrRows.length ? (
            <div className="analytics-table">
              <div className="analytics-table-header analytics-table-qr">
                <span>Name</span>
                <span>Destination</span>
                <span>Total Scans</span>
                <span>Unique Visitors</span>
                <span>Last Scan</span>
                <span>Linked Profile</span>
              </div>
              {qrRows.map((row) => (
                <div key={row.id} className="analytics-table-row analytics-table-qr">
                  <span>{row.name}</span>
                  <span className="truncate">{row.destination}</span>
                  <span>{row.totalScans}</span>
                  <span>{row.uniqueVisitors}</span>
                  <span>{prettyDate(row.lastScan)}</span>
                  <span>{row.linkedProfileName || "-"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">No QR code activity yet.</div>
          )}
        </section>
      ) : null}

      {activeTab === "clutch-connect" ? (
        <section className="chart-container">
          <h2 className="chart-title">Clutch Connect</h2>
          {connectRows.length ? (
            <div className="analytics-table">
              <div className="analytics-table-header analytics-table-connect">
                <span>Profile Name</span>
                <span>Profile Views</span>
                <span>Link Clicks</span>
                <span>Top Clicked Link</span>
                <span>Leads Captured</span>
                <span>Linked QR Code</span>
              </div>
              {connectRows.map((row) => (
                <div key={row.id} className="analytics-table-row analytics-table-connect">
                  <span>{row.profileName}</span>
                  <span>{row.profileViews}</span>
                  <span>{row.linkClicks}</span>
                  <span>{row.topClickedLink || "-"}</span>
                  <span>{row.leadsCaptured}</span>
                  <span>{row.linkedQrCode || "-"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">No Clutch Connect profile activity yet.</div>
          )}
        </section>
      ) : null}

      {activeTab === "geography" ? (
        <section className="chart-container">
          <h2 className="chart-title">Geography</h2>
          {geographyRows.length ? (
            <div className="chart-bars">
              {geographyRows.slice(0, 20).map((row) => (
                <div className="chart-bar-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="chart-bar-track"><i style={{ width: `${(row.value / Math.max(geographyRows[0]?.value || 1, 1)) * 100}%` }} /></div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">
              Location data will appear after scans with detectable location metadata.
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "devices" ? (
        <section className="chart-container">
          <h2 className="chart-title">Devices</h2>
          <div className="analytics-three-col">
            <article className="analytics-card">
              <h3>Device Types</h3>
              <ul className="analytics-list">
                {deviceRows.slice(0, 8).map((row) => <li key={row.label}><span>{row.label}</span><strong>{row.value}</strong></li>)}
              </ul>
            </article>
            <article className="analytics-card">
              <h3>Browsers</h3>
              <ul className="analytics-list">
                {browserRows.slice(0, 8).map((row) => <li key={row.label}><span>{row.label}</span><strong>{row.value}</strong></li>)}
              </ul>
            </article>
            <article className="analytics-card">
              <h3>Operating Systems</h3>
              <ul className="analytics-list">
                {osRows.slice(0, 8).map((row) => <li key={row.label}><span>{row.label}</span><strong>{row.value}</strong></li>)}
              </ul>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "activity-heatmap" ? (
        <section className="chart-container">
          <h2 className="chart-title">Activity Heatmap</h2>
          {!heatmap.some((cell) => cell.count > 0) ? (
            <div className="analytics-empty">No activity yet. Scan a QR code or view a Clutch Connect profile to start tracking.</div>
          ) : (
            <div className="heatmap-layout">
              {heatmap.map((cell) => {
                const ratio = maxHeat ? cell.count / maxHeat : 0;
                const level = ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : ratio > 0 ? 1 : 0;
                return (
                  <div
                    key={`${cell.day}-${cell.hour}`}
                    className={`heatmap-cell ${level ? `active-${level}` : ""}`}
                    title={`${cell.day} ${cell.hour.toString().padStart(2, "0")}:00 - ${cell.count}`}
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
