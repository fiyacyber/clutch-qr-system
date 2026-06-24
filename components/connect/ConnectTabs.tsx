import Link from "next/link";

type ConnectTabKey = "builder" | "profile" | "links" | "leads" | "analytics";

interface ConnectTabsProps {
  active: ConnectTabKey;
}

const TABS: Array<{ key: ConnectTabKey; label: string; href: string }> = [
  { key: "builder", label: "Builder", href: "/portal/connect/build" },
  { key: "profile", label: "Profile", href: "/portal/connect" },
  { key: "links", label: "Links", href: "/portal/connect/links" },
  { key: "leads", label: "Leads", href: "/portal/connect/leads" },
  { key: "analytics", label: "Analytics", href: "/portal/analytics?tab=clutch-connect" },
];

export default function ConnectTabs({ active }: ConnectTabsProps) {
  return (
    <nav className="connect-tabs" aria-label="Clutch Connect sections">
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} className={`connect-tab${active === tab.key ? " active" : ""}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
