"use client";

import SidebarNav from "@/components/dashboard/SidebarNav";

interface DashboardShellProps {
  isAdmin?: boolean;
  children: React.ReactNode;
}

export default function DashboardShell({ isAdmin, children }: DashboardShellProps) {
  return (
    <div className="ds-app-shell">
      <SidebarNav isAdmin={isAdmin} />
      <div className="ds-main-shell">{children}</div>
    </div>
  );
}
