export type DashboardVariant =
  | "no-product"
  | "smart-card"
  | "connect-plus"
  | "clutch-codes"
  | "print-order"
  | "business-kit"
  | "combined"
  | "admin";

export type AccountModuleKey =
  | "overview"
  | "print-orders"
  | "smart-card"
  | "clutch-connect"
  | "guided-setup"
  | "profile-builder"
  | "lead-inbox"
  | "profile-analytics"
  | "qr-codes"
  | "campaign-analytics"
  | "campaign-heatmap"
  | "subscription"
  | "settings"
  | "admin";

export type AccountModuleState = "enabled" | "locked" | "hidden";

export interface AccountAccessCustomer {
  is_admin?: boolean | null;
  plan?: string | null;
  plan_code?: string | null;
  plan_status?: string | null;
  subscription_status?: string | null;
  included_qr_allowance?: number | null;
  subscription_qr_limit?: number | null;
  qr_limit?: number | null;
  clutch_codes_plan_code?: string | null;
  clutch_codes_subscription_status?: string | null;
}

export interface CommerceEvidence {
  hasSmartCardOrder?: boolean;
  hasSmartCardSystemQr?: boolean;
  hasActiveProfile?: boolean;
  hasPrintOrders?: boolean;
  hasTrackedPrint?: boolean;
  hasBusinessKit?: boolean;
  hasIncludedPrintQr?: boolean;
  printOrderCount?: number;
  includedPrintQrCount?: number;
  materialTypes?: string[];
}

export interface AccountAccessInput extends CommerceEvidence {
  customer: AccountAccessCustomer;
  usedQrCount?: number;
}

export interface AccountAccess {
  isAdmin: boolean;
  hasSmartCard: boolean;
  hasConnectBasic: boolean;
  hasConnectPlus: boolean;
  hasClutchCodes: boolean;
  hasTrackedPrint: boolean;
  hasBusinessKit: boolean;
  hasIncludedPrintQr: boolean;
  hasPrintOrders: boolean;
  printOrderCount: number;
  includedPrintQrCount: number;
  materialTypes: string[];
  clutchCodesPlanCode: string | null;
  clutchCodesPlanName: string | null;
  clutchCodesPrice: string | null;
  includedQrAllowance: number;
  subscriptionQrAllowance: number;
  effectiveQrCapacity: number | null;
  usedQrCount: number;
  remainingQrCapacity: number | null;
  canCreateQr: boolean;
  canEditOwnedQr: boolean;
  canCustomizeQr: boolean;
  canUploadQrLogo: boolean;
  canExportQr: boolean;
  canUseCampaignAnalytics: boolean;
  canUseCampaignHeatmap: boolean;
  canUseProfileBuilder: boolean;
  canUseProfileAnalytics: boolean;
  canUseProfileHeatmap: boolean;
  canUseLeadInbox: boolean;
  canViewPrintOrders: boolean;
  canManageSubscription: boolean;
  canUseAdmin: boolean;
  activeProductLabels: string[];
  dashboardVariant: DashboardVariant;
  dashboardTitle: string;
  warnings: string[];
  modules: Record<AccountModuleKey, AccountModuleState>;
}

const CLUTCH_CODES_PLANS: Record<string, { name: string; price: string; allowance: number }> = {
  clutch_codes_starter: { name: "Clutch Codes Starter", price: "$3.99/month", allowance: 10 },
  clutch_codes_growth: { name: "Clutch Codes Growth", price: "$6.99/month", allowance: 30 },
  clutch_codes_pro: { name: "Clutch Codes Pro", price: "$11.99/month", allowance: 100 },
};

function nonnegative(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isActiveStatus(value: unknown, fallback = true): boolean {
  const status = normalized(value);
  if (!status) return fallback;
  return !["cancelled", "canceled", "past_due", "unpaid", "paused", "expired", "inactive"].includes(status);
}

function chooseVariant(flags: Array<[DashboardVariant, boolean]>, isAdmin: boolean): DashboardVariant {
  if (isAdmin) return "admin";
  const owned = flags.filter(([, active]) => active).map(([variant]) => variant);
  if (owned.length === 0) return "no-product";
  if (owned.length > 1) return "combined";
  return owned[0];
}

export function resolveAccountAccess(input: AccountAccessInput): AccountAccess {
  const customer = input.customer || {};
  const warnings: string[] = [];
  const isAdmin = customer.is_admin === true;
  const basePlan = normalized(customer.plan_code || customer.plan);
  const basePlanActive = isActiveStatus(customer.plan_status || customer.subscription_status);
  const hasSmartCard = Boolean(input.hasSmartCardOrder || input.hasSmartCardSystemQr);
  const hasConnectBasic = hasSmartCard || Boolean(input.hasActiveProfile);
  const hasConnectPlus = isAdmin || (basePlanActive && ["connect_plus", "qr_pro", "qr_pro_plus", "agency"].includes(basePlan));
  if (["qr_pro", "qr_pro_plus", "agency"].includes(basePlan)) {
    warnings.push("Legacy combined plan data is being interpreted as Connect+ access until it is normalized.");
  }

  const requestedClutchCodesPlan = normalized(customer.clutch_codes_plan_code);
  const clutchCodesPlan = CLUTCH_CODES_PLANS[requestedClutchCodesPlan] || null;
  const clutchCodesActive = normalized(customer.clutch_codes_subscription_status) === "active";
  const hasClutchCodes = isAdmin || Boolean(clutchCodesPlan && clutchCodesActive);
  if (requestedClutchCodesPlan && !clutchCodesPlan) warnings.push("Unknown Clutch Codes plan code; subscription access is locked.");
  if (clutchCodesPlan && !clutchCodesActive) warnings.push("Clutch Codes subscription is not active; subscription features are locked.");

  const includedQrAllowance = nonnegative(customer.included_qr_allowance);
  const subscriptionQrAllowance = nonnegative(customer.subscription_qr_limit);
  const usedQrCount = nonnegative(input.usedQrCount);
  const effectiveQrCapacity = isAdmin ? null : includedQrAllowance + subscriptionQrAllowance;
  const remainingQrCapacity = isAdmin ? null : Math.max(0, (effectiveQrCapacity ?? 0) - usedQrCount);
  const hasTrackedPrint = Boolean(input.hasTrackedPrint);
  const hasBusinessKit = Boolean(input.hasBusinessKit);
  const hasIncludedPrintQr = Boolean(input.hasIncludedPrintQr && includedQrAllowance > 0);
  const hasPrintOrders = Boolean(input.hasPrintOrders || hasTrackedPrint || hasBusinessKit);
  const ownsOrderLinkedQr = hasTrackedPrint || hasBusinessKit || hasIncludedPrintQr;

  if (includedQrAllowance > 0 && !hasIncludedPrintQr) {
    warnings.push("Included QR allowance exists without verified print-order source evidence.");
  }
  if (hasClutchCodes && clutchCodesPlan && subscriptionQrAllowance !== clutchCodesPlan.allowance) {
    warnings.push(`Stored subscription allowance differs from the canonical ${clutchCodesPlan.name} allowance.`);
  }

  const canCreateQr = isAdmin || (hasClutchCodes && remainingQrCapacity !== 0);
  const canEditOwnedQr = isAdmin || hasClutchCodes || ownsOrderLinkedQr;
  const canUseCampaignAnalytics = isAdmin || hasClutchCodes || ownsOrderLinkedQr;
  const canUseProfileBuilder = isAdmin || hasConnectPlus;
  const canUseProfileAnalytics = isAdmin || hasConnectPlus || hasSmartCard;
  const canUseProfileHeatmap = isAdmin || hasConnectPlus;
  const canUseLeadInbox = isAdmin || hasConnectBasic || hasConnectPlus;
  const activeProductLabels: string[] = [];
  if (isAdmin) {
    activeProductLabels.push("Administrator Access");
  } else {
    if (hasSmartCard) activeProductLabels.push("Smart Business Card");
    if (hasConnectPlus) activeProductLabels.push("Clutch Connect+");
    if (hasClutchCodes && clutchCodesPlan) activeProductLabels.push(clutchCodesPlan.name);
    if (hasTrackedPrint) activeProductLabels.push("Tracked Print");
    if (hasBusinessKit) activeProductLabels.push("Business Kit");
    if (hasIncludedPrintQr && !hasTrackedPrint && !hasBusinessKit) activeProductLabels.push("Included Print QR");
  }

  const dashboardVariant = chooseVariant([
    ["smart-card", hasSmartCard],
    ["connect-plus", hasConnectPlus],
    ["clutch-codes", hasClutchCodes && !isAdmin],
    ["print-order", hasTrackedPrint || (hasIncludedPrintQr && !hasBusinessKit)],
    ["business-kit", hasBusinessKit],
  ], isAdmin);

  const dashboardTitles: Record<DashboardVariant, string> = {
    "no-product": "Account Dashboard",
    "smart-card": "Smart Business Card Dashboard",
    "connect-plus": "Clutch Connect+ Dashboard",
    "clutch-codes": "Clutch Codes Dashboard",
    "print-order": "Print Campaign Dashboard",
    "business-kit": "Business Kit Dashboard",
    combined: "Clutch Dashboard",
    admin: "Admin / Internal experience",
  };

  const modules: Record<AccountModuleKey, AccountModuleState> = {
    overview: "enabled",
    "print-orders": hasPrintOrders || isAdmin ? "enabled" : "hidden",
    "smart-card": hasSmartCard || isAdmin ? "enabled" : "hidden",
    "clutch-connect": hasConnectBasic || hasConnectPlus || isAdmin ? "enabled" : "hidden",
    "guided-setup": hasSmartCard || isAdmin ? "enabled" : "hidden",
    "profile-builder": canUseProfileBuilder ? "enabled" : hasConnectBasic ? "locked" : "hidden",
    "lead-inbox": canUseLeadInbox ? "enabled" : "hidden",
    "profile-analytics": canUseProfileAnalytics ? "enabled" : "hidden",
    "qr-codes": canEditOwnedQr ? "enabled" : hasClutchCodes ? "locked" : "hidden",
    "campaign-analytics": canUseCampaignAnalytics ? "enabled" : "hidden",
    "campaign-heatmap": isAdmin ? "enabled" : hasClutchCodes || ownsOrderLinkedQr ? "locked" : "hidden",
    subscription: hasClutchCodes ? "enabled" : "hidden",
    settings: "enabled",
    admin: isAdmin ? "enabled" : "hidden",
  };

  return {
    isAdmin,
    hasSmartCard,
    hasConnectBasic,
    hasConnectPlus,
    hasClutchCodes,
    hasTrackedPrint,
    hasBusinessKit,
    hasIncludedPrintQr,
    hasPrintOrders,
    printOrderCount: nonnegative(input.printOrderCount),
    includedPrintQrCount: nonnegative(input.includedPrintQrCount),
    materialTypes: Array.from(new Set((input.materialTypes || []).map((value) => String(value).trim()).filter(Boolean))),
    clutchCodesPlanCode: clutchCodesPlan && hasClutchCodes ? requestedClutchCodesPlan : null,
    clutchCodesPlanName: clutchCodesPlan && hasClutchCodes ? clutchCodesPlan.name : null,
    clutchCodesPrice: clutchCodesPlan && hasClutchCodes ? clutchCodesPlan.price : null,
    includedQrAllowance,
    subscriptionQrAllowance,
    effectiveQrCapacity,
    usedQrCount,
    remainingQrCapacity,
    canCreateQr,
    canEditOwnedQr,
    canCustomizeQr: isAdmin || hasClutchCodes,
    canUploadQrLogo: isAdmin || hasClutchCodes,
    canExportQr: canEditOwnedQr,
    canUseCampaignAnalytics,
    canUseCampaignHeatmap: isAdmin,
    canUseProfileBuilder,
    canUseProfileAnalytics,
    canUseProfileHeatmap,
    canUseLeadInbox,
    canViewPrintOrders: isAdmin || hasPrintOrders,
    canManageSubscription: !isAdmin && hasClutchCodes,
    canUseAdmin: isAdmin,
    activeProductLabels,
    dashboardVariant,
    dashboardTitle: dashboardTitles[dashboardVariant],
    warnings,
    modules,
  };
}

export function canAccessAccountModule(access: AccountAccess, module: AccountModuleKey): boolean {
  return access.modules[module] === "enabled";
}

export function isAccountModuleVisible(access: AccountAccess, module: AccountModuleKey): boolean {
  return access.modules[module] !== "hidden";
}

export type AccountAccessAction =
  | "create-qr"
  | "edit-owned-qr"
  | "profile-builder"
  | "admin"
  | "campaign-heatmap";

export function canPerformAccountAction(
  access: AccountAccess,
  action: AccountAccessAction,
  context: { ownsRecord?: boolean } = {}
): boolean {
  switch (action) {
    case "create-qr":
      return access.canCreateQr;
    case "edit-owned-qr":
      return context.ownsRecord === true && access.canEditOwnedQr;
    case "profile-builder":
      return access.canUseProfileBuilder;
    case "admin":
      return access.canUseAdmin;
    case "campaign-heatmap":
      return access.canUseCampaignHeatmap;
  }
}

export const ACCOUNT_MODULE_ROUTES: Partial<Record<AccountModuleKey, string>> = {
  overview: "/portal",
  "print-orders": "/portal/print-orders",
  "smart-card": "/portal/connect",
  "clutch-connect": "/portal/connect",
  "guided-setup": "/portal/connect/setup",
  "profile-builder": "/portal/connect/build",
  "lead-inbox": "/portal/connect/leads",
  "profile-analytics": "/portal/analytics?tab=profile",
  "qr-codes": "/portal/qr",
  "campaign-analytics": "/portal/analytics",
  "campaign-heatmap": "/portal/heatmap",
  subscription: "/portal/subscription",
  settings: "/portal/settings",
  admin: "/admin",
};
