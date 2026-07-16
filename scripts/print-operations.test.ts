import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  MAX_PRINT_FILE_BYTES,
  PRINT_FILE_KINDS,
  PRINT_ORDER_FILE_BUCKET,
  PRINT_WORKFLOW_ACTIONS,
  actorCanPerformPrintAction,
  actorCanUploadPrintFile,
  allowedPrintFileExtension,
  buildPrintFilePath,
  canTransitionPrintOrder,
  isPrintFileKind,
  isPrintWorkflowAction,
  type PrintWorkflowAction,
  type PrintWorkflowState,
} from "../lib/print-operations.ts";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260713043811_print_operations_workflow.sql", import.meta.url), "utf8");
const uploadRoute = fs.readFileSync(new URL("../app/api/print-orders/[id]/files/route.ts", import.meta.url), "utf8");
const workflowRoute = fs.readFileSync(new URL("../app/api/print-orders/[id]/workflow/route.ts", import.meta.url), "utf8");
const signedRoute = fs.readFileSync(new URL("../app/api/print-order-files/[fileId]/route.ts", import.meta.url), "utf8");

test("print operations use one private bucket and a 25 MB limit", () => {
  assert.equal(PRINT_ORDER_FILE_BUCKET, "print-order-files");
  assert.equal(MAX_PRINT_FILE_BYTES, 26_214_400);
  assert.match(migration, /'print-order-files'[\s\S]*false,[\s\S]*26214400/);
  assert.doesNotMatch(migration, /create policy[^;]+storage\.objects/is);
});

test("only supported artwork and proof MIME types receive extensions", () => {
  assert.equal(allowedPrintFileExtension("application/pdf"), "pdf");
  assert.equal(allowedPrintFileExtension("image/JPEG"), "jpg");
  assert.equal(allowedPrintFileExtension("application/zip"), null);
  assert.equal(allowedPrintFileExtension("text/html"), null);
});

test("storage paths are order scoped and sanitize generated identifiers", () => {
  assert.equal(buildPrintFilePath({ orderId: "order-1", kind: "customer_artwork", fileId: "abc/../123", extension: "pdf" }), "order-1/customer_artwork/abc123.pdf");
});

test("file kinds are a closed allowlist", () => {
  for (const kind of PRINT_FILE_KINDS) assert.equal(isPrintFileKind(kind), true);
  assert.equal(isPrintFileKind("avatar"), false);
  assert.equal(isPrintFileKind("customer_proof"), false);
});

test("customers can upload only customer artwork", () => {
  assert.equal(actorCanUploadPrintFile("customer", "customer_artwork"), true);
  for (const kind of ["admin_proof", "production_artwork", "supplier_file"] as const) {
    assert.equal(actorCanUploadPrintFile("customer", kind), false);
  }
});

test("admins cannot impersonate the customer artwork path", () => {
  assert.equal(actorCanUploadPrintFile("admin", "customer_artwork"), false);
  assert.equal(actorCanUploadPrintFile("admin", "admin_proof"), true);
  assert.equal(actorCanUploadPrintFile("admin", "production_artwork"), true);
});

test("workflow actions are a closed allowlist", () => {
  for (const action of PRINT_WORKFLOW_ACTIONS) assert.equal(isPrintWorkflowAction(action), true);
  assert.equal(isPrintWorkflowAction("force_complete"), false);
});

test("customer and admin actions are separated", () => {
  for (const action of PRINT_WORKFLOW_ACTIONS) {
    const customerAction = ["approve_proof", "request_proof_revision"].includes(action);
    assert.equal(actorCanPerformPrintAction("customer", action), customerAction);
    assert.equal(actorCanPerformPrintAction("admin", action), !customerAction);
  }
});

const validTransitions: Array<[PrintWorkflowState, PrintWorkflowAction]> = [
  ["artwork_received", "begin_artwork_review"],
  ["artwork_review", "request_artwork_changes"],
  ["artwork_review", "approve_artwork"],
  ["proof_preparing", "send_proof"],
  ["proof_sent", "approve_proof"],
  ["proof_sent", "request_proof_revision"],
  ["ready_for_production", "submit_to_supplier"],
  ["submitted_to_supplier", "start_production"],
  ["in_production", "complete_production"],
  ["production_complete", "fulfill"],
  ["fulfilled", "mark_delivered"],
];

test("every expected artwork, proof, production, and fulfillment transition is centralized", () => {
  for (const [state, action] of validTransitions) assert.equal(canTransitionPrintOrder(state, action), true, `${state} -> ${action}`);
});

test("out-of-order workflow transitions are rejected", () => {
  assert.equal(canTransitionPrintOrder("awaiting_artwork", "send_proof"), false);
  assert.equal(canTransitionPrintOrder("proof_sent", "submit_to_supplier"), false);
  assert.equal(canTransitionPrintOrder("fulfilled", "start_production"), false);
});

test("delivered and cancelled orders cannot be cancelled again", () => {
  assert.equal(canTransitionPrintOrder("delivered", "cancel"), false);
  assert.equal(canTransitionPrintOrder("cancelled", "cancel"), false);
  assert.equal(canTransitionPrintOrder("in_production", "cancel"), true);
});

test("migration adds workflow fields without editing Phase 2 tables destructively", () => {
  assert.match(migration, /alter table public\.print_order_items[\s\S]*add column workflow_state/);
  assert.doesNotMatch(migration, /drop table public\.print_order_items/i);
  for (const field of ["supplier_order_id", "carrier", "artwork_received_at", "proof_approved_at", "production_completed_at", "shipped_at", "delivered_at"]) {
    assert.match(migration, new RegExp(`add column ${field}`));
  }
});

test("file and proof tables have RLS, ownership joins, and no client writes", () => {
  for (const table of ["print_order_files", "print_proofs"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /join public\.customers c on c\.id = poi\.customer_id/);
  assert.match(migration, /file_kind in \('customer_artwork','admin_proof'\)/);
  assert.match(migration, /c\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke insert, update, delete on public\.print_order_files, public\.print_proofs from anon, authenticated/);
});

test("database functions independently verify customer ownership and administrator status", () => {
  assert.match(migration, /c\.id = v_item\.customer_id and c\.auth_user_id = p_actor_auth_user_id/);
  assert.match(migration, /c\.auth_user_id = p_actor_auth_user_id and c\.is_admin/);
  assert.match(migration, /service role required/g);
});

test("workflow functions are service-only and use fixed search paths", () => {
  assert.match(migration, /register_print_order_file[\s\S]*security definer set search_path = ''/);
  assert.match(migration, /transition_print_order_workflow[\s\S]*security definer set search_path = ''/);
  assert.match(migration, /revoke all on function public\.register_print_order_file/);
  assert.match(migration, /revoke all on function public\.transition_print_order_workflow/);
  assert.match(migration, /grant execute on function public\.transition_print_order_workflow[^;]+to service_role/);
});

test("proof revisions preserve history and enforce one current proof", () => {
  assert.match(migration, /unique \(print_order_item_id, revision\)/);
  assert.match(migration, /create unique index print_proofs_current_unique/);
  assert.match(migration, /set is_current = false, status = 'superseded'/);
  assert.match(migration, /coalesce\(max\(revision\), 0\) \+ 1/);
});

test("workflow mutations and audit activity occur inside the same database functions", () => {
  assert.match(migration, /insert into public\.order_activity/g);
  assert.match(migration, /jsonb_build_object\('workflow_state', v_previous_state\)/);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /if exists \([\s\S]*a\.idempotency_key = p_idempotency_key/);
});

test("upload route authorizes the order, hashes files, and removes objects after registration failure", () => {
  assert.match(uploadRoute, /loadAuthorizedPrintOrder/);
  assert.match(uploadRoute, /createHash\("sha256"\)/);
  assert.match(uploadRoute, /register_print_order_file/);
  assert.match(uploadRoute, /if \(error\) \{[\s\S]*\.remove\(\[storagePath\]\)/);
  assert.doesNotMatch(uploadRoute, /RESEND|sendEmail|send\(/i);
});

test("workflow route authorizes before invoking the service-only state machine", () => {
  assert.ok(workflowRoute.indexOf("loadAuthorizedPrintOrder") < workflowRoute.indexOf("transition_print_order_workflow"));
  assert.match(workflowRoute, /actorCanPerformPrintAction/);
  assert.doesNotMatch(workflowRoute, /customer_email|raw_order_payload/);
});

test("signed file access is short-lived and requires order authorization", () => {
  assert.ok(signedRoute.indexOf("loadAuthorizedPrintOrder") < signedRoute.indexOf("createSignedUrl"));
  assert.match(signedRoute, /createSignedUrl\(file\.storage_path, 300/);
  assert.match(signedRoute, /!actor\.isAdmin && !\["customer_artwork", "admin_proof", "qr_artwork_asset"\]\.includes\(file\.file_kind\)/);
  assert.doesNotMatch(signedRoute, /getPublicUrl/);
});

test("customer and admin detail routes exist and use distinct access gates", () => {
  const customerPage = fs.readFileSync(new URL("../app/portal/print-orders/[id]/page.tsx", import.meta.url), "utf8");
  const adminPage = fs.readFileSync(new URL("../app/admin/print-orders/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(customerPage, /\.eq\("customer_id", customer\.id\)/);
  assert.match(adminPage, /if \(!customer\?\.is_admin\) redirect\("\/portal"\)/);
  assert.match(customerPage, /PrintOrderWorkflowActions/);
  assert.match(adminPage, /PrintOrderWorkflowActions/);
});
