import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_PRINT_QR_INTEGRATION === "1";
const url = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:55321";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY || "";
const dbUrl = process.env.LOCAL_SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  wrong: "10000000-0000-4000-8000-000000000002",
  admin: "10000000-0000-4000-8000-000000000003",
  ownerCustomer: "20000000-0000-4000-8000-000000000001",
  wrongCustomer: "20000000-0000-4000-8000-000000000002",
  adminCustomer: "20000000-0000-4000-8000-000000000003",
  item: "30000000-0000-4000-8000-000000000001",
  qr: "40000000-0000-4000-8000-000000000001",
};

const design = {
  codeName: "Integration QR", campaignName: "Integration", destinationUrl: "https://example.com/original",
  foregroundColor: "#384862", backgroundColor: "#ffffff", dotStyle: "square", cornerStyle: "square",
  frameStyle: "none", frameColor: "#384862", frameLabel: "SCAN ME", logoPath: "", logoUrl: "", logoSize: 18,
  shortUrl: "http://127.0.0.1:3000/qr/integration-qr", slug: "integration-qr",
};
const placement = {
  placementMode: "customer_preference", artworkSide: "front", preferredPosition: "top_right",
  placementInstructions: "Keep clear of the fold.", preferredPrintSize: "1.5 inches",
};
const checksum = "a".repeat(64);

function client(key: string) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createUser(admin: SupabaseClient, id: string, email: string, password: string) {
  const result = await admin.auth.admin.createUser({ id, email, password, email_confirm: true });
  if (result.error && !result.error.message.includes("already")) throw result.error;
}

async function signIn(email: string, password: string) {
  const instance = client(anonKey);
  const { error } = await instance.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return instance;
}

test("service-role PostgREST submission is authorized without the legacy claim and remains atomic/idempotent", { skip: !enabled }, async () => {
  assert.ok(serviceKey && anonKey, "local Supabase keys are required");
  const admin = client(serviceKey);
  const password = "Integration-pass-123!";
  await Promise.all([
    createUser(admin, ids.owner, "qr-owner@example.test", password),
    createUser(admin, ids.wrong, "qr-wrong@example.test", password),
    createUser(admin, ids.admin, "qr-admin@example.test", password),
  ]);
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", `
    insert into public.customers (id, auth_user_id, email) values
      ('${ids.ownerCustomer}', '${ids.owner}', 'qr-owner@example.test'),
      ('${ids.wrongCustomer}', '${ids.wrong}', 'qr-wrong@example.test'),
      ('${ids.adminCustomer}', '${ids.admin}', 'qr-admin@example.test')
    on conflict (id) do nothing;
    update public.customers set is_admin = true, plan = 'admin', plan_code = 'admin' where id = '${ids.adminCustomer}';
    insert into public.print_order_items (
      id, customer_id, shopify_order_id, shopify_line_item_id, product_title, material_type, quantity,
      tracking_mode, provisioning_status, workflow_state, proof_status
    ) values (
      '${ids.item}', '${ids.ownerCustomer}', 'integration-order', 'integration-line', 'Integration print', 'vinyl', 1,
      'new_included_code', 'completed', 'awaiting_artwork', 'not_started'
    ) on conflict (id) do nothing;
    insert into public.qr_codes (
      id, customer_id, print_order_item_id, name, slug, destination_url, qr_type,
      capacity_source, counts_toward_capacity, customer_can_delete
    ) values (
      '${ids.qr}', '${ids.ownerCustomer}', '${ids.item}', 'Working draft', 'integration-qr', 'https://example.com/draft',
      'tracked_print', 'included_print', false, false
    ) on conflict (id) do nothing;
    insert into public.print_qr_provisionings (
      print_order_item_id, customer_id, qr_code_id, source_type, access_type, material_type, provisioning_status, idempotency_key
    ) values (
      '${ids.item}', '${ids.ownerCustomer}', '${ids.qr}', 'tracked_print', 'included_permanent', 'vinyl', 'completed', 'integration-provisioning'
    ) on conflict (print_order_item_id) do nothing;
  `], { stdio: "ignore" });

  const base = {
    p_print_order_item_id: ids.item, p_customer_id: ids.ownerCustomer, p_qr_code_id: ids.qr,
    p_storage_path: `${ids.ownerCustomer}/${ids.item}/qr-artwork/integration.svg`,
    p_original_filename: "integration.svg", p_mime_type: "image/svg+xml", p_size_bytes: 100,
    p_checksum_sha256: checksum, p_design_snapshot: design, p_placement_snapshot: placement,
    p_destination_url_snapshot: design.destinationUrl, p_actor_auth_user_id: ids.owner,
    p_idempotency_key: "integration-submission-1",
  };
  const preflight = await admin.rpc("prepare_print_qr_artwork_submission", {
    p_print_order_item_id: ids.item, p_customer_id: ids.ownerCustomer, p_qr_code_id: ids.qr,
    p_actor_auth_user_id: ids.owner, p_idempotency_key: base.p_idempotency_key,
    p_checksum_sha256: checksum, p_design_snapshot: design, p_placement_snapshot: placement,
  });
  assert.ifError(preflight.error);
  assert.deepEqual(preflight.data, []);

  const [first, duplicate] = await Promise.all([
    admin.rpc("register_print_qr_artwork_submission", base),
    admin.rpc("register_print_qr_artwork_submission", base),
  ]);
  assert.ifError(first.error);
  assert.ifError(duplicate.error);
  assert.equal(first.data?.[0].version_id, duplicate.data?.[0].version_id);
  assert.equal(first.data?.[0].file_id, duplicate.data?.[0].file_id);
  assert.equal(first.data?.[0].revision, 1);

  const { data: versions } = await admin.from("print_qr_artwork_versions").select("*").eq("print_order_item_id", ids.item);
  assert.equal(versions?.length, 1);
  assert.deepEqual(versions?.[0].placement_snapshot, placement);
  const { data: item } = await admin.from("print_order_items").select("placement_mode,artwork_side,preferred_position,placement_instructions,preferred_print_size").eq("id", ids.item).single();
  assert.deepEqual(item, { placement_mode: "customer_preference", artwork_side: "front", preferred_position: "top_right", placement_instructions: "Keep clear of the fold.", preferred_print_size: "1.5 inches" });

  const changedDesign = { ...design, codeName: "Changed working draft", destinationUrl: "https://example.com/changed" };
  const draft = await admin.rpc("save_print_qr_artwork_draft", {
    p_print_order_item_id: ids.item, p_customer_id: ids.ownerCustomer, p_qr_code_id: ids.qr,
    p_actor_auth_user_id: ids.owner, p_design: changedDesign, p_placement: placement,
  });
  assert.ifError(draft.error);
  const { data: frozen } = await admin.from("print_qr_artwork_versions").select("design_snapshot").eq("id", first.data?.[0].version_id).single();
  assert.equal(frozen?.design_snapshot.codeName, "Integration QR");
  const immutableAttempt = await admin.from("print_qr_artwork_versions").update({ design_snapshot: changedDesign }).eq("id", first.data?.[0].version_id);
  assert.match(immutableAttempt.error?.message || "", /immutable/);

  const concurrent = await Promise.all([
    admin.rpc("register_print_qr_artwork_submission", { ...base, p_storage_path: `${ids.ownerCustomer}/${ids.item}/qr-artwork/concurrent-a.svg`, p_idempotency_key: "integration-concurrent-a" }),
    admin.rpc("register_print_qr_artwork_submission", { ...base, p_storage_path: `${ids.ownerCustomer}/${ids.item}/qr-artwork/concurrent-b.svg`, p_idempotency_key: "integration-concurrent-b" }),
  ]);
  concurrent.forEach((result) => assert.ifError(result.error));
  const revisions = concurrent.map((result) => Number(result.data?.[0].revision));
  assert.equal(new Set(revisions).size, 2);

  await admin.from("print_order_items").update({ workflow_state: "proof_preparing", proof_status: "preparing" }).eq("id", ids.item);
  const proofFile = await admin.rpc("register_print_order_file", {
    p_print_order_item_id: ids.item, p_file_kind: "admin_proof", p_storage_path: `${ids.item}/admin_proof/proof.pdf`,
    p_original_filename: "front-back-proof.pdf", p_mime_type: "application/pdf", p_size_bytes: 100,
    p_checksum_sha256: "b".repeat(64), p_actor_type: "admin", p_actor_auth_user_id: ids.admin,
    p_idempotency_key: "integration-proof-file",
  });
  assert.ifError(proofFile.error);
  const proofId = proofFile.data?.[0].proof_id;
  const proofMeta = await admin.rpc("update_print_proof_review_metadata", {
    p_print_order_item_id: ids.item, p_proof_id: proofId, p_actor_auth_user_id: ids.admin,
    p_page_labels: ["Front", "Back"], p_qr_placement_note: "Front, top right, 1.5 inches", p_scan_validation_status: "passed",
  });
  assert.ifError(proofMeta.error);
  const { data: proof } = await admin.from("print_proofs").select("qr_artwork_version_id,qr_revision,page_labels,qr_destination_snapshot,qr_scan_validation_status").eq("id", proofId).single();
  assert.ok(proof?.qr_artwork_version_id);
  assert.ok(proof?.qr_revision);
  assert.deepEqual(proof?.page_labels, ["Front", "Back"]);

  const send = await admin.rpc("transition_print_order_workflow", {
    p_print_order_item_id: ids.item, p_action: "send_proof", p_actor_type: "admin", p_actor_auth_user_id: ids.admin,
    p_reason: null, p_metadata: {}, p_idempotency_key: "integration-send-proof",
  });
  assert.ifError(send.error);
  const bypassApproval = await admin.from("print_order_items").update({ workflow_state: "ready_for_production", proof_status: "approved" }).eq("id", ids.item);
  assert.match(bypassApproval.error?.message || "", /only approval of the current complete artwork proof/);
  const raceSubmission = admin.rpc("register_print_qr_artwork_submission", { ...base, p_storage_path: `${ids.ownerCustomer}/${ids.item}/qr-artwork/race.svg`, p_idempotency_key: "integration-race" });
  const approval = admin.rpc("transition_print_order_workflow", {
    p_print_order_item_id: ids.item, p_action: "approve_proof", p_actor_type: "customer", p_actor_auth_user_id: ids.owner,
    p_reason: null, p_metadata: {}, p_idempotency_key: "integration-approve-proof",
  });
  const [raceResult, approvalResult] = await Promise.all([raceSubmission, approval]);
  assert.match(raceResult.error?.message || "", /proof is sent/);
  assert.ifError(approvalResult.error);
  const { data: approvedItem } = await admin.from("print_order_items").select("workflow_state,proof_status").eq("id", ids.item).single();
  assert.deepEqual(approvedItem, { workflow_state: "ready_for_production", proof_status: "approved" });

  const retryAfterApproval = await admin.rpc("register_print_qr_artwork_submission", base);
  assert.ifError(retryAfterApproval.error);
  assert.equal(retryAfterApproval.data?.[0].version_id, first.data?.[0].version_id);

  const anon = client(anonKey);
  const denied = await anon.rpc("register_print_qr_artwork_submission", base);
  assert.ok(denied.error);
  const [ownerClient, wrongClient, adminClient] = await Promise.all([
    signIn("qr-owner@example.test", password), signIn("qr-wrong@example.test", password), signIn("qr-admin@example.test", password),
  ]);
  const [ownerFiles, wrongFiles, adminFiles] = await Promise.all([
    ownerClient.from("print_order_files").select("id").eq("print_order_item_id", ids.item),
    wrongClient.from("print_order_files").select("id").eq("print_order_item_id", ids.item),
    adminClient.from("print_order_files").select("id").eq("print_order_item_id", ids.item),
  ]);
  assert.ok((ownerFiles.data?.length || 0) > 0);
  assert.equal(wrongFiles.data?.length, 0);
  assert.equal(adminFiles.data?.length, ownerFiles.data?.length);
});
