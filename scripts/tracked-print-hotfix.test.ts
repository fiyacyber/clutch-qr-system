import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const hotfix = fs.readFileSync(
  new URL("../supabase/migrations/20260714015753_fix_tracked_print_service_rpc_authorization_and_activity_idempotency.sql", import.meta.url),
  "utf8",
);
const provisioning = fs.readFileSync(
  new URL("../supabase/migrations/20260713031044_correct_tracked_print_safety.sql", import.meta.url),
  "utf8",
);
const adapter = fs.readFileSync(new URL("../lib/tracked-print-supabase.ts", import.meta.url), "utf8");

const signatures = [
  "public.reconcile_included_qr_allowance(uuid)",
  "public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid)",
  "public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text)",
  "public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text)",
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("hotfix targets exactly the four tracked-print service RPC signatures", () => {
  for (const signature of signatures) assert.match(hotfix, new RegExp(escapeRegex(signature)));
  assert.equal((hotfix.match(/to_regprocedure\(v_signature\)/g) || []).length, 1);
});

test("hotfix removes only the expected legacy service-role body check", () => {
  assert.match(hotfix, /regexp_replace\([\s\S]*request\\\.jwt\\\.claim\\\.role[\s\S]*service role required/);
  assert.match(hotfix, /v_rewritten = v_definition[\s\S]*request\.jwt\.claim\.role/);
});

test("hotfix fails closed if a function or expected legacy check is absent", () => {
  assert.match(hotfix, /if v_function is null then[\s\S]*raise exception/);
  assert.match(hotfix, /expected legacy role check/);
  assert.match(hotfix, /could not safely remove legacy role check/);
});

test("function recreation preserves the complete existing definitions otherwise", () => {
  assert.match(hotfix, /pg_get_functiondef\(v_function::oid\)/);
  assert.match(hotfix, /execute v_rewritten/);
  assert.doesNotMatch(hotfix, /drop function/i);
});

test("public, anon, and authenticated execution are revoked for every RPC", () => {
  for (const signature of signatures) {
    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(hotfix, new RegExp(`revoke all on function ${escapeRegex(signature)} from ${role}`));
    }
  }
});

test("service_role remains the only explicitly granted API role", () => {
  for (const signature of signatures) {
    assert.match(hotfix, new RegExp(`grant execute on function ${escapeRegex(signature)} to service_role`));
  }
  assert.doesNotMatch(hotfix, /grant execute[^;]+to (?:anon|authenticated|public)/i);
});

test("duplicate non-null activity keys abort before the index changes", () => {
  assert.ok(hotfix.indexOf("having count(*) > 1") < hotfix.indexOf("drop index"));
  assert.match(hotfix, /duplicate non-null order_activity idempotency keys require manual review/);
});

test("activity idempotency becomes a normal inferable unique index", () => {
  assert.match(hotfix, /create unique index order_activity_idempotency_key_unique\s+on public\.order_activity\(idempotency_key\);/);
  assert.doesNotMatch(hotfix, /create unique index order_activity_idempotency_key_unique[^;]+where/i);
});

test("multiple null activity idempotency keys remain permitted", () => {
  assert.match(hotfix, /Multiple NULL values remain valid under a normal PostgreSQL unique/);
  assert.doesNotMatch(hotfix, /idempotency_key\s+not null/i);
});

test("the application keeps its PostgREST onConflict activity upsert", () => {
  assert.match(adapter, /upsert\([\s\S]*onConflict: "idempotency_key", ignoreDuplicates: true/);
});

test("SQL-side QR activity idempotency remains preserved", () => {
  assert.match(provisioning, /on conflict \(idempotency_key\) where idempotency_key is not null do nothing/);
});

test("the hotfix does not alter RLS, tables, entitlements, or product configuration", () => {
  assert.doesNotMatch(hotfix, /disable row level security|alter table public\.customers|included_qr_allowance\s*=|subscription_qr_limit\s*=|tracked_print_enabled/i);
});
