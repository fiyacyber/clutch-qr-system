"use client";

import SidebarNav from "@/components/dashboard/SidebarNav";

interface DashboardShellProps {
  isAdmin?: boolean;
  navLocks?: {
    qr?: boolean;
    analytics?: boolean;
    heatmap?: boolean;
  };
  children: React.ReactNode;
}

export default function DashboardShell({ isAdmin, navLocks, children }: DashboardShellProps) {
  return (
    <div className="ds-app-shell">
      <SidebarNav isAdmin={isAdmin} navLocks={navLocks} />
      <div className="ds-main-shell">{children}</div>
    </div>
  );
}
