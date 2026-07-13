-- Clutch Codes release verification.
-- READ ONLY: every executable statement in this file is SELECT-only.
-- Run after the allowance migration and any approved manual remediation.
-- A passing release has passed = true (or violating_count = 0) for every check.

-- 1. customers.plan and customers.plan_code accept every canonical/legacy value.
with required_values(value) as (
  values
    ('free_qr'),
    ('connect_basic'),
    ('connect_plus'),
    ('qr_pro'),
    ('qr_pro_plus'),
    ('agency'),
    ('admin')
), expected_constraints(constraint_name) as (
  values ('customers_plan_check'), ('customers_plan_code_check')
), definitions as (
  select
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  where con.conrelid = 'public.customers'::regclass
)
select
  'plan_constraint_values' as check_name,
  expected.constraint_name,
  coalesce(
    (
      select bool_and(strpos(definition.definition, quote_literal(required.value)) > 0)
      from required_values required
    ),
    false
  ) as passed,
  coalesce(definition.definition, 'MISSING') as detail
from expected_constraints expected
left join definitions definition using (constraint_name)
order by expected.constraint_name;

-- 2. Both authoritative allowances are nonnegative for every customer.
select
  'allowances_nonnegative' as check_name,
  count(*) filter (
    where included_qr_allowance < 0 or subscription_qr_limit < 0
  ) = 0 as passed,
  count(*) filter (
    where included_qr_allowance < 0 or subscription_qr_limit < 0
  ) as violating_count
from public.customers;

-- 3. Clean-install defaults for both authoritative allowances are zero.
with expected_columns(column_name) as (
  values ('included_qr_allowance'), ('subscription_qr_limit')
), definitions as (
  select column_name, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'customers'
)
select
  'allowance_clean_default_zero' as check_name,
  expected.column_name,
  definition.column_default,
  coalesce(
    regexp_replace(definition.column_default, '[^0-9-]', '', 'g') = '0',
    false
  ) as passed
from expected_columns expected
left join definitions definition using (column_name)
order by expected.column_name;

-- 4. Admin plan, plan_code, and legacy capacity still match the pre-migration evidence.
select
  'admin_rows_preserved' as check_name,
  count(*) filter (
    where audit.customer_id is null
       or audit.classification <> 'admin_preserve'
       or customer.plan is distinct from audit.evidence->>'plan'
       or customer.plan_code is distinct from audit.evidence->>'plan_code'
       or customer.qr_limit is distinct from (audit.evidence->>'legacy_qr_limit')::integer
  ) = 0 as passed,
  count(*) filter (
    where audit.customer_id is null
       or audit.classification <> 'admin_preserve'
       or customer.plan is distinct from audit.evidence->>'plan'
       or customer.plan_code is distinct from audit.evidence->>'plan_code'
       or customer.qr_limit is distinct from (audit.evidence->>'legacy_qr_limit')::integer
  ) as violating_count
from public.customers customer
left join public.clutch_codes_allowance_migration_audit audit
  on audit.customer_id = customer.id
where customer.is_admin;

-- 5. No unresolved review row received authoritative capacity automatically.
select
  'unresolved_review_rows_have_zero_capacity' as check_name,
  count(*) filter (
    where audit.review_required
      and (customer.included_qr_allowance <> 0 or customer.subscription_qr_limit <> 0)
  ) = 0 as passed,
  count(*) filter (
    where audit.review_required
      and (customer.included_qr_allowance <> 0 or customer.subscription_qr_limit <> 0)
  ) as violating_count
from public.clutch_codes_allowance_migration_audit audit
join public.customers customer on customer.id = audit.customer_id;

-- 6. qr_limit is only the compatibility mirror for every non-admin customer.
select
  'legacy_qr_limit_matches_authoritative_sum' as check_name,
  count(*) filter (
    where qr_limit <> included_qr_allowance + subscription_qr_limit
  ) = 0 as passed,
  count(*) filter (
    where qr_limit <> included_qr_allowance + subscription_qr_limit
  ) as violating_count
from public.customers
where is_admin is false;

-- Diagnostic details for any compatibility-mirror mismatch.
select
  id as customer_id,
  qr_limit,
  included_qr_allowance,
  subscription_qr_limit,
  included_qr_allowance + subscription_qr_limit as expected_qr_limit
from public.customers
where is_admin is false
  and qr_limit <> included_qr_allowance + subscription_qr_limit
order by id;

-- 7. QR records captured by pre-migration evidence remain with the same customer.
with current_counts as (
  select customer_id, count(*)::integer as qr_count
  from public.qr_codes
  group by customer_id
)
select
  'existing_qr_records_preserved' as check_name,
  count(*) filter (
    where coalesce(current_counts.qr_count, 0)
      < coalesce((audit.evidence->>'existing_qr_count')::integer, 0)
  ) = 0 as passed,
  count(*) filter (
    where coalesce(current_counts.qr_count, 0)
      < coalesce((audit.evidence->>'existing_qr_count')::integer, 0)
  ) as violating_count
from public.clutch_codes_allowance_migration_audit audit
left join current_counts on current_counts.customer_id = audit.customer_id;

-- Every current QR still has a valid customer association and enforced foreign key.
select
  'qr_customer_associations_valid' as check_name,
  count(*) filter (where customer.id is null) = 0
    and exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid = 'public.qr_codes'::regclass
        and constraint_record.contype = 'f'
        and constraint_record.conname = 'qr_codes_customer_id_fkey'
    ) as passed,
  count(*) filter (where customer.id is null) as orphaned_qr_count
from public.qr_codes qr
left join public.customers customer on customer.id = qr.customer_id;

-- 8a. shopify_entitlement_events has every expected constraint.
with expected(constraint_name) as (
  values
    ('shopify_entitlement_events_pkey'),
    ('shopify_entitlement_events_event_key_key'),
    ('shopify_entitlement_events_customer_id_fkey'),
    ('shopify_entitlement_events_status_check'),
    ('shopify_entitlement_events_plan_code_check'),
    ('shopify_entitlement_events_subscription_qr_limit_check')
), actual as (
  select conname as constraint_name
  from pg_constraint
  where conrelid = 'public.shopify_entitlement_events'::regclass
)
select
  'shopify_entitlement_events_constraint' as check_name,
  expected.constraint_name,
  actual.constraint_name is not null as passed
from expected
left join actual using (constraint_name)
order by expected.constraint_name;

-- 8b. shopify_entitlement_events has every expected index.
with expected(index_name) as (
  values
    ('shopify_entitlement_events_pkey'),
    ('shopify_entitlement_events_event_key_key'),
    ('shopify_entitlement_events_shopify_event_id_idx'),
    ('shopify_entitlement_events_shopify_order_id_idx'),
    ('shopify_entitlement_events_subscription_contract_id_idx'),
    ('shopify_entitlement_events_customer_id_idx')
), actual as (
  select indexname as index_name
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'shopify_entitlement_events'
)
select
  'shopify_entitlement_events_index' as check_name,
  expected.index_name,
  actual.index_name is not null as passed
from expected
left join actual using (index_name)
order by expected.index_name;

-- 9a. Entitlement events contain only canonical Clutch Codes plan codes, never Connect+.
select
  'clutch_codes_events_do_not_grant_connect_plus' as check_name,
  count(*) filter (
    where plan_code = 'connect_plus'
       or plan_code not in ('clutch_codes_starter', 'clutch_codes_growth', 'clutch_codes_pro')
  ) = 0 as passed,
  count(*) filter (
    where plan_code = 'connect_plus'
       or plan_code not in ('clutch_codes_starter', 'clutch_codes_growth', 'clutch_codes_pro')
  ) as violating_count
from public.shopify_entitlement_events
where plan_code is not null;

-- 9b. The event-table plan constraint itself excludes Connect+.
select
  'event_plan_constraint_excludes_connect_plus' as check_name,
  strpos(pg_get_constraintdef(oid), quote_literal('connect_plus')) = 0
    and strpos(pg_get_constraintdef(oid), quote_literal('clutch_codes_starter')) > 0
    and strpos(pg_get_constraintdef(oid), quote_literal('clutch_codes_growth')) > 0
    and strpos(pg_get_constraintdef(oid), quote_literal('clutch_codes_pro')) > 0 as passed,
  pg_get_constraintdef(oid) as detail
from pg_constraint
where conrelid = 'public.shopify_entitlement_events'::regclass
  and conname = 'shopify_entitlement_events_plan_code_check';

-- Diagnostic only: a customer can legitimately own Connect+ separately. Any overlap
-- must have independent Connect+ provenance; Clutch Codes is not proof of that grant.
select
  id as customer_id,
  plan,
  plan_code,
  clutch_codes_plan_code,
  clutch_codes_subscription_status
from public.customers
where clutch_codes_plan_code is not null
  and (plan = 'connect_plus' or plan_code = 'connect_plus')
order by id;
