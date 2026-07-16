import DashboardShell from "@/components/dashboard/DashboardShell";

export default function PortalLoading() {
  return (
    <DashboardShell>
      <main className="container" aria-busy="true" aria-label="Loading customer portal">
        <div className="ds-loading-skeleton" style={{ height: 126 }} />
        <div className="unified-metric-grid" style={{ marginTop: 14 }}>
          {[0, 1, 2, 3].map((item) => <div key={item} className="ds-loading-skeleton" style={{ height: 148 }} />)}
        </div>
        <div className="unified-dashboard-grid" style={{ marginTop: 14 }}>
          <div className="ds-loading-skeleton" style={{ height: 300 }} />
          <div className="ds-loading-skeleton" style={{ height: 300 }} />
        </div>
      </main>
    </DashboardShell>
  );
}
