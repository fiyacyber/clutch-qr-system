"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  Eye,
  Info,
  Layers3,
  MapPin,
  MousePointerClick,
  Plus,
  QrCode,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./MarketingAnalyticsHub.module.css";

const ScansLineChart = dynamic(() => import("./ScansLineChart"), {
  ssr: false,
  loading: () => <div style={{ minHeight: 245 }} />,
});
const DeviceDonut = dynamic(() => import("./DeviceDonut"), {
  ssr: false,
  loading: () => <div style={{ minHeight: 245 }} />,
});

export type MarketingAssetAnalyticsRow = {
  id: string;
  name: string;
  destination: string;
  assetType: "QR Code" | "NFC Card";
  isActive: boolean;
  totalInteractions: number;
  uniqueVisitors: number;
  lastActivity: string | null;
  linkedProfileName: string | null;
};

export type LeadProfileAnalyticsRow = {
  id: string;
  profileName: string;
  profileViews: number;
  linkClicks: number;
  leadsCaptured: number;
  topClickedLink: string | null;
  linkedQrCode: string | null;
};

export type LocationAnalyticsRow = {
  label: string;
  city: string;
  region: string;
  country: string;
  interactions: number;
  uniqueVisitors: number;
};

export type MarketingAnalyticsHubProps = {
  activeTab: string;
  assets: MarketingAssetAnalyticsRow[];
  leadProfiles: LeadProfileAnalyticsRow[];
  scansOverTime: { date: string; scans: number }[];
  locationRows: LocationAnalyticsRow[];
  deviceRows: { label: string; value: number }[];
  browserRows: { label: string; value: number }[];
  osRows: { label: string; value: number }[];
  heatmap: { day: string; hour: number; count: number }[];
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, index) => index);

function formatDate(value?: string | null) {
  if (!value) return "No activity yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No activity yet";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 100));
}

function heatLevel(count: number, maximum: number) {
  if (!count || !maximum) return 0;
  const ratio = count / maximum;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function hourLabel(hour: number) {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function BreakdownList({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (!rows.length) {
    return <div className={styles.empty}><p>No activity has been recorded yet.</p></div>;
  }

  return (
    <div className={styles.breakdownList}>
      {rows.slice(0, 8).map((row) => (
        <div key={row.label} className={styles.breakdownRow}>
          <span className={styles.breakdownLabel}>
            <span className={styles.breakdownDot} />
            {row.label}
          </span>
          <strong className={styles.breakdownValue}>
            {row.value.toLocaleString()} · {percent(row.value, total)}%
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function MarketingAnalyticsHub({
  activeTab,
  assets,
  leadProfiles,
  scansOverTime,
  locationRows,
  deviceRows,
  browserRows,
  osRows,
  heatmap,
}: MarketingAnalyticsHubProps) {
  const [qrSearch, setQrSearch] = useState("");
  const [nfcSearch, setNfcSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

  const normalizedTab = [
    "overview",
    "qr-codes",
    "nfc-cards",
    "leads",
    "locations",
    "devices",
    "activity",
  ].includes(activeTab)
    ? activeTab
    : "overview";

  const qrAssets = useMemo(() => assets.filter((asset) => asset.assetType === "QR Code"), [assets]);
  const nfcAssets = useMemo(() => assets.filter((asset) => asset.assetType === "NFC Card"), [assets]);

  const filteredQrAssets = useMemo(() => {
    const query = qrSearch.trim().toLowerCase();
    if (!query) return qrAssets;
    return qrAssets.filter((asset) => `${asset.name} ${asset.destination} ${asset.linkedProfileName || ""}`.toLowerCase().includes(query));
  }, [qrAssets, qrSearch]);

  const filteredNfcAssets = useMemo(() => {
    const query = nfcSearch.trim().toLowerCase();
    if (!query) return nfcAssets;
    return nfcAssets.filter((asset) => `${asset.name} ${asset.destination} ${asset.linkedProfileName || ""}`.toLowerCase().includes(query));
  }, [nfcAssets, nfcSearch]);

  const filteredLeadProfiles = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    if (!query) return leadProfiles;
    return leadProfiles.filter((profile) => `${profile.profileName} ${profile.topClickedLink || ""} ${profile.linkedQrCode || ""}`.toLowerCase().includes(query));
  }, [leadProfiles, leadSearch]);

  const qrInteractions = qrAssets.reduce((sum, asset) => sum + asset.totalInteractions, 0);
  const nfcInteractions = nfcAssets.reduce((sum, asset) => sum + asset.totalInteractions, 0);
  const profileViews = leadProfiles.reduce((sum, profile) => sum + profile.profileViews, 0);
  const linkClicks = leadProfiles.reduce((sum, profile) => sum + profile.linkClicks, 0);
  const leadsCaptured = leadProfiles.reduce((sum, profile) => sum + profile.leadsCaptured, 0);
  const activeAssets = assets.filter((asset) => asset.isActive).length;
  const uniqueVisitors = new Set(assets.flatMap((asset) => Array(asset.uniqueVisitors).fill(asset.id))).size;
  const profilesWithLeads = leadProfiles.filter((profile) => profile.leadsCaptured > 0).length;

  const topQrAssets = [...qrAssets].sort((a, b) => b.totalInteractions - a.totalInteractions).slice(0, 4);
  const topNfcAssets = [...nfcAssets].sort((a, b) => b.totalInteractions - a.totalInteractions).slice(0, 4);
  const topLeadProfiles = [...leadProfiles].sort((a, b) => b.leadsCaptured - a.leadsCaptured).slice(0, 4);
  const topLocation = locationRows[0] || null;
  const topDevice = deviceRows[0] || null;

  const heatByDay = useMemo(() => {
    const rows = new Map<string, number[]>();
    DAY_ORDER.forEach((day) => rows.set(day, Array(24).fill(0)));
    heatmap.forEach((cell) => {
      const row = rows.get(cell.day);
      if (row) row[cell.hour] = cell.count;
    });
    return rows;
  }, [heatmap]);
  const maxHeat = Math.max(...heatmap.map((cell) => cell.count), 0);

  const tabs = [
    { key: "overview", label: "Overview", icon: Layers3 },
    { key: "qr-codes", label: "QR Codes", icon: QrCode },
    { key: "nfc-cards", label: "NFC Cards", icon: CreditCard },
    { key: "leads", label: "Leads", icon: UserCheck },
    { key: "locations", label: "Locations", icon: MapPin },
    { key: "devices", label: "Devices", icon: Smartphone },
    { key: "activity", label: "Activity", icon: Activity },
  ];

  const kpis = [
    { label: "QR scans", value: qrInteractions, helper: `${qrAssets.length} QR code${qrAssets.length === 1 ? "" : "s"}`, icon: QrCode },
    { label: "NFC card visits", value: nfcInteractions, helper: `${nfcAssets.length} smart card${nfcAssets.length === 1 ? "" : "s"}`, icon: CreditCard },
    { label: "Profile views", value: profileViews, helper: "Clutch Connect visits", icon: Eye },
    { label: "Link clicks", value: linkClicks, helper: "Profile link engagement", icon: MousePointerClick },
    { label: "Leads captured", value: leadsCaptured, helper: `${profilesWithLeads} profile${profilesWithLeads === 1 ? "" : "s"} converting`, icon: UserCheck },
    { label: "Active assets", value: activeAssets, helper: `${assets.length} total tracked assets`, icon: Layers3 },
  ];

  function AssetTable({ rows, kind }: { rows: MarketingAssetAnalyticsRow[]; kind: "QR Code" | "NFC Card" }) {
    if (!rows.length) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>{kind === "QR Code" ? <QrCode size={28} /> : <CreditCard size={28} />}</span>
          <h3>{kind === "QR Code" ? "No QR codes yet" : "No NFC card activity yet"}</h3>
          <p>
            {kind === "QR Code"
              ? "Create a Clutch Code to begin tracking scans, visitors, and campaign performance."
              : "NFC card activity will appear after a smart card is connected and its tracked destination receives visits."}
          </p>
          <Link href={kind === "QR Code" ? "/portal/create" : "/portal/connect"} className={styles.primaryLink}>
            {kind === "QR Code" ? <Plus size={15} /> : <CreditCard size={15} />}
            {kind === "QR Code" ? "Create Clutch Code" : "Manage Clutch Connect"}
          </Link>
        </div>
      );
    }

    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{kind === "QR Code" ? "QR code" : "NFC card"}</th>
              <th>{kind === "QR Code" ? "Scans" : "Card visits"}</th>
              <th>Visitors</th>
              <th>Linked profile</th>
              <th>Last activity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <span className={styles.tableName}>{asset.name}</span>
                  <span className={styles.tableUrl}>{asset.destination}</span>
                </td>
                <td>{asset.totalInteractions.toLocaleString()}</td>
                <td>{asset.uniqueVisitors.toLocaleString()}</td>
                <td>{asset.linkedProfileName || "—"}</td>
                <td>{formatDate(asset.lastActivity)}</td>
                <td>
                  <span className={`${styles.status} ${asset.isActive ? "" : styles.statusInactive}`}>
                    {asset.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Link href={`/portal/analytics/${asset.id}`} className={styles.secondaryLink}>View analytics</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="ca-main">
      <div className={`ca-content ${styles.page}`}>
        <DashboardHeader
          pretitle="Marketing"
          title="Marketing Analytics"
          subtitle="Track Clutch Code scans, NFC card visits, profile engagement, and leads from one dashboard."
          actions={(
            <div className={styles.headerActions}>
              <span className={styles.headerBadge}>All-time data</span>
              <Link href="/portal/qr" className={styles.headerLink}>
                Marketing Assets <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
        />

        <nav className={styles.tabs} aria-label="Marketing analytics sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={tab.key === "overview" ? "/portal/analytics" : `/portal/analytics?tab=${tab.key}`}
                className={`${styles.tab} ${normalizedTab === tab.key ? styles.tabActive : ""}`}
                aria-current={normalizedTab === tab.key ? "page" : undefined}
              >
                <Icon size={15} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <section className={styles.kpiGrid} aria-label="Marketing performance summary">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <article key={kpi.label} className={styles.kpiCard}>
                <div className={styles.kpiTop}>
                  <span className={styles.kpiIcon}><Icon size={16} /></span>
                  <span className={styles.kpiLabel}>{kpi.label}</span>
                </div>
                <strong className={styles.kpiValue}>{kpi.value.toLocaleString()}</strong>
                <p className={styles.kpiHelper}>{kpi.helper}</p>
              </article>
            );
          })}
        </section>

        {normalizedTab === "overview" ? (
          <>
            <section className={styles.sectionGrid}>
              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>QR code performance</h2>
                    <p>Your most active non-card Clutch Codes.</p>
                  </div>
                  <Link href="/portal/analytics?tab=qr-codes" className={styles.cardLink}>View QR codes</Link>
                </div>
                {topQrAssets.length ? (
                  <div className={styles.assetList}>
                    {topQrAssets.map((asset) => (
                      <div key={asset.id} className={styles.assetRow}>
                        <div>
                          <span className={styles.assetName}>{asset.name}</span>
                          <span className={styles.assetMeta}>{asset.destination}</span>
                        </div>
                        <span className={styles.assetMetric}>{asset.totalInteractions}<small>scans</small></span>
                      </div>
                    ))}
                  </div>
                ) : <div className={styles.empty}><p>No QR scan activity yet.</p></div>}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>NFC card performance</h2>
                    <p>Tracked visits attributed to smart-card assets.</p>
                  </div>
                  <Link href="/portal/analytics?tab=nfc-cards" className={styles.cardLink}>View NFC cards</Link>
                </div>
                {topNfcAssets.length ? (
                  <div className={styles.assetList}>
                    {topNfcAssets.map((asset) => (
                      <div key={asset.id} className={styles.assetRow}>
                        <div>
                          <span className={styles.assetName}>{asset.name}</span>
                          <span className={styles.assetMeta}>{asset.linkedProfileName || "No linked profile"}</span>
                        </div>
                        <span className={styles.assetMetric}>{asset.totalInteractions}<small>card visits</small></span>
                      </div>
                    ))}
                  </div>
                ) : <div className={styles.empty}><p>No NFC card activity yet.</p></div>}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Lead funnel</h2>
                    <p>How profile traffic turns into customer inquiries.</p>
                  </div>
                  <Link href="/portal/analytics?tab=leads" className={styles.cardLink}>View leads</Link>
                </div>
                <div className={styles.funnel}>
                  <div className={styles.funnelStep} style={{ "--funnel-width": "100%" } as CSSProperties}>
                    <span>Profile views</span><strong>{profileViews.toLocaleString()}</strong>
                  </div>
                  <div className={styles.funnelStep} style={{ "--funnel-width": `${percent(linkClicks, profileViews)}%` } as CSSProperties}>
                    <span>Link clicks</span><strong>{linkClicks.toLocaleString()}</strong>
                  </div>
                  <div className={styles.funnelStep} style={{ "--funnel-width": `${percent(leadsCaptured, profileViews)}%` } as CSSProperties}>
                    <span>Leads captured</span><strong>{leadsCaptured.toLocaleString()}</strong>
                  </div>
                </div>
                <div className={styles.funnelFooter}>
                  <span>View-to-lead conversion</span>
                  <strong>{percent(leadsCaptured, profileViews)}%</strong>
                </div>
              </article>
            </section>

            <section className={styles.twoColumn}>
              <article className={`${styles.card} ${styles.chartCard}`}>
                <div className={styles.cardHeader}>
                  <div><h2>Tracked activity over time</h2><p>QR scans and tracked NFC card visits.</p></div>
                  <Link href="/portal/analytics?tab=activity" className={styles.cardLink}>Full activity</Link>
                </div>
                <div className={styles.chartBody}><ScansLineChart data={scansOverTime} /></div>
              </article>

              <article className={`${styles.card} ${styles.chartCard}`}>
                <div className={styles.cardHeader}>
                  <div><h2>Audience snapshot</h2><p>Where visitors are coming from and what they use.</p></div>
                  <Link href="/portal/analytics?tab=devices" className={styles.cardLink}>View devices</Link>
                </div>
                <div className={styles.summaryGrid} style={{ marginTop: 16 }}>
                  <div className={styles.summaryCard}><span>Top location</span><strong>{topLocation?.label || "—"}</strong></div>
                  <div className={styles.summaryCard}><span>Top device</span><strong>{topDevice?.label || "—"}</strong></div>
                  <div className={styles.summaryCard}><span>Tracked visitors</span><strong>{uniqueVisitors.toLocaleString()}</strong></div>
                  <div className={styles.summaryCard}><span>Profiles tracked</span><strong>{leadProfiles.length.toLocaleString()}</strong></div>
                </div>
                <BreakdownList rows={deviceRows} />
              </article>
            </section>
          </>
        ) : null}

        {normalizedTab === "qr-codes" ? (
          <>
            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}><span>Active QR codes</span><strong>{qrAssets.filter((asset) => asset.isActive).length}</strong></article>
              <article className={styles.summaryCard}><span>Total scans</span><strong>{qrInteractions.toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>Unique visitors</span><strong>{qrAssets.reduce((sum, asset) => sum + asset.uniqueVisitors, 0).toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>Top QR code</span><strong>{topQrAssets[0]?.name || "—"}</strong></article>
            </section>
            <section className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div><h2>QR code analytics</h2><p>Performance for QR-only campaigns and printed marketing pieces.</p></div>
                {qrAssets.length ? <Link href="/portal/create" className={styles.primaryLink}><Plus size={15} /> Create Clutch Code</Link> : null}
              </div>
              {qrAssets.length ? (
                <div style={{ padding: "12px 18px 0" }}>
                  <input
                    value={qrSearch}
                    onChange={(event) => setQrSearch(event.target.value)}
                    placeholder="Search QR codes or destinations"
                    aria-label="Search QR code analytics"
                    style={{ width: "100%", minHeight: 42, border: "1px solid #d6e0ea", borderRadius: 10, padding: "9px 12px", font: "inherit" }}
                  />
                </div>
              ) : null}
              <AssetTable rows={filteredQrAssets} kind="QR Code" />
            </section>
          </>
        ) : null}

        {normalizedTab === "nfc-cards" ? (
          <>
            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}><span>Active NFC cards</span><strong>{nfcAssets.filter((asset) => asset.isActive).length}</strong></article>
              <article className={styles.summaryCard}><span>Tracked card visits</span><strong>{nfcInteractions.toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>Unique visitors</span><strong>{nfcAssets.reduce((sum, asset) => sum + asset.uniqueVisitors, 0).toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>Profiles connected</span><strong>{nfcAssets.filter((asset) => asset.linkedProfileName).length}</strong></article>
            </section>
            <div className={styles.notice}><Info size={16} /><span>NFC card activity represents visits attributed to smart-card assets. When a card also contains a printed QR code using the same tracked destination, the system does not claim to distinguish the physical interaction method.</span></div>
            <section className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div><h2>NFC card analytics</h2><p>Review tracked visits and the Clutch Connect profile associated with each smart card.</p></div>
                <Link href="/portal/connect" className={styles.secondaryLink}>Manage profile</Link>
              </div>
              {nfcAssets.length ? (
                <div style={{ padding: "12px 18px 0" }}>
                  <input
                    value={nfcSearch}
                    onChange={(event) => setNfcSearch(event.target.value)}
                    placeholder="Search NFC cards or profiles"
                    aria-label="Search NFC card analytics"
                    style={{ width: "100%", minHeight: 42, border: "1px solid #d6e0ea", borderRadius: 10, padding: "9px 12px", font: "inherit" }}
                  />
                </div>
              ) : null}
              <AssetTable rows={filteredNfcAssets} kind="NFC Card" />
            </section>
          </>
        ) : null}

        {normalizedTab === "leads" ? (
          <>
            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}><span>Leads captured</span><strong>{leadsCaptured.toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>Profile views</span><strong>{profileViews.toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>Link clicks</span><strong>{linkClicks.toLocaleString()}</strong></article>
              <article className={styles.summaryCard}><span>View-to-lead rate</span><strong>{percent(leadsCaptured, profileViews)}%</strong></article>
            </section>
            <section className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div><h2>Lead performance by profile</h2><p>See which Clutch Connect profiles generate views, clicks, and submitted leads.</p></div>
                <Link href="/portal/connect/leads" className={styles.primaryLink}><UserCheck size={15} /> Open Lead Inbox</Link>
              </div>
              {leadProfiles.length ? (
                <div style={{ padding: "12px 18px 0" }}>
                  <input
                    value={leadSearch}
                    onChange={(event) => setLeadSearch(event.target.value)}
                    placeholder="Search profiles, links, or QR codes"
                    aria-label="Search lead analytics"
                    style={{ width: "100%", minHeight: 42, border: "1px solid #d6e0ea", borderRadius: 10, padding: "9px 12px", font: "inherit" }}
                  />
                </div>
              ) : null}
              {filteredLeadProfiles.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Profile</th><th>Views</th><th>Link clicks</th><th>Leads</th><th>Conversion</th><th>Top link</th><th>Linked QR</th></tr></thead>
                    <tbody>
                      {filteredLeadProfiles.map((profile) => (
                        <tr key={profile.id}>
                          <td className={styles.tableName}>{profile.profileName}</td>
                          <td>{profile.profileViews.toLocaleString()}</td>
                          <td>{profile.linkClicks.toLocaleString()}</td>
                          <td>{profile.leadsCaptured.toLocaleString()}</td>
                          <td>{percent(profile.leadsCaptured, profile.profileViews)}%</td>
                          <td>{profile.topClickedLink || "—"}</td>
                          <td>{profile.linkedQrCode || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}><UserCheck size={28} /></span>
                  <h3>No lead activity yet</h3>
                  <p>Profile views, link clicks, and submitted lead forms will appear here as customers engage.</p>
                  <Link href="/portal/connect" className={styles.primaryLink}>Manage Clutch Connect</Link>
                </div>
              )}
            </section>
          </>
        ) : null}

        {normalizedTab === "locations" ? (
          <section className={styles.tableCard}>
            <div className={styles.tableHeader}><div><h2>Visitor locations</h2><p>Combined location activity from QR codes, NFC card assets, and Clutch Connect profiles.</p></div></div>
            {locationRows.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Location</th><th>City</th><th>State/region</th><th>Country</th><th>Interactions</th><th>Unique visitors</th></tr></thead>
                  <tbody>{locationRows.map((row) => <tr key={row.label}><td className={styles.tableName}>{row.label}</td><td>{row.city}</td><td>{row.region}</td><td>{row.country}</td><td>{row.interactions}</td><td>{row.uniqueVisitors}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <div className={styles.empty}><span className={styles.emptyIcon}><MapPin size={28} /></span><h3>No location data yet</h3><p>Location insights appear after tracked visitors interact with your marketing assets.</p></div>}
          </section>
        ) : null}

        {normalizedTab === "devices" ? (
          <section className={styles.sectionGrid}>
            <article className={`${styles.card} ${styles.chartCard}`}><div className={styles.cardHeader}><div><h2>Device breakdown</h2><p>Phones, tablets, and computers used by visitors.</p></div></div><div className={styles.chartBody}><DeviceDonut data={deviceRows} /></div></article>
            <article className={styles.card}><div className={styles.cardHeader}><div><h2>Browsers</h2><p>Browser share across tracked interactions.</p></div></div><BreakdownList rows={browserRows} /></article>
            <article className={styles.card}><div className={styles.cardHeader}><div><h2>Operating systems</h2><p>Operating systems reported by visitors.</p></div></div><BreakdownList rows={osRows} /></article>
          </section>
        ) : null}

        {normalizedTab === "activity" ? (
          <>
            <article className={`${styles.card} ${styles.chartCard}`}><div className={styles.cardHeader}><div><h2>Marketing activity over time</h2><p>Recorded QR scans and tracked smart-card visits.</p></div></div><div className={styles.chartBody}><ScansLineChart data={scansOverTime} /></div></article>
            <article className={`${styles.card} ${styles.heatmapCard}`}>
              <div className={styles.cardHeader}><div><h2>Activity by day and hour</h2><p>Identify when customers are most likely to interact with your marketing.</p></div></div>
              <div className={styles.heatmapScroll}>
                <div className={styles.heatmap}>
                  <div className={styles.heatRow}><span />{HOURS.map((hour) => <span key={hour} className={styles.hourLabel}>{hour % 3 === 0 ? hourLabel(hour) : ""}</span>)}</div>
                  {DAY_ORDER.map((day) => {
                    const cells = heatByDay.get(day) || Array(24).fill(0);
                    return <div key={day} className={styles.heatRow}><span className={styles.dayLabel}>{day}</span>{cells.map((count, hour) => <span key={hour} title={`${day} ${hourLabel(hour)}: ${count} interactions`} className={`${styles.heatCell} ${styles[`heat${heatLevel(count, maxHeat)}` as keyof typeof styles] || ""}`} />)}</div>;
                  })}
                </div>
              </div>
            </article>
          </>
        ) : null}
      </div>
    </div>
  );
}
