import type { SupabaseClient } from "@supabase/supabase-js";
import { isEnabledEnvironmentFlag } from "./env-flags.js";

export type OrderLinkedAccessState =
  | "active_included_access"
  | "expired_included_access"
  | "paid_subscription_access"
  | "view_only"
  | "denied"
  | "admin";

export type OrderLinkedAccess = {
  state: OrderLinkedAccessState;
  canView: boolean;
  canEditDestination: boolean;
  canViewBasicAnalytics: boolean;
  canExportBasicAnalytics: boolean;
  canDelete: boolean;
  accessStartedAt: string | null;
  accessExpiresAt: string | null;
};

type ResolverInput = {
  ownsCode: boolean;
  isAdmin?: boolean | null;
  hasActivePaidSubscription?: boolean;
  isOrderLinkedIncludedCode?: boolean;
  provisioningStatus?: string | null;
  accessStartedAt?: string | null;
  accessExpiresAt?: string | null;
  featureEnabled?: boolean;
  legacyOrderLinkedAccess?: boolean;
  now?: Date;
};

const result = (state: OrderLinkedAccessState, input: ResolverInput): OrderLinkedAccess => {
  const manages = ["active_included_access", "paid_subscription_access", "admin"].includes(state);
  return {
    state,
    canView: state !== "denied",
    canEditDestination: manages,
    canViewBasicAnalytics: manages,
    canExportBasicAnalytics: manages,
    canDelete: state === "admin",
    accessStartedAt: input.accessStartedAt || null,
    accessExpiresAt: input.accessExpiresAt || null,
  };
};

export const ORDER_LINKED_ACCESS_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export function parseOrderLinkedDestination(value: unknown) {
  if (typeof value !== "string" || !value || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildIncludedDestinationUpdate(value: unknown) {
  const destination = parseOrderLinkedDestination(value);
  return destination ? { destination_url: destination } : null;
}

function finiteTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function hasActiveClutchCodesSubscription(customer: Record<string, unknown>) {
  return String(customer.clutch_codes_subscription_status || "").trim().toLowerCase() === "active" &&
    ["clutch_codes_starter", "clutch_codes_growth", "clutch_codes_pro"].includes(
      String(customer.clutch_codes_plan_code || "").trim().toLowerCase()
    );
}

export function resolveOrderLinkedAccess(input: ResolverInput): OrderLinkedAccess {
  if (!input.ownsCode) return result("denied", input);
  if (input.isAdmin) return result("admin", input);
  if (input.hasActivePaidSubscription) return result("paid_subscription_access", input);
  if (!input.isOrderLinkedIncludedCode) return result("view_only", input);
  if (!input.featureEnabled) {
    const hasAnyTimedMetadata = input.accessStartedAt != null || input.accessExpiresAt != null;
    return result(!hasAnyTimedMetadata && input.legacyOrderLinkedAccess ? "active_included_access" : "view_only", input);
  }
  if (input.provisioningStatus !== "completed" || !input.accessStartedAt || !input.accessExpiresAt) {
    return result("view_only", input);
  }
  const now = (input.now || new Date()).getTime();
  const started = finiteTimestamp(input.accessStartedAt);
  const expires = finiteTimestamp(input.accessExpiresAt);
  const exactDuration = started !== null && expires !== null && expires - started === ORDER_LINKED_ACCESS_DURATION_MS;
  return result(
    exactDuration && started <= now && now < expires ? "active_included_access" : "expired_included_access",
    input
  );
}

export function orderLinkedAccessFeatureEnabled() {
  return isEnabledEnvironmentFlag(process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS);
}

export async function loadOrderLinkedQrAccess(
  admin: SupabaseClient,
  customer: Record<string, any>,
  qrId: string,
  now = new Date(),
  options: { throwOnError?: boolean } = {}
): Promise<OrderLinkedAccess> {
  const { data: code, error: codeError } = await admin.from("qr_codes")
    .select("id, customer_id, print_order_item_id, capacity_source, customer_can_edit_destination")
    .eq("id", qrId).eq("customer_id", customer.id).limit(1).maybeSingle();
  if (codeError && options.throwOnError) throw codeError;
  if (!code) return resolveOrderLinkedAccess({ ownsCode: false });
  if (!code.print_order_item_id || code.capacity_source !== "included_print") {
    const paid = hasActiveClutchCodesSubscription(customer);
    return resolveOrderLinkedAccess({ ownsCode: true, isAdmin: customer.is_admin, hasActivePaidSubscription: paid });
  }
  const { data: provisioning, error: provisioningError } = await admin.from("print_qr_provisionings")
    .select("access_type, provisioning_status, platform_access_started_at, platform_access_expires_at")
    .eq("qr_code_id", qrId).eq("customer_id", customer.id).limit(1).maybeSingle();
  if (provisioningError && options.throwOnError) throw provisioningError;
  return resolveOrderLinkedAccess({
    ownsCode: true,
    isAdmin: customer.is_admin,
    hasActivePaidSubscription: hasActiveClutchCodesSubscription(customer),
    isOrderLinkedIncludedCode: provisioning?.access_type === "included_permanent",
    provisioningStatus: provisioning?.provisioning_status,
    accessStartedAt: provisioning?.platform_access_started_at,
    accessExpiresAt: provisioning?.platform_access_expires_at,
    featureEnabled: orderLinkedAccessFeatureEnabled(),
    legacyOrderLinkedAccess: code.customer_can_edit_destination === true,
    now,
  });
}
