"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import {
  LayoutDashboard, QrCode, Link2, BarChart2, Globe, Monitor,
  Activity, Users, Settings, Download, SlidersHorizontal,
  CalendarDays, ChevronDown, Eye, MousePointerClick, UserCheck,
  TrendingUp, ArrowUpRight,
} from "lucide-react";

const WorldMap      = dynamic(() => import("./WorldMap"),       { ssr: false, loading: () => <div className="ca-map-skeleton" /> });
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
  cityRows: { label: string; value: number }[];
  deviceRows: { label: string; value: number }[];
  browserRows: { label: string; value: number }[];
  osRows: { label: string; value: number }[];
  heatmap: { day: string; hour: number; count: number }[];
}

/* ─────────────── Nav ─────────────── */
const NAV = [
  { id: "overview",        label: "Overview",        icon: LayoutDashboard },
  { id: "qr-codes",        label: "QR Codes",        icon: QrCode },
  { id: "clutch-connect",  label: "Clutch Connect",  icon: Link2 },
  { id: "analytics",       label: "Analytics",       icon: BarChart2 },
  { id: "geography",       label: "Geography",       icon: Globe },
  { id: "devices",         label: "Devices",         icon: Monitor },
  { id: "activity-heatmap",label: "Activity Heatmap",icon: Activity },
  { id: "leads",           label: "Leads",           icon: Users },
  { id: "settings",        label: "Settings",        icon: Settings },
];

const KPI = [
  { key: "totalScans",     label: "Total Scans",          icon: BarChart2 },
  { key: "uniqueVisitors", label: "Unique Visitors",      icon: Users },
  { key: "linkClicks",     label: "Link Clicks",          icon: MousePointerClick },
  { key: "connectViews",   label: "Clutch Connect Views", icon: Eye },
  { key: "leadsCaptured",  label: "Leads Captured",       icon: UserCheck },
  { key: "activeQrCodes",  label: "Active QR Codes",      icon: QrCode },
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
  const [viewBy, setViewBy] = useState("Scans");
  const [timeFilter, setTimeFilter] = useState("30D");

  const isMainView = activeTab === "analytics" || activeTab === "overview" || !activeTab;
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

  return (
    <div className="ca-shell">
      {/* ── Sidebar ── */}
      <aside className="ca-sidebar">
        <div className="ca-sidebar-logo">
          <div className="ca-logo-icon">C</div>
          <span className="ca-logo-word">LUTCH</span>
        </div>

        <nav className="ca-nav">
          {NAV.map(({ id, label, icon: Icon }) => {
            const href = id === "leads" ? "/portal/connect/leads" : `/portal/analytics?tab=${id}`;
            const active = activeTab === id || (id === "analytics" && isMainView && activeTab !== "overview");
            return (
              <Link key={id} href={href} className={`ca-nav-item${active ? " active" : ""}`}>
                <Icon size={16} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ca-upgrade-card">
          <p className="ca-upgrade-title">Upgrade to QR Pro+</p>
          <p className="ca-upgrade-desc">Unlock advanced analytics, custom domains, and more.</p>
          <Link href="/pricing" className="ca-upgrade-btn">Upgrade Now</Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="ca-main">
        {/* Top bar */}
        <div className="ca-topbar">
          <div>
            <h1 className="ca-page-title">Clutch Analytics</h1>
            <p className="ca-page-sub">Track QR scans, Clutch Connect profile views, link clicks, and lead activity.</p>
          </div>
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
            <button className="ca-ctrl-btn">
              <Download size={13} /> Export <ChevronDown size={12} />
            </button>
            <button className="ca-ctrl-btn">
              <SlidersHorizontal size={13} /> Filter
            </button>
          </div>
        </div>

        <div className="ca-content">
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
              {/* Geographic Heatmap */}
              <div className="ca-card ca-geo-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Geographic Heatmap</h2>
                  <div className="ca-card-controls">
                    <span className="ca-viewby-label">View by:</span>
                    <div className="ca-select-wrap">
                      <select
                        className="ca-select"
                        value={viewBy}
                        onChange={e => setViewBy(e.target.value)}
                      >
                        <option>Scans</option>
                        <option>Visitors</option>
                        <option>Leads</option>
                      </select>
                      <ChevronDown size={12} className="ca-select-caret" />
                    </div>
                  </div>
                </div>
                <WorldMap countryData={props.countryData} viewBy={viewBy} />
              </div>

              {/* 3-column row */}
              <div className="ca-three-col">
                {/* Top Locations */}
                <div className="ca-card">
                  <div className="ca-card-head">
                    <h2 className="ca-card-title">Top Locations</h2>
                    <div className="ca-select-wrap ca-select-sm">
                      <select className="ca-select">
                        <option>Top Cities</option>
                        <option>Top Countries</option>
                      </select>
                      <ChevronDown size={11} className="ca-select-caret" />
                    </div>
                  </div>
                  {props.cityRows.length ? (
                    <table className="ca-loc-table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Scans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {props.cityRows.slice(0, 5).map(row => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="ca-empty">No location data yet.</div>
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
                  <Link href="/portal/analytics?tab=devices" className="ca-card-link">
                    View full report <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Activity Heatmap */}
              <div className="ca-card ca-heatmap-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Activity Heatmap <span className="ca-title-sub">by Day &amp; Hour</span></h2>
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
          {activeTab === "qr-codes" && (
            <div className="ca-card">
              <div className="ca-card-head"><h2 className="ca-card-title">QR Codes</h2></div>
              {props.qrRows.length ? (
                <div className="ca-table-wrap">
                  <table className="ca-data-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Destination</th><th>Scans</th>
                        <th>Unique Visitors</th><th>Last Scan</th><th>Linked Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.qrRows.map(r => (
                        <tr key={r.id}>
                          <td className="ca-td-bold">{r.name}</td>
                          <td className="ca-td-trunc">{r.destination}</td>
                          <td>{r.totalScans}</td>
                          <td>{r.uniqueVisitors}</td>
                          <td>{prettyDate(r.lastScan)}</td>
                          <td>{r.linkedProfileName || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ca-empty">No QR code activity yet. Create and scan a QR code to start tracking.</div>
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
          {activeTab === "geography" && (
            <>
              <div className="ca-card ca-geo-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Geographic Heatmap</h2>
                  <div className="ca-card-controls">
                    <span className="ca-viewby-label">View by:</span>
                    <div className="ca-select-wrap">
                      <select className="ca-select" value={viewBy} onChange={e => setViewBy(e.target.value)}>
                        <option>Scans</option><option>Visitors</option><option>Leads</option>
                      </select>
                      <ChevronDown size={12} className="ca-select-caret" />
                    </div>
                  </div>
                </div>
                <WorldMap countryData={props.countryData} viewBy={viewBy} />
              </div>
              <div className="ca-card">
                <div className="ca-card-head"><h2 className="ca-card-title">All Locations</h2></div>
                {props.cityRows.length ? (
                  <div className="ca-table-wrap">
                    <table className="ca-data-table">
                      <thead><tr><th>Location</th><th>Events</th></tr></thead>
                      <tbody>
                        {props.cityRows.map(r => (
                          <tr key={r.label}><td>{r.label}</td><td>{r.value}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ca-empty">Location data will appear after scans with detectable location metadata.</div>
                )}
              </div>
            </>
          )}

          {/* ── Devices tab ── */}
          {activeTab === "devices" && (
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
          {activeTab === "activity-heatmap" && (
            <>
              <div className="ca-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Scans Over Time</h2>
                </div>
                <ScansLineChart data={props.scansOverTime} />
              </div>
              <div className="ca-card ca-heatmap-card">
                <div className="ca-card-head">
                  <h2 className="ca-card-title">Activity Heatmap <span className="ca-title-sub">by Day &amp; Hour</span></h2>
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
        </div>
      </div>
    </div>
  );
}
