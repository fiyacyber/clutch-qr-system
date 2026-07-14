import assert from "node:assert/strict";
import test from "node:test";
import { resolvePortalAnalyticsMode } from "../lib/order-linked-portal-analytics.ts";
import { resolveOwnedQrLibrary, visibleLibraryScanCount } from "../lib/order-linked-library.ts";
import { resolveOrderLinkedAccess, type OrderLinkedAccess } from "../lib/order-linked-access.ts";

const started = "2026-01-01T00:00:00.000Z";
const expires = "2026-04-01T00:00:00.000Z";
const active = resolveOrderLinkedAccess({
  ownsCode: true,
  isOrderLinkedIncludedCode: true,
  provisioningStatus: "completed",
  accessStartedAt: started,
  accessExpiresAt: expires,
  featureEnabled: true,
  now: new Date("2026-02-01T00:00:00.000Z"),
});
const expired = resolveOrderLinkedAccess({
  ownsCode: true,
  isOrderLinkedIncludedCode: true,
  provisioningStatus: "completed",
  accessStartedAt: started,
  accessExpiresAt: expires,
  featureEnabled: true,
  now: new Date(expires),
});

function analyticsHarness(overrides: Partial<{
  candidateError: unknown;
  scanError: unknown;
  resolverError: boolean;
  codeAccess: OrderLinkedAccess;
  candidates: Array<{ id: string; name: string; slug: string }>;
}> = {}) {
  let fullFetches = 0;
  return {
    dependencies: {
      async fetchFull() { fullFetches += 1; return { data: { privateAccountData: true }, failed: false }; },
      async listOwnedCodes() { return { data: overrides.candidates ?? [{ id: "included-1", name: "Included", slug: "included" }], error: overrides.candidateError }; },
      async listScans() { return { data: [{ qr_code_id: "included-1", created_at: "2026-02-02T00:00:00.000Z" }], error: overrides.scanError }; },
      async resolveCodeAccess() {
        if (overrides.resolverError) throw new Error("resolver failed");
        return overrides.codeAccess || active;
      },
    },
    get fullFetches() { return fullFetches; },
  };
}

test("included-only analytics is a terminal basic branch and never fetches unified account data", async () => {
  const h = analyticsHarness();
  const result = await resolvePortalAnalyticsMode({
    isAdmin: false,
    hasActivePaidSubscription: false,
    accountAccess: { canUseCampaignAnalytics: true, canUseProfileAnalytics: false },
    dependencies: h.dependencies,
  });
  assert.equal(result.kind, "basic");
  assert.equal(result.kind === "basic" ? result.status : null, "ready");
  assert.equal(h.fullFetches, 0);
});

test("included analytics failures and zero active codes fail closed without full-data fallback", async () => {
  for (const overrides of [
    { candidateError: new Error("candidate query") },
    { scanError: new Error("scan query") },
    { resolverError: true },
    { codeAccess: expired },
    { candidates: [] },
  ]) {
    const h = analyticsHarness(overrides);
    const result = await resolvePortalAnalyticsMode({
      isAdmin: false,
      hasActivePaidSubscription: false,
      accountAccess: { canUseCampaignAnalytics: true, canUseProfileAnalytics: false },
      dependencies: h.dependencies,
    });
    assert.equal(result.kind, "basic");
    assert.notEqual(result.kind === "basic" ? result.status : null, "ready");
    assert.equal(h.fullFetches, 0);
  }
});

test("only paid or administrator analytics invokes the unified fetch", async () => {
  for (const identity of [{ isAdmin: true, paid: false }, { isAdmin: false, paid: true }]) {
    const h = analyticsHarness();
    const result = await resolvePortalAnalyticsMode({
      isAdmin: identity.isAdmin,
      hasActivePaidSubscription: identity.paid,
      accountAccess: { canUseCampaignAnalytics: true, canUseProfileAnalytics: true },
      dependencies: h.dependencies,
    });
    assert.equal(result.kind, "full");
    assert.equal(h.fullFetches, 1);
  }
  const locked = analyticsHarness();
  assert.equal((await resolvePortalAnalyticsMode({
    isAdmin: false,
    hasActivePaidSubscription: false,
    accountAccess: { canUseCampaignAnalytics: false, canUseProfileAnalytics: false },
    dependencies: locked.dependencies,
  })).kind, "locked");
  assert.equal(locked.fullFetches, 0);
});

test("owned active and expired tracked-print and Business Kit codes remain in the library", async () => {
  const codes = [
    { id: "tracked-active", customer_id: "customer-1", is_system: true, qr_type: "tracked_print", capacity_source: "included_print", print_order_item_id: "item-1" },
    { id: "kit-expired", customer_id: "customer-1", is_system: true, qr_type: "business_kit", capacity_source: "included_print", print_order_item_id: "item-2" },
  ];
  const result = await resolveOwnedQrLibrary({
    customerId: "customer-1",
    hasPaidOrAdminAccess: false,
    listOwnedCodes: async () => ({ data: codes }),
    resolveCodeAccess: async (id) => id === "tracked-active" ? active : expired,
  });
  assert.equal(result.failed, false);
  assert.deepEqual(result.entries.map((entry) => entry.code.id), ["tracked-active", "kit-expired"]);
  assert.equal(result.entries[1].access.canView, true);
  assert.equal(result.entries[1].access.canEditDestination, false);
  assert.equal(result.entries[1].access.canViewBasicAnalytics, false);
  assert.equal(visibleLibraryScanCount({ ...result.entries[1].code, scan_count: 41 }, result.entries[1].access), 0);
  assert.equal(visibleLibraryScanCount({ ...result.entries[0].code, scan_count: 12 }, result.entries[0].access), 12);
});

test("library excludes unrelated system codes, other customers, and resolver/query failures", async () => {
  const normalAccess = resolveOrderLinkedAccess({ ownsCode: true, hasActivePaidSubscription: true });
  const rows = [
    { id: "normal", customer_id: "customer-1", is_system: false },
    { id: "smart-card", customer_id: "customer-1", is_system: true, qr_type: "smart_card" },
    { id: "other-customer", customer_id: "customer-2", is_system: false },
  ];
  const result = await resolveOwnedQrLibrary({
    customerId: "customer-1",
    hasPaidOrAdminAccess: true,
    listOwnedCodes: async () => ({ data: rows }),
    resolveCodeAccess: async () => normalAccess,
  });
  assert.deepEqual(result.entries.map((entry) => entry.code.id), ["normal"]);
  assert.equal((await resolveOwnedQrLibrary({
    customerId: "customer-1",
    hasPaidOrAdminAccess: false,
    listOwnedCodes: async () => ({ data: null, error: new Error("query failed") }),
    resolveCodeAccess: async () => active,
  })).failed, true);
  assert.equal((await resolveOwnedQrLibrary({
    customerId: "customer-1",
    hasPaidOrAdminAccess: false,
    listOwnedCodes: async () => ({ data: [rows[0]] }),
    resolveCodeAccess: async () => { throw new Error("resolver failed"); },
  })).failed, true);
});
