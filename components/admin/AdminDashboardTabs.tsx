import Link from "next/link";
import styles from "./AdminDashboardTabs.module.css";

type AdminTab = "overview" | "card-orders" | "qa";

const TABS: Array<{ key: AdminTab; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "card-orders", label: "Card Orders", href: "/admin/card-orders" },
  { key: "qa", label: "QA", href: "/admin/qa" },
];

export default function AdminDashboardTabs({ activeTab }: { activeTab: AdminTab }) {
  return (
    <nav className={styles.tabsWrap} aria-label="Admin dashboard sections">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`.trim()}
          aria-current={activeTab === tab.key ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}