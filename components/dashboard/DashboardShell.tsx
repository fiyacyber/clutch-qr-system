"use client";

import SidebarNav from "@/components/dashboard/SidebarNav";
import UnifiedMobileNav from "@/components/dashboard/UnifiedMobileNav";
import type { AccountAccess } from "@/lib/account-access";

export type DashboardNavVariant = "default" | "connect-basic" | "onboarding";

interface DashboardShellProps {
  accountAccess?: AccountAccess;
  isAdmin?: boolean;
  navLocks?: {
    qr?: boolean;
    analytics?: boolean;
    heatmap?: boolean;
  };
  navVariant?: DashboardNavVariant;
  showGuidedSetup?: boolean;
  showLeadInbox?: boolean;
  children: React.ReactNode;
}

export default function DashboardShell({
  accountAccess,
  isAdmin,
  navLocks,
  navVariant,
  showGuidedSetup,
  showLeadInbox,
  children,
}: DashboardShellProps) {
  return (
    <div className="ds-app-shell">
      <SidebarNav
        accountAccess={accountAccess}
        isAdmin={isAdmin}
        navLocks={navLocks}
        navVariant={navVariant}
        showGuidedSetup={showGuidedSetup}
        showLeadInbox={showLeadInbox}
      />
      <div className="ds-main-shell">{children}</div>
      <UnifiedMobileNav accountAccess={accountAccess} isAdmin={isAdmin} />
    </div>
  );
}
