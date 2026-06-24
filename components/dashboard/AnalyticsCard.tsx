interface AnalyticsCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function AnalyticsCard({ title, children, className }: AnalyticsCardProps) {
  return (
    <section className={`ds-analytics-card${className ? ` ${className}` : ""}`}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
}
