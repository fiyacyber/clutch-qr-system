"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LocationHeatmap.module.css";
import { getBrowser, getDeviceType, parseCoordinate } from "@/lib/analytics";

type HeatmapScan = {
  id: string | number;
  created_at?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  browser?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type HeatmapProps = {
  scans: HeatmapScan[];
  hasCoordinateData: boolean;
};

type RangeKey = "today" | "7d" | "30d" | "custom";

type Hotspot = {
  key: string;
  lat: number;
  lon: number;
  city: string;
  region: string;
  country: string;
  label: string;
  scans: HeatmapScan[];
  totalScans: number;
  uniqueVisitors: number;
  returningVisitors: number;
  topDevice: string;
  topBrowser: string;
  peakScanHour: string;
};

type LocationRow = {
  key: string;
  label: string;
  scans: number;
  uniqueVisitors: number;
  city: string;
  region: string;
  country: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatHour(value: number) {
  if (value === 0) return "12 AM";
  if (value < 12) return `${value} AM`;
  if (value === 12) return "12 PM";
  return `${value - 12} PM`;
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toLocalStart(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toLocalEnd(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function getLocationLabel(scan: HeatmapScan) {
  const city = String(scan.city || "").trim();
  const region = String(scan.region || "").trim();
  const country = String(scan.country || "").trim();
  return [city, region, country].filter(Boolean).join(", ") || "Unknown location";
}

function getVisitorId(scan: HeatmapScan) {
  return scan.ip_hash || `${scan.user_agent || "visitor"}-${scan.id}`;
}

function getTopCount(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top?.[0] || "Unknown";
}

function buildHotspots(scans: HeatmapScan[]) {
  const groups = new Map<string, HeatmapScan[]>();

  for (const scan of scans) {
    const lat = parseCoordinate(scan.latitude);
    const lon = parseCoordinate(scan.longitude);
    if (lat === null || lon === null) continue;

    const key = `${lat.toFixed(3)}:${lon.toFixed(3)}:${getLocationLabel(scan)}`;
    const list = groups.get(key) || [];
    list.push(scan);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([key, list]) => {
      const [latStr, lonStr, label] = key.split(":");
      const lat = Number(latStr);
      const lon = Number(lonStr);
      const first = list[0] || {};
      const visitorCounts = new Map<string, number>();
      for (const scan of list) {
        const visitor = getVisitorId(scan);
        visitorCounts.set(visitor, (visitorCounts.get(visitor) || 0) + 1);
      }

      const uniqueVisitors = visitorCounts.size;
      const returningVisitors = Array.from(visitorCounts.values()).filter((count) => count > 1).length;
      const peakHour = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        scans: list.filter((scan) => scan.created_at && new Date(scan.created_at).getHours() === hour).length,
      })).sort((a, b) => b.scans - a.scans || a.hour - b.hour)[0]?.hour;

      return {
        key,
        lat,
        lon,
        city: String(first.city || "Unknown city"),
        region: String(first.region || ""),
        country: String(first.country || ""),
        label,
        scans: list,
        totalScans: list.length,
        uniqueVisitors,
        returningVisitors,
        topDevice: getTopCount(list.map((scan) => scan.device_type || getDeviceType(scan.user_agent))),
        topBrowser: getTopCount(list.map((scan) => scan.browser || getBrowser(scan.user_agent))),
        peakScanHour: typeof peakHour === "number" ? formatHour(peakHour) : "Unknown",
      };
    })
    .sort((a, b) => b.totalScans - a.totalScans || a.label.localeCompare(b.label));
}

function buildLocationRows(scans: HeatmapScan[]) {
  const groups = new Map<string, HeatmapScan[]>();

  for (const scan of scans) {
    const label = getLocationLabel(scan);
    if (label === "Unknown location") continue;
    const list = groups.get(label) || [];
    list.push(scan);
    groups.set(label, list);
  }

  return Array.from(groups.entries())
    .map(([label, list]) => ({
      key: label,
      label,
      scans: list.length,
      uniqueVisitors: new Set(list.map(getVisitorId)).size,
      city: String(list[0]?.city || ""),
      region: String(list[0]?.region || ""),
      country: String(list[0]?.country || ""),
    }))
    .sort((a, b) => b.scans - a.scans || a.label.localeCompare(b.label));
}

function MapViewport({ hotspots, resetSignal }: { hotspots: Hotspot[]; resetSignal: number }) {
  const map = useMap();

  useEffect(() => {
    if (!hotspots.length) {
      map.setView([20, 0], 2);
      return;
    }

    const bounds: LatLngBoundsExpression = hotspots.map((point) => [point.lat, point.lon]);
    map.fitBounds(bounds, { padding: [38, 38], maxZoom: 11 });
  }, [hotspots, map]);

  useEffect(() => {
    map.invalidateSize();
  }, [map, resetSignal]);

  return null;
}

function MapControls({ onZoomIn, onZoomOut, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
  return (
    <div className={styles.mapControls}>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in"><Plus size={16} /></button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out"><Minus size={16} /></button>
      <button type="button" onClick={onReset} aria-label="Reset map"><RotateCcw size={16} /></button>
    </div>
  );
}

export default function LocationHeatmap({ scans, hasCoordinateData }: HeatmapProps) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const mapRef = useRef<LeafletMap | null>(null);

  const now = useMemo(() => new Date(), []);

  const defaultStart = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return formatDateInput(d);
  }, [now]);

  useEffect(() => {
    if (!customStart) setCustomStart(defaultStart);
    if (!customEnd) setCustomEnd(formatDateInput(now));
  }, [customStart, customEnd, defaultStart, now]);

  const filteredScans = useMemo(() => {
    const start = range === "today"
      ? toLocalStart(formatDateInput(now))
      : range === "7d"
        ? (() => {
            const d = new Date(now);
            d.setDate(d.getDate() - 6);
            return toLocalStart(formatDateInput(d));
          })()
        : range === "30d"
          ? (() => {
              const d = new Date(now);
              d.setDate(d.getDate() - 29);
              return toLocalStart(formatDateInput(d));
            })()
          : customStart
            ? toLocalStart(customStart)
            : null;
    const end = range === "custom" && customEnd ? toLocalEnd(customEnd) : now;

    return scans.filter((scan) => {
      if (!scan.created_at) return false;
      const created = new Date(scan.created_at);
      if (Number.isNaN(created.getTime())) return false;
      if (start && created < start) return false;
      if (end && created > end) return false;
      return true;
    });
  }, [scans, range, customStart, customEnd, now]);

  const hotspots = useMemo(() => buildHotspots(filteredScans), [filteredScans]);
  const locationRows = useMemo(() => buildLocationRows(filteredScans).slice(0, 7), [filteredScans]);

  const selectedHotspot = useMemo(() => hotspots.find((point) => point.key === selectedKey) || null, [hotspots, selectedKey]);

  const metrics = useMemo(() => {
    const totalScans = filteredScans.length;
    const uniqueVisitors = new Set(filteredScans.map(getVisitorId)).size;
    return {
      totalScans,
      uniqueVisitors,
      cities: new Set(filteredScans.map((scan) => String(scan.city || "").trim()).filter(Boolean)).size,
      countries: new Set(filteredScans.map((scan) => String(scan.country || "").trim()).filter(Boolean)).size,
    };
  }, [filteredScans]);

  const mapDensity = hotspots.length ? Math.max(...hotspots.map((point) => point.totalScans), 1) : 1;
  const mapCenter: [number, number] = hotspots.length ? [hotspots[0].lat, hotspots[0].lon] : [20, 0];
  const rankMax = Math.max(...locationRows.map((entry) => entry.scans), 1);

  const activeRangeLabel = range === "today" ? "Today" : range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "Custom";

  function resetMap() {
    setSelectedKey(null);
    setResetSignal((value) => value + 1);
    if (mapRef.current) {
      if (hotspots.length) {
        const bounds: LatLngBoundsExpression = hotspots.map((point) => [point.lat, point.lon]);
        mapRef.current.fitBounds(bounds, { padding: [38, 38], maxZoom: 11 });
      } else {
        mapRef.current.setView([20, 0], 2);
      }
    }
  }

  return (
    <section className={styles.shell}>
      <div className={styles.kpiRow}>
        <motion.article className={styles.kpiCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <span>Total Scans</span>
          <strong>{metrics.totalScans.toLocaleString()}</strong>
        </motion.article>
        <motion.article className={styles.kpiCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <span>Unique Visitors</span>
          <strong>{metrics.uniqueVisitors.toLocaleString()}</strong>
        </motion.article>
        <motion.article className={styles.kpiCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <span>Cities</span>
          <strong>{metrics.cities.toLocaleString()}</strong>
        </motion.article>
        <motion.article className={styles.kpiCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <span>Countries</span>
          <strong>{metrics.countries.toLocaleString()}</strong>
        </motion.article>
      </div>

      <div className={styles.filterBar}>
        {(["today", "7d", "30d", "custom"] as RangeKey[]).map((chip) => (
          <button
            key={chip}
            type="button"
            className={`${styles.filterChip} ${range === chip ? styles.filterChipActive : ""}`}
            onClick={() => setRange(chip)}
          >
            {chip === "today" ? "Today" : chip === "7d" ? "7 Days" : chip === "30d" ? "30 Days" : "Custom"}
          </button>
        ))}
        <div className={styles.rangeLabel}>
          <LocateFixed size={14} />
          <span>{activeRangeLabel}</span>
        </div>
      </div>

      {range === "custom" ? (
        <motion.div className={styles.customRangePanel} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <label>
            <span>Start</span>
            <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} max={customEnd || undefined} />
          </label>
          <label>
            <span>End</span>
            <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} min={customStart || undefined} max={formatDateInput(now)} />
          </label>
        </motion.div>
      ) : null}

      <article className={styles.mapCard}>
        <div className={styles.mapHeader}>
          <div>
            <p className={styles.mapEyebrow}>Live location analytics</p>
            <h2>Location Heatmap</h2>
          </div>
          <span className={styles.mapPill}>{hasCoordinateData ? `${hotspots.length} hotspots` : "No coordinate data yet"}</span>
        </div>

        <div className={styles.mapFrame}>
          <MapContainer
            center={mapCenter}
            zoom={hotspots.length ? 3 : 2}
            scrollWheelZoom
            className={styles.leafletMap}
            ref={(map) => {
              mapRef.current = map;
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewport hotspots={hotspots} resetSignal={resetSignal} />

            {hotspots.map((point) => {
              const intensity = clamp(point.totalScans / mapDensity, 0.1, 1);
              const radius = 7 + intensity * 16;
              const glowRadius = radius + 10;
              const active = selectedKey === point.key;

              return (
                <Fragment key={point.key}>
                  <CircleMarker
                    center={[point.lat, point.lon]}
                    radius={glowRadius}
                    pathOptions={{
                      color: "#FF7A1A",
                      fillColor: "#FF7A1A",
                      fillOpacity: 0.08 + intensity * 0.18,
                      weight: 0,
                      className: `${styles.hotspotGlow} ${active ? styles.hotspotGlowActive : ""}`,
                    }}
                  />
                  <CircleMarker
                    center={[point.lat, point.lon]}
                    radius={radius}
                    pathOptions={{
                      color: "#FFFFFF",
                      fillColor: "#FFA665",
                      fillOpacity: 0.55 + intensity * 0.28,
                      weight: active ? 2 : 1.5,
                      className: `${styles.hotspotCore} ${active ? styles.hotspotCoreActive : ""}`,
                    }}
                    eventHandlers={{
                      click: () => setSelectedKey(point.key),
                    }}
                  />
                </Fragment>
              );
            })}
          </MapContainer>

          <MapControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onReset={resetMap}
          />

          {!hasCoordinateData ? (
            <div className={styles.emptyOverlay}>
              <strong>No coordinate-backed scans yet</strong>
              <span>
                The map will light up as soon as scans include latitude and longitude values. City ranking data is still available below.
              </span>
            </div>
          ) : null}
        </div>
      </article>

      <section className={styles.rankCard}>
        <div className={styles.rankHeader}>
          <div>
            <p className={styles.mapEyebrow}>Top locations</p>
            <h3>Ranked by scans</h3>
          </div>
          <span className={styles.rankCount}>{locationRows.length} shown</span>
        </div>

        <div className={styles.rankList}>
          {locationRows.length ? locationRows.map((row, index) => {
            return (
              <button key={row.key} type="button" className={styles.rankRow} onClick={() => {
                const matched = hotspots.find((point) => point.label === row.label);
                if (matched) setSelectedKey(matched.key);
              }}>
                <span className={styles.rankIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.rankCopy}>
                  <strong>{row.label}</strong>
                  <span>{row.uniqueVisitors.toLocaleString()} unique visitors</span>
                </div>
                <span className={styles.rankValue}>{row.scans.toLocaleString()}</span>
                <i style={{ width: `${Math.max(14, (row.scans / rankMax) * 100)}%` }} />
              </button>
            );
          }) : (
            <div className={styles.rankEmpty}>No scan locations yet.</div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selectedHotspot ? (
          <motion.aside
            className={styles.sheetBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedKey(null)}
          >
            <motion.div
              className={styles.sheet}
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className={styles.sheetClose} onClick={() => setSelectedKey(null)} aria-label="Close hotspot details">
                <ChevronDown size={18} />
              </button>
              <div className={styles.sheetHead}>
                <p className={styles.mapEyebrow}>Hotspot details</p>
                <h4>{selectedHotspot.label}</h4>
                <p>{selectedHotspot.city} {selectedHotspot.region ? `, ${selectedHotspot.region}` : ""}{selectedHotspot.country ? `, ${selectedHotspot.country}` : ""}</p>
              </div>

              <div className={styles.sheetMetrics}>
                <div><span>Total scans</span><strong>{selectedHotspot.totalScans.toLocaleString()}</strong></div>
                <div><span>Unique visitors</span><strong>{selectedHotspot.uniqueVisitors.toLocaleString()}</strong></div>
                <div><span>Returning visitors</span><strong>{selectedHotspot.returningVisitors.toLocaleString()}</strong></div>
                <div><span>Peak scan hour</span><strong>{selectedHotspot.peakScanHour}</strong></div>
              </div>

              <div className={styles.sheetStats}>
                <div><span>Top device</span><strong>{selectedHotspot.topDevice}</strong></div>
                <div><span>Top browser</span><strong>{selectedHotspot.topBrowser}</strong></div>
              </div>
            </motion.div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </section>
  );
}