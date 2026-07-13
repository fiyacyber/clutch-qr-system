import type { AccountModuleKey } from "./account-access";

type SearchParamsLike = Pick<URLSearchParams, "get">;

export function getActiveAccountModule(
  pathname: string,
  searchParams: SearchParamsLike,
  visibleModules: AccountModuleKey[]
): AccountModuleKey | null {
  const visible = new Set(visibleModules);
  const tab = searchParams.get("tab");
  const section = searchParams.get("section");
  const choose = (...keys: AccountModuleKey[]) => keys.find((key) => visible.has(key)) || null;

  if (pathname.startsWith("/admin")) return choose("admin");
  if (pathname === "/portal/subscription") return choose("subscription");
  if (pathname === "/portal/settings") return choose("settings");
  if (pathname === "/portal/heatmap") return choose("campaign-heatmap");
  if (pathname === "/portal/print-orders" || (pathname === "/portal" && section === "print-orders")) return choose("print-orders");
  if (pathname === "/portal/qr" || pathname.startsWith("/portal/qr/")) return choose("qr-codes");
  if (pathname === "/portal/analytics") {
    return tab === "profile" ? choose("profile-analytics") : choose("campaign-analytics");
  }
  if (pathname.startsWith("/portal/connect/setup") || pathname.startsWith("/setup/guided")) return choose("guided-setup");
  if (pathname.startsWith("/portal/connect/build")) return choose("profile-builder");
  if (pathname.startsWith("/portal/connect/leads")) return choose("lead-inbox");
  if (pathname.startsWith("/portal/connect")) return choose("smart-card", "clutch-connect");
  if (pathname === "/portal" && !section) return choose("overview");
  return null;
}
