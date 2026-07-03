"use client";

import SidebarNav from "@/components/dashboard/SidebarNav";

export type DashboardNavVariant = "default" | "connect-basic" | "onboarding";

interface DashboardShellProps {
  isAdmin?: boolean;
  navLocks?: {
    qr?: boolean;
    analytics?: boolean;
    heatmap?: boolean;
  };
  navVariant?: DashboardNavVariant;
  showLeadInbox?: boolean;
  children: React.ReactNode;
}

export default function DashboardShell({
  isAdmin,
  navLocks,
  navVariant,
  showLeadInbox,
  children,
}: DashboardShellProps) {
  return (
    <div className="ds-app-shell">
      <SidebarNav
        isAdmin={isAdmin}
        navLocks={navLocks}
        navVariant={navVariant}
        showLeadInbox={showLeadInbox}
      />
      <div className="ds-main-shell">{children}</div>
    </div>
  );
}
