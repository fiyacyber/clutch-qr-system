\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer uuid;
  v_item uuid;
  v_qr uuid;
  v_replay_qr uuid;
  v_started timestamptz;
  v_expires timestamptz;
  v_original_started timestamptz;
  v_original_expires timestamptz;
begin
  insert into public.customers (
    email, plan, plan_code, qr_limit, included_qr_allowance, subscription_qr_limit
  ) values (
    'order-linked-db-test@example.invalid', 'free_qr', 'free_qr', 0, 0, 0
  ) returning id into v_customer;

  insert into public.print_order_items (
    customer_id, shopify_order_id, shopify_line_item_id, product_title,
    material_type, quantity, tracking_mode, campaign_name, destination_url,
    provisioning_status, clutch_codes_access_opt_in
  ) values (
    v_customer, 'db-test-order', 'db-test-line:cards', 'Database test Kit',
    'business_card', 1, 'new_included_code', 'Database test campaign',
    'https://example.com/database-test', 'pending', true
  ) returning id into v_item;

  select qr_code_id into v_qr
  from public.provision_tracked_print_qr(
    v_item, v_customer, 'https://example.com/database-test',
    'Database test campaign', 'business_card', 'db-test-idempotency', null, 'business_kit'
  );

  select platform_access_started_at, platform_access_expires_at
    into v_started, v_expires
  from public.print_qr_provisionings where print_order_item_id = v_item;

  if v_started is null or v_expires is null then raise exception 'timed grant was not created'; end if;
  if extract(epoch from (v_expires - v_started)) * 1000 <> 90::numeric * 24 * 60 * 60 * 1000 then
    raise exception 'grant duration is not exactly 90 UTC days';
  end if;
  if (select source_type from public.print_qr_provisionings where print_order_item_id = v_item) <> 'business_kit' then
    raise exception 'Business Kit source was not preserved';
  end if;

  v_original_started := v_started;
  v_original_expires := v_expires;
  update public.print_qr_provisionings
  set platform_access_started_at = v_started + interval '1 hour',
      platform_access_expires_at = v_expires + interval '1 hour'
  where print_order_item_id = v_item;

  select platform_access_started_at, platform_access_expires_at
    into v_started, v_expires
  from public.print_qr_provisionings where print_order_item_id = v_item;
  if v_started is distinct from v_original_started or v_expires is distinct from v_original_expires then
    raise exception 'timed grant timestamps were mutable';
  end if;

  select qr_code_id into v_replay_qr
  from public.provision_tracked_print_qr(
    v_item, v_customer, 'https://example.com/database-test',
    'Database test campaign', 'business_card', 'db-test-idempotency', null, 'business_kit'
  );
  if v_replay_qr is distinct from v_qr then raise exception 'replay created another QR'; end if;
  if (select count(*) from public.print_qr_provisionings where print_order_item_id = v_item) <> 1 then
    raise exception 'replay created another provisioning';
  end if;
  if (select count(*) from public.qr_codes where print_order_item_id = v_item) <> 1 then
    raise exception 'replay created another code';
  end if;
  if (select platform_access_expires_at from public.print_qr_provisionings where print_order_item_id = v_item) is distinct from v_original_expires then
    raise exception 'replay extended expiry';
  end if;
end
$test$;

rollback;
