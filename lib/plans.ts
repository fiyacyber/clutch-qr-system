export type PlanCode = "free_qr" | "qr_pro" | "qr_pro_plus" | "admin";
export type SubscriptionStatus = "active" | "cancelled" | "canceled" | "past_due" | "unpaid";

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  shortName: string;
  price: string;
  qrLimit: number;
  description: string;
  checkoutUrl: string;
  features: string[];
  advancedAnalytics: boolean;
  csvReports: boolean;
  pdfReports: boolean;
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
};

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  free_qr: {
    code: "free_qr",
    name: "Clutch Connect Starter",
    shortName: "Starter",
    price: "Included",
    qrLimit: 1,
    description: "Starter Clutch Connect access included with qualifying print orders.",
    checkoutUrl: "https://www.clutchprintshop.com",
    features: [
      "1 dynamic QR campaign",
      "Destination editing",
      "PNG, SVG, JPEG, and PDF exports",
      "Basic scan tracking",
      "Upgrade anytime for more campaigns",
    ],
    advancedAnalytics: false,
    csvReports: false,
    pdfReports: false,
  },
  qr_pro: {
    code: "qr_pro",
    name: "Clutch Connect",
    shortName: "Connect",
    price: "$14.99/month",
    qrLimit: 10,
    description: "Trackable QR and NFC campaign tools for print marketing and smart business cards.",
    checkoutUrl:
      process.env.NEXT_PUBLIC_QR_PRO_CHECKOUT_URL ||
      "https://www.clutchprintshop.com/products/qr-pro",
    features: [
      "Up to 10 dynamic QR campaigns",
      "Destination editing",
      "QR color customization",
      "Logo upload",
      "PNG, SVG, JPEG, and PDF exports",
      "Total scans and scans by campaign",
      "Basic source and device insights",
    ],
    advancedAnalytics: false,
    csvReports: false,
    pdfReports: false,
  },
  qr_pro_plus: {
    code: "qr_pro_plus",
    name: "Clutch Connect Agency",
    shortName: "Agency",
    price: "$30/month",
    qrLimit: 60,
    description: "Advanced reporting and higher campaign limits for growing teams and agencies.",
    checkoutUrl:
      process.env.NEXT_PUBLIC_QR_PRO_PLUS_CHECKOUT_URL ||
      "https://www.clutchprintshop.com/products/qr-pro-plus",
    features: [
      "Up to 60 dynamic QR campaigns",
      "Everything in Clutch Connect",
      "Advanced analytics placeholders",
      "Campaign comparison",
      "Best performing campaigns",
      "Custom date range filters",
      "CSV and PDF report exports",
      "Agency and multi-location reporting",
    ],
    advancedAnalytics: true,
    csvReports: true,
    pdfReports: true,
  },
  admin: {
    code: "admin",
    name: "Admin",
    shortName: "Admin",
    price: "Internal",
    qrLimit: Number.MAX_SAFE_INTEGER,
    description: "Internal Clutch account with unrestricted plan feature access.",
    checkoutUrl: "/admin",
    features: ["All Clutch Connect features", "All Clutch Connect Agency features", "Internal customer management"],
    advancedAnalytics: true,
    csvReports: true,
    pdfReports: true,
  },
};

export function normalizePlanCode(planCode?: string | null): PlanCode {
  if (planCode === "free_qr") return "free_qr";
  if (planCode === "qr_pro_plus" || planCode === "admin") return planCode;
  return "qr_pro";
}

export function getCustomerPlan(customer?: CustomerPlanShape | null) {
  if (customer?.is_admin) return PLAN_DEFINITIONS.admin;

  const explicitPlan = normalizePlanCode(customer?.plan_code || customer?.plan);
  if (explicitPlan === "free_qr") return PLAN_DEFINITIONS.free_qr;
  if (explicitPlan === "qr_pro_plus") return PLAN_DEFINITIONS.qr_pro_plus;

  if (!customer?.plan_code && !customer?.plan && Number(customer?.qr_limit || 0) >= PLAN_DEFINITIONS.qr_pro_plus.qrLimit) {
    return PLAN_DEFINITIONS.qr_pro_plus;
  }

  return PLAN_DEFINITIONS.qr_pro;
}

export function getEffectiveQrLimit(customer?: CustomerPlanShape | null) {
  const plan = getCustomerPlan(customer);
  if (plan.code === "admin") return plan.qrLimit;

  const storedLimit = Number(customer?.qr_limit || 0);
  return storedLimit > 0 ? storedLimit : plan.qrLimit;
}

export function isAdvancedAnalyticsUnlocked(customer?: CustomerPlanShape | null) {
  return getCustomerPlan(customer).advancedAnalytics && !isCustomerSubscriptionLocked(customer);
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

  if (isCustomerTrialExpired(customer)) return true;

  const plan = getCustomerPlan(customer);
  if (plan.code === "free_qr") return false;

  return ["cancelled", "canceled", "past_due", "unpaid"].includes(
    getCustomerSubscriptionStatus(customer)
  );
}

export function getSubscriptionLockMessage(customer?: CustomerPlanShape | null) {
  if (isCustomerTrialExpired(customer)) {
    return "Your 30-day Clutch Connect trial has ended. Choose a monthly plan to continue creating and managing paid campaigns.";
  }

  const status = getCustomerSubscriptionStatus(customer);

  if (status === "past_due" || status === "unpaid") {
    return "Your QR subscription needs billing attention. Paid QR features are locked until billing is current.";
  }

  if (status === "cancelled" || status === "canceled") {
    return "This QR subscription is cancelled. Existing QR codes are preserved, but paid portal features are locked.";
  }

  return "";
}
