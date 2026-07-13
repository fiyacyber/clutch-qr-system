"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  FileUp,
  Home,
  Layers3,
  PackageCheck,
  Plus,
  QrCode,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { AccountAccess } from "@/lib/account-access";
import styles from "./UnifiedMobileNav.module.css";

function activeClass(pathname: string, href: string) {
  if (href === "/portal") return pathname === href ? styles.active : "";
  return pathname.startsWith(href) ? styles.active : "";
}

export default function UnifiedMobileNav({ accountAccess, isAdmin }: { accountAccess?: AccountAccess; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!accountAccess || isAdmin) return null;

  const showCodes = accountAccess.modules["qr-codes"] !== "hidden";
  const showAnalytics = accountAccess.modules["campaign-analytics"] !== "hidden" || accountAccess.modules["profile-analytics"] !== "hidden";
  const showOrders = accountAccess.modules["print-orders"] !== "hidden";

  return (
    <>
      <nav className={styles.bottomNav} aria-label="Mobile dashboard navigation">
        <Link href="/portal" className={activeClass(pathname, "/portal")}><Home size={20} /><span>Home</span></Link>
        {showCodes ? <Link href="/portal/qr" className={activeClass(pathname, "/portal/qr")}><QrCode size={20} /><span>Codes</span></Link> : <Link href="/portal/connect" className={activeClass(pathname, "/portal/connect")}><UserRound size={20} /><span>Profile</span></Link>}
        <button type="button" className={styles.createButton} onClick={() => setOpen(true)} aria-label="Open create menu"><Plus size={24} /></button>
        {showAnalytics ? <Link href="/portal/analytics" className={activeClass(pathname, "/portal/analytics")}><BarChart3 size={20} /><span>Analytics</span></Link> : <Link href="/portal/business-kits" className={activeClass(pathname, "/portal/business-kits")}><Boxes size={20} /><span>Kits</span></Link>}
        {showOrders ? <Link href="/portal/print-orders" className={activeClass(pathname, "/portal/print-orders")}><PackageCheck size={20} /><span>Orders</span></Link> : <Link href="/portal/settings" className={activeClass(pathname, "/portal/settings")}><Layers3 size={20} /><span>More</span></Link>}
      </nav>

      {open ? <button className={styles.backdrop} aria-label="Close create menu" onClick={() => setOpen(false)} /> : null}
      <section className={`${styles.sheet}${open ? ` ${styles.open}` : ""}`} aria-hidden={!open} aria-label="Create">
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <div><span>Create</span><h2>What do you want to make?</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close create menu"><X size={20} /></button>
        </div>
        <div className={styles.actionList}>
          {accountAccess.canCreateQr ? (
            <Link href="/portal/create"><span className={styles.actionIcon}><QrCode size={22} /></span><span><strong>Create a Clutch Code</strong><small>Build a trackable code for a website, profile, or campaign.</small></span></Link>
          ) : null}
          {accountAccess.canViewPrintOrders ? (
            <Link href="/portal/print-orders"><span className={styles.actionIcon}><FileUp size={22} /></span><span><strong>Upload artwork</strong><small>Continue artwork, proof, or production tasks for a print order.</small></span></Link>
          ) : null}
          {accountAccess.hasBusinessKit ? (
            <Link href="/portal/business-kits"><span className={styles.actionIcon}><Boxes size={22} /></span><span><strong>Continue Business Kit setup</strong><small>Prepare every item, code, proof, and production step.</small></span></Link>
          ) : (
            <a href="https://clutchprintshop.com/pages/business-kits"><span className={styles.actionIcon}><Boxes size={22} /></span><span><strong>Explore Business Kits</strong><small>Launch coordinated print pieces with included tracking.</small></span></a>
          )}
          {accountAccess.hasConnectBasic || accountAccess.hasConnectPlus ? (
            <Link href="/portal/connect/setup"><span className={styles.actionIcon}><Sparkles size={22} /></span><span><strong>Build your Clutch Connect profile</strong><small>Create or update the profile connected to your smart card.</small></span></Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
