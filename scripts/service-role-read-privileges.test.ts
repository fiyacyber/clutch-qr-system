import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(repositoryRoot, "supabase", "migrations");
const migrationFilename = "20260718211056_reconcile_service_role_read_privileges.sql";
const migration = fs.readFileSync(path.join(migrationDirectory, migrationFilename), "utf8");
const executableMigration = migration.replace(/--.*$/gm, "");
const normalizedMigration = executableMigration.replace(/\s+/g, " ").trim();

const expectedTables = [
  "card_orders",
  "clutch_codes_allowance_migration_audit",
  "connect_events",
  "profile_click_events",
  "profile_leads",
  "profile_links",
  "profiles",
  "qr_scan_events",
  "qr_scans",
  "shopify_entitlement_events",
  "shopify_orders",
  "shopify_webhooks",
  "wallet_events",
  "webhook_events",
] as const;

test("migration grants only SELECT on the fourteen expected public tables to service_role", () => {
  assert.match(normalizedMigration, /^grant select on table [\s\S]+ to service_role;$/i);

  for (const table of expectedTables) {
    assert.match(normalizedMigration, new RegExp(`\\bpublic\\.${table}\\b`, "i"));
  }

  const qualifiedTables = [...normalizedMigration.matchAll(/\bpublic\.([a-z0-9_]+)\b/gi)].map((match) => match[1]);
  assert.deepEqual(qualifiedTables, [...expectedTables]);
  assert.equal((normalizedMigration.match(/\bgrant\b/gi) ?? []).length, 1);
  assert.doesNotMatch(normalizedMigration, /\bgrant\s+all\b/i);
  assert.doesNotMatch(normalizedMigration, /\b(insert|update|delete|truncate|references|trigger)\b[\s\S]*\bto\s+service_role\b/i);
});

test("customer_groups and application roles remain outside this migration", () => {
  assert.doesNotMatch(normalizedMigration, /\bcustomer_groups\b/i);
  assert.doesNotMatch(normalizedMigration, /\bto\s+(anon|authenticated)\b/i);
  assert.doesNotMatch(normalizedMigration, /\bfrom\s+(anon|authenticated)\b/i);
});

test("migration does not change RLS, policies, functions, ownership, sequences, or data", () => {
  assert.doesNotMatch(normalizedMigration, /\balter\s+table\b/i);
  assert.doesNotMatch(normalizedMigration, /\b(disable|enable)\s+row\s+level\s+security\b/i);
  assert.doesNotMatch(normalizedMigration, /\b(create|alter|drop)\s+policy\b/i);
  assert.doesNotMatch(normalizedMigration, /\b(create|alter|drop|replace)\s+(or\s+replace\s+)?function\b/i);
  assert.doesNotMatch(normalizedMigration, /\bowner\s+to\b/i);
  assert.doesNotMatch(normalizedMigration, /\bsequence\b/i);
  assert.doesNotMatch(normalizedMigration, /\b(insert\s+into|update\s+public\.|delete\s+from|truncate\s+table|merge\s+into)\b/i);
});

test("prohibited source-model migration is not introduced", () => {
  const migrationFilenames = fs.readdirSync(migrationDirectory);
  assert.equal(migrationFilenames.includes("20260713040000_clutch_codes_source_model.sql"), false);
});
