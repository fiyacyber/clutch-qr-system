"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { BarChart3, Copy, Download, Ellipsis, ExternalLink, Pencil, Plus, Search } from "lucide-react";
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
  canManage: boolean;
  canViewAnalytics: boolean;
  accessState: string;
  accessExpiresAt: string | null;
};

interface StoredQrLibraryProps {
  items: StoredQrItem[];
  usage: {
    used: number;
    limit: number | null;
  };
}

type SortMode = "newest" | "most_scanned" | "recently_scanned";
type FilterMode = "all" | "active" | "archived";

function formatDate(value: string | null) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatUsage(used: number, limit: number | null) {
  if (limit === null) return `${used} / Unlimited`;
  return `${used} / ${limit}`;
}

export default function StoredQrLibrary({ items, usage }: StoredQrLibraryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    const next = items
      .filter((item) => {
        if (statusFilter === "active") return item.status === "Active";
        if (statusFilter === "archived") return item.status === "Archived";
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.name} ${item.destinationUrl}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (sortMode === "most_scanned") return b.scanCount - a.scanCount;

        if (sortMode === "recently_scanned") {
          const bTime = b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0;
          const aTime = a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0;
          return bTime - aTime;
        }

        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return next;
  }, [items, search, statusFilter, sortMode]);

  const showEmpty = items.length === 0;
  const usagePercent = usage.limit && usage.limit > 0
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;
  const usageRingStyle = { "--usage-progress": `${usagePercent}%` } as CSSProperties;

  async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.focus();
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }

  function closeMenu() {
    setOpenMenuFor(null);
  }

  function notify(message: string) {
    setFlashMessage(message);
    window.setTimeout(() => setFlashMessage(null), 2000);
  }

  return (
    <section className={styles.shell}>
      {!showEmpty ? (
        <div className={styles.topBar}>
          <label className={styles.searchWrap}>
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.searchInput}
              placeholder="Search by name or destination URL"
              aria-label="Search QR codes"
            />
          </label>

          <Link href="/portal/create" className={styles.createButton}>
            <Plus size={18} aria-hidden="true" />
            Create QR
          </Link>

          <label className={`${styles.selectWrap} ${styles.statusControl}`}>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as FilterMode)}
              className={styles.select}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className={`${styles.selectWrap} ${styles.sortControl}`}>
            <span>Sort</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className={styles.select}
            >
              <option value="newest">Newest</option>
              <option value="most_scanned">Most scanned</option>
              <option value="recently_scanned">Recently scanned</option>
            </select>
          </label>

          <div className={styles.usageBadge}>
            <div>
              <span>QR Usage</span>
              <strong>{formatUsage(usage.used, usage.limit)}</strong>
              <small>{usage.limit === null ? "Unlimited capacity" : `${usagePercent}% used`}</small>
            </div>
            <span className={styles.usageRing} style={usageRingStyle} aria-hidden="true">
              <b>{usage.limit === null ? "∞" : `${usage.used}/${usage.limit}`}</b>
            </span>
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <article className={styles.emptyState}>
          <h2>Create your first trackable QR code</h2>
          <p>Your QR library is empty. Start by creating your first campaign.</p>
          <Link href="/portal/create" className={styles.createButton}>
            <Plus size={18} aria-hidden="true" />
            Create QR
          </Link>
        </article>
      ) : (
        <div className={styles.grid}>
          {filteredItems.map((item) => {
            const publicLink = qrUrl(item.slug);
            const destination = item.destinationUrl || "No destination";
            const downloadLink = qrServerImageUrl({
              url: publicLink,
              foreground_color: item.foregroundColor,
              background_color: item.backgroundColor,
              size: 640,
            });
            const analyticsHref = `/portal/analytics/${item.id}`;
            const editHref = `/portal/qr/${item.id}/edit`;
            const cardContent = <>
              <span className={styles.qrPreviewWrap}>
                <img
                  src={qrServerImageUrl({
                    url: publicLink,
                    foreground_color: item.foregroundColor,
                    background_color: item.backgroundColor,
                    size: 170,
                  })}
                  alt={`${item.name} QR preview`}
                  className={styles.qrPreview}
                />
              </span>
              <span className={styles.cardInfo}>
                <span className={styles.cardHeaderRow}>
                  <strong className={styles.name}>{item.name}</strong>
                  <span className={`${styles.status} ${item.status === "Active" && item.accessState !== "expired_included_access" ? styles.active : styles.archived}`}>
                    {item.accessState === "expired_included_access" ? "Access expired" : item.status}
                  </span>
                </span>
                <span className={styles.url} title={destination}>{destination}</span>
                <span className={styles.metrics}>
                  {item.canViewAnalytics ? <span><b>{item.scanCount}</b> scans</span> : null}
                  {item.canViewAnalytics ? <span>Last scanned <b>{formatDate(item.lastScannedAt)}</b></span> : null}
                  {item.accessState === "expired_included_access" ? <span>Expired <b>{formatDate(item.accessExpiresAt)}</b></span> : null}
                </span>
              </span>
            </>;

            return (
              <article key={item.id} className={styles.card}>
                {item.canManage ? <Link href={editHref} className={styles.cardTapTarget} aria-label={`Open ${item.name}`}>
                  {cardContent}
                </Link> : <div className={styles.cardTapTarget}>{cardContent}</div>}

                <div className={styles.actionsRow}>
                  <div className={styles.primaryActions}>
                    {item.canViewAnalytics ? <Link className={`${styles.actionBtn} ${styles.analyticsAction}`} href={analyticsHref}>
                      <BarChart3 size={16} aria-hidden="true" />
                      <span>Analytics</span>
                    </Link> : null}

                    {item.canManage ? <Link className={styles.actionBtn} href={editHref}>
                      <Pencil size={16} aria-hidden="true" />
                      <span>Edit QR</span>
                    </Link> : null}
                  </div>

                  <div className={styles.utilityActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Copy public link for ${item.name}`}
                      title="Copy public link"
                      onClick={async () => {
                        await copyText(publicLink);
                        notify("QR link copied.");
                      }}
                    >
                      <Copy size={17} aria-hidden="true" />
                    </button>

                    <a
                      className={styles.iconBtn}
                      href={downloadLink}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${item.name} QR code`}
                      title="Download QR"
                    >
                      <Download size={17} aria-hidden="true" />
                    </a>

                    <div className={styles.menuWrap}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label={`More actions for ${item.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuFor === item.id}
                        onClick={() => setOpenMenuFor((current) => (current === item.id ? null : item.id))}
                      >
                        <Ellipsis size={18} aria-hidden="true" />
                      </button>
                      {openMenuFor === item.id ? (
                        <div className={styles.menu} role="menu">
                          {item.canViewAnalytics ? <Link role="menuitem" href={analyticsHref} onClick={closeMenu}>
                            <BarChart3 size={15} aria-hidden="true" />
                            <span>View analytics</span>
                          </Link> : null}
                          {item.canManage ? <Link role="menuitem" href={editHref} onClick={closeMenu}>
                            <Pencil size={15} aria-hidden="true" />
                            <span>Edit QR</span>
                          </Link> : null}
                          <button
                            role="menuitem"
                            type="button"
                            onClick={async () => {
                              await copyText(publicLink);
                              notify("QR link copied.");
                              closeMenu();
                            }}
                          >
                            <Copy size={15} aria-hidden="true" />
                            <span>Copy public link</span>
                          </button>
                          <a role="menuitem" href={downloadLink} target="_blank" rel="noreferrer" onClick={closeMenu}>
                            <Download size={15} aria-hidden="true" />
                            <span>Download QR</span>
                          </a>
                          <a role="menuitem" href={publicLink} target="_blank" rel="noreferrer" onClick={closeMenu}>
                            <ExternalLink size={15} aria-hidden="true" />
                            <span>Open redirect link</span>
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!showEmpty && filteredItems.length === 0 ? (
        <article className={styles.emptyState}>
          <h2>No QR codes match your filters</h2>
          <p>Try a different search term or adjust filters.</p>
        </article>
      ) : null}

      {flashMessage ? <p className={styles.flash}>{flashMessage}</p> : null}
    </section>
  );
}
