import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertAdminCustomerQueriesSucceeded } from "../lib/admin-customer-data.ts";
import { summarizeAdminCustomerEvidence } from "../lib/admin-customer-detail.ts";
import {
  buildAdminOrderSearchHref,
  formatAdminLabel,
  formatOrderAge,
  getAdminStatusTone,
} from "../lib/admin-operations.ts";
import { isCanonicalCustomerId } from "../lib/customer-identifiers.ts";

const EXISTING_CUSTOMER_ID = "41802ffc-0389-4184-afca-e9dbb67d0c96";
const UNKNOWN_CUSTOMER_ID = "11b580c5-4f42-4e72-b4f6-1ffb0c074327";

test("admin labels never expose raw enum formatting", () => {
  assert.equal(formatAdminLabel("new_included_code"), "New Included Code");
  assert.equal(formatAdminLabel("ready_for_production"), "Ready for Production");
  assert.equal(formatAdminLabel("needs_attention"), "Needs Attention");
  assert.equal(formatAdminLabel("qr_setup_required"), "QR Setup Required");
  assert.equal(formatAdminLabel("approved"), "Approved");
  assert.equal(formatAdminLabel("qr"), "QR");
  assert.equal(formatAdminLabel("Customer supplied note"), "Customer supplied note");
});

test("admin status tones preserve operational meaning", () => {
  assert.equal(getAdminStatusTone("needs_attention"), "attention");
  assert.equal(getAdminStatusTone("ready_for_production"), "success");
  assert.equal(getAdminStatusTone("in_production"), "warning");
});

test("order age is readable and deterministic", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  assert.equal(formatOrderAge("2026-07-16T11:30:00.000Z", now), "< 1 hour");
  assert.equal(formatOrderAge("2026-07-16T09:00:00.000Z", now), "3 hours");
  assert.equal(formatOrderAge("2026-07-14T12:00:00.000Z", now), "2 days");
});

test("global admin search builds a trimmed encoded order destination", () => {
  assert.equal(
    buildAdminOrderSearchHref(" PR15-QA-15001 "),
    "/admin/print-orders?q=PR15-QA-15001"
  );
  assert.equal(
    buildAdminOrderSearchHref("Casey & Riley"),
    "/admin/print-orders?q=Casey+%26+Riley"
  );
  assert.equal(buildAdminOrderSearchHref("   "), "/admin/print-orders");
});

test("customer-management query failures cannot render as an empty state", () => {
  assert.doesNotThrow(() => {
    assertAdminCustomerQueriesSucceeded([
      { name: "customers", error: null },
      { name: "customer groups", error: undefined },
    ]);
  });

  assert.throws(
    () => {
      assertAdminCustomerQueriesSucceeded([
        {
          name: "customers",
          error: {
            code: "42501",
            message: "permission denied for table customer_groups",
          },
        },
      ]);
    },
    /Unable to load required admin customer-management data.*customers: 42501 permission denied for table customer_groups/
  );
});

test("customer_groups permission migration stays service-role only", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260717031126_restore_customer_groups_service_role_privileges.sql",
      import.meta.url
    ),
    "utf8"
  ).toLowerCase();

  assert.match(
    migration,
    /grant all privileges on table public\.customer_groups to service_role;/
  );
  assert.doesNotMatch(migration, /\bto\s+(anon|authenticated)\b/);
  assert.doesNotMatch(migration, /\b(create|alter|drop)\s+policy\b/);
});

test("print order table exposes a keyboard-focusable named scroll region", () => {
  const page = readFileSync(
    new URL("../app/admin/print-orders/page.tsx", import.meta.url),
    "utf8"
  );
  const styles = readFileSync(
    new URL("../app/admin/print-orders/page.module.css", import.meta.url),
    "utf8"
  );

  assert.match(page, /role="region"/);
  assert.match(page, /aria-label="Print orders table\.[^"]+"/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(styles, /\.tableScroll:focus-visible/);
  assert.match(styles, /overflow:\s*auto/);
});

test("order detail keeps operational actions while using structured workflow groups", () => {
  const page = readFileSync(
    new URL("../app/admin/print-orders/[id]/page.tsx", import.meta.url),
    "utf8"
  );
  const actions = readFileSync(
    new URL("../components/print-orders/PrintOrderWorkflowActions.tsx", import.meta.url),
    "utf8"
  );

  for (const section of ["Order", "Artwork", "QR placement", "Proof", "Production", "Fulfillment", "Supplier"]) {
    assert.match(page, new RegExp(`>${section}<`));
  }
  assert.match(page, /aria-label="Order workflow status"/);
  assert.match(actions, /<fieldset/);
  assert.match(actions, /<legend>Artwork review<\/legend>/);
  assert.match(actions, /<legend>Proof preparation<\/legend>/);
  assert.match(actions, /<legend>Supplier and production<\/legend>/);
  assert.match(actions, /<legend>Fulfillment<\/legend>/);
  assert.match(actions, /className=\{styles\.dangerButton\}[\s\S]*?>Cancel workflow<\/button>/);
});

test("customer evidence summary accepts populated, empty, object, array, and null relations", () => {
  const customer = {
    included_qr_allowance: 1,
    subscription_qr_limit: 10,
    clutch_codes_plan_code: "clutch_codes_starter",
    clutch_codes_subscription_status: "active",
  };
  const populated = summarizeAdminCustomerEvidence({
    customer,
    qrCodes: { counts_toward_capacity: true, is_system: true, qr_type: "smart_card" },
    profiles: [{ is_active: true }],
    cardOrders: {},
    printOrders: { material_type: "business_cards" },
    provisionings: [{
      access_type: "included_permanent",
      source_type: "business_kit",
      provisioning_status: "completed",
      material_type: "business_cards",
    }],
  });

  assert.equal(populated.counts.qrCodes, 1);
  assert.equal(populated.counts.activeProfiles, 1);
  assert.equal(populated.counts.printOrders, 1);
  assert.equal(populated.access.hasSmartCard, true);
  assert.equal(populated.access.hasBusinessKit, true);

  const empty = summarizeAdminCustomerEvidence({
    customer,
    qrCodes: null,
    profiles: undefined,
    cardOrders: [],
    printOrders: null,
    provisionings: undefined,
  });
  assert.deepEqual(empty.counts, {
    qrCodes: 0,
    activeProfiles: 0,
    cardOrders: 0,
    printOrders: 0,
    completedProvisionings: 0,
  });

  const exact = summarizeAdminCustomerEvidence({
    customer,
    qrCodes: [{ counts_toward_capacity: true }],
    profiles: [{ is_active: true }],
    cardOrders: [{}],
    printOrders: [{ material_type: "postcard" }],
    provisionings: [{
      access_type: "included_permanent",
      source_type: "tracked_print",
      provisioning_status: "completed",
    }],
    exact: {
      qrCodes: 75,
      usedQrCodes: 72,
      activeProfiles: 4,
      cardOrders: 8,
      printOrders: 120,
      completedProvisionings: 110,
      includedPrintQr: 105,
      hasSmartCardSystemQr: true,
      hasTrackedPrint: true,
      hasBusinessKit: true,
    },
  });
  assert.deepEqual(exact.counts, {
    qrCodes: 75,
    activeProfiles: 4,
    cardOrders: 8,
    printOrders: 120,
    completedProvisionings: 110,
  });
  assert.equal(exact.access.usedQrCount, 72);
  assert.equal(exact.access.printOrderCount, 120);
  assert.equal(exact.access.includedPrintQrCount, 105);
  assert.equal(exact.access.hasTrackedPrint, true);
  assert.equal(exact.access.hasBusinessKit, true);
});

test("customer IDs accept only canonical version 4 UUIDs used by public.customers", () => {
  assert.equal(isCanonicalCustomerId(EXISTING_CUSTOMER_ID), true);
  assert.equal(isCanonicalCustomerId(UNKNOWN_CUSTOMER_ID), true);
  assert.equal(isCanonicalCustomerId("not-a-customer"), false);
  assert.equal(isCanonicalCustomerId("41802ffc-0389-4184-afca-e9dbb67d0c9"), false);
  assert.equal(isCanonicalCustomerId(`x${EXISTING_CUSTOMER_ID}`), false);
  assert.equal(isCanonicalCustomerId(`${EXISTING_CUSTOMER_ID}x`), false);
  assert.equal(isCanonicalCustomerId(EXISTING_CUSTOMER_ID.toUpperCase()), false);
  assert.equal(isCanonicalCustomerId("41802ffc-0389-1184-afca-e9dbb67d0c96"), false);
  assert.equal(isCanonicalCustomerId("41802ffc-0389-4184-7fca-e9dbb67d0c96"), false);
  assert.equal(isCanonicalCustomerId(null), false);
});

test("customer detail rejects malformed IDs before creating a Supabase customer query", () => {
  const detailPage = readFileSync(
    new URL("../app/admin/customers/[id]/page.tsx", import.meta.url),
    "utf8"
  );
  const adminGuard = detailPage.indexOf('if (!currentCustomer?.is_admin) redirect("/portal")');
  const identifierGuard = detailPage.indexOf("if (!isCanonicalCustomerId(routeId)) notFound()");
  const clientCreation = detailPage.indexOf("createSupabaseAdminClient()");
  const customerQuery = detailPage.indexOf('.from("customers")');

  assert.ok(adminGuard >= 0);
  assert.ok(identifierGuard > adminGuard);
  assert.ok(clientCreation > identifierGuard);
  assert.ok(customerQuery > clientCreation);
  assert.match(
    detailPage,
    /assertAdminCustomerQueriesSucceeded\(\[\s*\{ name: "customer account", error: customerResult\.error \},\s*\]\);\s*if \(!customerResult\.data\) notFound\(\)/
  );
});

test("customer detail is admin guarded, UUID scoped, bounded, read-only, and fail closed", () => {
  const listPage = readFileSync(
    new URL("../app/admin/customers/page.tsx", import.meta.url),
    "utf8"
  );
  const detailPage = readFileSync(
    new URL("../app/admin/customers/[id]/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(listPage, /href=\{`\/admin\/customers\/\$\{c\.id\}`\}/);
  assert.match(detailPage, /if \(!currentCustomer\?\.is_admin\) redirect\("\/portal"\)/);
  assert.match(
    detailPage,
    /\.from\("customers"\)[\s\S]*?\.eq\("id", id\)\s*\.limit\(1\)\s*\.maybeSingle\(\)/
  );
  for (const table of ["qr_codes", "profiles", "print_order_items", "print_qr_provisionings", "card_orders", "shopify_orders", "shopify_entitlement_events"]) {
    assert.match(detailPage, new RegExp(`\\.from\\("${table}"\\)[\\s\\S]*?\\.eq\\("customer_id", id\\)`));
  }
  assert.match(detailPage, /if \(!customerResult\.data\) notFound\(\)/);
  assert.match(detailPage, /assertAdminCustomerQueriesSucceeded\(/);
  for (const table of ["qr_codes", "profiles", "print_order_items", "print_qr_provisionings", "card_orders", "shopify_orders", "shopify_entitlement_events"]) {
    const boundedList = new RegExp(
      `\\.from\\("${table}"\\)\\.select\\([^\\n]+\\{ count: "exact" \\}\\)[^\\n]+\\.limit\\(CUSTOMER_DETAIL_LIST_LIMIT\\)`
    );
    assert.match(detailPage, boundedList);
  }
  assert.match(detailPage, /formatRecordSummary\(/);
  assert.match(detailPage, /exact:\s*\{[\s\S]*?usedQrCodes: usedQrCountResult\.count \?\? 0/);
  assert.doesNotMatch(detailPage, /\.from\("profile_leads"\)/);
  assert.doesNotMatch(detailPage, /\.from\("profile_click_events"\)/);
  assert.doesNotMatch(detailPage, /\.(insert|update|upsert|delete)\(/);
  assert.doesNotMatch(detailPage, /<form/);
});

test("customer workflow markup remains pre-PR structure and admin cancellation is confirmed", () => {
  const actions = readFileSync(
    new URL("../components/print-orders/PrintOrderWorkflowActions.tsx", import.meta.url),
    "utf8"
  );
  const customerStart = actions.indexOf('if (actorType !== "admin")');
  const customerEnd = actions.indexOf("const adminCanUploadProof", customerStart);
  const customerRenderer = actions.slice(customerStart, customerEnd);

  assert.ok(customerStart >= 0);
  assert.ok(customerEnd > customerStart);
  assert.match(customerRenderer, /<section className="dashboard-card" aria-busy=\{busy\}>/);
  assert.match(customerRenderer, /<h2>Your actions<\/h2>/);
  assert.match(customerRenderer, /\{message \? <p role="status">\{message\}<\/p> : null\}/);
  assert.match(customerRenderer, /<form className="admin-form"/);
  assert.match(customerRenderer, /<label>Artwork file<input name="file"/);
  assert.match(customerRenderer, /<button type="submit" disabled=\{busy\}>Upload artwork<\/button>/);
  assert.doesNotMatch(customerRenderer, /styles\./);
  assert.doesNotMatch(customerRenderer, /Current state:/);
  assert.doesNotMatch(customerRenderer, /Workflow actions/);

  assert.match(actions, /window\.confirm\(\s*"Cancel this order workflow\?/);
  assert.match(actions, /onClick=\{confirmCancellation\}>Cancel workflow<\/button>/);
  assert.doesNotMatch(actions, /onClick=\{\(\) => void transition\("cancel"\)\}>Cancel workflow/);
});
