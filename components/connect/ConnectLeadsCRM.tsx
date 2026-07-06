"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArrowUpDown,
  Download,
  Mail,
  Phone,
  Save,
  Share2,
  UserRoundCheck,
} from "lucide-react";
import styles from "./ConnectLeadsCRM.module.css";
import CopyValueButton from "@/components/dashboard/CopyValueButton";
import { clutchConnectProfileUrl } from "@/lib/qr";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "closed" | "archived";
type ArchiveFilter = "active" | "archived" | "all";

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
  status: LeadStatus;
  archivedAt?: string | null;
  contactedAt?: string | null;
  qualifiedAt?: string | null;
  convertedAt?: string | null;
  closedAt?: string | null;
  crmNotes?: string | null;
  updatedAt?: string | null;
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
  isBasicPlan?: boolean;
  leads: LeadRow[];
  timeline: TimelineRow[];
  campaignRows: CampaignRow[];
  qrRows: QrPerformanceRow[];
  canUseAdvancedInbox?: boolean;
  canUseSourceInsights?: boolean;
  canUseCampaignPerformance?: boolean;
  canUsePdfReports?: boolean;
  connectPlusCheckoutHref?: string;
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

function normalizeLeadStatus(value?: string | null): LeadStatus {
  const status = String(value || "new").toLowerCase();
  if (["new", "contacted", "qualified", "converted", "closed", "archived"].includes(status)) {
    return status as LeadStatus;
  }
  return "new";
}

function formatStatus(status: LeadStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getLeadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to update lead";
}

function normalizeLead(lead: LeadRow): LeadRow {
  return {
    ...lead,
    status: normalizeLeadStatus(lead.status),
    archivedAt: lead.archivedAt || null,
    contactedAt: lead.contactedAt || null,
    qualifiedAt: lead.qualifiedAt || null,
    convertedAt: lead.convertedAt || null,
    closedAt: lead.closedAt || null,
    crmNotes: lead.crmNotes || "",
  };
}

function mergeUpdatedLead(current: LeadRow, updated: any): LeadRow {
  return normalizeLead({
    ...current,
    name: updated.name ?? current.name,
    email: updated.email ?? current.email,
    phone: updated.phone ?? current.phone,
    message: updated.message ?? current.message,
    createdAt: updated.created_at ?? current.createdAt,
    ipHash: updated.ip_hash ?? current.ipHash,
    status: normalizeLeadStatus(updated.status),
    archivedAt: updated.archived_at ?? null,
    contactedAt: updated.contacted_at ?? null,
    qualifiedAt: updated.qualified_at ?? null,
    convertedAt: updated.converted_at ?? null,
    closedAt: updated.closed_at ?? null,
    crmNotes: updated.crm_notes ?? "",
    updatedAt: updated.updated_at ?? current.updatedAt,
  });
}

export default function ConnectLeadsCRM({
  profileSlug,
  isBasicPlan = false,
  leads,
  timeline,
  campaignRows,
  qrRows,
  canUseAdvancedInbox = false,
  canUseSourceInsights = false,
  canUseCampaignPerformance = false,
  canUsePdfReports = false,
  connectPlusCheckoutHref = "/portal/settings",
  funnel,
}: ConnectLeadsCRMProps) {
  const [leadRows, setLeadRows] = useState<LeadRow[]>(() => leads.map(normalizeLead));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<"name" | "email" | "source" | "createdAt" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    leadRows.find((lead) => !lead.archivedAt && lead.status !== "archived")?.id || leadRows[0]?.id || null
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [notesDraftByLead, setNotesDraftByLead] = useState<Record<string, string>>({});
  const readOnlyInbox = !canUseAdvancedInbox;

  const sources = useMemo(
    () => ["All", ...Array.from(new Set(leadRows.map((lead) => lead.source))).filter(Boolean)],
    [leadRows]
  );

  const activeLeads = useMemo(
    () => leadRows.filter((lead) => !lead.archivedAt && lead.status !== "archived"),
    [leadRows]
  );

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sourceRows = leadRows.filter((lead) => {
      const archived = Boolean(lead.archivedAt || lead.status === "archived");
      if (archiveFilter === "active" && archived) return false;
      if (archiveFilter === "archived" && !archived) return false;
      return true;
    });

    const rows = sourceRows.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (sourceFilter !== "All" && lead.source !== sourceFilter) return false;

      if (!needle) return true;
      return [lead.name, lead.email, lead.phone, lead.message, lead.source, lead.crmNotes]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    rows.sort((a, b) => {
      const values: Record<typeof sortKey, [string | number, string | number]> = {
        name: [a.name, b.name],
        email: [a.email, b.email],
        source: [a.source, b.source],
        createdAt: [new Date(a.createdAt).getTime(), new Date(b.createdAt).getTime()],
        status: [a.status, b.status],
      };

      const [left, right] = values[sortKey];
      const result = left > right ? 1 : left < right ? -1 : 0;
      return sortDir === "asc" ? result : -result;
    });

    return rows;
  }, [leadRows, archiveFilter, query, statusFilter, sourceFilter, sortKey, sortDir]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ||
    filteredLeads[0] ||
    null;
  const selectedLeadNotes = selectedLead
    ? notesDraftByLead[selectedLead.id] ?? selectedLead.crmNotes ?? ""
    : "";

  const summary = useMemo(() => {
    const total = activeLeads.length;
    const newLeads = activeLeads.filter((lead) => lead.status === "new").length;
    const contacted = activeLeads.filter((lead) => lead.status === "contacted").length;
    const converted = activeLeads.filter((lead) => lead.status === "converted").length;
    return { total, newLeads, contacted, converted };
  }, [activeLeads]);

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

  const profileUrl = clutchConnectProfileUrl(profileSlug);

  async function patchLead(
    leadId: string,
    payload: { status?: LeadStatus; action?: "archive" | "unarchive"; crm_notes?: string },
    successMessage: string
  ) {
    const previousRows = leadRows;
    const now = new Date().toISOString();
    setNotice(null);
    setPendingAction(`${leadId}:${payload.action || payload.status || "notes"}`);

    setLeadRows((current) =>
      current.map((lead) => {
        if (lead.id !== leadId) return lead;
        const nextStatus = payload.action === "archive"
          ? "archived"
          : payload.action === "unarchive"
            ? "new"
            : payload.status || lead.status;

        return normalizeLead({
          ...lead,
          status: nextStatus,
          archivedAt: payload.action === "archive" ? (lead.archivedAt || now) : payload.action === "unarchive" ? null : lead.archivedAt,
          contactedAt: nextStatus === "contacted" ? (lead.contactedAt || now) : lead.contactedAt,
          qualifiedAt: nextStatus === "qualified" ? (lead.qualifiedAt || now) : lead.qualifiedAt,
          convertedAt: nextStatus === "converted" ? (lead.convertedAt || now) : lead.convertedAt,
          closedAt: nextStatus === "closed" ? (lead.closedAt || now) : lead.closedAt,
          crmNotes: payload.crm_notes ?? lead.crmNotes,
          updatedAt: now,
        });
      })
    );

    try {
      const response = await fetch(`/api/connect/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.lead) {
        console.warn("Lead update failed", {
          status: response.status,
          error: result.error,
        });
        throw new Error(result.error || "Failed to update lead");
      }

      setLeadRows((current) =>
        current.map((lead) => (lead.id === leadId ? mergeUpdatedLead(lead, result.lead) : lead))
      );
      setNotice({ tone: "success", message: successMessage });
    } catch (error) {
      console.warn("Failed to update lead", error);
      setLeadRows(previousRows);
      setNotice({ tone: "error", message: getLeadErrorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  function isLeadSaving(leadId: string) {
    return Boolean(pendingAction?.startsWith(`${leadId}:`));
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
      [
        "Name",
        "Email",
        "Phone",
        "Company",
        "Source",
        "Date Captured",
        "Status",
        "Contacted At",
        "Qualified At",
        "Converted At",
        "Closed At",
        "Archived At",
        "CRM Notes",
        "Message",
      ],
      ...filteredLeads.map((lead) => [
        lead.name,
        lead.email,
        lead.phone,
        lead.company,
        lead.source,
        lead.createdAt,
        formatStatus(lead.status),
        lead.contactedAt || "",
        lead.qualifiedAt || "",
        lead.convertedAt || "",
        lead.closedAt || "",
        lead.archivedAt || "",
        lead.crmNotes || "",
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
          <p>{summary.total ? `${summary.total} total submissions` : "No submissions yet"}</p>
        </article>
        <article className={styles.summaryCard}>
          <span>New Leads</span>
          <strong>{summary.newLeads}</strong>
          <p>{summary.newLeads ? "Ready for first response" : "Waiting for first lead"}</p>
        </article>
        <article className={styles.summaryCard}>
          <span>Contacted</span>
          <strong>{summary.contacted}</strong>
          <p>{summary.contacted ? "Follow-up in progress" : "No follow-ups yet"}</p>
        </article>
        <article className={styles.summaryCard}>
          <span>Converted</span>
          <strong>{summary.converted}</strong>
          <p>{summary.converted ? "Converted opportunities" : "No converted leads yet"}</p>
        </article>
      </section>

      {!leadRows.length ? (
        <section className={styles.emptyState}>
          <div className={styles.emptyIllustration}><Share2 size={28} /></div>
          <h3>No leads yet</h3>
          <p>Leads will appear here when someone submits the contact form on your Clutch Connect profile.</p>
          <div className={styles.emptyActions}>
            <a className="btn secondary" href={profileUrl} target="_blank" rel="noreferrer">View Public Profile</a>
            <CopyValueButton value={profileUrl} label="Copy Profile Link" className="btn ghost" />
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
                <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")}>
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
                <select className={styles.select} value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as ArchiveFilter)}>
                  <option value="active">Active Leads</option>
                  <option value="archived">Archived Leads</option>
                  <option value="all">All Leads</option>
                </select>
                <select className={styles.select} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  {sources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
                {canUseSourceInsights ? (
                  <button className="btn ghost" onClick={exportCsv} type="button"><Download size={14} /> CSV Export</button>
                ) : null}
                {canUsePdfReports ? (
                  <button className="btn ghost" onClick={() => window.print()} type="button"><Download size={14} /> PDF Export</button>
                ) : null}
              </div>
              {notice ? <p className={`${styles.notice} ${styles[notice.tone]}`}>{notice.message}</p> : null}
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
                        <td><span className={`${styles.statusPill} ${styles[lead.status]}`}>{formatStatus(lead.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.mobileLeadList}>
                {filteredLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className={`${styles.mobileLeadCard} ${selectedLead?.id === lead.id ? styles.activeMobileCard : ""}`}
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <span className={styles.mobileLeadTopline}>
                      <strong>{lead.name || "Unnamed lead"}</strong>
                      <span className={`${styles.statusPill} ${styles[lead.status]}`}>{formatStatus(lead.status)}</span>
                    </span>
                    <span>{lead.email || lead.phone || "No contact provided"}</span>
                    <span>{lead.source || "Clutch Connect Profile"} · {formatDate(lead.createdAt)}</span>
                  </button>
                ))}
              </div>

              <aside className={styles.drawer}>
                {selectedLead ? (
                  <>
                    <h3>Lead Details</h3>
                    <dl className={styles.detailList}>
                      <div><dt>Name</dt><dd>{selectedLead.name || "-"}</dd></div>
                      <div><dt>Email</dt><dd>{selectedLead.email || "-"}</dd></div>
                      <div><dt>Phone</dt><dd>{selectedLead.phone || "-"}</dd></div>
                      <div><dt>Company</dt><dd>{selectedLead.company || "-"}</dd></div>
                      <div><dt>Status</dt><dd><span className={`${styles.statusPill} ${styles[selectedLead.status]}`}>{formatStatus(selectedLead.status)}</span></dd></div>
                      <div><dt>Message</dt><dd>{selectedLead.message || "-"}</dd></div>
                      <div><dt>Source</dt><dd>{selectedLead.source || "-"}</dd></div>
                      <div><dt>Date Captured</dt><dd>{formatDate(selectedLead.createdAt)}</dd></div>
                      <div><dt>Contacted</dt><dd>{formatDate(selectedLead.contactedAt)}</dd></div>
                      <div><dt>Qualified</dt><dd>{formatDate(selectedLead.qualifiedAt)}</dd></div>
                      <div><dt>Converted</dt><dd>{formatDate(selectedLead.convertedAt)}</dd></div>
                      <div><dt>Closed</dt><dd>{formatDate(selectedLead.closedAt)}</dd></div>
                      {selectedLead.archivedAt ? <div><dt>Archived</dt><dd>{formatDate(selectedLead.archivedAt)}</dd></div> : null}
                    </dl>
                    <div className={styles.notesBox}>
                      <label htmlFor={`lead-notes-${selectedLead.id}`}>Follow-up Notes</label>
                      <textarea
                        id={`lead-notes-${selectedLead.id}`}
                        value={selectedLeadNotes}
                        onChange={(event) =>
                          setNotesDraftByLead((current) => ({ ...current, [selectedLead.id]: event.target.value }))
                        }
                        placeholder="Add follow-up notes"
                        rows={4}
                      />
                      {!readOnlyInbox ? (
                        <button
                          className="btn secondary"
                          type="button"
                          disabled={isLeadSaving(selectedLead.id)}
                          onClick={() => patchLead(selectedLead.id, { crm_notes: selectedLeadNotes }, "Saved")}
                        >
                          <Save size={14} />
                          {pendingAction === `${selectedLead.id}:notes` ? "Saving..." : "Save Notes"}
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.drawerActions}>
                      <a className="btn ghost" href={`tel:${selectedLead.phone}`}><Phone size={14} /> Call</a>
                      <a className="btn ghost" href={`mailto:${selectedLead.email}`}><Mail size={14} /> Email</a>
                      {!readOnlyInbox ? (
                        <>
                          <button
                            className="btn secondary"
                            type="button"
                            disabled={isLeadSaving(selectedLead.id)}
                            onClick={() => patchLead(selectedLead.id, { status: "contacted" }, "Saved")}
                          >
                            <UserRoundCheck size={14} />
                            {pendingAction === `${selectedLead.id}:contacted` ? "Saving..." : "Mark Contacted"}
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            disabled={isLeadSaving(selectedLead.id)}
                            onClick={() => patchLead(selectedLead.id, { status: "qualified" }, "Saved")}
                          >
                            {pendingAction === `${selectedLead.id}:qualified` ? "Saving..." : "Mark Qualified"}
                          </button>
                          <button
                            className="btn primary"
                            type="button"
                            disabled={isLeadSaving(selectedLead.id)}
                            onClick={() => patchLead(selectedLead.id, { status: "converted" }, "Saved")}
                          >
                            {pendingAction === `${selectedLead.id}:converted` ? "Saving..." : "Mark Converted"}
                          </button>
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={isLeadSaving(selectedLead.id)}
                            onClick={() => patchLead(selectedLead.id, { status: "closed" }, "Saved")}
                          >
                            {pendingAction === `${selectedLead.id}:closed` ? "Saving..." : "Mark Closed"}
                          </button>
                          {selectedLead.status === "archived" || selectedLead.archivedAt ? (
                            <button
                              className="btn ghost"
                              type="button"
                              disabled={isLeadSaving(selectedLead.id)}
                              onClick={() => patchLead(selectedLead.id, { action: "unarchive" }, "Saved")}
                            >
                              {pendingAction === `${selectedLead.id}:unarchive` ? "Saving..." : "Unarchive"}
                            </button>
                          ) : (
                            <button
                              className="btn ghost"
                              type="button"
                              disabled={isLeadSaving(selectedLead.id)}
                              onClick={() => patchLead(selectedLead.id, { action: "archive" }, "Archived")}
                            >
                              <Archive size={14} />
                              {pendingAction === `${selectedLead.id}:archive` ? "Saving..." : "Archive Lead"}
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className={styles.drawerEmpty}>Select a lead to open details.</p>
                )}
              </aside>
            </div>
          </section>

          {canUseSourceInsights ? (
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
          ) : null}

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

          {canUseCampaignPerformance ? (
            <details className={styles.advancedReporting}>
              <summary>Advanced reporting</summary>
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
            </details>
          ) : null}

          <section className={styles.card}>
            <h3>Lead Capture Settings</h3>
            <ul className={styles.settingsList}>
              <li><span>Form</span><strong>Active</strong></li>
              <li><span>Delivery</span><strong>Lead Inbox</strong></li>
              <li><span>Source tracking</span><strong>Active</strong></li>
              <li><span>Notifications</span><strong>Not configured</strong></li>
              {!canUseAdvancedInbox ? (
                <>
                  <li className={styles.settingsLocked}><span>Custom fields</span><strong>Connect+ Locked</strong></li>
                  <li className={styles.settingsLocked}><span>Auto-reply</span><strong>Connect+ Locked</strong></li>
                  <li className={styles.settingsLocked}><span>Webhook/Zapier</span><strong>Connect+ Locked</strong></li>
                  <li className={styles.settingsLocked}><span>CRM integrations</span><strong>Connect+ Locked</strong></li>
                </>
              ) : null}
            </ul>
            <div className={styles.settingsActions}>
              <a className="btn secondary" href="/portal/connect/setup">Edit Lead Form</a>
            </div>
          </section>

          {isBasicPlan ? (
            <section className={`${styles.card} ${styles.upgradeCard}`}>
              <h3>Upgrade to Clutch Connect+</h3>
              <p>Unlock advanced lead statuses, notes, source tracking, exports, and follow-up tools.</p>
              <div className={styles.upgradeActions}>
                <a className="btn ghost" href={connectPlusCheckoutHref}>Try Connect+</a>
                <span>14 Day Free Trial · Cancel Anytime</span>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
