"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const ISO_NUM_TO_NAME: Record<string, string> = {
  "4": "Afghanistan", "8": "Albania", "12": "Algeria", "24": "Angola",
  "32": "Argentina", "36": "Australia", "40": "Austria", "56": "Belgium",
  "68": "Bolivia", "76": "Brazil", "100": "Bulgaria", "124": "Canada",
  "144": "Sri Lanka", "152": "Chile", "156": "China", "170": "Colombia",
  "188": "Costa Rica", "191": "Croatia", "192": "Cuba", "203": "Czech Republic",
  "208": "Denmark", "218": "Ecuador", "818": "Egypt", "231": "Ethiopia",
  "246": "Finland", "250": "France", "276": "Germany", "288": "Ghana",
  "300": "Greece", "320": "Guatemala", "332": "Haiti", "340": "Honduras",
  "348": "Hungary", "356": "India", "360": "Indonesia", "364": "Iran",
  "368": "Iraq", "372": "Ireland", "376": "Israel", "380": "Italy",
  "388": "Jamaica", "392": "Japan", "400": "Jordan", "398": "Kazakhstan",
  "404": "Kenya", "410": "South Korea", "414": "Kuwait", "418": "Laos",
  "422": "Lebanon", "434": "Libya", "458": "Malaysia", "484": "Mexico",
  "504": "Morocco", "508": "Mozambique", "516": "Namibia", "524": "Nepal",
  "528": "Netherlands", "554": "New Zealand", "566": "Nigeria", "578": "Norway",
  "586": "Pakistan", "591": "Panama", "604": "Peru", "608": "Philippines",
  "616": "Poland", "620": "Portugal", "642": "Romania", "643": "Russia",
  "682": "Saudi Arabia", "686": "Senegal", "710": "South Africa", "724": "Spain",
  "752": "Sweden", "756": "Switzerland", "760": "Syria", "764": "Thailand",
  "788": "Tunisia", "792": "Turkey", "800": "Uganda", "804": "Ukraine",
  "784": "United Arab Emirates", "826": "United Kingdom", "840": "United States",
  "858": "Uruguay", "862": "Venezuela", "704": "Vietnam", "887": "Yemen",
  "716": "Zimbabwe",
};

function heatColor(value: number, max: number): string {
  if (!value || !max) return "#E8ECF4";
  const t = Math.min(value / max, 1);
  if (t < 0.1)  return "#FFE8D0";
  if (t < 0.25) return "#FFCA9A";
  if (t < 0.5)  return "#FFA665";
  if (t < 0.75) return "#FF7A1A";
  return "#C44D00";
}

function markerHeatColor(value: number, max: number): string {
  if (!value || !max) return "#FFA665";
  const t = Math.min(value / max, 1);
  if (t < 0.25) return "#FFA665";
  if (t < 0.5) return "#FF7A1A";
  if (t < 0.75) return "#E55F00";
  return "#B43A00";
}

const DEMO: Record<string, number> = {
  "840": 742, "826": 180, "124": 95, "36": 67, "276": 45,
  "250": 38, "380": 22, "392": 18, "356": 15, "76": 30,
  "484": 25, "724": 19, "528": 14,
};
const DEMO_MAX = 742;

interface WorldMapProps {
  countryData: { name: string; scans: number }[];
  mapPoints: {
    lat: number;
    lon: number;
    scans: number;
    uniqueVisitors: number;
    label: string;
    city?: string;
    region?: string;
    country?: string;
    topCampaign?: string;
  }[];
  viewBy?: string;
  onDrillDown?: (location: { city?: string; region?: string; country?: string }) => void;
}

function buildClusters(
  points: WorldMapProps["mapPoints"],
  zoom: number
) {
  const precision = zoom < 1.7 ? 1 : zoom < 2.5 ? 2 : 3;
  const grouped = new Map<
    string,
    {
      lat: number;
      lon: number;
      scans: number;
      uniqueVisitors: number;
      label: string;
      city?: string;
      region?: string;
      country?: string;
      topCampaign?: string;
      count: number;
    }
  >();

  for (const point of points) {
    const key = `${point.lat.toFixed(precision)}:${point.lon.toFixed(precision)}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        lat: point.lat,
        lon: point.lon,
        scans: point.scans,
        uniqueVisitors: point.uniqueVisitors,
        label: point.label,
        city: point.city,
        region: point.region,
        country: point.country,
        topCampaign: point.topCampaign,
        count: 1,
      });
      continue;
    }

    existing.scans += point.scans;
    existing.uniqueVisitors += point.uniqueVisitors;
    existing.count += 1;
    if (point.scans > existing.scans / existing.count) {
      existing.label = point.label;
      existing.city = point.city;
      existing.region = point.region;
      existing.country = point.country;
      existing.topCampaign = point.topCampaign;
    }
  }

  return Array.from(grouped.values());
}

export default function WorldMap({ countryData, mapPoints, viewBy = "Scans", onDrillDown }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    value: number;
    uniqueVisitors?: number;
    topCity?: string;
    topCampaign?: string;
    clustered?: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([10, 5]);

  const hasReal = countryData.length > 0;
  const hasCityPoints = mapPoints.length > 0;
  const byName = new Map(countryData.map(d => [d.name.toLowerCase(), d.scans]));
  const realMax = hasReal ? Math.max(...countryData.map(d => d.scans), 1) : DEMO_MAX;
  const clusteredPoints = useMemo(() => buildClusters(mapPoints, zoom), [mapPoints, zoom]);
  const pointMax = clusteredPoints.length ? Math.max(...clusteredPoints.map((point) => point.scans), 1) : realMax;

  function zoomIn() {
    setZoom((current) => Math.min(6, current + 0.6));
  }

  function zoomOut() {
    setZoom((current) => Math.max(1, current - 0.6));
  }

  function resetView() {
    setZoom(1);
    setCenter([10, 5]);
  }

  function getVal(geoId: string | number): number {
    const stripped = String(geoId).replace(/^0+/, "");
    if (!hasReal) return DEMO[stripped] || 0;
    const name = ISO_NUM_TO_NAME[stripped];
    return name ? (byName.get(name.toLowerCase()) || 0) : 0;
  }

  return (
    <div className="ca-world-map" onMouseLeave={() => setTooltip(null)}>
      {!hasCityPoints && (
        <span className="ca-map-demo-badge">
          City/town heat points appear after scans include location coordinates
        </span>
      )}

      <ComposableMap
        projectionConfig={{ scale: 145, center: [10, 5] }}
        style={{ width: "100%", height: "320px" }}
      >
        <ZoomableGroup zoom={zoom} center={center}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const val = getVal(geo.id);
                const name = ISO_NUM_TO_NAME[String(geo.id).replace(/^0+/, "")] || geo.properties?.name || "Unknown";
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={hasCityPoints ? "#EEF3FA" : heatColor(val, realMax)}
                    stroke="#fff"
                    strokeWidth={0.4}
                    onMouseMove={(e) => {
                      if (val > 0) setTooltip({ x: e.clientX, y: e.clientY, name, value: val });
                      else setTooltip(null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: hasCityPoints ? "#DDE5F0" : val > 0 ? "#8B3600" : "#CDD4E0",
                        outline: "none",
                        cursor: val > 0 ? "pointer" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {clusteredPoints.map((point, idx) => {
            const intensity = pointMax ? Math.min(point.scans / pointMax, 1) : 0;
            const size = Math.max(5, Math.min(18, 5 + intensity * 13));
            const color = markerHeatColor(point.scans, pointMax);
            return (
              <Marker key={`${point.label}-${idx}`} coordinates={[point.lon, point.lat]}>
                <circle
                  r={size + 7}
                  fill={color}
                  fillOpacity={0.16}
                  stroke="none"
                />
                <circle
                  r={size}
                  fill={color}
                  fillOpacity={0.78}
                  stroke="#fff"
                  strokeWidth={1.5}
                  onMouseMove={(e) => {
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      name: point.label,
                      value: point.scans,
                      uniqueVisitors: point.uniqueVisitors,
                      topCity: point.label.split(",")[0]?.trim() || point.label,
                      topCampaign: point.topCampaign,
                      clustered: point.count > 1 ? point.count : undefined,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    setCenter([point.lon, point.lat]);
                    setZoom((current) => Math.min(6, current + 0.9));
                    onDrillDown?.({
                      city: point.city,
                      region: point.region,
                      country: point.country,
                    });
                  }}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      <div className="ca-map-controls">
        <button type="button" className="ca-map-control-btn" onClick={zoomIn}>+</button>
        <button type="button" className="ca-map-control-btn" onClick={zoomOut}>-</button>
        <button type="button" className="ca-map-control-btn reset" onClick={resetView}>Reset</button>
      </div>

      {tooltip && (
        <div
          className="ca-map-tooltip"
          style={{ position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 9999, pointerEvents: "none" }}
        >
          <strong>{tooltip.name}</strong>
          <div className="ca-map-tt-row">
            <span>{viewBy}</span>
            <span className="ca-map-tt-val">{tooltip.value.toLocaleString()}</span>
          </div>
          {typeof tooltip.uniqueVisitors === "number" ? (
            <div className="ca-map-tt-row">
              <span>Unique Visitors</span>
              <span className="ca-map-tt-val">{tooltip.uniqueVisitors.toLocaleString()}</span>
            </div>
          ) : null}
          {tooltip.topCity ? (
            <div className="ca-map-tt-row">
              <span>Top City</span>
              <span className="ca-map-tt-val">{tooltip.topCity}</span>
            </div>
          ) : null}
          {tooltip.topCampaign ? (
            <div className="ca-map-tt-row">
              <span>Campaign</span>
              <span className="ca-map-tt-val">{tooltip.topCampaign}</span>
            </div>
          ) : null}
          {tooltip.clustered ? (
            <div className="ca-map-tt-row">
              <span>Clustered markers</span>
              <span className="ca-map-tt-val">{tooltip.clustered}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="ca-map-legend">
        <span className="ca-map-leg-title">City/Town {viewBy}</span>
        <div className="ca-map-leg-bar" />
        <div className="ca-map-leg-nums">
          <span>1</span>
          <span>{pointMax}+</span>
        </div>
      </div>
    </div>
  );
}
