import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createQrCodeAnalyticsHandler } from "../app/api/analytics/qr/[qrId]/route.ts";
import { createQrAnalyticsListHandler } from "../app/api/analytics/qr/route.ts";
import { createAnalyticsSummaryHandler } from "../app/api/analytics/summary/route.ts";
import { createAnalyticsExportHandler } from "../app/api/analytics/export/route.ts";
import { createQrUpdateHandler } from "../app/api/qr/update/route.ts";
import { createQrRedirectHandler } from "../app/qr/[slug]/route.ts";
import { resolveOrderLinkedAccess } from "../lib/order-linked-access.ts";

const customer = { id: "customer-1", auth_user_id: "auth-1", email: "owner@example.invalid", is_admin: false };
const user = { id: "auth-1" };
const start = "2026-01-01T00:00:00.000Z";
const expiry = "2026-04-01T00:00:00.000Z";
const activeGrant = resolveOrderLinkedAccess({ ownsCode: true, isOrderLinkedIncludedCode: true, provisioningStatus: "completed", accessStartedAt: start, accessExpiresAt: expiry, featureEnabled: true, now: new Date("2026-02-01T00:00:00Z") });
const expiredGrant = resolveOrderLinkedAccess({ ownsCode: true, isOrderLinkedIncludedCode: true, provisioningStatus: "completed", accessStartedAt: start, accessExpiresAt: expiry, featureEnabled: true, now: new Date(expiry) });

function mockAdmin(input: {
  codes?: any[];
  scans?: any[];
  tableErrors?: Record<string, any>;
  updateError?: any;
} = {}) {
  const rows: Record<string, any[]> = {
    customers: [customer],
    qr_codes: input.codes || [{ id: "qr-1", customer_id: customer.id, name: "Included campaign", slug: "included", destination_url: "https://example.com", qr_type: "tracked_print", customer_can_edit_destination: true }],
    qr_scans: input.scans || [{ id: "scan-secret", qr_code_id: "qr-1", created_at: "2026-02-01T00:00:00Z", ip_hash: "must-not-leak", city: "Private City" }],
  };
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  function from(table: string) {
    let selected = [...(rows[table] || [])];
    let updatePatch: Record<string, unknown> | null = null;
    const chain: any = {
      select() { return chain; },
      eq(column: string, value: unknown) { selected = selected.filter((row) => row[column] === value); return chain; },
      in(column: string, values: unknown[]) { selected = selected.filter((row) => values.includes(row[column])); return chain; },
      is(column: string, value: unknown) { selected = selected.filter((row) => row[column] === value); return chain; },
      or() { return chain; },
      order() { return chain; },
      limit(count: number) { selected = selected.slice(0, count); return chain; },
      update(patch: Record<string, unknown>) { updatePatch = patch; updates.push({ table, patch }); return chain; },
      async single() { return { data: selected[0] || null, error: input.tableErrors?.[table] || (!selected[0] ? { code: "PGRST116" } : null) }; },
      async maybeSingle() { return { data: selected[0] || null, error: input.tableErrors?.[table] || null }; },
      then(resolve: (value: any) => void) {
        resolve({ data: updatePatch ? null : selected, error: updatePatch ? input.updateError || null : input.tableErrors?.[table] || null });
      },
    };
    return chain;
  }
  return { client: { from, storage: { from: () => ({}) } } as any, updates };
}

const accountAccess = { canUseCampaignAnalytics: true, canUseProfileAnalytics: false, canExportQr: true, canEditOwnedQr: true, canUploadQrLogo: false, canCustomizeQr: false } as any;
const request = (url = "https://qr.example.test/api") => new NextRequest(url);
const context = (qrId = "qr-1") => ({ params: Promise.resolve({ qrId }) });

test("all five protected route handlers reject unauthenticated requests", async () => {
  const auth = async () => ({ user: null, customer: null });
  const admin = mockAdmin().client;
  const common = { requireCustomer: auth, createSupabaseAdminClient: () => admin } as any;
  assert.equal((await createQrCodeAnalyticsHandler(common)(request(), context())).status, 401);
  assert.equal((await createQrAnalyticsListHandler(common)()).status, 401);
  assert.equal((await createAnalyticsSummaryHandler(common)()).status, 401);
  assert.equal((await createAnalyticsExportHandler(common)(request())).status, 401);
  const update = createQrUpdateHandler({
    createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    createSupabaseAdminClient: () => admin,
  } as any);
  assert.equal((await update(new NextRequest("https://qr.example.test/api/qr/update", { method: "POST", body: new FormData() }))).status, 401);
});

test("per-code analytics enforces ownership, expiry, basic projection, paid scope, and database failures", async () => {
  const baseDeps = (admin: any, grant: any, authCustomer: any = customer) => ({
    requireCustomer: async () => ({ user, customer: authCustomer }), createSupabaseAdminClient: () => admin,
    loadAccountAccess: async () => accountAccess, loadOrderLinkedQrAccess: async () => grant,
  }) as any;
  const activeAdmin = mockAdmin();
  const activeResponse = await createQrCodeAnalyticsHandler(baseDeps(activeAdmin.client, activeGrant))(request(), context());
  assert.equal(activeResponse.status, 200);
  const activeBody = await activeResponse.json();
  assert.equal(activeBody.scope, "basic_code");
  assert.equal(activeBody.totalScans, 1);
  assert.equal("scans" in activeBody, false);
  assert.equal(JSON.stringify(activeBody).includes("must-not-leak"), false);

  const missing = mockAdmin({ codes: [] });
  assert.equal((await createQrCodeAnalyticsHandler(baseDeps(missing.client, activeGrant))(request(), context("missing"))).status, 404);
  const wrong = mockAdmin({ codes: [{ id: "qr-1", customer_id: "other", name: "Other" }] });
  assert.equal((await createQrCodeAnalyticsHandler(baseDeps(wrong.client, activeGrant))(request(), context())).status, 404);
  assert.equal((await createQrCodeAnalyticsHandler(baseDeps(activeAdmin.client, expiredGrant))(request(), context())).status, 403);
  assert.equal((await createQrCodeAnalyticsHandler(baseDeps(activeAdmin.client, activeGrant))(request(), context("../bad"))).status, 404);

  const paidCustomer = { ...customer, clutch_codes_plan_code: "clutch_codes_starter", clutch_codes_subscription_status: "active" };
  const paidGrant = { ...activeGrant, state: "paid_subscription_access" };
  const paidResponse = await createQrCodeAnalyticsHandler(baseDeps(activeAdmin.client, paidGrant, paidCustomer))(request(), context());
  assert.equal((await paidResponse.json()).scope, "full_account");
  const failed = mockAdmin({ tableErrors: { qr_scans: new Error("scan failure") } });
  assert.equal((await createQrCodeAnalyticsHandler(baseDeps(failed.client, activeGrant))(request(), context())).status, 500);
});

test("included list, summary, and export handlers isolate owned aggregate data and reject expired access", async () => {
  const adminMock = mockAdmin({ codes: [
    { id: "qr-1", customer_id: customer.id, name: "=Campaign", slug: "included" },
    { id: "other-qr", customer_id: "other", name: "Other", slug: "other" },
  ] });
  const deps = (grant: any) => ({
    requireCustomer: async () => ({ user, customer }), createSupabaseAdminClient: () => adminMock.client,
    loadAccountAccess: async () => accountAccess, loadOrderLinkedQrAccess: async () => grant,
    fetchUnifiedAnalyticsData: async () => { throw new Error("full analytics must not be fetched"); },
  }) as any;
  const list = await createQrAnalyticsListHandler(deps(activeGrant))();
  const listBody = await list.json();
  assert.equal(listBody.scope, "basic_code");
  assert.equal(listBody.rows.length, 1);
  assert.equal(JSON.stringify(listBody).includes("Other"), false);
  const summary = await createAnalyticsSummaryHandler(deps(activeGrant))();
  const summaryBody = await summary.json();
  assert.equal(summaryBody.scope, "basic_code");
  assert.deepEqual(Object.keys(summaryBody.summary).sort(), ["activeQrCodes", "totalScans"]);
  assert.equal("profiles" in summaryBody, false);
  const exported = await createAnalyticsExportHandler(deps(activeGrant))(request("https://qr.example.test/api/analytics/export"));
  const csv = await exported.text();
  assert.match(csv, /'=Campaign/);
  assert.doesNotMatch(csv, /must-not-leak|Private City/);
  assert.equal((await createQrAnalyticsListHandler(deps(expiredGrant))()).status, 403);
  assert.equal((await createAnalyticsSummaryHandler(deps(expiredGrant))()).status, 403);
  assert.equal((await createAnalyticsExportHandler(deps(expiredGrant))(request())).status, 403);

  const failedAdmin = mockAdmin({ tableErrors: { qr_codes: new Error("database unavailable") } });
  const failedDeps = { ...deps(activeGrant), createSupabaseAdminClient: () => failedAdmin.client } as any;
  assert.equal((await createQrAnalyticsListHandler(failedDeps)()).status, 500);
  assert.equal((await createAnalyticsSummaryHandler(failedDeps)()).status, 500);
  assert.equal((await createAnalyticsExportHandler(failedDeps)(request())).status, 500);
});

test("paid analytics handlers retain the full account projection", async () => {
  const paidCustomer = { ...customer, clutch_codes_plan_code: "clutch_codes_starter", clutch_codes_subscription_status: "active" };
  const admin = mockAdmin();
  const fullData = {
    qrCodes: [{ id: "qr-1", name: "Paid", slug: "paid", destination_url: "https://example.com", is_active: true }],
    qrScans: [{ id: "scan-1", qr_code_id: "qr-1", created_at: "2026-02-01T00:00:00Z", ip_hash: "paid-only" }],
    profiles: [], connectEvents: [], isAdmin: false,
  };
  const paidGrant = { ...activeGrant, state: "paid_subscription_access" };
  const deps = {
    requireCustomer: async () => ({ user, customer: paidCustomer }), createSupabaseAdminClient: () => admin.client,
    loadAccountAccess: async () => accountAccess, loadOrderLinkedQrAccess: async () => paidGrant,
    fetchUnifiedAnalyticsData: async () => fullData,
  } as any;
  assert.equal((await (await createQrAnalyticsListHandler(deps)()).json()).scope, "full_account");
  assert.equal((await (await createAnalyticsSummaryHandler(deps)()).json()).scope, "full_account");
});

function updateRequest(destination: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("id", "qr-1");
  form.set("qr_type", "url");
  form.set("destination_url", destination);
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return new NextRequest("https://qr.example.test/api/qr/update", { method: "POST", body: form });
}

test("QR update route limits included access to a validated destination and handles IDOR, expiry, and database errors", async () => {
  const makeHandler = (admin: ReturnType<typeof mockAdmin>, grant = activeGrant, resolvedAccess = accountAccess) => createQrUpdateHandler({
    createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
    createSupabaseAdminClient: () => admin.client,
    loadAccountAccess: async () => resolvedAccess,
    loadOrderLinkedQrAccess: async () => grant,
  } as any);
  const active = mockAdmin();
  const response = await makeHandler(active)(updateRequest("https://new.example.com/path", { theme: "forged", name: "Forged", foreground_color: "#000000" }));
  assert.equal(response.status, 200);
  assert.deepEqual(active.updates.at(-1)?.patch, { destination_url: "https://new.example.com/path" });
  for (const bad of ["", "javascript:alert(1)", "data:text/html,bad", "ftp://example.com", "https://u:p@example.com", "not a url"]) {
    assert.equal((await makeHandler(mockAdmin())(updateRequest(bad))).status, 400);
  }
  assert.equal((await makeHandler(mockAdmin(), expiredGrant)(updateRequest("https://new.example.com"))).status, 403);
  assert.equal((await makeHandler(mockAdmin({ codes: [] }))(updateRequest("https://new.example.com"))).status, 404);
  assert.equal((await makeHandler(mockAdmin({ codes: [{ id: "qr-1", customer_id: "other", customer_can_edit_destination: true }] }))(updateRequest("https://new.example.com"))).status, 404);
  assert.equal((await makeHandler(mockAdmin({ updateError: new Error("update failed") }))(updateRequest("https://new.example.com"))).status, 500);

  const paidAdmin = mockAdmin({ codes: [{ id: "qr-1", customer_id: customer.id, name: "Original", qr_type: "url", customer_can_edit_destination: true }] });
  const paidGrant = { ...activeGrant, state: "paid_subscription_access" };
  const paidAccess = { ...accountAccess, canCustomizeQr: true };
  assert.equal((await makeHandler(paidAdmin, paidGrant, paidAccess)(updateRequest("https://paid.example.com", { theme: "paid-theme", name: "Paid name" }))).status, 200);
  assert.equal(paidAdmin.updates.at(-1)?.patch.theme, "paid-theme");
  assert.equal(paidAdmin.updates.at(-1)?.patch.name, "Paid name");
});

test("public redirect and scan ingestion continue for active, expired, and disabled management states", async () => {
  for (const managementState of ["active_included_access", "expired_included_access", "feature_disabled"]) {
    const inserted: Record<string, any[]> = { qr_scans: [], qr_scan_events: [] };
    const qr = { id: "qr-1", slug: "public-code", is_active: true, destination_url: "https://destination.example/path", qr_type: "tracked_print", scan_count: 0 };
    const admin = {
      from(table: string) {
        const chain: any = {
          select() { return chain; }, eq() { return chain; },
          async single() { return { data: qr, error: null }; },
          insert(value: any) { inserted[table].push(value); return Promise.resolve({ error: null }); },
          update() { return chain; },
          then(resolve: (value: any) => void) { resolve({ error: null }); },
        };
        return chain;
      },
    };
    const handler = createQrRedirectHandler({ createSupabaseAdminClient: () => admin as any });
    const response = await handler(request(`https://qr.example.test/qr/public-code?state=${managementState}`), { params: Promise.resolve({ slug: "public-code" }) });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), qr.destination_url);
    assert.equal(inserted.qr_scans.length, 1);
    assert.equal(inserted.qr_scan_events.length, 1);
    assert.doesNotMatch(response.headers.get("location") || "", /upgrade|subscribe|interstitial/i);
  }
});
