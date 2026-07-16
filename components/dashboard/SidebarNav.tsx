"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  ContactRound,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Nfc,
  Plus,
  QrCode,
  Settings,
  Shield,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import ClutchCodesWordmark from "@/components/dashboard/ClutchCodesWordmark";
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

export type PortalSection = "dashboard" | "marketing" | "contacts" | "orders" | "account";

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

const createOptions = [
  { key: "clutchCode" as const, label: "Create Clutch Code", description: "Set up a dynamic destination", href: "/portal/create", icon: QrCode },
  { key: "campaign" as const, label: "Start Campaign", description: "Organize connected marketing", href: "/portal/create", icon: Megaphone },
  { key: "nfc" as const, label: "Add NFC Item", description: "Connect a tap-enabled product", href: "/portal/connect", icon: Nfc },
  { key: "leadForm" as const, label: "Create Lead Form", description: "Collect details after a scan", href: "/portal/connect/build", icon: FileText },
  { key: "profile" as const, label: "Set Up Profile", description: "Publish a Clutch Connect profile", href: "/portal/connect/setup", icon: UserRound },
];

function MobileCreateMenu({ accountAccess, onClose }: { accountAccess?: AccountAccess; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const enabled = {
    clutchCode: accountAccess?.canCreateQr ?? false,
    campaign: accountAccess?.canCreateQr ?? false,
    nfc: Boolean(accountAccess?.hasSmartCard || accountAccess?.hasConnectPlus),
    leadForm: accountAccess?.canUseProfileBuilder ?? false,
    profile: Boolean(accountAccess?.hasConnectBasic || accountAccess?.hasConnectPlus),
  };

  return (
    <div className="ds-create-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="ds-create-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-create-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="ds-create-menu-head">
          <div>
            <h2 id="mobile-create-title">Create New</h2>
            <p>Choose what you want to make.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close Create New menu"><X size={19} /></button>
        </div>
        <div className="ds-create-menu-list">
          {createOptions.map((option) => {
            const Icon = option.icon;
            return enabled[option.key] ? (
              <Link key={option.key} href={option.href} onClick={onClose}>
                <span><Icon size={19} aria-hidden="true" /></span>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </Link>
            ) : (
              <div key={option.key} className="is-locked" aria-disabled="true">
                <span><Icon size={19} aria-hidden="true" /></span>
                <span><strong>{option.label}</strong><small>Not included with your current access</small></span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function SidebarNav({ accountAccess, isAdmin }: SidebarNavProps) {
  const canUseAdmin = accountAccess?.canUseAdmin || isAdmin === true;
  const [createOpen, setCreateOpen] = useState(false);
  const used = accountAccess?.usedQrCount ?? 0;
  const capacity = accountAccess?.effectiveQrCapacity;
  const progress = capacity && capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const planName = accountAccess?.clutchCodesPlanName?.replace(/^Clutch Codes\s+/i, "")
    || accountAccess?.activeProductLabels?.[0]
    || (canUseAdmin ? "Administrator" : "Account access");
  const usage = accountAccess
    ? capacity === null
      ? `${used} codes · Unlimited`
      : capacity && capacity > 0
        ? `${used} of ${capacity} codes`
        : "No code allowance"
    : "View account details";

  return (
    <>
      <aside className="ds-sidebar desktop" aria-label="Customer portal sidebar">
        <Link href="/portal" className="ds-logo-wrap"><ClutchCodesWordmark /></Link>
        <PrimaryNavigation />
        <div className="ds-sidebar-utilities">
          <Link href="/portal/settings" className="ds-plan-card">
            <small>Clutch Codes™ plan</small>
            <span><strong>{planName}</strong><em>{usage}</em></span>
            <i aria-hidden="true"><b style={{ width: `${progress}%` }} /></i>
          </Link>
          {canUseAdmin ? (
            <Link href="/admin" className="ds-nav-item">
              <Shield size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Admin tools</span>
            </Link>
          ) : null}
          <Link href="/portal/settings" className="ds-nav-item ds-utility-item">
            <CircleHelp size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>Help center</span>
          </Link>
          <a href="mailto:support@clutchprintshop.com" className="ds-nav-item ds-utility-item">
            <LifeBuoy size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>Support</span>
          </a>
          <form action="/auth/signout" method="get" className="ds-logout-wrap">
            <button type="submit" className="ds-nav-item ds-logout-btn">
              <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Log out</span>
            </button>
          </form>
        </div>
      </aside>

      <PrimaryNavigation mobile />
      <button type="button" className="ds-mobile-create" onClick={() => setCreateOpen(true)} aria-label="Open Create New menu">
        <Plus size={24} aria-hidden="true" />
      </button>
      {createOpen ? <MobileCreateMenu accountAccess={accountAccess} onClose={() => setCreateOpen(false)} /> : null}
    </>
  );
}
