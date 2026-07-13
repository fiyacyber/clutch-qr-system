"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, Copy, Download, Ellipsis, ExternalLink, Pencil } from "lucide-react";
import { qrServerImageUrl, qrUrl } from "@/lib/qr";
import styles from "./stored-qr-library.module.css";

export type StoredQrItem = {
  id: string;
  name: string;
  slug: string;
  destinationUrl: string;
  scanCount: number;
  status: "Active" | "Archived";
  createdAt: string | null;
  updatedAt: string | null;
  lastScannedAt: string | null;
  foregroundColor: string;
  backgroundColor: string;
  sourceLabel: string;
};

interface StoredQrLibraryProps {
  items: StoredQrItem[];
  canCreate?: boolean;
  usage: { used: number; limit: number | null };
}

type SortMode = "newest" | "most_scanned" | "recently_scanned";
type FilterMode = "all" | "active" | "archived";

function formatDate(value: string | null) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function formatUsage(used: number, limit: number | null) {
  return limit === null ? `${used} used · Unlimited` : `${used} of ${limit} used`;
}

export default function StoredQrLibrary({ items, canCreate = false, usage }: StoredQrLibraryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => statusFilter === "all" || item.status.toLowerCase() === statusFilter)
      .filter((item) => !query || `${item.name} ${item.destinationUrl} ${item.sourceLabel}`.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortMode === "most_scanned") return b.scanCount - a.scanCount;
        if (sortMode === "recently_scanned") return (b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0) - (a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0);
        return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      });
  }, [items, search, statusFilter, sortMode]);

  async function copyText(value: string) {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
  }

  function notify(message: string) {
    setFlashMessage(message);
    window.setTimeout(() => setFlashMessage(null), 2000);
  }

  return (
    <section className={styles.shell}>
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={styles.searchInput} placeholder="Search codes, destinations, or sources" aria-label="Search Clutch Codes" />
        </div>
        <div className={styles.controlRow}>
          {canCreate ? <Link href="/portal/create" className="btn primary">Create Clutch Code</Link> : null}
          <label className={styles.selectWrap}><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterMode)} className={styles.select}><option value="all">All</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
          <label className={styles.selectWrap}><span>Sort</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={styles.select}><option value="newest">Newest</option><option value="most_scanned">Most scanned</option><option value="recently_scanned">Recently scanned</option></select></label>
          <div className={styles.usageBadge}><span>Code allowance</span><strong>{formatUsage(usage.used, usage.limit)}</strong></div>
        </div>
      </div>

      {!items.length ? (
        <article className={styles.emptyState}>
          <h2>Create your first Clutch Code</h2>
          <p>Send customers to a website or Clutch Connect profile, customize the design, and start tracking scans.</p>
          {canCreate ? <Link href="/portal/create" className="btn primary">Create Clutch Code</Link> : null}
        </article>
      ) : (
        <div className={styles.grid}>
          {filteredItems.map((item) => {
            const publicLink = qrUrl(item.slug);
            const downloadLink = qrServerImageUrl({ url: publicLink, foreground_color: item.foregroundColor, background_color: item.backgroundColor, size: 640 });
            const analyticsHref = `/portal/analytics/${item.id}`;
            const editHref = `/portal/qr/${item.id}/edit`;
            return (
              <article key={item.id} className={styles.card}>
                <Link href={editHref} className={styles.cardTapTarget} aria-label={`Open ${item.name}`}>
                  <span className={styles.qrPreviewWrap}><img src={qrServerImageUrl({ url: publicLink, foreground_color: item.foregroundColor, background_color: item.backgroundColor, size: 170 })} alt={`${item.name} Clutch Code preview`} className={styles.qrPreview} /></span>
                  <span className={styles.cardInfo}>
                    <span className={styles.cardHeaderRow}><strong className={styles.name}>{item.name}</strong><span className={`${styles.status} ${item.status === "Active" ? styles.active : styles.archived}`}>{item.status}</span></span>
                    <span className={styles.url}>{item.destinationUrl || "No destination"}</span>
                    <span className={styles.metrics}><span><b>{item.scanCount}</b> scans</span><span>Last scanned {formatDate(item.lastScannedAt)}</span></span>
                    <span className={styles.url}>Created from: {item.sourceLabel}</span>
                  </span>
                </Link>
                <div className={styles.actionsRow}>
                  <Link className={styles.actionBtn} href={analyticsHref}><BarChart3 size={16} /><span>Analytics</span></Link>
                  <Link className={styles.actionBtn} href={editHref}><Pencil size={16} /><span>Edit</span></Link>
                  <button type="button" className={styles.actionBtn} onClick={async () => { await copyText(publicLink); notify("Clutch Code link copied."); }}><Copy size={16} /><span>Copy link</span></button>
                  <a className={styles.actionBtn} href={downloadLink} target="_blank" rel="noreferrer"><Download size={16} /><span>Download</span></a>
                  <div className={styles.menuWrap}>
                    <button type="button" className={styles.iconBtn} aria-haspopup="menu" aria-expanded={openMenuFor === item.id} onClick={() => setOpenMenuFor((current) => current === item.id ? null : item.id)}><Ellipsis size={18} /></button>
                    {openMenuFor === item.id ? <div className={styles.menu} role="menu">
                      <Link role="menuitem" href={analyticsHref} onClick={() => setOpenMenuFor(null)}><BarChart3 size={15} /><span>View analytics</span></Link>
                      <Link role="menuitem" href={editHref} onClick={() => setOpenMenuFor(null)}><Pencil size={15} /><span>Edit code</span></Link>
                      <button role="menuitem" type="button" onClick={async () => { await copyText(publicLink); notify("Clutch Code link copied."); setOpenMenuFor(null); }}><Copy size={15} /><span>Copy public link</span></button>
                      <a role="menuitem" href={downloadLink} target="_blank" rel="noreferrer" onClick={() => setOpenMenuFor(null)}><Download size={15} /><span>Download code</span></a>
                      <a role="menuitem" href={publicLink} target="_blank" rel="noreferrer" onClick={() => setOpenMenuFor(null)}><ExternalLink size={15} /><span>Open redirect link</span></a>
                    </div> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {items.length > 0 && filteredItems.length === 0 ? <article className={styles.emptyState}><h2>No Clutch Codes match your filters</h2><p>Try a different search term or adjust the filters.</p></article> : null}
      {flashMessage ? <p className={styles.flash}>{flashMessage}</p> : null}
    </section>
  );
}
