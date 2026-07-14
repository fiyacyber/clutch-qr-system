import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { classifyPrintProduct, validatePrintProductRegistry } from "../lib/print-products.ts";
import { normalizePrintLineProperties } from "../lib/print-line-properties.ts";
import { provisionTrackedPrintOrder, type TrackedPrintDependencies } from "../lib/tracked-print.ts";
import { resolveAccountAccess } from "../lib/account-access.ts";
import { buildSafeExistingCustomerLinkagePatch, resolveCustomerIdentityRows } from "../lib/tracked-print-supabase.ts";
import { isEligibleExistingClutchCode, normalizeExistingClutchCodeReference } from "../lib/existing-clutch-code.ts";
import { downloadShopifyArtwork, importShopifyArtwork } from "../lib/shopify-artwork-import.ts";
import { BUSINESS_KIT_COMPONENT_PROPERTY_CONTRACT } from "../lib/business-kit-contracts.ts";

const registry = [{ sku: "POSTCARD-4X6", materialType: "postcard" as const, defaultTrackingAvailable: true }];
const line = (overrides: Record<string, unknown> = {}) => ({ id: "line-1", sku: "POSTCARD-4X6", product_id: "p1", title: "Postcards", quantity: 1, properties: [], ...overrides });
const order = (item = line(), overrides: Record<string, unknown> = {}) => ({ id: "order-1", name: "#1001", email: "buyer@example.com", customer: { id: "customer-1", email: "buyer@example.com" }, line_items: [item], ...overrides });

const businessKitComponents = BUSINESS_KIT_COMPONENT_PROPERTY_CONTRACT.map((component) => ({ ...component }));

function kitContract(productId = "900", sku = "STARTER-KIT", kitType: "starter" | "growth" = "starter") {
  return { productId, sku, kitType, components: businessKitComponents };
}

function kitProperties(modes: Record<string, "new_included_code" | "existing_code" | "none">) {
  return businessKitComponents.flatMap((component, index) => {
    const mode = modes[component.componentId] || "none";
    if (mode === "new_included_code") return [
      { name: component.trackingPropertyName, value: mode },
      { name: component.campaignPropertyName, value: `Campaign ${component.componentId}` },
      { name: component.destinationPropertyName, value: `https://example.com/${component.componentId}` },
    ];
    if (mode === "existing_code") return [
      { name: component.trackingPropertyName, value: mode },
      { name: component.existingCodePropertyName, value: index === 0 ? "owned" : "owned-qr" },
    ];
    return [{ name: component.trackingPropertyName, value: mode }];
  });
}

function harness(options: { existingCustomer?: boolean; rejectExisting?: boolean; identityConflict?: boolean; concurrentConflict?: boolean; importFailure?: boolean } = {}) {
  const items = new Map<string, any>(); const qrs = new Map<string, string>(); const activities = new Set<string>();
  const importedArtwork = new Set<string>(); const provisionInputs: any[] = [];
  let customerResolutions = 0; let authCustomers = 0; let existingCodeResolutions = 0;
  let createdCustomer = false;
  const dependencies: TrackedPrintDependencies = {
    async resolveCustomer() { customerResolutions++; return options.identityConflict ? { status: "conflict" } : options.existingCustomer || createdCustomer ? { status: "found", customer: { id: "customer-db-1", auth_user_id: "auth-1" } } : { status: "not_found" }; },
    async ensureNeutralCustomer() { if (options.concurrentConflict) return { status: "conflict" }; authCustomers++; createdCustomer = true; return { status: "found", customer: { id: "customer-db-1", auth_user_id: "auth-1" } }; },
    async resolveExistingCode(_customerId, reference) { existingCodeResolutions++; return options.rejectExisting ? null : reference === "owned" || reference === "owned-qr" ? "00000000-0000-4000-8000-000000000001" : null; },
    async findPrintItem(orderId, lineItemId) { return items.get(`${orderId}:${lineItemId}`) || null; },
    async upsertPrintItem(input) {
      const key = `${input.shopify_order_id}:${input.shopify_line_item_id}`; const previous = items.get(key);
      if (previous) {
        const keys = [
          "customer_id", "product_id", "variant_id", "sku", "material_type", "quantity",
          "tracking_mode", "destination_url", "existing_qr_code_id", "campaign_name",
          "artwork_method", "artwork_file_url", "artwork_instructions", "reorder_reference",
          "qr_placement_instructions",
        ];
        return { ...previous, immutableMatch: keys.every((field) => (previous[field] ?? null) === (input[field] ?? null)) };
      }
      const value = { ...input, id: `item-${items.size + 1}` }; items.set(key, value); return { ...value, immutableMatch: true };
    },
    async importArtwork(input) {
      if (options.importFailure) throw new Error("import failed");
      const imported = !importedArtwork.has(input.idempotencyKey);
      importedArtwork.add(input.idempotencyKey);
      return { fileId: "file-1", imported };
    },
    async provisionQr(input) {
      provisionInputs.push(input);
      if (options.rejectExisting && input.existingQrCodeId) throw new Error("selected QR is unavailable");
      if (!qrs.has(input.printOrderItemId)) qrs.set(input.printOrderItemId, input.existingQrCodeId || `qr-${qrs.size + 1}`);
      const included = [...qrs.values()].filter((id) => id.startsWith("qr-")).length;
      return { qrCodeId: qrs.get(input.printOrderItemId)!, includedQrAllowance: included };
    },
    async recordActivity(input) { activities.add(input.idempotencyKey); },
    async markAttention(orderId, reason) { for (const [key, item] of items) if (item.id === orderId) items.set(key, { ...item, provisioning_status: "needs_attention", attention_reason: reason }); },
  };
  return {
    dependencies, items, qrs, activities, importedArtwork, provisionInputs,
    get customerResolutions() { return customerResolutions; },
    get authCustomers() { return authCustomers; },
    get existingCodeResolutions() { return existingCodeResolutions; },
  };
}

test("Business Kit components provision at most one exact source-aware grant and replay does not duplicate", async () => {
  const previous = {
    registry: process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON,
    kitFlag: process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS,
    accessFlag: process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS,
  };
  process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = "true";
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "true";
  process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = JSON.stringify([kitContract()]);
  try {
    const h = harness();
    const payload = order(line({ id: "kit-line", product_id: "900", sku: "STARTER-KIT", properties: kitProperties({ business_cards: "new_included_code" }) }));
    const kitIdentity = [{ sku: "STARTER-KIT", productId: "900", materialType: "other_print" as const, defaultTrackingAvailable: true, sourceType: "business_kit" as const }];
    await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry: kitIdentity });
    await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry: kitIdentity });
    assert.equal(h.items.size, 1);
    assert.equal(h.qrs.size, 1);
    assert.equal(h.provisionInputs[0].sourceType, "business_kit");
    assert.equal([...h.items.values()][0].clutch_codes_access_opt_in, true);
  } finally {
    if (previous.registry === undefined) delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON; else process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = previous.registry;
    if (previous.kitFlag === undefined) delete process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS; else process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = previous.kitFlag;
    if (previous.accessFlag === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = previous.accessFlag;
  }
});

test("Starter and Growth expand independent component selections without sharing details", async () => {
  const previous = {
    registry: process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON,
    kitFlag: process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS,
    accessFlag: process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS,
  };
  process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = "true";
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "true";
  try {
    for (const identity of [
      { productId: "900", sku: "STARTER-KIT", kitType: "starter" as const },
      { productId: "901", sku: "GROWTH-KIT", kitType: "growth" as const },
    ]) {
      process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = JSON.stringify([kitContract(identity.productId, identity.sku, identity.kitType)]);
      const trusted = [{ sku: identity.sku, productId: identity.productId, materialType: "other_print" as const, defaultTrackingAvailable: true, sourceType: "business_kit" as const }];

      const none = harness();
      const noneResult = await provisionTrackedPrintOrder({
        payload: order(line({ id: "kit-none", product_id: identity.productId, sku: identity.sku, properties: kitProperties({}) })),
        webhookEventId: "none",
        dependencies: none.dependencies,
        registry: trusted,
      });
      assert.equal(noneResult.processedItems, 0);
      assert.equal(none.customerResolutions, 0);
      assert.equal(none.authCustomers, 0);
      assert.equal(none.items.size, 0);

      for (const component of businessKitComponents) {
        const single = harness();
        const modes = { [component.componentId]: "new_included_code" as const };
        await provisionTrackedPrintOrder({
          payload: order(line({ id: `kit-${component.componentId}`, product_id: identity.productId, sku: identity.sku, properties: kitProperties(modes) })),
          webhookEventId: component.componentId,
          dependencies: single.dependencies,
          registry: trusted,
        });
        assert.equal(single.items.size, 1);
        assert.equal(single.qrs.size, 1);
        assert.equal(single.provisionInputs[0].materialType, component.materialType);
        assert.equal(single.provisionInputs[0].destinationUrl, `https://example.com/${component.componentId}`);
        assert.equal(single.provisionInputs[0].campaignName, `Campaign ${component.componentId}`);
        assert.equal(single.provisionInputs[0].sourceType, "business_kit");
      }

      const allNew = harness();
      const allNewPayload = order(line({
        id: "kit-all-new",
        product_id: identity.productId,
        sku: identity.sku,
        properties: [
          ...kitProperties({ business_cards: "new_included_code", door_hangers: "new_included_code", flyers: "new_included_code" }),
          { name: "Artwork Method", value: "upload_later" },
          { name: "Artwork Instructions", value: "Shared kit artwork" },
        ],
      }));
      await provisionTrackedPrintOrder({ payload: allNewPayload, webhookEventId: "all-new", dependencies: allNew.dependencies, registry: trusted });
      await provisionTrackedPrintOrder({ payload: allNewPayload, webhookEventId: "all-new-replay", dependencies: allNew.dependencies, registry: trusted });
      assert.equal(allNew.items.size, 3);
      assert.equal(allNew.qrs.size, 3);
      assert.equal(allNew.authCustomers, 1);
      assert.equal(allNew.provisionInputs.length, 6);
      assert.deepEqual([...allNew.items.values()].map((item) => item.material_type).sort(), ["business_card", "door_hanger", "flyer"]);
      assert.deepEqual([...allNew.items.values()].map((item) => item.destination_url).sort(), [
        "https://example.com/business_cards",
        "https://example.com/door_hangers",
        "https://example.com/flyers",
      ]);
      assert.equal([...allNew.items.values()].every((item) => item.clutch_codes_access_opt_in === true), true);
      assert.equal([...allNew.items.values()].every((item) => item.artwork_method === "upload_later" && item.artwork_instructions === "Shared kit artwork"), true);
      assert.equal([...allNew.items.values()].every((item) => !JSON.stringify(item.normalized_properties).includes("Business Cards Tracking Mode")), true);

      const mixed = harness({ existingCustomer: true });
      await provisionTrackedPrintOrder({
        payload: order(line({
          id: "kit-mixed",
          product_id: identity.productId,
          sku: identity.sku,
          properties: kitProperties({ business_cards: "new_included_code", door_hangers: "existing_code", flyers: "none" }),
        })),
        webhookEventId: "mixed",
        dependencies: mixed.dependencies,
        registry: trusted,
      });
      assert.equal(mixed.items.size, 2);
      assert.equal(mixed.provisionInputs.length, 2);
      assert.equal(mixed.provisionInputs.filter((entry) => entry.existingQrCodeId).length, 1);
      assert.equal([...mixed.items.values()].filter((item) => item.clutch_codes_access_opt_in).length, 1);

      const allExisting = harness({ existingCustomer: true });
      await provisionTrackedPrintOrder({
        payload: order(line({
          id: "kit-existing",
          product_id: identity.productId,
          sku: identity.sku,
          properties: kitProperties({ business_cards: "existing_code", door_hangers: "existing_code", flyers: "existing_code" }),
        })),
        webhookEventId: "existing",
        dependencies: allExisting.dependencies,
        registry: trusted,
      });
      assert.equal(allExisting.items.size, 3);
      assert.equal(allExisting.existingCodeResolutions, 3);
      assert.equal([...allExisting.items.values()].every((item) => item.clutch_codes_access_opt_in === false), true);
    }
  } finally {
    if (previous.registry === undefined) delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON; else process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = previous.registry;
    if (previous.kitFlag === undefined) delete process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS; else process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = previous.kitFlag;
    if (previous.accessFlag === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = previous.accessFlag;
  }
});

test("invalid Business Kit component payloads fail atomically before customer or provisioning work", async () => {
  const previous = {
    registry: process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON,
    kitFlag: process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS,
    accessFlag: process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS,
  };
  process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = "true";
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "true";
  process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = JSON.stringify([kitContract()]);
  const trusted = [{ sku: "STARTER-KIT", productId: "900", materialType: "other_print" as const, defaultTrackingAvailable: true, sourceType: "business_kit" as const }];
  const validNew = kitProperties({ business_cards: "new_included_code" });
  const cards = businessKitComponents[0];
  const invalidCases: Array<[string, any[]]> = [
    ["missing mode", validNew.filter((entry) => entry.name !== businessKitComponents[2].trackingPropertyName)],
    ["duplicate mode", [...validNew, { name: cards.trackingPropertyName, value: "new_included_code" }]],
    ["missing campaign", validNew.filter((entry) => entry.name !== cards.campaignPropertyName)],
    ["missing destination", validNew.filter((entry) => entry.name !== cards.destinationPropertyName)],
    ["invalid destination", validNew.map((entry) => entry.name === cards.destinationPropertyName ? { ...entry, value: "ftp://example.com" } : entry)],
    ["credential destination", validNew.map((entry) => entry.name === cards.destinationPropertyName ? { ...entry, value: "https://user:pass@example.com" } : entry)],
    ["missing existing reference", kitProperties({ business_cards: "existing_code" }).filter((entry) => entry.name !== cards.existingCodePropertyName)],
    ["campaign with existing", [...kitProperties({ business_cards: "existing_code" }), { name: cards.campaignPropertyName, value: "conflict" }]],
    ["existing reference with new", [...validNew, { name: cards.existingCodePropertyName, value: "owned" }]],
    ["details with none", [...kitProperties({}), { name: cards.campaignPropertyName, value: "conflict" }]],
    ["duplicate campaign", [...validNew, { name: cards.campaignPropertyName, value: "duplicate" }]],
    ["duplicate destination", [...validNew, { name: cards.destinationPropertyName, value: "https://example.com/duplicate" }]],
    ["duplicate existing", [...kitProperties({ business_cards: "existing_code" }), { name: cards.existingCodePropertyName, value: "owned" }]],
    ["array mode", validNew.map((entry) => entry.name === cards.trackingPropertyName ? { ...entry, value: ["new_included_code"] } : entry)],
    ["object mode", validNew.map((entry) => entry.name === cards.trackingPropertyName ? { ...entry, value: { mode: "new_included_code" } } : entry)],
    ["null mode", validNew.map((entry) => entry.name === cards.trackingPropertyName ? { ...entry, value: null } : entry)],
    ["case spoof", validNew.map((entry) => entry.name === cards.trackingPropertyName ? { ...entry, name: cards.trackingPropertyName.toLowerCase() } : entry)],
    ["whitespace spoof", validNew.map((entry) => entry.name === cards.trackingPropertyName ? { ...entry, name: ` ${cards.trackingPropertyName}` } : entry)],
    ["generic authority", [...validNew, { name: "Tracking Mode", value: "new_included_code" }, { name: "Clutch Codes Access", value: "included_90_days" }]],
  ];
  try {
    for (const [label, properties] of invalidCases) {
      const h = harness({ existingCustomer: true });
      const result = await provisionTrackedPrintOrder({
        payload: order(line({ id: `invalid-${label}`, product_id: "900", sku: "STARTER-KIT", properties })),
        webhookEventId: label,
        dependencies: h.dependencies,
        registry: trusted,
      });
      assert.equal(result.processedItems, 0, label);
      assert.equal(result.results[0]?.reason, "invalid_business_kit_component_contract", label);
      assert.equal(h.customerResolutions, 0, label);
      assert.equal(h.authCustomers, 0, label);
      assert.equal(h.existingCodeResolutions, 0, label);
      assert.equal(h.items.size, 0, label);
      assert.equal(h.qrs.size, 0, label);
      assert.equal(h.provisionInputs.length, 0, label);
    }
  } finally {
    if (previous.registry === undefined) delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON; else process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = previous.registry;
    if (previous.kitFlag === undefined) delete process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS; else process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = previous.kitFlag;
    if (previous.accessFlag === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = previous.accessFlag;
  }
});

test("known Business Kits never fall through to generic grants when either flag or the contract is invalid", async () => {
  const original = {
    registry: process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON,
    kit: process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS,
    global: process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS,
  };
  const valid = [kitContract()];
  const payload = order(line({ id: "kit-line", product_id: "900", sku: "STARTER-KIT", properties: [
    ...kitProperties({ business_cards: "new_included_code" }),
  ] }));
  const trustedKitRegistry = [{ sku: "STARTER-KIT", productId: "900", materialType: "other_print" as const, defaultTrackingAvailable: true, sourceType: "business_kit" as const }];
  try {
    for (const scenario of [
      { global: "false", kit: "false", registry: valid },
      { global: "false", kit: "true", registry: valid },
      { global: "true", kit: "false", registry: valid },
      { global: "true", kit: "true", registry: undefined },
      { global: "true", kit: "true", registry: "malformed" },
      { global: "true", kit: "true", registry: [] },
      { global: "true", kit: "true", registry: [{ ...valid[0], components: [valid[0].components[0], valid[0].components[0]] }] },
      { global: "true", kit: "true", registry: valid, properties: [{ name: "Business Cards Tracking Mode", value: "unknown" }] },
    ]) {
      process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = scenario.global;
      process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = scenario.kit;
      if (scenario.registry === undefined) delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON;
      else process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = scenario.registry === "malformed" ? "{" : JSON.stringify(scenario.registry);
      const h = harness();
      const scenarioPayload = scenario.properties
        ? order(line({ id: "kit-line", product_id: "900", sku: "STARTER-KIT", properties: scenario.properties }))
        : payload;
      const result = await provisionTrackedPrintOrder({ payload: scenarioPayload, webhookEventId: "w", dependencies: h.dependencies, registry: trustedKitRegistry });
      assert.equal(result.processedItems, 0);
      assert.equal(h.qrs.size, 0);
      assert.equal(h.items.size, 0);
    }
  } finally {
    if (original.registry === undefined) delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON; else process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = original.registry;
    if (original.kit === undefined) delete process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS; else process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = original.kit;
    if (original.global === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = original.global;
  }
});

test("valid individual print is unaffected and a contract collision cannot reclassify it as a Kit", async () => {
  const original = {
    registry: process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON,
    kit: process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS,
    global: process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS,
  };
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "true";
  process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = "true";
  try {
    const properties = [
      { name: "Tracking Mode", value: "new_included_code" },
      { name: "Clutch Codes Access", value: "included_90_days" },
      { name: "Campaign Name", value: "Individual" },
      { name: "Destination URL", value: "https://example.com/individual" },
    ];
    delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON;
    const individual = harness();
    await provisionTrackedPrintOrder({ payload: order(line({ properties })), webhookEventId: "individual", dependencies: individual.dependencies, registry });
    assert.equal(individual.qrs.size, 1);
    assert.equal(individual.provisionInputs[0].sourceType, "tracked_print");

    process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = JSON.stringify([{ ...kitContract("901", "POSTCARD-4X6"), components: [{ ...businessKitComponents[0], materialType: "postcard" }] }]);
    const collision = harness();
    const result = await provisionTrackedPrintOrder({ payload: order(line({ product_id: "901", properties })), webhookEventId: "collision", dependencies: collision.dependencies, registry });
    assert.equal(result.processedItems, 0);
    assert.equal(collision.items.size, 0);
    assert.equal(collision.qrs.size, 0);
  } finally {
    if (original.registry === undefined) delete process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON; else process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON = original.registry;
    if (original.kit === undefined) delete process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS; else process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS = original.kit;
    if (original.global === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = original.global;
  }
});

test("strict tracked-print authority rejects every invalid canonical shape before operational dependencies", async () => {
  const previous = process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS;
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "true";
  try {
    const canonical = [
      { name: "Tracking Mode", value: "new_included_code" },
      { name: "Clutch Codes Access", value: "included_90_days" },
    ];
    const required = [
      { name: "Campaign Name", value: "Campaign" },
      { name: "Destination URL", value: "https://example.com" },
    ];
    for (const [label, properties] of [
      ["alias only", [{ name: "tracking", value: "new code" }, ...required]],
      ["alias before canonical", [{ name: "tracking", value: "new code" }, ...canonical, ...required]],
      ["alias after canonical", [...canonical, { name: "tracking", value: "new code" }, ...required]],
      ["canonical plus alias", [...canonical, { name: "QR Tracking", value: "none" }, ...required]],
      ["lowercase canonical", [{ name: "tracking mode", value: "new_included_code" }, canonical[1], ...required]],
      ["whitespace name", [{ name: " Tracking Mode", value: "new_included_code" }, canonical[1], ...required]],
      ["value casing", [{ name: "Tracking Mode", value: "NEW_INCLUDED_CODE" }, canonical[1], ...required]],
      ["value whitespace", [{ name: "Tracking Mode", value: "new_included_code " }, canonical[1], ...required]],
      ["missing access", [canonical[0], ...required]],
      ["duplicate canonical", [canonical[0], canonical[0], canonical[1], ...required]],
      ["null scalar", [{ name: "Tracking Mode", value: null }, canonical[1], ...required]],
      ["array scalar", [{ name: "Tracking Mode", value: ["new_included_code"] }, canonical[1], ...required]],
      ["object scalar", [{ name: "Tracking Mode", value: { value: "new_included_code" } }, canonical[1], ...required]],
    ] as Array<[string, any[]]>) {
      const h = harness();
      const result = await provisionTrackedPrintOrder({ payload: order(line({ properties })), webhookEventId: `w-${label}`, dependencies: h.dependencies, registry });
      assert.equal(result.results[0]?.status, "skipped", label);
      assert.equal((result.results[0] as any)?.reason, "invalid_tracking_authority", label);
      assert.equal(h.customerResolutions, 0, label);
      assert.equal(h.authCustomers, 0, label);
      assert.equal(h.existingCodeResolutions, 0, label);
      assert.equal(h.items.size, 0, label);
      assert.equal(h.qrs.size, 0, label);
      assert.equal(h.provisionInputs.length, 0, label);
      assert.equal("includedQrAllowance" in (result.results[0] || {}), false, label);
    }
  } finally {
    if (previous === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = previous;
  }
});

test("strict canonical tracked-print pairs control new, existing, and no-tracking operations", async () => {
  const previous = process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS;
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "true";
  try {
    const newCode = harness();
    const newResult = await provisionTrackedPrintOrder({ payload: order(line({ properties: [
      { name: "Tracking Mode", value: "new_included_code" },
      { name: "Clutch Codes Access", value: "included_90_days" },
      { name: "Campaign Name", value: "Canonical campaign" },
      { name: "Destination URL", value: "https://example.com/canonical" },
    ] })), webhookEventId: "canonical-new", dependencies: newCode.dependencies, registry });
    assert.equal(newCode.customerResolutions, 1);
    assert.equal(newCode.authCustomers, 1);
    assert.equal(newCode.items.size, 1);
    assert.equal([...newCode.items.values()][0].tracking_mode, "new_included_code");
    assert.equal([...newCode.items.values()][0].clutch_codes_access_opt_in, true);
    assert.equal(newCode.provisionInputs.length, 1);
    assert.equal(newCode.qrs.size, 1);
    assert.equal((newResult.results[0] as any).includedQrAllowance, 1);

    const existing = harness({ existingCustomer: true });
    const existingResult = await provisionTrackedPrintOrder({ payload: order(line({ properties: [
      { name: "Tracking Mode", value: "existing_code" },
      { name: "Clutch Codes Access", value: "none" },
      { name: "Existing QR Code ID", value: "owned" },
    ] })), webhookEventId: "canonical-existing", dependencies: existing.dependencies, registry });
    assert.equal(existing.authCustomers, 0);
    assert.equal(existing.existingCodeResolutions, 1);
    assert.equal([...existing.items.values()][0].tracking_mode, "existing_code");
    assert.equal([...existing.items.values()][0].clutch_codes_access_opt_in, false);
    assert.equal(existing.provisionInputs.length, 1);
    assert.equal(existing.provisionInputs[0].existingQrCodeId, "00000000-0000-4000-8000-000000000001");
    assert.equal((existingResult.results[0] as any).includedQrAllowance, 0);

    const none = harness();
    const noneResult = await provisionTrackedPrintOrder({ payload: order(line({ properties: [
      { name: "Tracking Mode", value: "none" },
      { name: "Clutch Codes Access", value: "none" },
    ] })), webhookEventId: "canonical-none", dependencies: none.dependencies, registry });
    assert.equal(none.customerResolutions, 1);
    assert.equal(none.authCustomers, 0);
    assert.equal(none.items.size, 1);
    assert.equal([...none.items.values()][0].tracking_mode, "none");
    assert.equal(none.provisionInputs.length, 0);
    assert.equal(none.qrs.size, 0);
    assert.equal("includedQrAllowance" in (noneResult.results[0] || {}), false);

    const untrusted = harness();
    const untrustedResult = await provisionTrackedPrintOrder({ payload: order(line({ sku: "UNTRUSTED", properties: [
      { name: "Tracking Mode", value: "new_included_code" },
      { name: "Clutch Codes Access", value: "included_90_days" },
    ] })), webhookEventId: "untrusted", dependencies: untrusted.dependencies, registry });
    assert.equal(untrustedResult.eligibleItems, 0);
    assert.equal(untrusted.customerResolutions, 0);
    assert.equal(untrusted.items.size, 0);
    assert.equal(untrusted.qrs.size, 0);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = previous;
  }
});

test("feature-disabled tracked print preserves permissive legacy operational behavior", async () => {
  const previous = process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS;
  process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = "false";
  try {
    const h = harness();
    const result = await provisionTrackedPrintOrder({ payload: order(line({ properties: {
      tracking: "new code",
      "Campaign Name": "Legacy campaign",
      destination: "https://example.com/legacy",
    } })), webhookEventId: "legacy", dependencies: h.dependencies, registry });
    assert.equal(h.authCustomers, 1);
    assert.equal(h.items.size, 1);
    assert.equal([...h.items.values()][0].tracking_mode, "new_included_code");
    assert.equal([...h.items.values()][0].clutch_codes_access_opt_in, false);
    assert.equal(h.provisionInputs.length, 1);
    assert.equal(h.qrs.size, 1);
    assert.equal((result.results[0] as any).includedQrAllowance, 1);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS; else process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS = previous;
  }
});

test("customer identity resolver reconciles email and Shopify matches explicitly", () => {
  const emailNoShopify = { id: "email", shopify_customer_id: null };
  const emailSameShopify = { id: "same", shopify_customer_id: "shop-1" };
  const shopifySame = { id: "same", shopify_customer_id: "shop-1" };
  const shopifyOnly = { id: "shopify", shopify_customer_id: "shop-1" };
  assert.deepEqual(resolveCustomerIdentityRows(null, null, "shop-1"), { status: "not_found" });
  assert.equal(resolveCustomerIdentityRows(emailNoShopify, null, "shop-1").status, "found");
  assert.equal(resolveCustomerIdentityRows(emailSameShopify, null, "shop-1").status, "found");
  assert.equal(resolveCustomerIdentityRows(emailSameShopify, null, "shop-2").status, "conflict");
  assert.deepEqual(resolveCustomerIdentityRows(null, shopifyOnly, "shop-1"), { status: "found", customer: shopifyOnly });
  assert.deepEqual(resolveCustomerIdentityRows(emailSameShopify, shopifySame, "shop-1"), { status: "found", customer: emailSameShopify });
  assert.equal(resolveCustomerIdentityRows(emailNoShopify, shopifyOnly, "shop-1").status, "conflict");
  assert.equal(resolveCustomerIdentityRows({ id: "admin", is_admin: true, shopify_customer_id: null }, shopifyOnly, "shop-1").status, "conflict");
});

test("identity conflict is a successful needs-attention result with no side effects", async () => {
  const h = harness({ identityConflict: true });
  const payload = order(line({ properties: { tracking: "new code", destination: "https://example.com" } }));
  const first = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  const second = await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal((first.results[0] as any).status, "needs_attention"); assert.equal((first.results[0] as any).customerId, undefined);
  const item = [...h.items.values()][0];
  assert.equal(item.customer_id, null); assert.equal(item.attention_reason, "Customer account identifiers require review.");
  assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0); assert.equal(h.items.size, 1);
  assert.equal(h.activities.size, 1); assert.equal((second.results[0] as any).status, "needs_attention");
});

test("concurrent insert conflict reruns identity reconciliation and remains needs attention", async () => {
  const h = harness({ concurrentConflict: true });
  const payload = order(line({ properties: { tracking: "new code", destination: "https://example.com" } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "needs_attention"); assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0);
  assert.equal([...h.items.values()][0].customer_id, null);
});

test("neutral linkage patches never include protected commerce fields", () => {
  for (const plan of ["clutch_codes_starter", "clutch_codes_growth", "connect_plus", "admin"]) {
    const existing = { id: "c1", plan, plan_code: plan, is_admin: plan === "admin", included_qr_allowance: 7, subscription_qr_limit: 30, qr_limit: 37 };
    const patch = buildSafeExistingCustomerLinkagePatch(existing, { authUserId: "auth", shopifyCustomerId: "shopify", shopifyOrderId: "order" });
    assert.deepEqual(patch, { auth_user_id: "auth", shopify_customer_id: "shopify", shopify_order_id: "order" });
    for (const protectedField of ["plan","plan_code","is_admin","included_qr_allowance","subscription_qr_limit","qr_limit","clutch_codes_plan_code","clutch_codes_subscription_status"]) assert.equal(protectedField in patch, false);
  }
});

test("trusted SKU is eligible and title-only or customer properties are insufficient", () => {
  assert.equal(classifyPrintProduct({ sku: "postcard-4x6" }, registry).eligible, true);
  assert.equal(classifyPrintProduct({ title: "Postcards" }, registry).eligible, false);
  assert.equal(classifyPrintProduct({ sku: "UNKNOWN", title: "Postcards" }, registry).eligible, false);
});

test("Business Kit classification requires exact product ID and SKU without cross-identity ambiguity", () => {
  const trusted = [
    { sku: "KIT", productId: "900", materialType: "other_print" as const, defaultTrackingAvailable: true, sourceType: "business_kit" as const },
    { sku: "POSTCARD", productId: "901", materialType: "postcard" as const, defaultTrackingAvailable: true, sourceType: "tracked_print" as const },
  ];
  assert.equal(classifyPrintProduct({ sku: "KIT", product_id: "900" }, trusted).sourceType, "business_kit");
  assert.equal(classifyPrintProduct({ sku: "KIT", product_id: "wrong" }, trusted).eligible, false);
  assert.equal(classifyPrintProduct({ sku: "wrong", product_id: "900" }, trusted).eligible, false);
  assert.equal(classifyPrintProduct({ sku: "POSTCARD", product_id: "900" }, trusted).eligible, false);
});

test("property parser normalizes canonical values, aliases, and capitalization", () => {
  assert.equal(normalizePrintLineProperties({ "Tracking Mode": "New Included Code" }).trackingMode, "new_included_code");
  assert.equal(normalizePrintLineProperties({ tracking: "USE EXISTING CODE" }).trackingMode, "existing_code");
  assert.equal(normalizePrintLineProperties({ tracking: "No Tracking" }).trackingMode, "none");
});

test("property parser validates destinations and extracts existing QR IDs", () => {
  assert.equal(normalizePrintLineProperties({ "Destination URL": "https://example.com/a" }).validDestination, true);
  assert.equal(normalizePrintLineProperties({ "Destination URL": "javascript:alert(1)" }).validDestination, false);
  assert.equal(normalizePrintLineProperties({ "Existing QR Code ID": "qr-123" }).existingQrCodeId, "qr-123");
  assert.equal("material_type" in normalizePrintLineProperties({ "Material Type": "Fake" }).normalizedProperties, false);
});

test("property parser supports every Phase 4 canonical property and artwork method", () => {
  const parsed = normalizePrintLineProperties({
    "Tracking Mode": "new_included_code",
    "Campaign Name": "Summer Postcard Campaign",
    "Destination URL": "https://example.com/summer",
    "Existing Clutch Code": "summer-code",
    "Artwork Method": "reorder_existing",
    "Artwork Upload URL": "https://cdn.shopify.com/s/files/artwork.pdf",
    "Artwork Instructions": "Use the approved blue background.",
    "Reorder Reference": "#1042",
    "QR Placement Instructions": "Bottom-right corner.",
  });
  assert.equal(parsed.trackingMode, "new_included_code");
  assert.equal(parsed.artworkMethod, "reorder_existing");
  assert.equal(parsed.existingClutchCode, "summer-code");
  assert.equal(parsed.reorderReference, "#1042");
  for (const key of ["tracking_mode", "campaign_name", "destination_url", "existing_clutch_code", "artwork_method", "artwork_file_url", "artwork_instructions", "reorder_reference", "qr_placement_instructions"]) {
    assert.equal(typeof parsed.normalizedProperties[key], "string");
  }
});

test("property parser applies canonical length limits before persistence", () => {
  const parsed = normalizePrintLineProperties({
    "Campaign Name": "c".repeat(300),
    "Artwork Instructions": "a".repeat(3000),
    "Reorder Reference": "r".repeat(400),
    "QR Placement Instructions": "q".repeat(800),
  });
  assert.equal(parsed.campaignName?.length, 160);
  assert.equal(parsed.artworkInstructions?.length, 2000);
  assert.equal(parsed.reorderReference?.length, 200);
  assert.equal(parsed.qrPlacementInstructions?.length, 500);
});

test("registry validation fails closed for ambiguous and conflicting entries", () => {
  assert.equal(validatePrintProductRegistry("not json").entries.length, 0);
  assert.ok(validatePrintProductRegistry([{ materialType: "postcard", defaultTrackingAvailable: true }]).errors.length > 0);
  assert.ok(validatePrintProductRegistry([{ sku: "A", materialType: "unknown", defaultTrackingAvailable: true }]).errors.length > 0);
  assert.ok(validatePrintProductRegistry([{ sku: "A", materialType: "postcard" }]).errors.length > 0);
  assert.ok(validatePrintProductRegistry([
    { sku: "A", productId: "1", materialType: "postcard", defaultTrackingAvailable: true },
    { sku: "A", productId: "2", materialType: "flyer", defaultTrackingAvailable: false },
  ]).errors.some((error) => error.includes("duplicates SKU")));
  assert.ok(validatePrintProductRegistry([
    { productId: "1", materialType: "postcard", defaultTrackingAvailable: true },
    { productId: "1", materialType: "flyer", defaultTrackingAvailable: true },
  ]).errors.some((error) => error.includes("conflicts")));
  assert.ok(validatePrintProductRegistry([
    { sku: "KIT", materialType: "other_print", defaultTrackingAvailable: true, sourceType: "business_kit" },
  ]).errors.some((error) => error.includes("require both")));
  assert.ok(validatePrintProductRegistry([
    { sku: "A", productId: "1", materialType: "postcard", defaultTrackingAvailable: true, sourceType: "tracked_print" },
    { sku: "A", productId: "1", materialType: "postcard", defaultTrackingAvailable: true, sourceType: "business_kit" },
  ]).errors.some((error) => error.includes("duplicates productId/SKU identity")));
  const variants = validatePrintProductRegistry([
    { sku: "POSTCARD-100", productId: "1", materialType: "postcard", defaultTrackingAvailable: true },
    { sku: "POSTCARD-500", productId: "1", materialType: "postcard", defaultTrackingAvailable: true },
  ]);
  assert.equal(variants.errors.length, 0);
  assert.equal(classifyPrintProduct({ sku: "POSTCARD-500", product_id: "1" }, variants.entries).eligible, true);
  assert.equal(classifyPrintProduct({ product_id: "1" }, variants.entries).eligible, false);
});

test("existing Clutch Code references normalize UUID, slug, and canonical redirect URL", () => {
  assert.deepEqual(normalizeExistingClutchCodeReference("550e8400-e29b-41d4-a716-446655440000"), { kind: "id", value: "550e8400-e29b-41d4-a716-446655440000" });
  assert.deepEqual(normalizeExistingClutchCodeReference("Summer-Code"), { kind: "slug", value: "summer-code" });
  assert.deepEqual(normalizeExistingClutchCodeReference("https://qr.clutchprintshop.com/qr/Summer-Code?source=dashboard"), { kind: "slug", value: "summer-code" });
  assert.equal(normalizeExistingClutchCodeReference("https://example.com/qr/summer-code"), null);
  assert.equal(normalizeExistingClutchCodeReference("../../admin"), null);
});

test("existing Clutch Code eligibility rejects wrong-owner, system, inactive, and excluded codes", () => {
  const eligible = { id: "q1", customer_id: "c1", is_system: false, capacity_source: "subscription", counts_toward_capacity: true, customer_can_edit_destination: true, is_active: true, qr_type: "url" };
  assert.equal(isEligibleExistingClutchCode(eligible, "c1"), true);
  assert.equal(isEligibleExistingClutchCode({ ...eligible, customer_id: "c2" }, "c1"), false);
  assert.equal(isEligibleExistingClutchCode({ ...eligible, is_system: true }, "c1"), false);
  assert.equal(isEligibleExistingClutchCode({ ...eligible, is_active: false }, "c1"), false);
  for (const qr_type of ["smart_card", "tracked_print", "business_kit", "system_exempt"]) {
    assert.equal(isEligibleExistingClutchCode({ ...eligible, qr_type }, "c1"), false);
  }
});

const publicDns = async () => [{ address: "23.227.38.65", family: 4 }];
const pdfBytes = Buffer.from("%PDF-1.7\ntracked print artwork");

test("Shopify artwork download rejects non-Shopify hosts and private DNS results", async () => {
  await assert.rejects(() => downloadShopifyArtwork({ sourceUrl: "https://example.com/art.pdf", lookup: publicDns }), /artwork_source_not_allowed/);
  await assert.rejects(() => downloadShopifyArtwork({ sourceUrl: "https://cdn.shopify.com/art.pdf", lookup: async () => [{ address: "127.0.0.1", family: 4 }] }), /artwork_source_not_public/);
});

test("Shopify artwork download rejects redirects outside the allowlist", async () => {
  await assert.rejects(() => downloadShopifyArtwork({
    sourceUrl: "https://cdn.shopify.com/art.pdf",
    lookup: publicDns,
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://example.com/steal.pdf" } }),
  }), /artwork_source_not_allowed/);
});

test("Shopify artwork download rejects oversized and MIME-mismatched responses", async () => {
  await assert.rejects(() => downloadShopifyArtwork({
    sourceUrl: "https://cdn.shopify.com/art.pdf",
    lookup: publicDns,
    fetchImpl: async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf", "content-length": String(25 * 1024 * 1024 + 1) } }),
  }), /artwork_file_too_large/);
  await assert.rejects(() => downloadShopifyArtwork({
    sourceUrl: "https://cdn.shopify.com/art.png",
    lookup: publicDns,
    fetchImpl: async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf" } }),
  }), /artwork_mime_extension_mismatch/);
});

test("Shopify artwork download validates and streams an allowed file", async () => {
  const result = await downloadShopifyArtwork({
    sourceUrl: "https://cdn.shopify.com/s/files/order-artwork.pdf",
    lookup: publicDns,
    fetchImpl: async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=customer-artwork.pdf" } }),
  });
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.originalFilename, "customer-artwork.pdf");
  assert.equal(result.bytes.equals(pdfBytes), true);
});

function artworkAdminMock(options: { registrationFails?: boolean } = {}) {
  const uploaded: string[] = [];
  const removed: string[] = [];
  const admin = {
    from() {
      const chain: any = {
        select() { return chain; }, eq() { return chain; }, limit() { return chain; },
        async maybeSingle() { return { data: null, error: null }; },
      };
      return chain;
    },
    storage: {
      from() {
        return {
          async upload(path: string) { uploaded.push(path); return { error: null }; },
          async remove(paths: string[]) { removed.push(...paths); return { error: null }; },
        };
      },
    },
    async rpc() {
      return options.registrationFails
        ? { data: null, error: new Error("registration failed") }
        : { data: [{ file_id: "file-1" }], error: null };
    },
  };
  return { admin: admin as any, uploaded, removed };
}

test("successful checkout artwork import stores privately and registers once", async () => {
  const mock = artworkAdminMock();
  const result = await importShopifyArtwork({
    admin: mock.admin,
    printOrderItemId: "order-item-1",
    actorAuthUserId: "auth-1",
    sourceUrl: "https://cdn.shopify.com/art.pdf",
    idempotencyKey: "artwork:1",
    lookup: publicDns,
    fetchImpl: async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf" } }),
  });
  assert.equal(result.fileId, "file-1");
  assert.equal(mock.uploaded.length, 1);
  assert.equal(mock.removed.length, 0);
});

test("checkout artwork import removes the object after database registration failure", async () => {
  const mock = artworkAdminMock({ registrationFails: true });
  await assert.rejects(() => importShopifyArtwork({
    admin: mock.admin,
    printOrderItemId: "order-item-1",
    actorAuthUserId: "auth-1",
    sourceUrl: "https://cdn.shopify.com/art.pdf",
    idempotencyKey: "artwork:1",
    lookup: publicDns,
    fetchImpl: async () => new Response(pdfBytes, { headers: { "content-type": "application/pdf" } }),
  }));
  assert.equal(mock.uploaded.length, 1);
  assert.deepEqual(mock.removed, mock.uploaded);
});

test("normal print creates one item and no customer, QR, or allowance", async () => {
  const h = harness(); const result = await provisionTrackedPrintOrder({ payload: order(), webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(result.processedItems, 1); assert.equal(h.items.size, 1); assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0);
  assert.equal([...h.items.values()][0].provisioning_status, "not_required");
});

for (const quantity of [1, 500]) test(`quantity ${quantity} provisions exactly one included code`, async () => {
  const h = harness();
  const item = line({ quantity, properties: { "Tracking Mode": "new included code", "Campaign Name": "Postcard campaign", "Destination URL": "https://example.com" } });
  await provisionTrackedPrintOrder({ payload: order(item), webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(h.items.size, 1); assert.equal(h.qrs.size, 1); assert.equal(h.authCustomers, 1);
});

test("same order and line is idempotent across webhook IDs", async () => {
  const h = harness(); const payload = order(line({ properties: { tracking: "new code", campaign: "Campaign", destination: "https://example.com" } }));
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal(h.items.size, 1); assert.equal(h.qrs.size, 1);
});

test("immutable replay differences are preserved and reported once", async () => {
  for (const changed of [
    { tracking: "none", destination: "https://example.com" },
    { tracking: "new code", destination: "https://changed.example.com" },
    { tracking: "existing code", "existing qr code id": "changed-qr" },
  ]) {
    const h = harness(); const original = order(line({ properties: { tracking: "new code", campaign: "Campaign", destination: "https://example.com" } }));
    await provisionTrackedPrintOrder({ payload: original, webhookEventId: "w1", dependencies: h.dependencies, registry });
    const replay = order(line({ properties: changed }));
    const first = await provisionTrackedPrintOrder({ payload: replay, webhookEventId: "w2", dependencies: h.dependencies, registry });
    const second = await provisionTrackedPrintOrder({ payload: replay, webhookEventId: "w3", dependencies: h.dependencies, registry });
    assert.equal((first.results[0] as any).discrepancy, true); assert.equal((second.results[0] as any).discrepancy, true);
    assert.equal(h.qrs.size, 1); assert.equal(h.activities.has("tracked-print:order-1:line-1:discrepancy"), true);
  }
});

test("an identical pending item resumes provisioning without rewriting inputs", async () => {
  const h = harness({ existingCustomer: true });
  const properties = { tracking: "new code", campaign: "Campaign", destination: "https://example.com" };
  h.items.set("order-1:line-1", {
    id: "item-1", customer_id: "customer-db-1", product_id: "p1", variant_id: null,
    sku: "POSTCARD-4X6", material_type: "postcard", quantity: 1, tracking_mode: "new_included_code",
    destination_url: "https://example.com/", existing_qr_code_id: null, campaign_name: "Campaign",
    provisioning_status: "pending", attention_reason: null,
  });
  const result = await provisionTrackedPrintOrder({ payload: order(line({ properties })), webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "completed"); assert.equal(h.qrs.size, 1);
});

test("tracking availability is trusted and cannot be overridden by properties", async () => {
  const disabledRegistry = [{ sku: "POSTCARD-4X6", materialType: "postcard" as const, defaultTrackingAvailable: false }];
  const plain = harness();
  await provisionTrackedPrintOrder({ payload: order(), webhookEventId: "w1", dependencies: plain.dependencies, registry: disabledRegistry });
  assert.equal([...plain.items.values()][0].provisioning_status, "not_required");
  for (const properties of [
    { tracking: "new code", campaign: "Campaign", destination: "https://example.com" },
    { tracking: "existing code", "existing qr code id": "owned" },
  ]) {
    const h = harness({ existingCustomer: true });
    await provisionTrackedPrintOrder({ payload: order(line({ properties })), webhookEventId: "w", dependencies: h.dependencies, registry: disabledRegistry });
    const item = [...h.items.values()][0];
    assert.equal(item.provisioning_status, "needs_attention"); assert.equal(item.attention_reason, "QR tracking is not available for this product configuration.");
    assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0);
  }
});

test("two eligible line items create two records and two codes", async () => {
  const h = harness(); const properties = { tracking: "new code", campaign: "Campaign", destination: "https://example.com" };
  const payload = order(line({ properties }), { line_items: [line({ id: "l1", properties }), line({ id: "l2", properties })] });
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(h.items.size, 2); assert.equal(h.qrs.size, 2);
});

test("existing owned code links without a new QR or included allowance", async () => {
  const h = harness({ existingCustomer: true });
  const payload = order(line({ properties: { tracking: "existing code", "Existing Clutch Code": "owned-qr" } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(h.qrs.get("item-1"), "00000000-0000-4000-8000-000000000001"); assert.equal((result.results[0] as any).includedQrAllowance, 0);
});

test("wrong-customer or Smart Card selection is rejected without creating another QR", async () => {
  const h = harness({ existingCustomer: true, rejectExisting: true });
  const payload = order(line({ properties: { tracking: "existing code", "existing qr code id": "unavailable" } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "needs_attention");
  assert.equal(h.qrs.size, 0);
});

test("upload_now imports artwork once and duplicate webhook delivery does not duplicate it", async () => {
  const h = harness();
  const payload = order(line({ properties: {
    "Tracking Mode": "new_included_code",
    "Campaign Name": "Launch campaign",
    "Destination URL": "https://example.com/launch",
    "Artwork Method": "upload_now",
    "Artwork Upload URL": "https://cdn.shopify.com/artwork.pdf",
  } }));
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal(h.importedArtwork.size, 1);
  assert.equal(h.qrs.size, 1);
});

test("artwork import failure creates needs_attention without failing the webhook or provisioning a QR", async () => {
  const options = { importFailure: true };
  const h = harness(options);
  const payload = order(line({ properties: {
    "Tracking Mode": "new_included_code",
    "Campaign Name": "Launch campaign",
    "Destination URL": "https://example.com/launch",
    "Artwork Method": "upload_now",
    "Artwork Upload URL": "https://cdn.shopify.com/artwork.pdf",
  } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "needs_attention");
  assert.equal(h.qrs.size, 0);
  assert.equal([...h.items.values()][0].attention_reason, "Checkout artwork could not be imported securely.");
});

test("an identical replay resumes only the exact checkout artwork import failure", async () => {
  const options = { importFailure: true };
  const h = harness(options);
  const payload = order(line({ properties: {
    "Tracking Mode": "new_included_code",
    "Campaign Name": "Launch campaign",
    "Destination URL": "https://example.com/launch",
    "Artwork Method": "upload_now",
    "Artwork Upload URL": "https://cdn.shopify.com/artwork.pdf",
  } }));

  const failed = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  options.importFailure = false;
  const resumed = await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
  const duplicate = await provisionTrackedPrintOrder({ payload, webhookEventId: "w3", dependencies: h.dependencies, registry });

  assert.equal((failed.results[0] as any).status, "needs_attention");
  assert.equal((resumed.results[0] as any).status, "completed");
  assert.equal((duplicate.results[0] as any).status, "completed");
  assert.equal(h.items.size, 1);
  assert.equal(h.importedArtwork.size, 1);
  assert.equal(h.qrs.size, 1);
});

test("other needs_attention reasons remain blocked even with identical upload inputs", async () => {
  for (const attentionReason of [
    "Customer account identifiers require review.",
    "QR tracking is not available for this product configuration.",
    "Tracking request requires a campaign name and valid destination.",
  ]) {
    const h = harness({ existingCustomer: true });
    h.items.set("order-1:line-1", {
      id: "item-1", customer_id: "customer-db-1", product_id: "p1", variant_id: null,
      sku: "POSTCARD-4X6", material_type: "postcard", quantity: 1, tracking_mode: "new_included_code",
      destination_url: "https://example.com/launch", existing_qr_code_id: null, campaign_name: "Launch campaign",
      artwork_method: "upload_now", artwork_file_url: "https://cdn.shopify.com/artwork.pdf",
      artwork_instructions: null, reorder_reference: null, qr_placement_instructions: null,
      provisioning_status: "needs_attention", attention_reason: attentionReason,
    });
    const payload = order(line({ properties: {
      "Tracking Mode": "new_included_code",
      "Campaign Name": "Launch campaign",
      "Destination URL": "https://example.com/launch",
      "Artwork Method": "upload_now",
      "Artwork Upload URL": "https://cdn.shopify.com/artwork.pdf",
    } }));

    const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
    assert.equal((result.results[0] as any).status, "needs_attention");
    assert.equal(h.importedArtwork.size, 0);
    assert.equal(h.qrs.size, 0);
  }
});

for (const [method, extra] of [
  ["upload_later", {}],
  ["request_design", { "Artwork Instructions": "Create a clean two-sided design." }],
  ["reorder_existing", { "Reorder Reference": "#1042" }],
] as const) {
  test(`${method} creates no checkout artwork file`, async () => {
    const h = harness();
    const payload = order(line({ properties: { "Tracking Mode": "none", "Artwork Method": method, ...extra } }));
    const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
    assert.equal((result.results[0] as any).status, "not_required");
    assert.equal(h.importedArtwork.size, 0);
    assert.equal(h.qrs.size, 0);
    assert.equal(h.authCustomers, 1);
  });
}

test("request design and reorder selections require their supporting fields", async () => {
  for (const method of ["request_design", "reorder_existing"]) {
    const h = harness();
    const payload = order(line({ properties: { "Tracking Mode": "none", "Artwork Method": method } }));
    const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
    assert.equal((result.results[0] as any).status, "needs_attention");
    assert.equal(h.authCustomers, 0);
  }
});

test("reorder reference is persisted as a normalized operational field", async () => {
  const h = harness();
  await provisionTrackedPrintOrder({
    payload: order(line({ properties: { "Tracking Mode": "none", "Artwork Method": "reorder_existing", "Reorder Reference": "#1042" } })),
    webhookEventId: "w1", dependencies: h.dependencies, registry,
  });
  assert.equal([...h.items.values()][0].reorder_reference, "#1042");
});

test("missing email or invalid destination needs attention without provisioning", async () => {
  for (const payload of [
    order(line({ properties: { tracking: "new code", campaign: "Campaign", destination: "https://example.com" } }), { email: "", customer: null }),
    order(line({ properties: { tracking: "new code", campaign: "Campaign", destination: "bad" } })),
  ]) {
    const h = harness(); await provisionTrackedPrintOrder({ payload, webhookEventId: "w", dependencies: h.dependencies, registry });
    assert.equal([...h.items.values()][0].provisioning_status, "needs_attention"); assert.equal(h.qrs.size, 0); assert.equal(h.authCustomers, 0);
  }
});

test("tracked print plus Growth resolves capacity 31 without Smart Card or Connect+", () => {
  const access = resolveAccountAccess({ customer: { included_qr_allowance: 1, subscription_qr_limit: 30, clutch_codes_plan_code: "clutch_codes_growth", clutch_codes_subscription_status: "active" }, hasPrintOrders: true, hasTrackedPrint: true, hasIncludedPrintQr: true, usedQrCount: 1 });
  assert.equal(access.dashboardVariant, "combined"); assert.equal(access.effectiveQrCapacity, 31);
  assert.equal(access.hasSmartCard, false); assert.equal(access.hasConnectPlus, false); assert.equal(access.canCreateQr, true);
});

test("tracked-print permissions remain limited to owned-code operations", () => {
  const access = resolveAccountAccess({ customer: { included_qr_allowance: 1 }, hasPrintOrders: true, hasTrackedPrint: true, hasIncludedPrintQr: true, usedQrCount: 1 });
  assert.equal(access.canEditOwnedQr, true); assert.equal(access.canExportQr, true); assert.equal(access.canUseCampaignAnalytics, true);
  assert.equal(access.canCreateQr, false); assert.equal(access.canCustomizeQr, false); assert.equal(access.canUseCampaignHeatmap, false); assert.equal(access.canUseProfileBuilder, false);
});

test("migration contains atomic reconciliation, RLS, protected QR metadata, and no public execution", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260713024450_tracked_print_order_provisioning.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.print_order_items/); assert.match(sql, /create table public\.print_qr_provisionings/);
  assert.match(sql, /create or replace function public\.provision_tracked_print_qr/); assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.provision_tracked_print_qr/); assert.match(sql, /counts_toward_capacity/);
  assert.match(sql, /enable row level security/g);
});

test("corrective migration preserves all QR types and strict existing-code eligibility", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260713031044_correct_tracked_print_safety.sql", import.meta.url), "utf8");
  for (const type of ["url","connect_profile","text","wifi","email","sms","image","pdf","vcard","smart_card","tracked_print","business_kit"]) assert.match(sql, new RegExp(`'${type}'`));
  for (const predicate of ["q.is_system = false","q.capacity_source = 'subscription'","q.counts_toward_capacity = true","q.customer_can_edit_destination = true","q.is_active = true"]) assert.match(sql, new RegExp(predicate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Phase 4 migrations add TIFF support and normalized reorder references", () => {
  const tiff = fs.readFileSync("supabase/migrations/20260713225926_add_tracked_print_tiff_support.sql", "utf8");
  const reorder = fs.readFileSync("supabase/migrations/20260713232644_add_tracked_print_reorder_reference.sql", "utf8");
  assert.match(tiff, /image\/tiff/);
  assert.match(reorder, /add column reorder_reference text/);
  assert.match(reorder, /char_length\(reorder_reference\) <= 200/);
});

test("admin print operations surface artwork method, instructions, and reorder reference", () => {
  const queue = fs.readFileSync("app/admin/print-orders/page.tsx", "utf8");
  const detail = fs.readFileSync("app/admin/print-orders/[id]/page.tsx", "utf8");
  assert.match(queue, /Artwork method/);
  assert.match(queue, /item\.reorder_reference/);
  assert.match(detail, /order\.artwork_instructions/);
  assert.match(detail, /order\.qr_placement_instructions/);
});

test("neutral customer implementation uses paginated Auth lookup and insert-conflict reuse", () => {
  const source = fs.readFileSync(new URL("../lib/tracked-print-supabase.ts", import.meta.url), "utf8");
  assert.match(source, /for \(let page = 1; page <= 100; page\+\+\)/);
  assert.doesNotMatch(source, /\.or\(/); assert.doesNotMatch(source, /from\("customers"\)\.upsert/);
  assert.match(source, /error\.code !== "23505"/); assert.match(source, /resolveCustomerIdentity/);
  assert.ok(source.indexOf('from("customers").insert(neutral)') < source.lastIndexOf("ensureAuthUser(admin, normalizedEmail, name)"));
});

test("production trusted registry defaults to no eligible products", () => {
  assert.equal(classifyPrintProduct({ sku: "POSTCARD-4X6" }, []).eligible, false);
});

test("orders-paid retains HMAC and email kill-switch paths while integrating tracked print", () => {
  const source = fs.readFileSync(new URL("../app/api/webhooks/shopify/orders-paid/route.ts", import.meta.url), "utf8");
  assert.match(source, /verifyShopifyHmac/); assert.match(source, /SEND_ONBOARDING_EMAILS/); assert.match(source, /provisionClutchCodesPaidOrder/);
  assert.match(source, /provisionTrackedPrintOrder/); assert.match(source, /isSmartCardLineItem/);
});
