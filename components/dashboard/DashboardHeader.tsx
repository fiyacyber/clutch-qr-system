interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function DashboardHeader({ title, subtitle, actions }: DashboardHeaderProps) {
  return (
    <header className="ds-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="ds-page-header-actions">{actions}</div> : null}
    </header>
  );
}
