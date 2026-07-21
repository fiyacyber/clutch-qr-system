"use client";

import Link from "next/link";
import {
  Bell,
  Camera,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LoaderCircle,
  LogOut,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
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

const ACCOUNT_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_ACCOUNT_AVATAR_SIZE = 2 * 1024 * 1024;

export default function DashboardTopbar() {
  const pathname = usePathname();
  const section = sectionLabels[getPortalSection(pathname)];
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/customer/avatar", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ avatar_url?: string | null }>;
      })
      .then((payload) => {
        if (active && payload?.avatar_url) setAvatarUrl(payload.avatar_url);
      })
      .catch(() => {
        // Keep the initials fallback when the optional account avatar cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, []);

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

  const openAvatarPicker = () => {
    if (avatarUploading) return;
    setAvatarError(null);
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!ACCOUNT_AVATAR_TYPES.has(file.type)) {
      setAvatarError("Use a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_ACCOUNT_AVATAR_SIZE) {
      setAvatarError("Profile photo must be 2MB or smaller.");
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);

    try {
      const form = new FormData();
      form.append("avatar", file);

      const response = await fetch("/api/customer/avatar", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: form,
      });
      const payload = await response.json().catch(() => ({})) as { avatar_url?: string; error?: string };

      if (!response.ok || !payload.avatar_url) {
        throw new Error(payload.error || "Profile photo upload failed.");
      }

      setAvatarUrl(payload.avatar_url);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Profile photo upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const avatarContent = avatarUrl ? (
    <img src={avatarUrl} alt="" className={styles.avatarImage} />
  ) : (
    <span className={styles.avatarInitials}>CC</span>
  );

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
            <span className={styles.triggerAvatar}>{avatarContent}</span>
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
                <button
                  type="button"
                  className={styles.accountAvatarButton}
                  onClick={openAvatarPicker}
                  disabled={avatarUploading}
                  aria-label={avatarUrl ? "Change profile photo" : "Upload profile photo"}
                  title={avatarUrl ? "Change profile photo" : "Upload profile photo"}
                >
                  <span className={styles.accountAvatar}>{avatarContent}</span>
                  <span className={styles.avatarAction} aria-hidden="true">
                    {avatarUploading ? <LoaderCircle size={15} className={styles.avatarSpinner} /> : <Camera size={15} />}
                  </span>
                </button>
                <input
                  ref={avatarInputRef}
                  className={styles.avatarInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  tabIndex={-1}
                />
                <div className={styles.accountMenuCopy}>
                  <strong>Clutch account</strong>
                  <span>{avatarUploading ? "Uploading profile photo..." : "Manage your workspace"}</span>
                  <button type="button" className={styles.changeAvatarButton} onClick={openAvatarPicker} disabled={avatarUploading}>
                    {avatarUrl ? "Change photo" : "Add profile photo"}
                  </button>
                </div>
              </div>

              {avatarError ? <p className={styles.avatarError} role="alert">{avatarError}</p> : null}

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
