import type { AccountAccess } from "./account-access.ts";
import type { OrderLinkedAccess } from "./order-linked-access.ts";
import { buildBasicCodeAnalytics, type BasicCode, type BasicScan } from "./order-linked-analytics.ts";

type BasicAnalyticsRow = ReturnType<typeof buildBasicCodeAnalytics>;

export type PortalAnalyticsMode<T> =
  | { kind: "full"; data: T; failed: boolean }
  | { kind: "locked" }
  | { kind: "basic"; status: "ready"; rows: BasicAnalyticsRow[] }
  | { kind: "basic"; status: "empty"; rows: [] }
  | { kind: "basic"; status: "error"; rows: []; message: string };

export type PortalAnalyticsDependencies<T> = {
  fetchFull(): Promise<{ data: T; failed?: boolean }>;
  listOwnedCodes(): Promise<{ data: BasicCode[] | null; error?: unknown }>;
  listScans(codeIds: string[]): Promise<{ data: BasicScan[] | null; error?: unknown }>;
  resolveCodeAccess(codeId: string): Promise<OrderLinkedAccess>;
};

export async function resolvePortalAnalyticsMode<T>(input: {
  isAdmin: boolean;
  hasActivePaidSubscription: boolean;
  accountAccess: Pick<AccountAccess, "canUseCampaignAnalytics" | "canUseProfileAnalytics">;
  dependencies: PortalAnalyticsDependencies<T>;
}): Promise<PortalAnalyticsMode<T>> {
  if (input.isAdmin || input.hasActivePaidSubscription) {
    const full = await input.dependencies.fetchFull();
    return { kind: "full", data: full.data, failed: Boolean(full.failed) };
  }
  if (!input.accountAccess.canUseCampaignAnalytics && !input.accountAccess.canUseProfileAnalytics) {
    return { kind: "locked" };
  }

  let candidates: Awaited<ReturnType<typeof input.dependencies.listOwnedCodes>>;
  try {
    candidates = await input.dependencies.listOwnedCodes();
  } catch {
    return { kind: "basic", status: "error", rows: [], message: "Included analytics are temporarily unavailable." };
  }
  if (candidates.error) {
    return { kind: "basic", status: "error", rows: [], message: "Included analytics are temporarily unavailable." };
  }

  try {
    const accessEntries = await Promise.all((candidates.data || []).map(async (code) => ({
      code,
      access: await input.dependencies.resolveCodeAccess(code.id),
    })));
    const activeCodes = accessEntries
      .filter((entry) => entry.access.state === "active_included_access" && entry.access.canViewBasicAnalytics)
      .map((entry) => entry.code);
    if (!activeCodes.length) return { kind: "basic", status: "empty", rows: [] };

    const scans = await input.dependencies.listScans(activeCodes.map((code) => code.id));
    if (scans.error) {
      return { kind: "basic", status: "error", rows: [], message: "Included analytics are temporarily unavailable." };
    }
    return {
      kind: "basic",
      status: "ready",
      rows: activeCodes.map((code) => buildBasicCodeAnalytics(code, scans.data || [])),
    };
  } catch {
    return { kind: "basic", status: "error", rows: [], message: "Included analytics are temporarily unavailable." };
  }
}
