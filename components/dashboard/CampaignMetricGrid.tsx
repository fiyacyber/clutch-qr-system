import StatCard from "./StatCard";

export type CampaignMetric = {
  label: string;
  value: React.ReactNode;
  description?: string;
};

export default function CampaignMetricGrid({ metrics }: { metrics: CampaignMetric[] }) {
  return (
    <section className="ds-stat-grid ds-stat-grid-marketing" aria-label="Campaign metrics">
      {metrics.map((metric) => (
        <StatCard key={metric.label} {...metric} />
      ))}
    </section>
  );
}