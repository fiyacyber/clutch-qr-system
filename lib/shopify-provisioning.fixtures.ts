import { detectPlanFromShopifyPayload } from "@/lib/shopify-provisioning";

type ExpectedPlan = "connect_basic" | "connect_plus" | "qr_pro" | "agency" | null;

type DetectionFixture = {
  name: string;
  payload: Record<string, unknown>;
  expected: ExpectedPlan;
};

// Dev-only fixture matrix for manual verification.
// This file is not executed automatically in production.
export const SHOPIFY_PLAN_DETECTION_FIXTURES: DetectionFixture[] = [
  {
    name: "Smart Business Card",
    payload: { line_items: [{ title: "Smart Business Card" }] },
    expected: "connect_basic",
  },
  {
    name: "NFC Business Card",
    payload: { line_items: [{ title: "NFC Business Card" }] },
    expected: "connect_basic",
  },
  {
    name: "Starter Business Kit",
    payload: { line_items: [{ title: "Starter Business Kit" }] },
    expected: "connect_basic",
  },
  {
    name: "$80 print order with no keywords",
    payload: { total_price: "80.00", line_items: [{ title: "Premium Print Package" }] },
    expected: "connect_basic",
  },
  {
    name: "Clutch Connect+",
    payload: { line_items: [{ title: "Clutch Connect+" }] },
    expected: "connect_plus",
  },
  {
    name: "Connect Plus Subscription",
    payload: { subscription_name: "Connect Plus Subscription" },
    expected: "connect_plus",
  },
  {
    name: "QR Pro",
    payload: { line_items: [{ title: "QR Pro" }] },
    expected: "qr_pro",
  },
  {
    name: "QR Pro 100 QR Codes",
    payload: { line_items: [{ title: "QR Pro 100 QR Codes" }] },
    expected: "qr_pro",
  },
  {
    name: "Agency Plan",
    payload: { plan_name: "Agency Plan" },
    expected: "agency",
  },
  {
    name: "Agency Kit with QR Pro",
    payload: { line_items: [{ title: "Agency Kit with QR Pro" }] },
    expected: "agency",
  },
  {
    name: "Low-value unrelated order",
    payload: { total_price: "12.00", line_items: [{ title: "Sticker Pack" }] },
    expected: null,
  },
];

export function runShopifyPlanDetectionFixtureCheck() {
  return SHOPIFY_PLAN_DETECTION_FIXTURES.map((fixture) => {
    const actual = detectPlanFromShopifyPayload(fixture.payload);
    return {
      name: fixture.name,
      expected: fixture.expected,
      actual,
      passed: actual === fixture.expected,
    };
  });
}
