"use client";

import dynamic from "next/dynamic";

const LocationHeatmap = dynamic(() => import("@/components/dashboard/LocationHeatmap"), {
  ssr: false,
  loading: () => (
    <section className="empty-state">
      <p className="muted">Loading heatmap...</p>
    </section>
  ),
});

type LocationHeatmapClientProps = {
  scans: any[];
  hasCoordinateData: boolean;
};

export default function LocationHeatmapClient({ scans, hasCoordinateData }: LocationHeatmapClientProps) {
  return <LocationHeatmap scans={scans} hasCoordinateData={hasCoordinateData} />;
}
