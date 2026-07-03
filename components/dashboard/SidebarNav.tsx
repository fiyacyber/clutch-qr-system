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
  X,
} from "lucide-react";
import { useState } from "react";

interface SidebarNavProps {
  isAdmin?: boolean;
  navLocks?: {
    qr?: boolean;
    analytics?: boolean;
    heatmap?: boolean;
  };
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  match: (pathname: string, tab: string | null) => boolean;
  adminOnly?: boolean;
  lockKey?: "qr" | "analytics" | "heatmap";
};

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/portal",
    icon: LayoutDashboard,
    match: (pathname, tab) => pathname === "/portal" || (pathname === "/portal/analytics" && (!tab || tab === "overview")),
  },
  {
    label: "Campaign Performance",
    href: "/portal/analytics?tab=campaign-performance",
    icon: QrCode,
    match: (pathname, tab) => pathname === "/portal/analytics" && (tab === "campaign-performance" || tab === "qr-codes"),
  },
  {
    label: "Clutch Connect",
    href: "/portal/connect",
    icon: Link2,
    match: (pathname) => pathname.startsWith("/portal/connect") || pathname.startsWith("/clutch-connect"),
  },
  {
    label: "QR Codes",
    href: "/portal/qr",
    icon: QrCode,
    match: (pathname) => pathname === "/portal/qr" || pathname.startsWith("/portal/qr/"),
    lockKey: "qr",
  },
  {
    label: "Analytics",
    href: "/portal/analytics",
    icon: BarChart3,
    match: (pathname) => pathname === "/portal/analytics",
    lockKey: "analytics",
  },
  {
    label: "Heatmap",
    href: "/portal/heatmap",
    icon: Map,
    match: (pathname) => pathname === "/portal/heatmap",
    lockKey: "heatmap",
  },
  {
    label: "Admin",
    href: "/admin",
    icon: Shield,
    match: (pathname) => pathname.startsWith("/admin"),
    adminOnly: true,
  },
  {
    label: "Settings",
    href: "/portal/settings",
    icon: Settings,
    match: (pathname) => pathname === "/portal/settings",
  },
];

function SidebarList({
  isAdmin,
  onNavigate,
  navLocks,
}: {
  isAdmin?: boolean;
  onNavigate?: () => void;
  navLocks?: SidebarNavProps["navLocks"];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <>
      <div className="ds-logo-wrap">
        <img src="/clutch-sidebar-logo.svg" alt="Clutch" className="ds-sidebar-logo" />
      </div>

      <nav className="ds-sidebar-nav" aria-label="Primary">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const active = item.match(pathname, tab);
            const Icon = item.icon;
            const isLocked = item.lockKey ? navLocks?.[item.lockKey] === true : false;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`ds-nav-item${active ? " is-active" : ""}`}
                onClick={onNavigate}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{item.label}</span>
                {isLocked ? <small className="ds-nav-lock-pill">Locked</small> : null}
              </Link>
            );
          })}
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

export default function SidebarNav({ isAdmin, navLocks }: SidebarNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <SidebarList isAdmin={isAdmin} navLocks={navLocks} />
      </aside>

      {mobileOpen ? <div className="ds-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`ds-sidebar mobile${mobileOpen ? " open" : ""}`} aria-label="Mobile dashboard sidebar">
        <div className="ds-mobile-head">
          <span>Navigation</span>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>
        <SidebarList isAdmin={isAdmin} navLocks={navLocks} onNavigate={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
