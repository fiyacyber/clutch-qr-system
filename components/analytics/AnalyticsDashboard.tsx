"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  QrCode, BarChart2, Users, Download, SlidersHorizontal,
  CalendarDays, ChevronDown, Eye, MousePointerClick, UserCheck,
  ArrowUpRight, Search,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

const ScansLineChart = dynamic(() => import("./ScansLineChart"), { ssr: false, loading: () => <div className="ca-chart-skeleton" /> });
const DeviceDonut   = dynamic(() => import("./DeviceDonut"),    { ssr: false, loading: () => <div className="ca-chart-skeleton" /> });

/* ─────────────── Types ─────────────── */
interface QrRow {
  id: string; name: string; destination: string;
  totalScans: number; uniqueVisitors: number;
  lastScan: string | null; linkedProfileName: string | null;
}
interface ConnectRow {
  id: string; profileName: string; profileViews: number;
  linkClicks: number; topClickedLink: string | null;
  leadsCaptured: number; linkedQrCode: string | null;
}
export interface DashboardProps {
  activeTab: string;
  totalScans: number;
  connectViews: number;
  linkClicks: number;
  uniqueVisitors: number;
  leadsCaptured: number;
  activeQrCodes: number;
  qrRows: QrRow[];
  connectRows: ConnectRow[];
  scansOverTime: { date: string; scans: number }[];
  countryData: { name: string; scans: number }[];
  mapPoints: { lat: number; lon: number; scans: number; uniqueVisitors: number; label: string }[];
  cityRows: { label: string; value: number }[];
  deviceRows: { label: string; value: number }[];
  browserRows: { label: string; value: number }[];
  osRows: { label: string; value: number }[];
  heatmap: { day: string; hour: number; count: number }[];
  geographyRows: {
    id: string;
    qrId: string;
    campaign: string;
    city: string;
    region: string;
    country: string;
    locationLabel: string;
    createdAt: string;
    latitude: number | null;
    longitude: number | null;
    location_source?: string | null;
  }[];
}

const KPI = [
  { key: "totalScans",     label: "Total Scans",          icon: BarChart2 },
  { key: "uniqueVisitors", label: "Unique Visitors",      icon: Users },
  { key: "linkClicks",     label: "Link Clicks",          icon: MousePointerClick },
  { key: "connectViews",   label: "Profile Views", icon: Eye },
  { key: "leadsCaptured",  label: "Leads Captured",       icon: UserCheck },
  { key: "activeQrCodes",  label: "Active Campaigns",      icon: QrCode },
];

function prettyDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/* ─────────────── Heatmap helpers ─────────────── */
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function hourLabel(h: number) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function heatLevel(count: number, max: number) {
  if (!count || !max) return 0;
  const r = count / max;
  if (r >= 0.75) return 4;
  if (r >= 0.5)  return 3;
  if (r >= 0.25) return 2;
  return 1;
}

/* ─────────────── Main component ─────────────── */
export default function AnalyticsDashboard(props: DashboardProps) {
  const { activeTab, heatmap } = props;
  const [topLocationView, setTopLocationView] = useState<"cities" | "countries">("countries");
  const [timeFilter, setTimeFilter] = useState("30D");
  const [qrSearch, setQrSearch] = useState("");
  const [qrFilter, setQrFilter] = useState("all");
  const [geoDateRange, setGeoDateRange] = useState("30d");
  const [geoCountry, setGeoCountry] = useState("all");
  const [geoState, setGeoState] = useState("all");
  const [geoCity, setGeoCity] = useState("all");
  const [geoCampaign, setGeoCampaign] = useState("all");
  const [geoQrCode, setGeoQrCode] = useState("all");
  const [showDashboardFilters, setShowDashboardFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const analyticsTab = useMemo(() => {
    if (!activeTab || activeTab === "analytics" || activeTab === "overview") return "overview";
    if (activeTab === "geography") return "geography";
    if (activeTab === "devices" || activeTab === "technology") return "technology";
    if (activeTab === "activity-heatmap" || activeTab === "activity") return "activity-heatmap";
    if (activeTab === "campaign-performance" || activeTab === "qr-codes") return "campaign-performance";
    return "overview";
  }, [activeTab]);

  const headerTitle = "Insights";
  const headerSubtitle = "Measure scans, profile views, link clicks, leads, and location performance across campaigns.";
  const isMainView = analyticsTab === "overview";
  const maxHeat = Math.max(...heatmap.map(c => c.count), 0);

  // Group heatmap by day
  const heatByDay = new Map<string, number[]>();
  for (const day of DAY_ORDER) heatByDay.set(day, Array(24).fill(0));
  for (const cell of heatmap) {
    const row = heatByDay.get(cell.day);
    if (row) row[cell.hour] = cell.count;
  }

  // Show X labels every 2 hours
  const xLabels = HOURS.filter(h => h % 2 === 0);

  const qrRows = useMemo(() => {
    return props.qrRows.map((row) => {
      const type = row.linkedProfileName ? "Clutch Connect Profile" : "Website";
      const status = row.totalScans > 0 ? "Active" : "Idle";
      return { ...row, type, status };
    });
  }, [props.qrRows]);

  const filteredQrRows = useMemo(() => {
    const needle = qrSearch.trim().toLowerCase();
    return qrRows.filter((row) => {
      const searchMatch =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.destination.toLowerCase().includes(needle) ||
        row.type.toLowerCase().includes(needle);

      if (!searchMatch) return false;
      if (qrFilter === "all") return true;
      if (qrFilter === "connected") return Boolean(row.linkedProfileName);
      if (qrFilter === "standard") return !row.linkedProfileName;
      if (qrFilter === "scanned") return row.totalScans > 0;
      return true;
    });
  }, [qrRows, qrSearch, qrFilter]);

  const qrTotalScans = useMemo(
    () => qrRows.reduce((sum, row) => sum + row.totalScans, 0),
    [qrRows]
  );

  const mostActiveQr = useMemo(() => {
    if (!qrRows.length) return null;
    return [...qrRows].sort((a, b) => b.totalScans - a.totalScans)[0];
  }, [qrRows]);

  const overviewTopLocations = useMemo(() => {
    if (topLocationView === "countries") {
      return props.countryData
        .slice()
        .sort((a, b) => b.scans - a.scans)
        .map((row) => ({ label: row.name, value: row.scans }));
    }
    return props.cityRows;
  }, [props.countryData, props.cityRows, topLocationView]);

  const lastScan = useMemo(() => {
    const timestamps = qrRows
      .map((row) => (row.lastScan ? new Date(row.lastScan).getTime() : null))
      .filter((value): value is number => Boolean(value));
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [qrRows]);

  const templates = [
    { label: "Business Card", href: "/portal/create?template=business-card" },
    { label: "Google Review", href: "/portal/create?template=google-review" },
    { label: "Flyer", href: "/portal/create?template=flyer" },
    { label: "Yard Sign", href: "/portal/create?template=yard-sign" },
    { label: "Website", href: "/portal/create?template=website" },
    { label: "Clutch Connect Profile", href: "/portal/create?template=clutch-connect-profile" },
  ];

  const geoRows = useMemo(() => {
    const now = Date.now();

    function inRange(createdAt: string) {
      const ts = new Date(createdAt).getTime();
      if (!Number.isFinite(ts)) return true;
      if (geoDateRange === "7d") return ts >= now - 7 * 24 * 60 * 60 * 1000;
      if (geoDateRange === "30d") return ts >= now - 30 * 24 * 60 * 60 * 1000;
      if (geoDateRange === "90d") return ts >= now - 90 * 24 * 60 * 60 * 1000;
      return true;
    }

    return props.geographyRows.filter((row) => {
      if (!inRange(row.createdAt)) return false;
      if (geoCountry !== "all" && row.country !== geoCountry) return false;
      if (geoState !== "all" && row.region !== geoState) return false;
      if (geoCity !== "all" && row.city !== geoCity) return false;
      if (geoCampaign !== "all" && row.campaign !== geoCampaign) return false;
      if (geoQrCode !== "all" && row.qrId !== geoQrCode) return false;
      return true;
    });
  }, [props.geographyRows, geoDateRange, geoCountry, geoState, geoCity, geoCampaign, geoQrCode]);

  const geoCountries = useMemo(
    () => Array.from(new Set(props.geographyRows.map((row) => row.country))).filter(Boolean).sort(),
    [props.geographyRows]
  );
  const geoStates = useMemo(
    () => Array.from(new Set(props.geographyRows.map((row) => row.region))).filter(Boolean).sort(),
    [props.geographyRows]
  );
  const geoCities = useMemo(
    () => Array.from(new Set(props.geographyRows.map((row) => row.city))).filter(Boolean).sort(),
    [props.geographyRows]
  );
  const geoCampaigns = useMemo(
    () => Array.from(new Set(props.geographyRows.map((row) => row.campaign))).filter(Boolean).sort(),
    [props.geographyRows]
  );

  const topCities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of geoRows) {
      counts.set(row.city, (counts.get(row.city) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [geoRows]);

  const topStates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of geoRows) {
      counts.set(row.region, (counts.get(row.region) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [geoRows]);

  const campaignGeography = useMemo(() => {
    const counts = new Map<string, { campaign: string; location: string; scans: number }>();
    for (const row of geoRows) {
      const key = `${row.campaign}__${row.locationLabel}`;
      const existing = counts.get(key);
      if (existing) {
        existing.scans += 1;
      } else {
        counts.set(key, {
          campaign: row.campaign,
          location: row.locationLabel,
          scans: 1,
        });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.scans - a.scans).slice(0, 20);
  }, [geoRows]);

  const regionalPerformance = useMemo(() => {
    const total = geoRows.length;
    const bestCity = topCities[0];
    const bestState = topStates[0];
    return {
      bestCity,
      bestState,
      cityPct: total && bestCity ? ((bestCity.value / total) * 100).toFixed(1) : "0.0",
      statePct: total && bestState ? ((bestState.value / total) * 100).toFixed(1) : "0.0",
    };
  }, [geoRows.length, topCities, topStates]);

  const growthInsights = useMemo(() => {
    const now = Date.now();
    const currentStart = now - 7 * 24 * 60 * 60 * 1000;
    const previousStart = now - 14 * 24 * 60 * 60 * 1000;
    const current = new Map<string, number>();
    const previous = new Map<string, number>();

    for (const row of geoRows) {
      const ts = new Date(row.createdAt).getTime();
      if (!Number.isFinite(ts)) continue;
      if (ts >= currentStart) {
        current.set(row.locationLabel, (current.get(row.locationLabel) || 0) + 1);
      } else if (ts >= previousStart && ts < currentStart) {
        previous.set(row.locationLabel, (previous.get(row.locationLabel) || 0) + 1);
      }
    }

    let fastestLocation = "—";
    let fastestDelta = Number.NEGATIVE_INFINITY;
    for (const [location, count] of Array.from(current.entries())) {
      const delta = count - (previous.get(location) || 0);
      if (delta > fastestDelta) {
        fastestDelta = delta;
        fastestLocation = location;
      }
    }

    const mostActive = topCities[0]?.label || "—";
    const mostRecent =
      [...geoRows]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        ?.locationLabel || "—";

    return {
      fastestLocation,
      mostActive,
      mostRecent,
    };
  }, [geoRows, topCities]);

  const geoTopRegion = topStates[0]?.label || "—";
  const geoTopCity = topCities[0]?.label || "—";

  function exportGeographyCsv() {
    const rows = [
      ["Campaign", "Location", "City", "State", "Country", "Scan Timestamp"],
      ...geoRows.map((row) => [
        row.campaign,
        row.locationLabel,
        row.city,
        row.region,
        row.country,
        row.createdAt,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clutch-location-intelligence.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadBlob(filename, csv, "text/csv;charset=utf-8;");
  }

  function downloadBlob(filename: string, content: BlobPart, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getCampaignExportRows(): Array<Array<string | number | null | undefined>> {
    return [
      ["Campaign", "Destination", "Type", "Status", "Total Scans", "Unique Visitors", "Last Scan", "Linked Profile"],
      ...filteredQrRows.map((row) => [
        row.name,
        row.destination,
        row.type,
        row.status,
        row.totalScans,
        row.uniqueVisitors,
        row.lastScan ? prettyDate(row.lastScan) : "No scans yet",
        row.linkedProfileName || "",
      ]),
    ];
  }

  function exportCampaignCsv() {
    downloadCsv("clutch-campaign-performance.csv", getCampaignExportRows());
    setShowExportMenu(false);
  }

  function exportCampaignXls() {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Destination</th>
            <th>Total Scans</th>
            <th>Unique Visitors</th>
            <th>Last Scan</th>
            <th>Linked Profile</th>
          </tr>
        </thead>
        <tbody>
          ${filteredQrRows
            .map(
              (row) => `<tr>
                <td>${row.name}</td>
                <td>${row.destination || ""}</td>
                <td>${row.totalScans}</td>
                <td>${row.uniqueVisitors}</td>
                <td>${row.lastScan ? prettyDate(row.lastScan) : "No scans"}</td>
                <td>${row.linkedProfileName || ""}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    downloadBlob("clutch-campaign-performance.xls", html, "application/vnd.ms-excel;charset=utf-8;");
    setShowExportMenu(false);
  }

  function exportCampaignPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const rows = filteredQrRows;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    let y = 48;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Clutch Campaign Performance", margin, y);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(88, 101, 125);
    doc.text(`Exported ${new Date().toLocaleString()} • ${rows.length} campaigns`, margin, y);
    y += 28;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(11, 31, 53);
    doc.text("Campaign", margin, y);
    doc.text("Scans", pageWidth - 220, y);
    doc.text("Visitors", pageWidth - 160, y);
    doc.text("Last Scan", pageWidth - 92, y);
    y += 8;
    doc.setDrawColor(216, 221, 232);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(56, 72, 98);

    for (const row of rows) {
      if (y > 560) {
        doc.addPage();
        y = 48;
      }

      const campaign = doc.splitTextToSize(row.name, pageWidth - 320).slice(0, 2);
      const destination = doc.splitTextToSize(row.destination || "", pageWidth - 320).slice(0, 1);
      doc.setFont("helvetica", "bold");
      doc.text(campaign, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(destination, margin, y + campaign.length * 10 + 2);
      doc.text(String(row.totalScans), pageWidth - 220, y);
      doc.text(String(row.uniqueVisitors), pageWidth - 160, y);
      doc.text(row.lastScan ? prettyDate(row.lastScan) : "No scans", pageWidth - 92, y);
      y += Math.max(34, campaign.length * 10 + 18);
    }

    doc.save("clutch-campaign-performance.pdf");
    setShowExportMenu(false);
  }

  return (
    <div className="ca-main">
      <DashboardHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        actions={
          <div className="ca-topbar-controls">
            <button className="ca-date-btn">
              <CalendarDays size={13} />
              May 19 – Jun 18, 2025
              <ChevronDown size={12} />
            </button>
            <div className="ca-time-filters">
              {["7D", "30D", "90D", "1Y"].map(t => (
                <button
                  key={t}
                  className={`ca-time-btn${timeFilter === t ? " active" : ""}`}
                  onClick={() => setTimeFilter(t)}
                >{t}</button>
              ))}
            </div>
            <div className="ca-export-menu-wrap">
              <button
                type="button"
                className={`ca-ctrl-btn${showExportMenu ? " active" : ""}`}
                onClick={() => setShowExportMenu((isOpen) => !isOpen)}
                aria-expanded={showExportMenu}
              >
                <Download size={13} /> Export <ChevronDown size={12} />
              </button>
              {showExportMenu ? (
                <div className="ca-export-menu" role="menu" aria-label="Export campaign performance">
                  <button type="button" onClick={exportCampaignCsv} role="menuitem">CSV</button>
                  <button type="button" onClick={exportCampaignXls} role="menuitem">XLS</button>
                  <button type="button" onClick={exportCampaignPdf} role="menuitem">PDF</button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={`ca-ctrl-btn${showDashboardFilters ? " active" : ""}`}
              onClick={() => setShowDashboardFilters((isOpen) => !isOpen)}
              aria-expanded={showDashboardFilters}
            >
              <SlidersHorizontal size={13} /> Filter
            </button>
          </div>
        }
      />

      <div className="ca-content">
          <div className="ca-analytics-tabs" role="tablist" aria-label="Analytics views">
            {[
              { key: "overview", label: "Overview" },
              { key: "geography", label: "Geography" },
              { key: "technology", label: "Technology" },
              { key: "activity-heatmap", label: "Activity" },
              { key: "campaign-performance", label: "Campaign Performance" },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={tab.key === "overview" ? "/portal/analytics" : `/portal/analytics?tab=${tab.key}`}
                className={`ca-analytics-tab${analyticsTab === tab.key ? " active" : ""}`}
                role="tab"
                aria-selected={analyticsTab === tab.key}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {showDashboardFilters ? (
            <section className="ca-card ca-dashboard-filter-panel" aria-label="Analytics filters">
              <div className="ca-card-head">
                <div>
                  <h2 className="ca-card-title">Dashboard Filters</h2>
                  <p className="ca-title-sub">Adjust the visible analytics view and campaign list.</p>
                </div>
                <button
                  type="button"
                  className="ca-secondary-link-btn"
                  onClick={() => {
                    setTimeFilter("30D");
                    setQrSearch("");
                    setQrFilter("all");
                    setGeoDateRange("30d");
                    setGeoCountry("all");
                    setGeoState("all");
                    setGeoCity("all");
                    setGeoCampaign("all");
                    setGeoQrCode("all");
                  }}
                >
                  Reset
                </button>
              </div>

              <div className="ca-dashboard-filter-grid">
                <label>
                  <span>QR Campaigns</span>
                  <select className="ca-select" value={qrFilter} onChange={(event) => setQrFilter(event.target.value)}>
                    <option value="all">All campaigns</option>
                    <option value="connected">Connected profiles</option>
                    <option value="standard">Standard QR codes</option>
                    <option value="scanned">Scanned campaigns</option>
                  </select>
                </label>
                <label>
                  <span>Search Campaigns</span>
                  <input
                    className="ca-filter-input"
                    value={qrSearch}
                    onChange={(event) => setQrSearch(event.target.value)}
                    placeholder="Campaign name or URL"
                  />
                </label>
                <label>
                  <span>Geography Range</span>
                  <select className="ca-select" value={geoDateRange} onChange={(event) => setGeoDateRange(event.target.value)}>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          {/* KPI Row — always visible */}
          <div className="ca-kpi-row">
            {KPI.map(({ key, label, icon: Icon }) => {
              const val = (props as any)[key] as number;
              return (
                <div key={key} className="ca-kpi-card">
                  <div className="ca-kpi-top">
                    <div className="ca-kpi-icon-wrap"><Icon size={15} strokeWidth={2} /></div>
                    <span className="ca-kpi-label">{label}</span>
                  </div>
                  <div className="ca-kpi-body">
                    <span className="ca-kpi-val">{val.toLocaleString()}</span>
                    {val > 0 && (
                      <span className="ca-kpi-change">
                        <ArrowUpRight size={12} /> {(Math.random() * 20 + 8).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="ca-kpi-cmp">vs May 19 – Jun 18, 2025</p>
                </div>
              );
            })}
          </div>

          {/* ── Overview / Analytics tab ── */}
          {isMainView && (
            <>
              {/* 3-column row */}
              <div className="ca-three-col">
                {/* Top Locations */}
                <div className="ca-card">
                  <div className="ca-card-head">
                    <h2 className="ca-card-title">Top Locations</h2>
                    <div className="ca-inline-toggle" role="tablist" aria-label="Top location view">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={topLocationView === "cities"}
                        className={`ca-inline-toggle-btn${topLocationView === "cities" ? " active" : ""}`}
                        onClick={() => setTopLocationView("cities")}
                      >
                        Top Cities
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={topLocationView === "countries"}
                        className={`ca-inline-toggle-btn${topLocationView === "countries" ? " active" : ""}`}
                        onClick={() => setTopLocationView("countries")}
                      >
                        Top Countries
                      </button>
                    </div>
                  </div>
                  {overviewTopLocations.length ? (
                    <table className="ca-loc-table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Scans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewTopLocations.slice(0, 5).map(row => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="ca-empty">No {topLocationView === "countries" ? "country" : "city"} data yet.</div>
                  )}
                  <Link href="/portal/analytics?tab=geography" className="ca-card-link">
                    View full report <ArrowUpRight size={13} />
                  </Link>
                </div>

                {/* Scans Over Time */}
                <div className="ca-card">
                  <div className="ca-card-head">
                    <h2 className="ca-card-title">Scans Over Time</h2>
                    <div className="ca-select-wrap ca-select-sm">
                      <select className="ca-select">
                        <option>Daily</option>
                        <option>Weekly</option>
                      </select>
                      <ChevronDown size={11} className="ca-select-caret" />
                    </div>
                  </div>
                  <ScansLineChart data={props.scansOverTime} />
                  <Link href="/portal/analytics?tab=activity-heatmap" className="ca-card-link">
                    View full report <ArrowUpRight size={13} />
                  </Link>
                </div>

                {/* Device Breakdown */}
                <div className="ca-card">
                  <div className="ca-card-head">
                    <h2 className="ca-card-title">Device Breakdown</h2>
                  </div>
                  <DeviceDonut data={props.deviceRows} />
                  <Link href="/portal/analytics?tab=technology" className="ca-card-link">
                    View full report <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Activity Heatmap */}
              <div className="ca-card ca-heatmap-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Activity <span className="ca-title-sub">by Day &amp; Hour</span></h2>
                  <div className="ca-heat-legend">
                    <span>Less Activity</span>
                    <div className="ca-heat-swatches">
                      {[0,1,2,3,4].map(l => (
                        <span key={l} className={`ca-heat-swatch ${l > 0 ? `active-${l}` : ""}`} />
                      ))}
                    </div>
                    <span>More Activity</span>
                  </div>
                </div>

                <div className="ca-heatmap-body">
                  {/* Hour axis labels */}
                  <div className="ca-heat-row ca-heat-header">
                    <span className="ca-heat-day-label" />
                    {HOURS.map(h => (
                      <span key={h} className={`ca-heat-hour-label${xLabels.includes(h) ? "" : " ca-heat-hidden"}`}>
                        {xLabels.includes(h) ? hourLabel(h) : ""}
                      </span>
                    ))}
                  </div>

                  {DAY_ORDER.map(day => {
                    const cells = heatByDay.get(day) || Array(24).fill(0);
                    return (
                      <div key={day} className="ca-heat-row">
                        <span className="ca-heat-day-label">{day}</span>
                        {cells.map((count, h) => (
                          <span
                            key={h}
                            className={`ca-heat-cell active-${heatLevel(count, maxHeat)}`}
                            title={`${day} ${hourLabel(h)} — ${count} events`}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── QR Codes tab ── */}
          {analyticsTab === "campaign-performance" && (
            <div className="ca-qr-center">
              <div className="ca-card ca-qr-header-card">
                <h2 className="ca-card-title ca-qr-header-title">My QR Codes</h2>
                <p className="ca-qr-header-sub">Manage and track all QR campaigns.</p>

                <div className="ca-qr-action-bar">
                  <label className="ca-qr-search-wrap" aria-label="Search QR campaigns">
                    <Search size={14} />
                    <input
                      value={qrSearch}
                      onChange={(e) => setQrSearch(e.target.value)}
                      placeholder="Search campaigns"
                    />
                  </label>

                  <div className="ca-select-wrap">
                    <select
                      className="ca-select"
                      value={qrFilter}
                      onChange={(e) => setQrFilter(e.target.value)}
                      aria-label="Filter QR campaigns"
                    >
                      <option value="all">All Types</option>
                      <option value="connected">Clutch Connect</option>
                      <option value="standard">Standard</option>
                      <option value="scanned">With Scans</option>
                    </select>
                    <ChevronDown size={12} className="ca-select-caret" />
                  </div>

                  <Link href="/portal/create" className="ca-primary-link-btn">
                    <QrCode size={14} />
                    Create QR
                  </Link>
                </div>
              </div>

              {!qrRows.length ? (
                <div className="ca-card ca-qr-empty-card">
                  <div className="ca-qr-empty-illustration" aria-hidden="true">
                    <QrCode size={44} />
                  </div>
                  <h3>Create Your First QR Code</h3>
                  <p>Generate dynamic QR codes and track scans, clicks, and conversions.</p>
                  <Link href="/portal/create" className="ca-primary-link-btn">
                    <QrCode size={14} />
                    Create QR Code
                  </Link>
                </div>
              ) : null}

              <div className="ca-card">
                <div className="ca-card-head">
                  <h3 className="ca-card-title">Quick Start Templates</h3>
                </div>
                <div className="ca-qr-template-grid">
                  {templates.map((template) => (
                    <Link key={template.label} href={template.href} className="ca-qr-template-card">
                      <strong>{template.label}</strong>
                      <span>Use template</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="ca-card">
                <div className="ca-card-head">
                  <h3 className="ca-card-title">Usage Summary</h3>
                </div>
                <div className="ca-qr-usage-grid">
                  <article>
                    <p>Active QR Codes</p>
                    <strong>{qrRows.length}</strong>
                  </article>
                  <article>
                    <p>Total Scans</p>
                    <strong>{qrTotalScans}</strong>
                  </article>
                  <article>
                    <p>Last Scan</p>
                    <strong>{prettyDate(lastScan)}</strong>
                  </article>
                  <article>
                    <p>Most Active QR</p>
                    <strong>{mostActiveQr?.name || "—"}</strong>
                  </article>
                </div>
              </div>

              {qrRows.length ? (
                <div className="ca-card">
                  <div className="ca-card-head">
                    <h3 className="ca-card-title">Campaign Table</h3>
                  </div>
                  {filteredQrRows.length ? (
                    <div className="ca-table-wrap">
                  <table className="ca-data-table">
                    <thead>
                      <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Destination</th>
                          <th>Scans</th>
                          <th>Last Scan</th>
                          <th>Status</th>
                          <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                        {filteredQrRows.map(r => (
                        <tr key={r.id}>
                          <td className="ca-td-bold">{r.name}</td>
                          <td>{r.type}</td>
                          <td className="ca-td-trunc">{r.destination}</td>
                          <td>{r.totalScans}</td>
                          <td>{prettyDate(r.lastScan)}</td>
                          <td>
                            <span className={`ca-qr-status ${r.status === "Active" ? "active" : "idle"}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            <div className="ca-qr-row-actions">
                              <Link href="/portal" className="ca-secondary-link-btn">Edit</Link>
                              <Link href={`/portal/analytics/${r.id}`} className="ca-secondary-link-btn">Analytics</Link>
                              <button type="button" className="ca-secondary-link-btn">Download</button>
                              <button type="button" className="ca-secondary-link-btn">Archive</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  ) : (
                    <div className="ca-empty">No campaigns match your current search/filter.</div>
                  )}
                </div>
              ) : (
                <div className="ca-card">
                  <div className="ca-empty">No activity yet. Create and scan your first QR code to start tracking.</div>
                </div>
              )}
            </div>
          )}

          {/* ── Clutch Connect tab ── */}
          {activeTab === "clutch-connect" && (
            <div className="ca-card">
              <div className="ca-card-head"><h2 className="ca-card-title">Clutch Connect</h2></div>
              {props.connectRows.length ? (
                <div className="ca-table-wrap">
                  <table className="ca-data-table">
                    <thead>
                      <tr>
                        <th>Profile</th><th>Views</th><th>Link Clicks</th>
                        <th>Top Clicked Link</th><th>Leads</th><th>Linked QR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.connectRows.map(r => (
                        <tr key={r.id}>
                          <td className="ca-td-bold">{r.profileName}</td>
                          <td>{r.profileViews}</td>
                          <td>{r.linkClicks}</td>
                          <td>{r.topClickedLink || "—"}</td>
                          <td>{r.leadsCaptured}</td>
                          <td>{r.linkedQrCode || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ca-empty">No Clutch Connect activity yet.</div>
              )}
            </div>
          )}

          {/* ── Geography tab ── */}
          {analyticsTab === "geography" && (
            <>
              <div className="ca-geo-filters">
                <div className="ca-select-wrap">
                  <select className="ca-select" value={geoDateRange} onChange={(e) => setGeoDateRange(e.target.value)}>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                  <ChevronDown size={12} className="ca-select-caret" />
                </div>

                {[{ value: geoCountry, setter: setGeoCountry, options: geoCountries, label: "Country" },
                  { value: geoState, setter: setGeoState, options: geoStates, label: "State" },
                  { value: geoCity, setter: setGeoCity, options: geoCities, label: "City" },
                  { value: geoCampaign, setter: setGeoCampaign, options: geoCampaigns, label: "Campaign" }].map((filter) => (
                  <div className="ca-select-wrap" key={filter.label}>
                    <select
                      className="ca-select"
                      value={filter.value}
                      onChange={(e) => filter.setter(e.target.value)}
                    >
                      <option value="all">All {filter.label}</option>
                      {filter.options.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="ca-select-caret" />
                  </div>
                ))}

                <div className="ca-select-wrap">
                  <select className="ca-select" value={geoQrCode} onChange={(e) => setGeoQrCode(e.target.value)}>
                    <option value="all">All QR Codes</option>
                    {props.qrRows.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="ca-select-caret" />
                </div>

                <button className="ca-ctrl-btn" onClick={() => window.print()}>
                  <Download size={13} /> PDF report
                </button>
                <button className="ca-ctrl-btn" onClick={exportGeographyCsv}>
                  <Download size={13} /> CSV export
                </button>
              </div>

              <div className="ca-geo-kpi-row">
                <article className="ca-geo-kpi-card"><span>Countries Reached</span><strong>{new Set(geoRows.map((r) => r.country)).size}</strong></article>
                <article className="ca-geo-kpi-card"><span>States Reached</span><strong>{new Set(geoRows.map((r) => r.region)).size}</strong></article>
                <article className="ca-geo-kpi-card"><span>Cities Reached</span><strong>{new Set(geoRows.map((r) => r.city)).size}</strong></article>
                <article className="ca-geo-kpi-card"><span>Top City</span><strong>{geoTopCity}</strong></article>
                <article className="ca-geo-kpi-card"><span>Top Region</span><strong>{geoTopRegion}</strong></article>
              </div>

              <div className="ca-three-col">
                <div className="ca-card">
                  <div className="ca-card-head"><h2 className="ca-card-title">Top Cities</h2></div>
                  <div className="ca-table-wrap">
                    <table className="ca-data-table">
                      <thead><tr><th>City</th><th>Scans</th></tr></thead>
                      <tbody>
                        {topCities.map(r => (
                          <tr key={r.label}><td>{r.label}</td><td>{r.value}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!topCities.length ? <div className="ca-empty">No city scan data for selected filters.</div> : null}
                </div>

                <div className="ca-card">
                  <div className="ca-card-head"><h2 className="ca-card-title">Top States</h2></div>
                  <div className="ca-table-wrap">
                    <table className="ca-data-table">
                      <thead><tr><th>State / Region</th><th>Scans</th></tr></thead>
                      <tbody>
                        {topStates.map(r => (
                          <tr key={r.label}><td>{r.label}</td><td>{r.value}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!topStates.length ? <div className="ca-empty">No state scan data for selected filters.</div> : null}
                </div>

                <div className="ca-card">
                  <div className="ca-card-head"><h2 className="ca-card-title">Regional Performance</h2></div>
                  <ul className="ca-stat-list">
                    <li><span>Best Performing City</span><strong>{regionalPerformance.bestCity?.label || "—"}</strong></li>
                    <li><span>City Share of Scans</span><strong>{regionalPerformance.cityPct}%</strong></li>
                    <li><span>Best Performing State</span><strong>{regionalPerformance.bestState?.label || "—"}</strong></li>
                    <li><span>State Share of Scans</span><strong>{regionalPerformance.statePct}%</strong></li>
                  </ul>
                </div>
              </div>

              <div className="ca-card">
                <div className="ca-card-head"><h2 className="ca-card-title">Campaign Geography</h2></div>
                {campaignGeography.length ? (
                  <div className="ca-table-wrap">
                    <table className="ca-data-table">
                      <thead><tr><th>Campaign</th><th>Location</th><th>Scan Count</th></tr></thead>
                      <tbody>
                        {campaignGeography.map((row) => (
                          <tr key={`${row.campaign}:${row.location}`}>
                            <td>{row.campaign}</td>
                            <td>{row.location}</td>
                            <td>{row.scans}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ca-empty">No campaign geography rows for selected filters.</div>
                )}
              </div>

              <div className="ca-card">
                <div className="ca-card-head"><h2 className="ca-card-title">Growth Insights</h2></div>
                <div className="ca-geo-insights-grid">
                  <article>
                    <p>Fastest Growing Location</p>
                    <strong>{growthInsights.fastestLocation}</strong>
                  </article>
                  <article>
                    <p>Most Active Location</p>
                    <strong>{growthInsights.mostActive}</strong>
                  </article>
                  <article>
                    <p>Most Recent Scan Location</p>
                    <strong>{growthInsights.mostRecent}</strong>
                  </article>
                </div>
              </div>
            </>
          )}

          {/* ── Devices tab ── */}
          {analyticsTab === "technology" && (
            <div className="ca-three-col">
              {[
                { title: "Device Types",      rows: props.deviceRows },
                { title: "Browsers",          rows: props.browserRows },
                { title: "Operating Systems", rows: props.osRows },
              ].map(({ title, rows }) => (
                <div key={title} className="ca-card">
                  <div className="ca-card-head"><h2 className="ca-card-title">{title}</h2></div>
                  {rows.length ? (
                    <ul className="ca-stat-list">
                      {rows.slice(0, 8).map(r => (
                        <li key={r.label}>
                          <span>{r.label}</span>
                          <strong>{r.value}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ca-empty">No device data yet.</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Activity Heatmap tab ── */}
          {analyticsTab === "activity-heatmap" && (
            <>
              <div className="ca-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Scans Over Time</h2>
                </div>
                <ScansLineChart data={props.scansOverTime} />
              </div>
              <div className="ca-card ca-heatmap-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Activity <span className="ca-title-sub">by Day &amp; Hour</span></h2>
                  <div className="ca-heat-legend">
                    <span>Less Activity</span>
                    <div className="ca-heat-swatches">
                      {[0,1,2,3,4].map(l => <span key={l} className={`ca-heat-swatch ${l > 0 ? `active-${l}` : ""}`} />)}
                    </div>
                    <span>More Activity</span>
                  </div>
                </div>
                <div className="ca-heatmap-body">
                  <div className="ca-heat-row ca-heat-header">
                    <span className="ca-heat-day-label" />
                    {HOURS.map(h => (
                      <span key={h} className={`ca-heat-hour-label${xLabels.includes(h) ? "" : " ca-heat-hidden"}`}>
                        {xLabels.includes(h) ? hourLabel(h) : ""}
                      </span>
                    ))}
                  </div>
                  {DAY_ORDER.map(day => {
                    const cells = heatByDay.get(day) || Array(24).fill(0);
                    return (
                      <div key={day} className="ca-heat-row">
                        <span className="ca-heat-day-label">{day}</span>
                        {cells.map((count, h) => (
                          <span key={h} className={`ca-heat-cell active-${heatLevel(count, maxHeat)}`}
                            title={`${day} ${hourLabel(h)} — ${count}`} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Leads tab ── */}
          {activeTab === "leads" && (
            <div className="ca-card">
              <div className="ca-card-head">
                <h2 className="ca-card-title">Leads</h2>
              </div>
              {props.connectRows.some(r => r.leadsCaptured > 0) ? (
                <div className="ca-table-wrap">
                  <table className="ca-data-table">
                    <thead>
                      <tr>
                        <th>Profile</th>
                        <th>Leads Captured</th>
                        <th>Profile Views</th>
                        <th>Link Clicks</th>
                        <th>Linked QR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.connectRows
                        .filter(r => r.leadsCaptured > 0)
                        .sort((a, b) => b.leadsCaptured - a.leadsCaptured)
                        .map(r => (
                          <tr key={r.id}>
                            <td className="ca-td-bold">{r.profileName}</td>
                            <td>{r.leadsCaptured}</td>
                            <td>{r.profileViews}</td>
                            <td>{r.linkClicks}</td>
                            <td>{r.linkedQrCode || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ca-empty">No leads captured yet. Leads from your Clutch Connect profile will appear here.</div>
              )}
            </div>
          )}
          <footer className="ca-footer">Powered by ClutchPrintShop</footer>
      </div>
    </div>
  );
}
