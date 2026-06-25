type DashboardPreviewCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export default function DashboardPreviewCard({ eyebrow, title, description, children }: DashboardPreviewCardProps) {
  return (
    <article className="ds-dashboard-preview-card">
      {eyebrow ? <span className="ds-badge">{eyebrow}</span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {children ? <div className="ds-dashboard-preview-body">{children}</div> : null}
    </article>
  );
}