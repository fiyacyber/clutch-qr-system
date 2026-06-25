import Link from "next/link";

type HeatmapPreviewProps = {
  title?: string;
  subtitle?: string;
  demo?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  locations?: Array<{ label: string; value: number }>;
};

const demoLocations = [
  { label: "Cincinnati", value: 42 },
  { label: "Dayton", value: 28 },
  { label: "Columbus", value: 18 },
];

export default function HeatmapPreview({
  title = "Heatmap Command Center",
  subtitle = "Visualize where scans, taps, and leads are happening by campaign and city.",
  demo = false,
  ctaHref = "/portal/heatmap",
  ctaLabel = "Open Heatmap",
  locations,
}: HeatmapPreviewProps) {
  const topLocations = locations?.length ? locations.slice(0, 3) : demoLocations;
  const maxValue = Math.max(...topLocations.map((item) => item.value), 1);

  return (
    <article className="ds-heatmap-preview">
      <div className="ds-heatmap-preview-head">
        <div>
          <span className={`ds-badge${demo ? " ds-badge-warning" : ""}`}>{demo ? "Demo preview" : "Live location data"}</span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <Link className="btn primary" href={ctaHref}>{ctaLabel}</Link>
      </div>

      <div className="ds-heatmap-preview-grid">
        <div className="ds-react-heatmap" aria-label={demo ? "Demo heatmap preview" : "Heatmap preview"}>
          <svg viewBox="0 0 520 340" role="img" aria-hidden="true">
            <defs>
              <pattern id="heat-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#DDE6EF" strokeWidth="1" opacity="0.55" />
              </pattern>
              <radialGradient id="heat-orange" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFA665" stopOpacity="0.58" />
                <stop offset="52%" stopColor="#FFA665" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#FFA665" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="520" height="340" rx="22" fill="#F4F7FA" />
            <rect width="520" height="340" rx="22" fill="url(#heat-grid)" />
            <path d="M90 214 C132 142 218 124 270 170 C314 209 390 188 438 116" fill="none" stroke="#384862" strokeWidth="2" strokeDasharray="7 9" opacity="0.24" />
            <path d="M70 138 C130 84 222 94 290 126 C356 157 410 146 462 86" fill="none" stroke="#FFA665" strokeWidth="2.5" strokeDasharray="9 10" opacity="0.52" />
            <ellipse cx="155" cy="212" rx="86" ry="55" fill="#384862" opacity="0.11" />
            <ellipse cx="294" cy="154" rx="96" ry="58" fill="#384862" opacity="0.1" />
            <ellipse cx="394" cy="226" rx="78" ry="49" fill="#384862" opacity="0.09" />
            <circle cx="156" cy="210" r="86" fill="url(#heat-orange)" />
            <circle cx="294" cy="154" r="105" fill="url(#heat-orange)" opacity="0.88" />
            <circle cx="394" cy="226" r="72" fill="url(#heat-orange)" opacity="0.7" />
            <g className="ds-heat-point">
              <circle cx="156" cy="210" r="13" fill="#FFA665" stroke="#fff" strokeWidth="5" />
            </g>
            <g className="ds-heat-point">
              <circle cx="294" cy="154" r="16" fill="#FF7A1A" stroke="#fff" strokeWidth="5" />
            </g>
            <g className="ds-heat-point">
              <circle cx="394" cy="226" r="11" fill="#FFA665" stroke="#fff" strokeWidth="5" />
            </g>
          </svg>

          <div className="ds-heatmap-label ds-heatmap-label-a">{topLocations[0]?.label || "Cincinnati"}</div>
          <div className="ds-heatmap-label ds-heatmap-label-b">{topLocations[1]?.label || "Dayton"}</div>
          <div className="ds-heatmap-label ds-heatmap-label-c">{topLocations[2]?.label || "Columbus"}</div>
        </div>

        <div className="ds-heatmap-rankings">
          <span className="ds-heatmap-kicker">Top locations</span>
          {topLocations.map((location) => (
            <div key={location.label} className="ds-heatmap-ranking-row">
              <div>
                <strong>{location.label}</strong>
                <span>{location.value.toLocaleString()} interactions</span>
              </div>
              <i style={{ width: `${Math.max(12, (location.value / maxValue) * 100)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}