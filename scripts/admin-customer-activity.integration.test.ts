import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_ADMIN_CUSTOMER_ACTIVITY_INTEGRATION === "1";
const url = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:55321";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY || "";
const dbUrl =
  process.env.LOCAL_SUPABASE_DB_URL ||
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const customerId = "60000000-0000-4000-8000-000000000001";
const orderId = (sequence: number) =>
  `70000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
const activityId = (sequence: number) =>
  `80000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;

function client(key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test(
  "admin customer activity remains complete, deterministic, bounded, and service-role only",
  { skip: !enabled },
  async () => {
    assert.ok(serviceKey && anonKey, "local Supabase keys are required");

    execFileSync(
      "psql",
      [
        dbUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `
          -- PR #18 owns this existing-table service-role grant. Reproduce that
          -- already-approved prerequisite in the isolated local fixture.
          grant select on public.shopify_entitlement_events to service_role;

          delete from public.order_activity
          where order_id in (
            select id from public.print_order_items where customer_id = '${customerId}'
          );
          delete from public.shopify_entitlement_events where customer_id = '${customerId}';
          delete from public.print_order_items where customer_id = '${customerId}';
          delete from public.customers where id = '${customerId}';

          insert into public.customers (id, email, company_name)
          values ('${customerId}', 'activity-fixture@example.test', 'Activity Fixture');

          insert into public.print_order_items (
            id,
            customer_id,
            shopify_order_id,
            shopify_line_item_id,
            product_title,
            material_type,
            quantity,
            tracking_mode,
            provisioning_status,
            created_at
          )
          select
            ('70000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
            '${customerId}'::uuid,
            'activity-order-' || sequence,
            'activity-line-' || sequence,
            'Activity order ' || sequence,
            'vinyl',
            1,
            'none',
            'not_required',
            timestamptz '2026-01-01 00:00:00+00' + sequence * interval '1 hour'
          from generate_series(1, 55) as sequence;

          insert into public.order_activity (
            id,
            order_type,
            order_id,
            action,
            actor_type,
            created_at
          )
          select
            ('80000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
            'print_order',
            ('70000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
            case
              when sequence in (1, 2) then 'outside_displayed_' || sequence
              else 'activity_' || sequence
            end,
            'admin',
            case
              when sequence in (1, 2) then timestamptz '2026-12-31 00:00:00+00'
              else timestamptz '2026-02-01 00:00:00+00' + sequence * interval '1 hour'
            end
          from generate_series(1, 55) as sequence;

          insert into public.shopify_entitlement_events (
            id,
            event_key,
            shopify_event_id,
            topic,
            customer_id,
            action,
            status,
            created_at
          ) values (
            '90000000-0000-4000-8000-000000000001',
            'activity-fixture-entitlement',
            'activity-fixture-event',
            'subscription_contracts/update',
            '${customerId}',
            'subscription_updated',
            'completed',
            '2026-12-30 00:00:00+00'
          );
        `,
      ],
      { stdio: "ignore" }
    );

    const service = client(serviceKey);
    const displayedOrders = await service
      .from("print_order_items")
      .select("id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    assert.ifError(displayedOrders.error);
    assert.equal(displayedOrders.data?.length, 50);
    assert.equal(displayedOrders.data?.some((order) => order.id === orderId(1)), false);
    assert.equal(displayedOrders.data?.some((order) => order.id === orderId(2)), false);

    const activity = await service
      .from("admin_customer_activity")
      .select(
        "id,customer_id,source,action,actor_type,reason,status,error_message,created_at",
        { count: "exact" }
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(25);
    assert.ifError(activity.error);
    assert.equal(activity.count, 56);
    assert.equal(activity.data?.length, 25);
    assert.deepEqual(
      activity.data?.slice(0, 2).map((event) => [event.id, event.action]),
      [
        [`print_order:${activityId(2)}`, "outside_displayed_2"],
        [`print_order:${activityId(1)}`, "outside_displayed_1"],
      ]
    );
    assert.equal(activity.data?.[2]?.source, "shopify_entitlement");

    const anon = await client(anonKey)
      .from("admin_customer_activity")
      .select("id")
      .limit(1);
    assert.ok(anon.error);

    const authenticated = spawnSync(
      "psql",
      [
        dbUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "set role authenticated; select id from public.admin_customer_activity limit 1;",
      ],
      { encoding: "utf8" }
    );
    assert.notEqual(authenticated.status, 0);
    assert.match(authenticated.stderr, /permission denied/i);

    const privilegeEvidence = execFileSync(
      "psql",
      [
        dbUrl,
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `
          select
            has_table_privilege('service_role', 'public.admin_customer_activity', 'select'),
            has_table_privilege('anon', 'public.admin_customer_activity', 'select'),
            has_table_privilege('authenticated', 'public.admin_customer_activity', 'select');
        `,
      ],
      { encoding: "utf8" }
    ).trim();
    assert.equal(privilegeEvidence, "t|f|f");

    const indexes = execFileSync(
      "psql",
      [
        dbUrl,
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `
          select indexname
          from pg_indexes
          where schemaname = 'public'
            and indexname in (
              'order_activity_print_order_lookup_idx',
              'shopify_entitlement_events_customer_activity_idx'
            )
          order by indexname;
        `,
      ],
      { encoding: "utf8" }
    ).trim().split("\n");
    assert.deepEqual(indexes, [
      "order_activity_print_order_lookup_idx",
      "shopify_entitlement_events_customer_activity_idx",
    ]);
  }
);
