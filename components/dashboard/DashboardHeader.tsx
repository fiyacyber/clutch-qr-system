interface DashboardHeaderProps {
  pretitle?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function DashboardHeader({ pretitle, title, subtitle, actions }: DashboardHeaderProps) {
  return (
    <header className="ds-page-header">
      <div>
        {pretitle ? <p className="ds-page-header-pretitle">{pretitle}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="ds-page-header-actions">{actions}</div> : null}
    </header>
  );
}
