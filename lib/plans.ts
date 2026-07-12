export type LegacyPlanCode = "free_qr" | "qr_pro_plus";
export type CanonicalPlanCode = "connect_basic" | "connect_plus" | "qr_pro" | "agency" | "admin";
export type PlanCode = "free_qr" | "qr_pro" | "qr_pro_plus" | "admin";
export type SupportedPlanCode = CanonicalPlanCode | LegacyPlanCode;
export type SubscriptionStatus = "active" | "cancelled" | "canceled" | "past_due" | "unpaid";

export type EntitlementKey =
  | "basicProfile"
  | "basicLeadInbox"
  | "advancedBuilder"
  | "premiumThemes"
  | "customBannerUpload"
  | "customForms"
  | "advancedLeadInbox"
  | "leadStatuses"
  | "heatmapAnalytics"
  | "sourceTracking"
  | "removeBranding"
  | "dynamicQr"
  | "qrCustomization"
  | "qrLogoUpload"
  | "qrExports"
  | "campaignAnalytics"
  | "csvReports"
  | "pdfReports"
  | "clientReporting"
  | "highVolume"
  | "internalAdmin";

export type PlanEntitlements = Record<EntitlementKey, boolean>;

export type PlanDefinition = {
  code: SupportedPlanCode;
  name: string;
  shortName: string;
  price: string;
  profileLimit: number | null;
  qrLimit: number;
  description: string;
  checkoutUrl: string;
  features: string[];
  advancedAnalytics: boolean;
  csvReports: boolean;
  pdfReports: boolean;
  entitlements: PlanEntitlements;
};

type CustomerPlanShape = {
  is_admin?: boolean | null;
  plan?: string | null;
  plan_code?: string | null;
  plan_status?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  trial_status?: string | null;
  qr_limit?: number | null;
  included_qr_allowance?: number | null;
  subscription_qr_limit?: number | null;
  clutch_codes_plan_code?: string | null;
  clutch_codes_subscription_status?: string | null;
};

const CONNECT_BASIC_ENTITLEMENTS: PlanEntitlements = {
  basicProfile: true,
  basicLeadInbox: true,
  advancedBuilder: false,
  premiumThemes: false,
  customBannerUpload: false,
  customForms: false,
  advancedLeadInbox: false,
  leadStatuses: false,
  heatmapAnalytics: false,
  sourceTracking: false,
  removeBranding: false,
  dynamicQr: false,
  qrCustomization: false,
  qrLogoUpload: false,
  qrExports: false,
  campaignAnalytics: false,
  csvReports: false,
  pdfReports: false,
  clientReporting: false,
  highVolume: false,
  internalAdmin: false,
};

const CONNECT_PLUS_ENTITLEMENTS: PlanEntitlements = {
  ...CONNECT_BASIC_ENTITLEMENTS,
  advancedBuilder: true,
  premiumThemes: true,
  customBannerUpload: true,
  customForms: true,
  advancedLeadInbox: true,
  leadStatuses: true,
  heatmapAnalytics: true,
  sourceTracking: true,
  removeBranding: true,
  csvReports: true,
};

const QR_PRO_ENTITLEMENTS: PlanEntitlements = {
  ...CONNECT_PLUS_ENTITLEMENTS,
  dynamicQr: true,
  qrCustomization: true,
  qrLogoUpload: true,
  qrExports: true,
  campaignAnalytics: true,
};

const AGENCY_ENTITLEMENTS: PlanEntitlements = {
  ...QR_PRO_ENTITLEMENTS,
  pdfReports: true,
  clientReporting: true,
  highVolume: true,
};

const ADMIN_ENTITLEMENTS: PlanEntitlements = {
  basicProfile: true,
  basicLeadInbox: true,
  advancedBuilder: true,
  premiumThemes: true,
  customBannerUpload: true,
  customForms: true,
  advancedLeadInbox: true,
  leadStatuses: true,
  heatmapAnalytics: true,
  sourceTracking: true,
  removeBranding: true,
  dynamicQr: true,
  qrCustomization: true,
  qrLogoUpload: true,
  qrExports: true,
  campaignAnalytics: true,
  csvReports: true,
  pdfReports: true,
  clientReporting: true,
  highVolume: true,
  internalAdmin: true,
};

const CLUTCH_CODES_ENTITLEMENTS: Partial<PlanEntitlements> = {
  dynamicQr: true,
  qrCustomization: true,
  qrLogoUpload: true,
  qrExports: true,
  campaignAnalytics: true,
};

const CANONICAL_PLAN_DEFINITIONS: Record<CanonicalPlanCode, PlanDefinition> = {
  connect_basic: {
    code: "connect_basic",
    name: "Clutch Connect Basic",
    shortName: "Basic",
    price: "Free",
    profileLimit: 1,
    qrLimit: 0,
    description: "Free digital profile for NFC cards, QR codes, and social bios.",
    checkoutUrl: "https://qr.clutchprintshop.com/login",
    features: [
      "1 profile",
      "Basic public profile and contact actions",
      "Lead Inbox starter capture",
      "No dynamic QR campaigns",
    ],
    advancedAnalytics: false,
    csvReports: false,
    pdfReports: false,
    entitlements: CONNECT_BASIC_ENTITLEMENTS,
  },
  connect_plus: {
    code: "connect_plus",
    name: "Clutch Connect+",
    shortName: "Connect+",
    price: "$9.99/month",
    profileLimit: 1,
    qrLimit: 0,
    description: "Advanced profile customization, lead capture, and profile analytics.",
    checkoutUrl:
      process.env.NEXT_PUBLIC_CONNECT_PLUS_CHECKOUT_URL ||
      "https://www.clutchprintshop.com/products/clutch-connect-plus",
    features: [
      "Everything in Clutch Connect Basic",
      "Advanced Builder and premium themes",
      "Custom banner uploads and form controls",
      "Lead statuses and source tracking",
      "CSV exports",
      "No dynamic QR campaigns",
    ],
    advancedAnalytics: true,
    csvReports: true,
    pdfReports: false,
    entitlements: CONNECT_PLUS_ENTITLEMENTS,
  },
  qr_pro: {
    code: "qr_pro",
    name: "QR Pro",
    shortName: "QR Pro",
    price: "$14.99/month",
    profileLimit: 1,
    qrLimit: 100,
    description: "Dynamic QR campaign tracking for print and marketing.",
    checkoutUrl:
      process.env.NEXT_PUBLIC_QR_PRO_CHECKOUT_URL ||
      "https://www.clutchprintshop.com/products/qr-pro",
    features: [
      "Everything in Clutch Connect+",
      "Up to 100 dynamic QR campaigns",
      "QR styling, logo upload, and exports",
      "Campaign analytics and reporting",
    ],
    advancedAnalytics: true,
    csvReports: true,
    pdfReports: false,
    entitlements: QR_PRO_ENTITLEMENTS,
  },
  agency: {
    code: "agency",
    name: "Agency",
    shortName: "Agency",
    price: "Custom",
    profileLimit: null,
    qrLimit: 250,
    description: "Multi-client, high-volume QR and campaign reporting.",
    checkoutUrl:
      process.env.NEXT_PUBLIC_AGENCY_INQUIRY_URL ||
      "https://www.clutchprintshop.com/pages/agency",
    features: [
      "Everything in QR Pro",
      "Up to 250 dynamic QR campaigns",
      "Client reporting and PDF exports",
      "High-volume operations support",
    ],
    advancedAnalytics: true,
    csvReports: true,
    pdfReports: true,
    entitlements: AGENCY_ENTITLEMENTS,
  },
  admin: {
    code: "admin",
    name: "Admin",
    shortName: "Admin",
    price: "Internal",
    profileLimit: null,
    qrLimit: Number.MAX_SAFE_INTEGER,
    description: "Internal Clutch account with unrestricted plan feature access.",
    checkoutUrl: "/admin",
    features: ["All Clutch Connect and QR Pro features", "Internal customer management", "Unrestricted access"],
    advancedAnalytics: true,
    csvReports: true,
    pdfReports: true,
    entitlements: ADMIN_ENTITLEMENTS,
  },
};

export const PLAN_DEFINITIONS: Record<SupportedPlanCode, PlanDefinition> = {
  ...CANONICAL_PLAN_DEFINITIONS,
  // Legacy aliases preserved for backward compatibility during phased migration.
  free_qr: CANONICAL_PLAN_DEFINITIONS.connect_basic,
  qr_pro_plus: CANONICAL_PLAN_DEFINITIONS.agency,
};

function normalizeCanonicalPlanCode(planCode?: string | null): CanonicalPlanCode {
  const normalized = String(planCode || "").trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "free_qr" || normalized === "connect_basic") return "connect_basic";
  if (normalized === "connect_plus") return "connect_plus";
  if (normalized === "qr_pro") return "qr_pro";
  if (normalized === "qr_pro_plus" || normalized === "agency") return "agency";
  return "connect_basic";
}

export function normalizePlanCode(planCode?: string | null): PlanCode {
  // Runtime always normalizes to canonical plan codes. Return type remains legacy-compatible during migration.
  return normalizeCanonicalPlanCode(planCode) as PlanCode;
}

export function getPlanDefinition(planCode?: string | null): PlanDefinition {
  return CANONICAL_PLAN_DEFINITIONS[normalizeCanonicalPlanCode(planCode)];
}

export function getCustomerPlan(customer?: CustomerPlanShape | null) {
  if (customer?.is_admin) return getPlanDefinition("admin");

  if (customer?.plan_code || customer?.plan) {
    return getPlanDefinition(customer.plan_code || customer.plan);
  }

  const storedLimit = Number(customer?.qr_limit || 0);
  if (storedLimit >= CANONICAL_PLAN_DEFINITIONS.agency.qrLimit) {
    return CANONICAL_PLAN_DEFINITIONS.agency;
  }
  if (storedLimit >= CANONICAL_PLAN_DEFINITIONS.qr_pro.qrLimit) {
    return CANONICAL_PLAN_DEFINITIONS.qr_pro;
  }

  return CANONICAL_PLAN_DEFINITIONS.connect_basic;
}

export function getEffectiveQrLimit(customer?: CustomerPlanShape | null) {
  const plan = getCustomerPlan(customer);
  const storedLimit = Number(customer?.qr_limit || 0);
  if (plan.code === "admin") return Math.max(plan.qrLimit, storedLimit || 0);

  const included = customer?.included_qr_allowance;
  const subscription = customer?.subscription_qr_limit;
  if (included !== null && included !== undefined && subscription !== null && subscription !== undefined) {
    return Math.max(0, Number(included) || 0) + Math.max(0, Number(subscription) || 0);
  }

  // Compatibility fallback for deployments that have not applied the allowance migration yet.
  return storedLimit || plan.qrLimit;
}

export function getPlanEntitlements(customer?: CustomerPlanShape | null): PlanEntitlements {
  const base = getCustomerPlan(customer).entitlements;
  if (!customer?.clutch_codes_plan_code || customer.clutch_codes_subscription_status !== "active") {
    return base;
  }

  return Object.entries(CLUTCH_CODES_ENTITLEMENTS).reduce(
    (entitlements, [key, enabled]) => ({ ...entitlements, [key]: enabled }),
    { ...base }
  );
}

export function hasEntitlement(customer: CustomerPlanShape | null | undefined, entitlementKey: EntitlementKey): boolean {
  return getPlanEntitlements(customer)[entitlementKey] === true;
}

export function isQrPlan(customer?: CustomerPlanShape | null) {
  const code = getCustomerPlan(customer).code;
  return (
    code === "qr_pro" ||
    code === "agency" ||
    code === "admin" ||
    (Boolean(customer?.clutch_codes_plan_code) && customer?.clutch_codes_subscription_status === "active")
  );
}

export function isConnectPlusOrHigher(customer?: CustomerPlanShape | null) {
  const code = getCustomerPlan(customer).code;
  return code === "connect_plus" || code === "qr_pro" || code === "agency" || code === "admin";
}

export function isAgencyOrHigher(customer?: CustomerPlanShape | null) {
  const code = getCustomerPlan(customer).code;
  return code === "agency" || code === "admin";
}

export function isAdvancedAnalyticsUnlocked(customer?: CustomerPlanShape | null) {
  return hasEntitlement(customer, "heatmapAnalytics") && !isCustomerSubscriptionLocked(customer);
}

export function isAdvancedBuilderUnlocked(customer?: CustomerPlanShape | null) {
  if (!customer) return false;
  if (customer.is_admin) return true;

  if (!hasEntitlement(customer, "advancedBuilder")) return false;

  return !isCustomerSubscriptionLocked(customer);
}

export function getAdvancedBuilderLockMessage(customer?: CustomerPlanShape | null) {
  if (!customer) return "Advanced Builder is available on Clutch Connect+ and higher plans.";
  if (customer.is_admin) return "";

  if (!hasEntitlement(customer, "advancedBuilder")) {
    return "Advanced Builder is a Clutch Connect+ feature. Finish Guided Setup now, then upgrade when you are ready for full block customization.";
  }

  if (isCustomerSubscriptionLocked(customer)) {
    const subscriptionMessage = getSubscriptionLockMessage(customer);
    return subscriptionMessage || "Your subscription is locked. Update billing to use Advanced Builder.";
  }

  return "";
}

export function getCustomerSubscriptionStatus(customer?: CustomerPlanShape | null) {
  return String(customer?.subscription_status || customer?.plan_status || "active").toLowerCase();
}

export function getCustomerTrialStatus(customer?: CustomerPlanShape | null) {
  return String(customer?.trial_status || "none").toLowerCase();
}

export function isCustomerTrialExpired(customer?: CustomerPlanShape | null) {
  if (!customer || customer.is_admin) return false;

  const trialStatus = getCustomerTrialStatus(customer);
  if (trialStatus === "converted" || trialStatus === "cancelled" || trialStatus === "none") return false;
  if (trialStatus === "expired") return true;
  if (!customer.trial_ends_at) return false;

  const trialEndsAt = new Date(customer.trial_ends_at).getTime();
  return Number.isFinite(trialEndsAt) && trialEndsAt <= Date.now();
}

export function isCustomerSubscriptionLocked(customer?: CustomerPlanShape | null) {
  if (!customer || customer.is_admin) return false;

  const plan = getCustomerPlan(customer);
  if (plan.code === "connect_basic") return false;

  if (isCustomerTrialExpired(customer)) return true;

  return ["cancelled", "canceled", "past_due", "unpaid"].includes(
    getCustomerSubscriptionStatus(customer)
  );
}

export function getSubscriptionLockMessage(customer?: CustomerPlanShape | null) {
  if (isCustomerTrialExpired(customer)) {
    return "Your Clutch Connect trial has ended. Choose Clutch Connect+ or QR Pro to continue using paid features.";
  }

  const status = getCustomerSubscriptionStatus(customer);

  if (status === "past_due" || status === "unpaid") {
    return "Your Clutch Connect or QR Pro subscription needs billing attention. Paid features are locked until billing is current.";
  }

  if (status === "cancelled" || status === "canceled") {
    return "This Clutch Connect or QR Pro subscription is cancelled. Existing data is preserved, but paid features are locked.";
  }

  return "";
}
