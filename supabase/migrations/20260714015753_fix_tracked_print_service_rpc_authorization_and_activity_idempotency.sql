-- Focused production hotfix for the Phase 2/3 tracked-print workflow.
--
-- The RPCs are already SECURITY DEFINER functions with an empty search_path and
-- API execution restricted to service_role. PostgREST does not populate the
-- legacy request.jwt.claim.role setting consistently for service-key requests,
-- so the redundant body check rejected authorized calls. Rebuild each function
-- from its existing definition after removing only that exact check. This keeps
-- every validation, ownership rule, state transition, and transaction boundary
-- byte-for-byte identical otherwise and fails closed if the expected definition
-- is absent or materially different.

do $hotfix$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
  v_rewritten text;
  v_signatures constant text[] := array[
    'public.reconcile_included_qr_allowance(uuid)',
    'public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid)',
    'public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text)',
    'public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text)'
  ];
begin
  foreach v_signature in array v_signatures loop
    v_function := to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'tracked-print hotfix expected function %', v_signature;
    end if;

    select pg_get_functiondef(v_function::oid) into v_definition;
    if position('request.jwt.claim.role' in v_definition) = 0 then
      raise exception 'tracked-print hotfix expected legacy role check in %', v_signature;
    end if;

    v_rewritten := regexp_replace(
      v_definition,
      $pattern$[[:space:]]*if[[:space:]]+coalesce\(current_setting\('request\.jwt\.claim\.role',[[:space:]]*true\),[[:space:]]*''\)[[:space:]]*<>[[:space:]]*'service_role'[[:space:]]*then[[:space:]]*raise[[:space:]]+exception[[:space:]]*'service role required';[[:space:]]*end[[:space:]]+if;$pattern$,
      E'\n',
      'i'
    );

    if v_rewritten = v_definition or position('request.jwt.claim.role' in v_rewritten) > 0 then
      raise exception 'tracked-print hotfix could not safely remove legacy role check from %', v_signature;
    end if;

    execute v_rewritten;
  end loop;
end
$hotfix$;

-- Reassert the intended API boundary after CREATE OR REPLACE. SECURITY DEFINER
-- is safe here only because no public API role can execute these functions and
-- the functions retain their own customer/admin actor checks.
revoke all on function public.reconcile_included_qr_allowance(uuid) from public;
revoke all on function public.reconcile_included_qr_allowance(uuid) from anon;
revoke all on function public.reconcile_included_qr_allowance(uuid) from authenticated;
grant execute on function public.reconcile_included_qr_allowance(uuid) to service_role;

revoke all on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) from public;
revoke all on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) from anon;
revoke all on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) from authenticated;
grant execute on function public.provision_tracked_print_qr(uuid,uuid,text,text,text,text,uuid) to service_role;

revoke all on function public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text) from public;
revoke all on function public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text) from anon;
revoke all on function public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text) from authenticated;
grant execute on function public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text) to service_role;

revoke all on function public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text) from public;
revoke all on function public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text) from anon;
revoke all on function public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text) from authenticated;
grant execute on function public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text) to service_role;

-- PostgREST's on_conflict=idempotency_key needs a non-partial unique index it
-- can infer. Multiple NULL values remain valid under a normal PostgreSQL unique
-- index. Refuse to alter the index if existing non-NULL keys are duplicated.
do $preflight$
begin
  if exists (
    select 1
    from public.order_activity
    where idempotency_key is not null
    group by idempotency_key
    having count(*) > 1
  ) then
    raise exception 'duplicate non-null order_activity idempotency keys require manual review';
  end if;
end
$preflight$;

drop index if exists public.order_activity_idempotency_unique;
drop index if exists public.order_activity_idempotency_key_unique;
create unique index order_activity_idempotency_key_unique
  on public.order_activity(idempotency_key);
