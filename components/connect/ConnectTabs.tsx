import Link from "next/link";

type ConnectTabKey = "builder" | "profile" | "leads" | "analytics";

interface ConnectTabsProps {
  active: ConnectTabKey;
  showBuilder?: boolean;
}

const TABS: Array<{ key: ConnectTabKey; label: string; href: string }> = [
  { key: "builder", label: "Builder", href: "/portal/connect/build" },
  { key: "profile", label: "Overview", href: "/portal/connect" },
  { key: "leads", label: "Leads", href: "/portal/connect/leads" },
  { key: "analytics", label: "Analytics", href: "/portal/analytics?tab=clutch-connect" },
];

export default function ConnectTabs({ active, showBuilder = true }: ConnectTabsProps) {
  const visibleTabs = showBuilder ? TABS : TABS.filter((tab) => tab.key !== "builder");

  return (
    <nav className="connect-tabs" aria-label="Clutch Connect sections">
      {visibleTabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={`connect-tab${active === tab.key ? " active" : ""}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
