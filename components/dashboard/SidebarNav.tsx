"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  CreditCard,
  Home,
  Link2,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  QrCode,
  Settings,
  Shield,
  Sparkles,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import type { DashboardNavVariant } from "@/components/dashboard/DashboardShell";
import type { AccountAccess } from "@/lib/account-access";

interface SidebarNavProps {
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
}

type Item = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  visible?: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  if (href.includes("?")) return pathname === href.split("?")[0];
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ProductNav({ accountAccess, isAdmin, close }: { accountAccess: AccountAccess; isAdmin?: boolean; close?: () => void }) {
  const pathname = usePathname();
  const items: Item[] = [
    { label: "Home", href: "/portal", icon: Home },
    { label: "Clutch Codes", href: "/portal/qr", icon: QrCode, visible: accountAccess.modules["qr-codes"] === "enabled" },
    {
      label: "Analytics",
      href: "/portal/analytics",
      icon: BarChart3,
      visible: accountAccess.modules["campaign-analytics"] === "enabled" || accountAccess.modules["profile-analytics"] === "enabled",
    },
    { label: "Print Orders", href: "/portal/print-orders", icon: PackageCheck, visible: accountAccess.modules["print-orders"] === "enabled" },
    { label: "Business Kits", href: "/portal/business-kits", icon: Boxes, visible: accountAccess.hasBusinessKit },
    { label: "Clutch Connect", href: "/portal/connect", icon: Link2, visible: accountAccess.modules["clutch-connect"] === "enabled" },
    { label: "Guided Setup", href: "/portal/connect/setup", icon: Sparkles, visible: accountAccess.modules["guided-setup"] === "enabled" },
    { label: "Profile Builder", href: "/portal/connect/build", icon: UserRoundCog, visible: accountAccess.modules["profile-builder"] === "enabled" },
    { label: "Lead Inbox", href: "/portal/connect/leads", icon: Users, visible: accountAccess.modules["lead-inbox"] === "enabled" },
    { label: "Subscription", href: "/portal/subscription", icon: CreditCard, visible: accountAccess.modules.subscription === "enabled" },
    { label: "Settings", href: "/portal/settings", icon: Settings },
    { label: "Admin", href: "/admin", icon: Shield, visible: Boolean(isAdmin) },
  ];

  return (
    <>
      <div className="ds-logo-wrap">
        <Image src="/clutch-sidebar-logo.svg" alt="Clutch" className="ds-sidebar-logo" width={180} height={48} priority />
      </div>
      {accountAccess.canCreateQr ? (
        <Link href="/portal/create" className="ds-sidebar-create" onClick={close}>
          <Plus size={18} strokeWidth={2.2} /><span>Create Clutch Code</span>
        </Link>
      ) : null}
      <nav className="ds-sidebar-nav" aria-label="Primary">
        {items.filter((item) => item.visible !== false).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`ds-nav-item${active ? " is-active" : ""}`} onClick={close}>
              <Icon size={17} strokeWidth={1.9} /><span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <form action="/auth/signout" method="get" className="ds-logout-wrap">
        <button type="submit" className="ds-nav-item ds-logout-btn"><LogOut size={17} strokeWidth={1.9} /><span>Logout</span></button>
      </form>
    </>
  );
}

function LegacyNav({ isAdmin, navLocks, navVariant, showGuidedSetup, showLeadInbox, close }: SidebarNavProps & { close?: () => void }) {
  const pathname = usePathname();
  const connectOnly = navVariant === "connect-basic" || navVariant === "onboarding";
  const items: Item[] = [
    { label: "Home", href: "/portal", icon: Home },
    { label: "Clutch Codes", href: "/portal/qr", icon: QrCode, visible: !connectOnly && navLocks?.qr !== true },
    { label: "Analytics", href: "/portal/analytics", icon: BarChart3, visible: !connectOnly && navLocks?.analytics !== true },
    { label: "Clutch Connect", href: "/portal/connect", icon: Link2 },
    { label: "Guided Setup", href: "/portal/connect/setup", icon: Sparkles, visible: showGuidedSetup === true },
    { label: "Lead Inbox", href: "/portal/connect/leads", icon: Users, visible: showLeadInbox !== false && connectOnly },
    { label: "Settings", href: "/portal/settings", icon: Settings },
    { label: "Admin", href: "/admin", icon: Shield, visible: Boolean(isAdmin) },
  ];

  return (
    <>
      <div className="ds-logo-wrap"><Image src="/clutch-sidebar-logo.svg" alt="Clutch" className="ds-sidebar-logo" width={180} height={48} priority /></div>
      {!connectOnly && navLocks?.qr !== true ? <Link href="/portal/create" className="ds-sidebar-create" onClick={close}><Plus size={18} /><span>Create Clutch Code</span></Link> : null}
      <nav className="ds-sidebar-nav" aria-label="Primary">
        {items.filter((item) => item.visible !== false).map((item) => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={`ds-nav-item${isActive(pathname, item.href) ? " is-active" : ""}`} onClick={close}><Icon size={17} strokeWidth={1.9} /><span>{item.label}</span></Link>;
        })}
      </nav>
      <form action="/auth/signout" method="get" className="ds-logout-wrap"><button type="submit" className="ds-nav-item ds-logout-btn"><LogOut size={17} /><span>Logout</span></button></form>
    </>
  );
}

export default function SidebarNav(props: SidebarNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  const content = props.accountAccess
    ? <ProductNav accountAccess={props.accountAccess} isAdmin={props.isAdmin} close={close} />
    : <LegacyNav {...props} close={close} />;

  return (
    <>
      <button type="button" className="ds-mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
      <aside className="ds-sidebar desktop" aria-label="Dashboard sidebar">{content}</aside>
      {mobileOpen ? <button type="button" className="ds-mobile-backdrop" onClick={close} aria-label="Close navigation" /> : null}
      <aside className={`ds-sidebar mobile${mobileOpen ? " open" : ""}`} aria-label="Mobile dashboard sidebar">
        <div className="ds-mobile-head"><span>Navigation</span><button type="button" onClick={close} aria-label="Close navigation"><X size={17} /></button></div>
        {content}
      </aside>
    </>
  );
}
