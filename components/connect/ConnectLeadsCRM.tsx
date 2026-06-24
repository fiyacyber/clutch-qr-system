"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Mail,
  Phone,
  Share2,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import styles from "./ConnectLeadsCRM.module.css";

type LeadStatus = "New" | "Contacted" | "Qualified" | "Converted" | "Closed";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: string;
  createdAt: string;
  ipHash: string;
};

type TimelineRow = {
  id: string;
  eventType: "lead_submit" | "profile_view" | "link_click" | "qr_scan";
  label: string;
  createdAt: string;
  detail?: string;
};

type CampaignRow = {
  campaign: string;
  scans: number;
  visitors: number;
  clicks: number;
  conversions: number;
};

type QrPerformanceRow = {
  qrName: string;
  scans: number;
  visitors: number;
  clicks: number;
  conversionRate: number;
};

interface ConnectLeadsCRMProps {
  profileSlug: string;
  leads: LeadRow[];
  timeline: TimelineRow[];
  campaignRows: CampaignRow[];
  qrRows: QrPerformanceRow[];
  funnel: {
    profileViews: number;
    qrScans: number;
    linkClicks: number;
    leadCaptures: number;
    conversions: number;
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function ConnectLeadsCRM({
  profileSlug,
  leads,
  timeline,
  campaignRows,
  qrRows,
  funnel,
}: ConnectLeadsCRMProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<"name" | "email" | "source" | "createdAt" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id || null);
  const [statusByLead, setStatusByLead] = useState<Record<string, LeadStatus>>({});
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});

  const sources = useMemo(
    () => ["All", ...Array.from(new Set(leads.map((lead) => lead.source))).filter(Boolean)],
    [leads]
  );

  const activeLeads = useMemo(
    () => leads.filter((lead) => !dismissedIds[lead.id]),
    [leads, dismissedIds]
  );

  function getLeadStatus(lead: LeadRow): LeadStatus {
    return statusByLead[lead.id] || "New";
  }

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = activeLeads.filter((lead) => {
      if (statusFilter !== "All" && getLeadStatus(lead) !== statusFilter) return false;
      if (sourceFilter !== "All" && lead.source !== sourceFilter) return false;

      if (!needle) return true;
      return [lead.name, lead.email, lead.phone, lead.message, lead.source]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    rows.sort((a, b) => {
      const aStatus = getLeadStatus(a);
      const bStatus = getLeadStatus(b);

      const values: Record<typeof sortKey, [string | number, string | number]> = {
        name: [a.name, b.name],
        email: [a.email, b.email],
        source: [a.source, b.source],
        createdAt: [new Date(a.createdAt).getTime(), new Date(b.createdAt).getTime()],
        status: [aStatus, bStatus],
      };

      const [left, right] = values[sortKey];
      const result = left > right ? 1 : left < right ? -1 : 0;
      return sortDir === "asc" ? result : -result;
    });

    return rows;
  }, [activeLeads, query, statusFilter, sourceFilter, sortKey, sortDir, statusByLead]);

  const selectedLead = filteredLeads.find((lead) => lead.id === selectedLeadId) || filteredLeads[0] || null;

  const summary = useMemo(() => {
    const total = activeLeads.length;
    const newLeads = activeLeads.filter((lead) => getLeadStatus(lead) === "New").length;
    const contacted = activeLeads.filter((lead) => getLeadStatus(lead) === "Contacted").length;
    const converted = activeLeads.filter((lead) => getLeadStatus(lead) === "Converted").length;
    return { total, newLeads, contacted, converted };
  }, [activeLeads, statusByLead]);

  const sourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of activeLeads) {
      counts.set(lead.source, (counts.get(lead.source) || 0) + 1);
    }
    const total = activeLeads.length || 1;
    return Array.from(counts.entries())
      .map(([source, value]) => ({
        source,
        value,
        pct: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeLeads]);

  const engagementRows = useMemo(() => {
    const total = funnel.profileViews + funnel.qrScans + funnel.linkClicks + funnel.leadCaptures || 1;
    return [
      { label: "Profile Views", value: funnel.profileViews },
      { label: "QR Scans", value: funnel.qrScans },
      { label: "Link Clicks", value: funnel.linkClicks },
      { label: "Leads Captured", value: funnel.leadCaptures },
    ].map((row) => ({ ...row, pct: Math.round((row.value / total) * 100) }));
  }, [funnel]);

  function setLeadStatus(leadId: string, status: LeadStatus) {
    setStatusByLead((current) => ({ ...current, [leadId]: status }));
  }

  function removeLead(leadId: string) {
    setDismissedIds((current) => ({ ...current, [leadId]: true }));
    if (selectedLeadId === leadId) {
      const fallback = filteredLeads.find((lead) => lead.id !== leadId);
      setSelectedLeadId(fallback?.id || null);
    }
  }

  function toggleSort(next: typeof sortKey) {
    if (sortKey === next) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setSortDir("desc");
  }

  function exportCsv() {
    const csv = toCsv([
      ["Name", "Email", "Phone", "Source", "Date", "Status", "Message"],
      ...filteredLeads.map((lead) => [
        lead.name,
        lead.email,
        lead.phone,
        lead.source,
        lead.createdAt,
        getLeadStatus(lead),
        lead.message,
      ]),
    ]);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clutch-connect-leads.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.shell}>
      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>Total Leads</span>
          <strong>{summary.total}</strong>
          <p>+12.4% vs prior period</p>
        </article>
        <article className={styles.summaryCard}>
          <span>New Leads</span>
          <strong>{summary.newLeads}</strong>
          <p>Priority follow-up queue</p>
        </article>
        <article className={styles.summaryCard}>
          <span>Contacted</span>
          <strong>{summary.contacted}</strong>
          <p>Outreach in progress</p>
        </article>
        <article className={styles.summaryCard}>
          <span>Converted</span>
          <strong>{summary.converted}</strong>
          <p>Won opportunities</p>
        </article>
      </section>

      {!activeLeads.length ? (
        <section className={styles.emptyState}>
          <div className={styles.emptyIllustration}><Share2 size={28} /></div>
          <h3>No leads yet.</h3>
          <p>Share your digital business card and QR campaigns to start capturing contact requests.</p>
          <div className={styles.emptyActions}>
            <a className="btn secondary" href={`/u/${profileSlug}`} target="_blank" rel="noreferrer">Open Public Profile</a>
            <a className="btn ghost" href="/portal/connect">Share Profile</a>
            <a className="btn primary" href="/portal/create">Generate QR Code</a>
          </div>
        </section>
      ) : (
        <>
          <section className={styles.inboxShell}>
            <header className={styles.inboxHeader}>
              <h2>Lead Inbox</h2>
              <div className={styles.inboxControls}>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={styles.search}
                  placeholder="Search leads"
                />
                <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "All")}>
                  <option value="All">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted</option>
                  <option value="Closed">Closed</option>
                </select>
                <select className={styles.select} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  {sources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
                <button className="btn ghost" onClick={exportCsv} type="button"><Download size={14} /> CSV Export</button>
                <button className="btn ghost" onClick={() => window.print()} type="button"><Download size={14} /> PDF Export</button>
              </div>
            </header>

            <div className={styles.inboxLayout}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th><button type="button" onClick={() => toggleSort("name")}>Name <ArrowUpDown size={13} /></button></th>
                      <th><button type="button" onClick={() => toggleSort("email")}>Email <ArrowUpDown size={13} /></button></th>
                      <th>Phone</th>
                      <th><button type="button" onClick={() => toggleSort("source")}>Source <ArrowUpDown size={13} /></button></th>
                      <th><button type="button" onClick={() => toggleSort("createdAt")}>Date <ArrowUpDown size={13} /></button></th>
                      <th><button type="button" onClick={() => toggleSort("status")}>Status <ArrowUpDown size={13} /></button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={selectedLead?.id === lead.id ? styles.activeRow : ""}>
                        <td>{lead.name || "-"}</td>
                        <td>{lead.email || "-"}</td>
                        <td>{lead.phone || "-"}</td>
                        <td>{lead.source || "-"}</td>
                        <td>{formatDate(lead.createdAt)}</td>
                        <td><span className={`${styles.statusPill} ${styles[getLeadStatus(lead).toLowerCase()]}`}>{getLeadStatus(lead)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <aside className={styles.drawer}>
                {selectedLead ? (
                  <>
                    <h3>Lead Detail</h3>
                    <dl className={styles.detailList}>
                      <div><dt>Name</dt><dd>{selectedLead.name || "-"}</dd></div>
                      <div><dt>Email</dt><dd>{selectedLead.email || "-"}</dd></div>
                      <div><dt>Phone</dt><dd>{selectedLead.phone || "-"}</dd></div>
                      <div><dt>Company</dt><dd>{selectedLead.company || "-"}</dd></div>
                      <div><dt>Message</dt><dd>{selectedLead.message || "-"}</dd></div>
                      <div><dt>Source</dt><dd>{selectedLead.source || "-"}</dd></div>
                      <div><dt>Date Captured</dt><dd>{formatDate(selectedLead.createdAt)}</dd></div>
                    </dl>
                    <div className={styles.drawerActions}>
                      <a className="btn ghost" href={`tel:${selectedLead.phone}`}><Phone size={14} /> Call</a>
                      <a className="btn ghost" href={`mailto:${selectedLead.email}`}><Mail size={14} /> Email</a>
                      <button className="btn secondary" type="button" onClick={() => setLeadStatus(selectedLead.id, "Contacted")}><UserRoundCheck size={14} /> Mark Contacted</button>
                      <button className="btn primary" type="button" onClick={() => setLeadStatus(selectedLead.id, "Converted")}>Mark Converted</button>
                      <button className="btn ghost" type="button" onClick={() => removeLead(selectedLead.id)}><Trash2 size={14} /> Delete</button>
                    </div>
                  </>
                ) : (
                  <p className={styles.drawerEmpty}>Select a lead to open details.</p>
                )}
              </aside>
            </div>
          </section>

          <section className={styles.twoCol}>
            <article className={styles.card}>
              <h3>Source Tracking</h3>
              <div className={styles.breakdownList}>
                {sourceBreakdown.map((row) => (
                  <div key={row.source}>
                    <p>
                      <span>{row.source}</span>
                      <strong>{row.value}</strong>
                    </p>
                    <div className={styles.progress}><span style={{ width: `${row.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.card}>
              <h3>Conversion Funnel</h3>
              <ul className={styles.funnelList}>
                <li><span>Profile Views</span><strong>{funnel.profileViews}</strong></li>
                <li><span>QR Scans</span><strong>{funnel.qrScans}</strong></li>
                <li><span>Link Clicks</span><strong>{funnel.linkClicks}</strong></li>
                <li><span>Lead Captures</span><strong>{funnel.leadCaptures}</strong></li>
                <li><span>Conversions</span><strong>{funnel.conversions}</strong></li>
              </ul>
            </article>
          </section>

          <section className={styles.twoCol}>
            <article className={styles.card}>
              <h3>Engagement Breakdown</h3>
              <div className={styles.breakdownList}>
                {engagementRows.map((row) => (
                  <div key={row.label}>
                    <p>
                      <span>{row.label}</span>
                      <strong>{row.value} ({row.pct}%)</strong>
                    </p>
                    <div className={styles.progress}><span style={{ width: `${row.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.card}>
              <h3>Activity Timeline</h3>
              <ul className={styles.timeline}>
                {timeline.slice(0, 10).map((item) => (
                  <li key={item.id}>
                    <div className={styles.timelineDot} />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail || "-"}</p>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className={styles.card}>
            <h3>Campaign Performance</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Scans</th>
                    <th>Visitors</th>
                    <th>Clicks</th>
                    <th>Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map((row) => (
                    <tr key={row.campaign}>
                      <td>{row.campaign}</td>
                      <td>{row.scans}</td>
                      <td>{row.visitors}</td>
                      <td>{row.clicks}</td>
                      <td>{row.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <h3>Most Active QR Codes</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>QR Name</th>
                    <th>Scans</th>
                    <th>Visitors</th>
                    <th>Clicks</th>
                    <th>Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {qrRows.map((row) => (
                    <tr key={row.qrName}>
                      <td>{row.qrName}</td>
                      <td>{row.scans}</td>
                      <td>{row.visitors}</td>
                      <td>{row.clicks}</td>
                      <td>{row.conversionRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
