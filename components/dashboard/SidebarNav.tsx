"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ContactRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  ShoppingBag,
} from "lucide-react";
import type { DashboardNavVariant } from "@/components/dashboard/DashboardShell";
import type { AccountAccess } from "@/lib/account-access";

interface SidebarNavProps {
  accountAccess?: AccountAccess;
  isAdmin?: boolean;
  navLocks?: { qr?: boolean; analytics?: boolean; heatmap?: boolean };
  navVariant?: DashboardNavVariant;
  showGuidedSetup?: boolean;
  showLeadInbox?: boolean;
}

type PortalSection = "dashboard" | "marketing" | "contacts" | "orders" | "account";

const primaryItems: Array<{
  key: PortalSection;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard", label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { key: "marketing", label: "Marketing", href: "/portal/qr", icon: Megaphone },
  { key: "contacts", label: "Contacts", href: "/portal/connect/leads", icon: ContactRound },
  { key: "orders", label: "Orders", href: "/portal/print-orders", icon: ShoppingBag },
  { key: "account", label: "Account", href: "/portal/settings", icon: Settings },
];

export function getPortalSection(pathname: string): PortalSection {
  if (pathname.startsWith("/portal/print-orders")) return "orders";
  if (pathname.startsWith("/portal/connect/leads")) return "contacts";
  if (
    pathname.startsWith("/portal/settings") ||
    pathname.startsWith("/portal/subscription") ||
    pathname.startsWith("/portal/pricing")
  ) return "account";
  if (
    pathname.startsWith("/portal/qr") ||
    pathname.startsWith("/portal/create") ||
    pathname.startsWith("/portal/analytics") ||
    pathname.startsWith("/portal/heatmap") ||
    pathname.startsWith("/portal/connect")
  ) return "marketing";
  return "dashboard";
}

function PrimaryNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const activeSection = getPortalSection(pathname);

  return (
    <nav className={mobile ? "ds-bottom-nav" : "ds-sidebar-nav"} aria-label="Primary">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeSection;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`${mobile ? "ds-bottom-nav-item" : "ds-nav-item"}${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={mobile ? 20 : 17} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function SidebarNav({ accountAccess, isAdmin }: SidebarNavProps) {
  const canUseAdmin = accountAccess?.canUseAdmin || isAdmin === true;

  return (
    <>
      <aside className="ds-sidebar desktop" aria-label="Customer portal sidebar">
        <div className="ds-logo-wrap">
          <Image src="/clutch-sidebar-logo.svg" alt="Clutch Codes" className="ds-sidebar-logo" width={180} height={48} priority />
        </div>
        <PrimaryNavigation />
        <div className="ds-sidebar-utilities">
          {canUseAdmin ? (
            <Link href="/admin" className="ds-nav-item">
              <Shield size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Admin tools</span>
            </Link>
          ) : null}
          <form action="/auth/signout" method="get" className="ds-logout-wrap">
            <button type="submit" className="ds-nav-item ds-logout-btn">
              <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Log out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="ds-mobile-brand" aria-hidden="true">
        <Image src="/clutch-sidebar-logo.svg" alt="" width={120} height={34} priority />
      </div>
      <PrimaryNavigation mobile />
    </>
  );
}
