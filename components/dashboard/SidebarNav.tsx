"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Globe,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Monitor,
  QrCode,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

interface SidebarNavProps {
  isAdmin?: boolean;
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  match: (pathname: string, tab: string | null) => boolean;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/portal",
    icon: LayoutDashboard,
    match: (pathname, tab) => pathname === "/portal" || (pathname === "/portal/analytics" && (!tab || tab === "overview")),
  },
  {
    label: "QR Codes",
    href: "/portal/analytics?tab=qr-codes",
    icon: QrCode,
    match: (pathname, tab) => pathname === "/portal/analytics" && tab === "qr-codes",
  },
  {
    label: "Clutch Connect",
    href: "/portal/connect",
    icon: Link2,
    match: (pathname) => pathname.startsWith("/portal/connect") || pathname.startsWith("/clutch-connect"),
  },
  {
    label: "Create QR",
    href: "/portal/create",
    icon: QrCode,
    match: (pathname) => pathname === "/portal/create" || pathname === "/create",
  },
  {
    label: "Analytics",
    href: "/portal/analytics",
    icon: BarChart3,
    match: (pathname, tab) => pathname === "/portal/analytics" && (!tab || tab === "analytics" || tab === "overview"),
  },
  {
    label: "Geography",
    href: "/portal/analytics?tab=geography",
    icon: Globe,
    match: (pathname, tab) => pathname === "/portal/analytics" && tab === "geography",
  },
  {
    label: "Devices",
    href: "/portal/analytics?tab=devices",
    icon: Monitor,
    match: (pathname, tab) => pathname === "/portal/analytics" && tab === "devices",
  },
  {
    label: "Activity Heatmap",
    href: "/portal/analytics?tab=activity-heatmap",
    icon: Activity,
    match: (pathname, tab) => pathname === "/portal/analytics" && (tab === "activity-heatmap" || tab === "activity"),
  },
  {
    label: "Leads",
    href: "/portal/analytics?tab=leads",
    icon: Users,
    match: (pathname, tab) => pathname === "/portal/analytics" && tab === "leads",
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
    href: "/portal/analytics?tab=settings",
    icon: Settings,
    match: (pathname, tab) => pathname === "/portal/analytics" && tab === "settings",
  },
];

function SidebarList({ isAdmin, onNavigate }: { isAdmin?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <>
      <div className="ds-logo-wrap">
        <div className="ds-logo-mark">C</div>
        <span className="ds-logo-word">LUTCH</span>
      </div>

      <nav className="ds-sidebar-nav" aria-label="Primary">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const active = item.match(pathname, tab);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`ds-nav-item${active ? " is-active" : ""}`}
                onClick={onNavigate}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{item.label}</span>
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

export default function SidebarNav({ isAdmin }: SidebarNavProps) {
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
        <SidebarList isAdmin={isAdmin} />
      </aside>

      {mobileOpen ? <div className="ds-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`ds-sidebar mobile${mobileOpen ? " open" : ""}`} aria-label="Mobile dashboard sidebar">
        <div className="ds-mobile-head">
          <span>Navigation</span>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>
        <SidebarList isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
