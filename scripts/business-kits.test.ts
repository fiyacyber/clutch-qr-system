import assert from "node:assert/strict";
import test from "node:test";
import {
  customerFacingCodeSource,
  groupBusinessKitItems,
  isBusinessKitItem,
  type BusinessKitItem,
} from "../lib/business-kits.ts";

function item(overrides: Partial<BusinessKitItem> = {}): BusinessKitItem {
  return {
    id: "item-1",
    shopify_order_id: "1001",
    shopify_order_number: "#1001",
    product_title: "500 Business Cards",
    material_type: "business_card",
    quantity: 500,
    tracking_mode: "new_included_code",
    artwork_status: "approved",
    proof_status: "approved",
    production_status: "ready",
    fulfillment_status: "unfulfilled",
    provisioning_status: "completed",
    created_at: "2026-07-13T00:00:00.000Z",
    normalized_properties: null,
    source_type: null,
    ...overrides,
  };
}

test("explicit Business Kit provisioning is trusted ownership evidence", () => {
  assert.equal(isBusinessKitItem(item({ source_type: "business_kit" })), true);
});

test("normalized merchant kit metadata groups related line items", () => {
  const first = item({
    id: "cards",
    normalized_properties: { business_kit_id: "kit-77", business_kit_name: "Starter Business Kit" },
  });
  const second = item({
    id: "flyers",
    product_title: "250 Flyers",
    material_type: "flyer",
    artwork_status: "not_received",
    provisioning_status: "pending",
    normalized_properties: { business_kit_id: "kit-77", business_kit_name: "Starter Business Kit" },
  });

  const groups = groupBusinessKitItems([first, second]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "kit-77");
  assert.equal(groups[0].name, "Starter Business Kit");
  assert.equal(groups[0].itemCount, 2);
  assert.equal(groups[0].readyCount, 1);
  assert.equal(groups[0].trackedCount, 2);
  assert.equal(groups[0].progressPercent, 50);
});

test("ordinary print orders are not mislabeled as Business Kits", () => {
  const groups = groupBusinessKitItems([item()]);
  assert.deepEqual(groups, []);
});

test("kit-like order titles provide compatibility evidence for historic orders", () => {
  assert.equal(isBusinessKitItem(item({ product_title: "Starter Business Kit" })), true);
  assert.equal(isBusinessKitItem(item({ variant_title: "Agency Kit Bundle" })), true);
});

test("customer-facing code source labels hide internal entitlement terminology", () => {
  assert.equal(customerFacingCodeSource({ source_type: "business_kit" }), "Business Kit");
  assert.equal(customerFacingCodeSource({ capacity_source: "included_print" }), "Print order");
  assert.equal(customerFacingCodeSource({ print_order_item_id: "print-1" }), "Print order");
  assert.equal(customerFacingCodeSource({ capacity_source: "subscription" }), "Clutch Codes subscription");
});
