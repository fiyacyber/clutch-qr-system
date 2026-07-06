"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Map,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  QrCode,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Suspense, useState } from "react";
import type { DashboardNavVariant } from "@/components/dashboard/DashboardShell";

interface SidebarNavProps {
  isAdmin?: boolean;
  navLocks?: {
    qr?: boolean;
    analytics?: boolean;
    heatmap?: boolean;
  };
  navVariant?: DashboardNavVariant;
  showGuidedSetup?: boolean;
  showLeadInbox?: boolean;
}

type NavItem = {
  key: "overview" | "campaign-performance" | "connect" | "guided-setup" | "lead-inbox" | "qr" | "analytics" | "heatmap" | "admin" | "settings";
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  match: (pathname: string, tab: string | null) => boolean;
  adminOnly?: boolean;
  lockKey?: "qr" | "analytics" | "heatmap";
};

const navItems: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/portal",
    icon: LayoutDashboard,
    match: (pathname) => pathname === "/portal",
  },
  {
    key: "campaign-performance",
    label: "Campaign Performance",
    href: "/portal/analytics?tab=campaign-performance",
    icon: QrCode,
    match: (pathname, tab) => pathname === "/portal/analytics" && tab === "campaign-performance",
  },
  {
    key: "connect",
    label: "Clutch Connect",
    href: "/portal/connect",
    icon: Link2,
    match: (pathname) =>
      pathname === "/portal/connect" ||
      pathname === "/portal/connect/build" ||
      pathname === "/portal/connect/edit" ||
      pathname === "/portal/connect/links" ||
      pathname.startsWith("/clutch-connect"),
  },
  {
    key: "guided-setup",
    label: "Guided Setup",
    href: "/portal/connect/setup",
    icon: Sparkles,
    match: (pathname) => pathname.startsWith("/portal/connect/setup") || pathname.startsWith("/setup/guided"),
  },
  {
    key: "lead-inbox",
    label: "Lead Inbox",
    href: "/portal/connect/leads",
    icon: Users,
    match: (pathname) => pathname.startsWith("/portal/connect/leads"),
  },
  {
    key: "qr",
    label: "QR Codes",
    href: "/portal/qr",
    icon: QrCode,
    match: (pathname) => pathname === "/portal/qr" || pathname.startsWith("/portal/qr/"),
    lockKey: "qr",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/portal/analytics",
    icon: BarChart3,
    match: (pathname, tab) => pathname === "/portal/analytics" && (!tab || tab === "analytics" || tab === "overview"),
    lockKey: "analytics",
  },
  {
    key: "heatmap",
    label: "Heatmap",
    href: "/portal/heatmap",
    icon: Map,
    match: (pathname) => pathname === "/portal/heatmap",
    lockKey: "heatmap",
  },
  {
    key: "admin",
    label: "Admin",
    href: "/admin",
    icon: Shield,
    match: (pathname) => pathname.startsWith("/admin"),
    adminOnly: true,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/portal/settings",
    icon: Settings,
    match: (pathname) => pathname === "/portal/settings",
  },
];

function itemByKey(key: NavItem["key"]): NavItem {
  const item = navItems.find((entry) => entry.key === key);
  if (!item) {
    throw new Error(`Missing nav item: ${key}`);
  }
  return item;
}

function getNavSections({
  navVariant,
  isAdmin,
  showGuidedSetup,
  showLeadInbox,
}: {
  navVariant: DashboardNavVariant;
  isAdmin?: boolean;
  showGuidedSetup?: boolean;
  showLeadInbox?: boolean;
}) {
  const shouldShowGuidedSetup = showGuidedSetup === true;
  const shouldShowLeadInbox = showLeadInbox !== false;
  const guidedSetupKey: NavItem["key"][] = shouldShowGuidedSetup ? ["guided-setup"] : [];
  const leadInboxKey: NavItem["key"][] = shouldShowLeadInbox ? ["lead-inbox"] : [];
  const primaryKeysByVariant: Record<DashboardNavVariant, NavItem["key"][]> = {
    default: ["overview", "campaign-performance", "connect", ...guidedSetupKey, "qr", "analytics", "heatmap", "settings"],
    "connect-basic": ["overview", "connect", ...guidedSetupKey, ...leadInboxKey, "settings"],
    onboarding: ["overview", "connect", ...guidedSetupKey, ...leadInboxKey, "settings"],
  };

  const primary = primaryKeysByVariant[navVariant].map(itemByKey);
  if (isAdmin) {
    primary.splice(primary.length - 1, 0, itemByKey("admin"));
  }

  const secondaryKeys: NavItem["key"][] = ["campaign-performance", "qr", "analytics", "heatmap"];
  const secondary = navVariant === "connect-basic"
    ? secondaryKeys.map(itemByKey)
    : [];

  return { primary, secondary };
}

function SidebarListInner({
  isAdmin,
  onNavigate,
  navLocks,
  navVariant,
  showGuidedSetup,
  showLeadInbox,
}: {
  isAdmin?: boolean;
  onNavigate?: () => void;
  navLocks?: SidebarNavProps["navLocks"];
  navVariant: DashboardNavVariant;
  showGuidedSetup?: boolean;
  showLeadInbox?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const navSections = getNavSections({ navVariant, isAdmin, showGuidedSetup, showLeadInbox });
  const orderedVisibleItems = [...navSections.primary, ...navSections.secondary];
  const activeKey = orderedVisibleItems.find((item) => item.match(pathname, tab))?.key || null;

  function renderItem(item: NavItem, secondary = false) {
    const active = item.key === activeKey;
    const Icon = item.icon;
    const isLocked = item.lockKey ? navLocks?.[item.lockKey] === true : false;

    return (
      <Link
        key={`${secondary ? "secondary" : "primary"}-${item.label}`}
        href={item.href}
        className={`ds-nav-item${secondary ? " is-secondary" : ""}${active ? " is-active" : ""}`}
        onClick={onNavigate}
      >
        <Icon size={16} strokeWidth={1.8} />
        <span>{item.label}</span>
        {isLocked ? <small className="ds-nav-lock-pill">Locked</small> : null}
      </Link>
    );
  }

  return (
    <>
      <div className="ds-logo-wrap">
        <img src="/clutch-sidebar-logo.svg" alt="Clutch" className="ds-sidebar-logo" />
      </div>

      <nav className="ds-sidebar-nav" aria-label="Primary">
        {navSections.primary.map((item) => renderItem(item))}

        {navSections.secondary.length ? (
          <>
            <p className="ds-sidebar-section-label">Upgrade tools</p>
            {navSections.secondary.map((item) => renderItem(item, true))}
          </>
        ) : null}
      </nav>

      <form action="/auth/signout" method="get" className="ds-logout-wrap">
        <button type="submit" className="ds-nav-item ds-logout-btn">
          <LogOut size={16} strokeWidth={1.8} />
          <span>Logout</span>
        </button>
      </form>
    </>
  );
}

function SidebarList(props: {
  isAdmin?: boolean;
  onNavigate?: () => void;
  navLocks?: SidebarNavProps["navLocks"];
  navVariant: DashboardNavVariant;
  showGuidedSetup?: boolean;
  showLeadInbox?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <SidebarListInner {...props} />
    </Suspense>
  );
}

export default function SidebarNav({ isAdmin, navLocks, navVariant, showGuidedSetup, showLeadInbox }: SidebarNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inferredConnectBasic = !isAdmin && navLocks?.qr === true && navLocks?.analytics === true && navLocks?.heatmap === true;
  const resolvedVariant: DashboardNavVariant = navVariant || (inferredConnectBasic ? "connect-basic" : "default");

  return (
    <>
      <button
        type="button"
        className="ds-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <aside className="ds-sidebar desktop" aria-label="Dashboard sidebar">
        <SidebarList
          isAdmin={isAdmin}
          navLocks={navLocks}
          navVariant={resolvedVariant}
          showGuidedSetup={showGuidedSetup}
          showLeadInbox={showLeadInbox}
        />
      </aside>

      {mobileOpen ? <div className="ds-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`ds-sidebar mobile${mobileOpen ? " open" : ""}`} aria-label="Mobile dashboard sidebar">
        <div className="ds-mobile-head">
          <span>Navigation</span>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>
        <SidebarList
          isAdmin={isAdmin}
          navLocks={navLocks}
          navVariant={resolvedVariant}
          showGuidedSetup={showGuidedSetup}
          showLeadInbox={showLeadInbox}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>
    </>
  );
}
