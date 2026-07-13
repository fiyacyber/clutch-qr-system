-- Run before 20260712100000_add_clutch_codes_allowances_and_sources.sql.
-- This is read-only and returns one classification row for every customer.

with evidence as (
  select
    c.id as customer_id,
    c.email,
    c.is_admin,
    c.plan,
    c.plan_code,
    c.subscription_status,
    c.shopify_subscription_id,
    c.shopify_order_id,
    greatest(coalesce(c.qr_limit, 0), 0) as legacy_qr_limit,
    coalesce(qr.qr_count, 0) as existing_qr_count,
    coalesce(cards.card_order_count, 0) as confirmed_card_order_count,
    coalesce(orders.has_paid_clutch_codes_order, false) as has_paid_clutch_codes_order
  from public.customers c
  left join lateral (
    select count(*)::integer as qr_count
    from public.qr_codes q
    where q.customer_id = c.id
  ) qr on true
  left join lateral (
    select count(*)::integer as card_order_count
    from public.card_orders co
    where co.customer_id = c.id
  ) cards on true
  left join lateral (
    select bool_or(
      so.financial_status in ('paid', 'partially_paid')
      and exists (
        select 1
        from jsonb_array_elements(coalesce(so.raw_payload->'line_items', '[]'::jsonb)) li
        where upper(coalesce(li->>'sku', '')) in (
          'CLUTCH-CODES-STARTER', 'CLUTCH-CODES-GROWTH', 'CLUTCH-CODES-PRO'
        )
      )
    ) as has_paid_clutch_codes_order
    from public.shopify_orders so
    where so.customer_id = c.id
       or (c.shopify_order_id is not null and so.shopify_order_id = c.shopify_order_id)
  ) orders on true
), classified as (
  select
    evidence.*,
    (
      shopify_subscription_id is not null
      and lower(coalesce(subscription_status, '')) = 'active'
      and lower(coalesce(plan_code, plan, '')) in ('qr_pro', 'qr_pro_plus', 'agency')
    ) as has_active_paid_subscription_evidence
  from evidence
)
select
  customer_id,
  email,
  case
    when is_admin then 'admin_preserve'
    when has_active_paid_subscription_evidence and confirmed_card_order_count > 0
      then 'active_paid_subscription_plus_confirmed_card'
    when has_active_paid_subscription_evidence then 'active_paid_subscription'
    when confirmed_card_order_count > 0 then 'confirmed_card_allowance'
    when has_paid_clutch_codes_order then 'manual_review_paid_order_without_contract'
    when existing_qr_count > 0 then 'manual_review_existing_qr_without_source'
    when lower(coalesce(plan_code, plan, '')) in ('qr_pro', 'qr_pro_plus', 'agency')
      then 'manual_review_legacy_paid_plan_without_subscription_id'
    else 'manual_review_no_entitlement_source'
  end as classification,
  not (
    is_admin
    or has_active_paid_subscription_evidence
    or confirmed_card_order_count > 0
  ) as review_required,
  case when not is_admin then confirmed_card_order_count else 0 end
    as proposed_included_qr_allowance,
  case when not is_admin and has_active_paid_subscription_evidence then legacy_qr_limit else 0 end
    as proposed_subscription_qr_limit,
  plan,
  plan_code,
  subscription_status,
  shopify_subscription_id,
  shopify_order_id,
  legacy_qr_limit,
  existing_qr_count,
  confirmed_card_order_count,
  has_paid_clutch_codes_order
from classified
order by review_required desc, classification, email;
