interface StatCardProps {
  label: string;
  value: React.ReactNode;
  description?: string;
}

export default function StatCard({ label, value, description }: StatCardProps) {
  return (
    <article className="ds-stat-card">
      <span className="ds-stat-label">{label}</span>
      <strong className="ds-stat-value">{value}</strong>
      {description ? <p className="ds-stat-desc">{description}</p> : null}
    </article>
  );
}
