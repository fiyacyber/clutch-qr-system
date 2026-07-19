"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ContactRound,
  FilePlus2,
  Megaphone,
  Nfc,
  Plus,
  QrCode,
  UserRound,
  X,
} from "lucide-react";

export type PerformancePoint = {
  date: string;
  label: string;
  qr: number;
  nfc: number;
};

type CreateCapability = {
  href: string;
  enabled: boolean;
  reason?: string;
};

interface UnifiedDashboardInteractiveProps {
  performance: PerformancePoint[];
  showButton?: boolean;
  showChart?: boolean;
  createCapabilities: {
    clutchCode: CreateCapability;
    campaign: CreateCapability;
    nfc: CreateCapability;
    leadForm: CreateCapability;
    profile: CreateCapability;
  };
}

const createOptions = [
  { key: "clutchCode" as const, label: "Create Clutch Code", description: "A trackable, editable QR code", icon: QrCode },
  { key: "campaign" as const, label: "Start Campaign", description: "Group assets and measure results", icon: Megaphone },
  { key: "nfc" as const, label: "Add NFC Item", description: "Coming soon", icon: Nfc },
  { key: "leadForm" as const, label: "Create Lead Form", description: "Capture contact details", icon: ContactRound },
  { key: "profile" as const, label: "Set Up Profile", description: "Publish your Clutch Connect profile", icon: UserRound },
];

export default function UnifiedDashboardInteractive({ performance, createCapabilities, showButton = true, showChart = true }: UnifiedDashboardInteractiveProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [range, setRange] = useState<7 | 14>(14);
  const [series, setSeries] = useState<"all" | "qr" | "nfc">("all");
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const visiblePoints = useMemo(() => performance.slice(-range), [performance, range]);
  const peak = Math.max(1, ...visiblePoints.map((point) => {
    if (series === "qr") return point.qr;
    if (series === "nfc") return point.nfc;
    return point.qr + point.nfc;
  }));

  useEffect(() => {
    if (!createOpen) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateOpen(false);
        openButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createOpen]);

  return (
    <>
      {showButton ? <div className="unified-dashboard-actions">
        <button ref={openButtonRef} type="button" className="btn primary unified-create-button" onClick={() => setCreateOpen(true)}>
          <Plus size={18} aria-hidden="true" /> Create New
        </button>
      </div> : null}

      {showChart ? <section className="unified-performance" aria-labelledby="performance-title">
        <div className="unified-section-heading">
          <div>
            <p className="unified-kicker">Performance</p>
            <h2 id="performance-title">Scans and taps</h2>
          </div>
          <div className="unified-chart-filters" aria-label="Performance chart filters">
            <label>
              <span className="sr-only">Date range</span>
              <select value={range} onChange={(event) => setRange(Number(event.target.value) as 7 | 14)}>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
              </select>
            </label>
            <div className="unified-segmented" role="group" aria-label="Asset type">
              {(["all", "qr", "nfc"] as const).map((value) => (
                <button key={value} type="button" className={series === value ? "is-active" : ""} onClick={() => setSeries(value)}>
                  {value === "all" ? "All" : value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        {visiblePoints.some((point) => point.qr + point.nfc > 0) ? (
          <div className="unified-bar-chart" role="img" aria-label={`${range}-day chart of customer scans and taps`}>
            {visiblePoints.map((point) => {
              const value = series === "qr" ? point.qr : series === "nfc" ? point.nfc : point.qr + point.nfc;
              return (
                <div className="unified-bar-column" key={point.date} title={`${point.label}: ${value}`}>
                  <span className="unified-bar-value">{value || ""}</span>
                  <span className="unified-bar" style={{ height: `${Math.max(value ? 10 : 2, (value / peak) * 100)}%` }} />
                  <span className="unified-bar-label">{point.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ds-empty-state"><p>Your performance chart will appear after the first scan or tap.</p></div>
        )}
      </section> : null}

      {showButton && createOpen ? (
        <div className="unified-sheet-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section className="unified-create-sheet" role="dialog" aria-modal="true" aria-labelledby="create-new-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="unified-create-sheet-head">
              <div><p className="unified-kicker">Quick action</p><h2 id="create-new-title">Create New</h2></div>
              <button ref={closeButtonRef} type="button" className="unified-icon-button" onClick={() => { setCreateOpen(false); openButtonRef.current?.focus(); }} aria-label="Close Create New menu"><X size={20} /></button>
            </div>
            <div className="unified-create-grid">
              {createOptions.map((option) => {
                const capability = createCapabilities[option.key];
                const Icon = option.icon;
                return capability.enabled ? (
                  <Link key={option.key} href={capability.href} className="unified-create-option">
                    <span className="unified-create-icon"><Icon size={21} /></span>
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  </Link>
                ) : (
                  <div key={option.key} className="unified-create-option is-locked" aria-disabled="true">
                    <span className="unified-create-icon"><Icon size={21} /></span>
                    <span><strong>{option.label}</strong><small>{capability.reason || "Not included with your current access"}</small></span>
                  </div>
                );
              })}
            </div>
            <p className="unified-create-footnote"><FilePlus2 size={15} /> Create and manage your Clutch tools from one place.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
