"use client";

import Link from "next/link";
import { Bell, ChevronDown, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import ClutchCodesWordmark from "@/components/dashboard/ClutchCodesWordmark";
import { getPortalSection } from "@/components/dashboard/SidebarNav";

const sectionLabels = {
  dashboard: "Dashboard",
  marketing: "Marketing",
  contacts: "Contacts",
  orders: "Orders",
  account: "Account",
} as const;

export default function DashboardTopbar() {
  const pathname = usePathname();
  const section = sectionLabels[getPortalSection(pathname)];

  return (
    <header className="ds-topbar">
      <div className="ds-topbar-mobile-brand">
        <ClutchCodesWordmark dark />
      </div>
      <div className="ds-topbar-title">
        <span>Clutch Print Shop</span>
        <strong>{section}</strong>
      </div>
      <div className="ds-topbar-actions">
        <Link href="/portal/create" className="ds-topbar-create">
          <Plus size={17} aria-hidden="true" /> Create New
        </Link>
        <Link href="/portal#actions" className="ds-topbar-icon" aria-label="View notifications and required actions">
          <Bell size={19} aria-hidden="true" />
        </Link>
        <Link href="/portal/settings" className="ds-topbar-account" aria-label="Open account settings">
          <span>CC</span>
          <ChevronDown size={16} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
