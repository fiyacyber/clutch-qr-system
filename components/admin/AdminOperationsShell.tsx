"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Box,
  ChevronDown,
  ClipboardCheck,
  ContactRound,
  CreditCard,
  FileCheck2,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  QrCode,
  Search,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";
import ClutchCodesWordmark from "@/components/dashboard/ClutchCodesWordmark";
import { buildAdminOrderSearchHref } from "@/lib/admin-operations";
import styles from "./AdminOperationsShell.module.css";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  matches?: string[];
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operations",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Orders", href: "/admin/print-orders", icon: ShoppingBag, matches: ["/admin/print-orders", "/admin/card-orders"] },
      { label: "Proofs", href: "/admin/proofs", icon: FileCheck2 },
      { label: "Production", href: "/admin/production", icon: Box },
      { label: "Fulfillment", href: "/admin/fulfillment", icon: Truck },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Clutch Codes", href: "/admin/clutch-codes", icon: QrCode },
      { label: "Connect & Leads", href: "/admin/connect-leads", icon: ContactRound },
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Attention Required", href: "/admin/print-orders?view=attention", icon: AlertTriangle },
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "QA", href: "/admin/qa", icon: FlaskConical },
    ],
  },
];

function isActivePath(pathname: string, item: NavItem, attentionView: boolean) {
  if (item.href === "/admin") return pathname === "/admin";
  if (item.href.includes("view=attention")) return pathname === "/admin/print-orders" && attentionView;
  if (item.href === "/admin/print-orders" && attentionView) return false;
  const paths = item.matches || [item.href.split("?")[0]];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function AdminOperationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const attentionView = searchParams.get("view") === "attention";

  function submitGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    router.push(buildAdminOrderSearchHref(formData.get("q")));
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Admin operations navigation">
        <div className={styles.brand}>
          <ClutchCodesWordmark />
          <span>Admin Operations</span>
        </div>

        <nav className={styles.navigation}>
          {NAV_SECTIONS.map((section) => (
            <div className={styles.navSection} key={section.label}>
              <p>{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item, attentionView);
                return (
                  <Link
                    href={item.href}
                    key={`${section.label}-${item.label}`}
                    className={`${styles.navItem} ${active ? styles.active : ""}`.trim()}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/portal" className={styles.portalLink}>
            <Store size={17} aria-hidden="true" /> Customer Portal
          </Link>
          <span>Desktop operations workspace</span>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <form
            className={styles.search}
            action="/admin/print-orders"
            method="get"
            onSubmit={submitGlobalSearch}
          >
            <Search size={17} aria-hidden="true" />
            <input
              key={searchParams.get("q") || ""}
              name="q"
              type="search"
              defaultValue={searchParams.get("q") || ""}
              placeholder="Search orders or customers"
              aria-label="Search orders or customers"
            />
            <button type="submit" className={styles.searchSubmit}>Search</button>
          </form>
          <div className={styles.topbarActions}>
            <Link href="/portal" className={styles.customerPortalLink}>Customer Portal</Link>
            <details className={styles.accountMenu}>
              <summary>
                <span>AD</span>
                <strong>Admin</strong>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div>
                <Link href="/portal"><Store size={16} /> Customer Portal</Link>
                <Link href="/admin/qa"><ClipboardCheck size={16} /> QA Workspace</Link>
                <form action="/auth/signout" method="get">
                  <button type="submit"><LogOut size={16} /> Log out</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
