import Link from "next/link";

type ConnectTabKey = "builder" | "profile" | "leads" | "analytics";

interface ConnectTabsProps {
  active: ConnectTabKey;
  showBuilder?: boolean;
  showAnalytics?: boolean;
  analyticsLocked?: boolean;
  analyticsLockedMode?: "badge" | "inline" | "hide";
}

const TABS: Array<{ key: ConnectTabKey; label: string; href: string }> = [
  { key: "builder", label: "Builder", href: "/portal/connect/build" },
  { key: "profile", label: "Overview", href: "/portal/connect" },
  { key: "leads", label: "Leads", href: "/portal/connect/leads" },
  { key: "analytics", label: "Analytics", href: "/portal/analytics?tab=clutch-connect" },
];

export default function ConnectTabs({
  active,
  showBuilder = true,
  showAnalytics = true,
  analyticsLocked = false,
  analyticsLockedMode = "badge",
}: ConnectTabsProps) {
  const visibleTabs = (showBuilder ? TABS : TABS.filter((tab) => tab.key !== "builder")).filter((tab) => {
    if (tab.key === "analytics" && !showAnalytics) return false;
    if (tab.key === "analytics" && analyticsLocked && analyticsLockedMode === "hide") return false;
    return true;
  });

  return (
    <nav className="connect-tabs" aria-label="Clutch Connect sections">
      {visibleTabs.map((tab) => {
        const isLockedAnalytics = tab.key === "analytics" && analyticsLocked;
        const tabLabel = isLockedAnalytics && analyticsLockedMode === "inline"
          ? "Analytics · Connect+"
          : tab.label;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`connect-tab${active === tab.key ? " active" : ""}${isLockedAnalytics ? " locked" : ""}`}
          >
            {tabLabel}
            {isLockedAnalytics && analyticsLockedMode === "badge" ? <span className="connect-tab-lock">Connect+</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
