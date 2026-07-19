import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const analyticsPage = fs.readFileSync(new URL("../app/portal/analytics/page.tsx", import.meta.url), "utf8");
const portalPage = fs.readFileSync(new URL("../app/portal/page.tsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../components/dashboard/SidebarNav.tsx", import.meta.url), "utf8");
const ordersPage = fs.readFileSync(new URL("../app/portal/print-orders/page.tsx", import.meta.url), "utf8");
const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const plans = fs.readFileSync(new URL("../lib/plans.ts", import.meta.url), "utf8");
const provisioning = fs.readFileSync(new URL("../lib/shopify-provisioning.ts", import.meta.url), "utf8");

test("verified Clutch customers receive the full analytics dashboard including owned NFC cards", () => {
  assert.match(analyticsPage, /const isClutchCustomer = access\.isAdmin \|\| access\.activeProductLabels\.length > 0/);
  assert.match(analyticsPage, /const hasFullCampaignAnalytics = isClutchCustomer/);
  assert.match(analyticsPage, /\["tracked_print", "business_kit", "smart_card"\]/);
  assert.match(analyticsPage, /access\.hasSmartCard && entry\.code\.qr_type === "smart_card"/);
  assert.match(analyticsPage, /const assetType:[\s\S]*code\.qr_type === "smart_card" \? "NFC Card"/);
  assert.doesNotMatch(analyticsPage, /Basic Analytics/);
});

test("quick actions expose standard customer tools while NFC creation remains coming soon", () => {
  assert.match(portalPage, /nfc: \{ href: "\/portal\/connect", enabled: false, reason: "Coming soon" \}/);
  assert.match(portalPage, /leadForm: \{ href: "\/portal\/connect\/setup", enabled: hasCustomerTools \}/);
  assert.match(sidebar, /nfc: false/);
  assert.match(sidebar, /option\.key === "nfc" \? "Coming soon"/);
  assert.match(sidebar, /leadForm: hasCustomerTools/);
});

test("mobile uses only the raised plus action and the order list is grouped and humanized", () => {
  assert.match(globals, /\.ds-page-header-actions \.unified-dashboard-actions \{[\s\S]*display: none/);
  assert.match(globals, /\.ds-mobile-create \{[\s\S]*bottom: 52px/);
  assert.match(ordersPage, /const groups = new Map<string, PrintOrderItem\[\]>/);
  assert.match(ordersPage, /customer-order-progress/);
  assert.match(ordersPage, /humanize\(item\.material_type/);
  assert.doesNotMatch(ordersPage, /Artwork: \{item\.artwork_status\}/);
});

test("customer-facing plan and onboarding copy no longer uses the Basic product label", () => {
  assert.doesNotMatch(plans, /Clutch Connect Basic|shortName: "Basic"|Basic public profile/);
  assert.doesNotMatch(provisioning, /Clutch Connect Basic/);
});
