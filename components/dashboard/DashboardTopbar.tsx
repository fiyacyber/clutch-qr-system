"use client";

import Link from "next/link";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LogOut,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ClutchCodesWordmark from "@/components/dashboard/ClutchCodesWordmark";
import { getPortalSection } from "@/components/dashboard/SidebarNav";
import styles from "./DashboardTopbar.module.css";

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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const closeAccountMenu = () => setAccountMenuOpen(false);

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

        <div className={styles.accountMenuWrap} ref={accountMenuRef}>
          <button
            type="button"
            className={`ds-topbar-account ${styles.accountTrigger}`}
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
            aria-controls="dashboard-account-menu"
            onClick={() => setAccountMenuOpen((current) => !current)}
          >
            <span>CC</span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`${styles.chevron} ${accountMenuOpen ? styles.chevronOpen : ""}`}
            />
          </button>

          {accountMenuOpen ? (
            <nav
              id="dashboard-account-menu"
              className={styles.accountMenu}
              aria-label="Account actions"
            >
              <div className={styles.accountMenuHeader}>
                <span className={styles.accountAvatar}>CC</span>
                <div>
                  <strong>Clutch account</strong>
                  <span>Manage your workspace</span>
                </div>
              </div>

              <div className={styles.menuDivider} />

              <Link
                href="/portal/settings"
                className={styles.menuItem}
                onClick={closeAccountMenu}
              >
                <Settings size={18} aria-hidden="true" />
                <span className={styles.menuItemText}>
                  <strong>Account settings</strong>
                  <small>Manage your account and company details</small>
                </span>
              </Link>

              <Link
                href="/portal/connect"
                className={styles.menuItem}
                onClick={closeAccountMenu}
              >
                <UserRound size={18} aria-hidden="true" />
                <span className={styles.menuItemText}>
                  <strong>Clutch Connect profile</strong>
                  <small>Build and manage your profile</small>
                </span>
              </Link>

              <Link
                href="/portal/subscription"
                className={styles.menuItem}
                onClick={closeAccountMenu}
              >
                <CreditCard size={18} aria-hidden="true" />
                <span className={styles.menuItemText}>
                  <strong>Plan &amp; billing</strong>
                  <small>Review access and subscription</small>
                </span>
              </Link>

              <a
                href="mailto:info@clutchprintshop.com"
                className={styles.menuItem}
                onClick={closeAccountMenu}
              >
                <CircleHelp size={18} aria-hidden="true" />
                <span className={styles.menuItemText}>
                  <strong>Help &amp; support</strong>
                  <small>Contact Clutch Print Shop</small>
                </span>
              </a>

              <div className={styles.menuDivider} />

              <Link
                href="/auth/signout"
                className={`${styles.menuItem} ${styles.signOut}`}
                onClick={closeAccountMenu}
              >
                <LogOut size={18} aria-hidden="true" />
                <span className={styles.menuItemText}>
                  <strong>Sign out</strong>
                </span>
              </Link>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
