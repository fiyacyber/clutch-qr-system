import DashboardShell from "@/components/dashboard/DashboardShell";

export default function PortalLoading() {
  return (
    <DashboardShell>
      <main className="container" aria-busy="true" aria-label="Loading customer portal">
        <div className="ds-loading-heading">
          <div className="ds-loading-skeleton" />
          <div className="ds-loading-skeleton" />
        </div>
        <div className="unified-metric-grid ds-loading-metrics">
          {[0, 1, 2, 3].map((item) => <div key={item} className="ds-loading-skeleton" />)}
        </div>
        <div className="unified-dashboard-grid ds-loading-panels">
          <div className="ds-loading-skeleton" />
          <div className="ds-loading-skeleton" />
        </div>
      </main>
    </DashboardShell>
  );
}
