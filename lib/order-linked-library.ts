import type { OrderLinkedAccess } from "./order-linked-access.ts";

export type OwnedQrLibraryCode = {
  id: string;
  customer_id?: string | null;
  is_system?: boolean | null;
  qr_type?: string | null;
  capacity_source?: string | null;
  print_order_item_id?: string | null;
  [key: string]: unknown;
};

export type OwnedQrLibraryEntry = { code: OwnedQrLibraryCode; access: OrderLinkedAccess };

export function visibleLibraryScanCount(code: OwnedQrLibraryCode, access: OrderLinkedAccess) {
  return access.canViewBasicAnalytics ? Math.max(0, Number(code.scan_count) || 0) : 0;
}

export async function resolveOwnedQrLibrary(input: {
  customerId: string;
  hasPaidOrAdminAccess: boolean;
  listOwnedCodes(): Promise<{ data: OwnedQrLibraryCode[] | null; error?: unknown }>;
  resolveCodeAccess(codeId: string): Promise<OrderLinkedAccess>;
}): Promise<{ entries: OwnedQrLibraryEntry[]; failed: boolean }> {
  let result: Awaited<ReturnType<typeof input.listOwnedCodes>>;
  try {
    result = await input.listOwnedCodes();
  } catch {
    return { entries: [], failed: true };
  }
  if (result.error) return { entries: [], failed: true };

  try {
    const resolved = await Promise.all((result.data || [])
      .filter((code) => code.customer_id === input.customerId)
      .map(async (code) => ({ code, access: await input.resolveCodeAccess(code.id) })));
    const entries = resolved.filter(({ code, access }) => {
      const isOrderLinked = code.capacity_source === "included_print" && Boolean(code.print_order_item_id);
      if (isOrderLinked) return access.canView;
      return input.hasPaidOrAdminAccess && code.is_system !== true && access.canView;
    });
    return { entries, failed: false };
  } catch {
    return { entries: [], failed: true };
  }
}
