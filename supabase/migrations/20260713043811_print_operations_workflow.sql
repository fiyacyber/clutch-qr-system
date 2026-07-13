-- Phase 3: private artwork/proof storage and centralized print operations workflow.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-order-files',
  'print-order-files',
  false,
  26214400,
  array['application/pdf','image/png','image/jpeg','image/webp','image/svg+xml','application/postscript','application/illustrator']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.print_order_items
  add column workflow_state text not null default 'awaiting_artwork',
  add column artwork_review_notes text,
  add column supplier_order_id text,
  add column carrier text,
  add column artwork_received_at timestamptz,
  add column artwork_approved_at timestamptz,
  add column proof_approved_at timestamptz,
  add column supplier_submitted_at timestamptz,
  add column production_started_at timestamptz,
  add column production_completed_at timestamptz,
  add column shipped_at timestamptz,
  add column delivered_at timestamptz,
  add column cancelled_at timestamptz,
  add column workflow_updated_at timestamptz not null default now();

alter table public.print_order_items
  add constraint print_order_items_workflow_state_check check (workflow_state in (
    'awaiting_artwork','artwork_received','artwork_review','artwork_changes_requested',
    'proof_preparing','proof_sent','proof_changes_requested','ready_for_production',
    'submitted_to_supplier','in_production','production_complete','fulfilled','delivered','cancelled'
  ));

update public.print_order_items
set workflow_state = case
      when fulfillment_status = 'delivered' then 'delivered'
      when fulfillment_status in ('fulfilled','partial') then 'fulfilled'
      when production_status = 'completed' then 'production_complete'
      when production_status = 'in_production' then 'in_production'
      when production_status = 'submitted' then 'submitted_to_supplier'
      when production_status = 'ready' then 'ready_for_production'
      when proof_status = 'approved' then 'ready_for_production'
      when proof_status = 'changes_requested' then 'proof_changes_requested'
      when proof_status = 'sent' then 'proof_sent'
      when proof_status = 'preparing' then 'proof_preparing'
      when artwork_status = 'changes_requested' then 'artwork_changes_requested'
      when artwork_status = 'reviewing' then 'artwork_review'
      when artwork_status in ('received','approved') then 'artwork_received'
      else 'awaiting_artwork'
    end,
    workflow_updated_at = updated_at;

create table public.print_order_files (
  id uuid primary key default gen_random_uuid(),
  print_order_item_id uuid not null references public.print_order_items(id) on delete restrict,
  file_kind text not null check (file_kind in ('customer_artwork','admin_proof','production_artwork','supplier_file')),
  storage_bucket text not null default 'print-order-files' check (storage_bucket = 'print-order-files'),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by_type text not null check (uploaded_by_type in ('admin','customer')),
  uploaded_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  is_current boolean not null default true,
  superseded_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint print_order_files_current_check check (
    (is_current and superseded_at is null) or (not is_current and superseded_at is not null)
  )
);

create unique index print_order_files_current_kind_unique
  on public.print_order_files(print_order_item_id, file_kind)
  where is_current;
create index print_order_files_order_created_idx
  on public.print_order_files(print_order_item_id, created_at desc);

create table public.print_proofs (
  id uuid primary key default gen_random_uuid(),
  print_order_item_id uuid not null references public.print_order_items(id) on delete restrict,
  proof_file_id uuid not null unique references public.print_order_files(id) on delete restrict,
  revision integer not null check (revision > 0),
  status text not null default 'draft' check (status in ('draft','sent','approved','changes_requested','superseded')),
  is_current boolean not null default true,
  created_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz,
  approved_at timestamptz,
  changes_requested_at timestamptz,
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (print_order_item_id, revision)
);

create unique index print_proofs_current_unique
  on public.print_proofs(print_order_item_id)
  where is_current;
create index print_proofs_order_created_idx
  on public.print_proofs(print_order_item_id, created_at desc);
create index print_order_items_workflow_idx
  on public.print_order_items(workflow_state, workflow_updated_at desc);

create trigger set_print_proofs_updated_at before update on public.print_proofs
for each row execute function public.set_updated_at();

alter table public.print_order_files enable row level security;
alter table public.print_proofs enable row level security;

create policy print_order_files_authorized_read
on public.print_order_files for select to authenticated
using (
  (
    file_kind in ('customer_artwork','admin_proof')
    and exists (
    select 1
    from public.print_order_items poi
    join public.customers c on c.id = poi.customer_id
    where poi.id = print_order_files.print_order_item_id
      and c.auth_user_id = (select auth.uid())
    )
  )
  or public.current_user_is_admin()
);

create policy print_proofs_authorized_read
on public.print_proofs for select to authenticated
using (
  exists (
    select 1
    from public.print_order_items poi
    join public.customers c on c.id = poi.customer_id
    where poi.id = print_proofs.print_order_item_id
      and c.auth_user_id = (select auth.uid())
  )
  or public.current_user_is_admin()
);

grant select on public.print_order_files, public.print_proofs to authenticated;
revoke insert, update, delete on public.print_order_files, public.print_proofs from anon, authenticated;

-- Storage remains service-mediated. No authenticated storage.objects policy is
-- created; authorized application routes issue short-lived signed URLs.

create or replace function public.register_print_order_file(
  p_print_order_item_id uuid,
  p_file_kind text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text,
  p_actor_type text,
  p_actor_auth_user_id uuid,
  p_idempotency_key text
) returns table(file_id uuid, proof_id uuid, workflow_state text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.print_order_items%rowtype;
  v_file_id uuid;
  v_proof_id uuid;
  v_revision integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_print_order_item_id is null or p_actor_auth_user_id is null
     or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'invalid file registration input';
  end if;

  select * into v_item from public.print_order_items
  where id = p_print_order_item_id for update;
  if not found then raise exception 'print order unavailable'; end if;

  if p_actor_type = 'customer' then
    if p_file_kind <> 'customer_artwork' or not exists (
      select 1 from public.customers c
      where c.id = v_item.customer_id and c.auth_user_id = p_actor_auth_user_id
    ) then raise exception 'print order unavailable'; end if;
  elsif p_actor_type = 'admin' then
    if p_file_kind = 'customer_artwork' or not exists (
      select 1 from public.customers c
      where c.auth_user_id = p_actor_auth_user_id and c.is_admin
    ) then raise exception 'admin access required'; end if;
  else
    raise exception 'invalid actor type';
  end if;

  select f.id into v_file_id from public.print_order_files f
  where f.idempotency_key = p_idempotency_key;
  if v_file_id is not null then
    select p.id into v_proof_id from public.print_proofs p where p.proof_file_id = v_file_id;
    return query select v_file_id, v_proof_id, v_item.workflow_state;
    return;
  end if;

  if p_file_kind = 'customer_artwork'
     and v_item.workflow_state not in ('awaiting_artwork','artwork_changes_requested','proof_changes_requested') then
    raise exception 'artwork cannot be uploaded in the current state';
  end if;
  if p_file_kind = 'admin_proof'
     and v_item.workflow_state not in ('proof_preparing','proof_changes_requested') then
    raise exception 'proof cannot be uploaded in the current state';
  end if;
  if p_file_kind = 'production_artwork'
     and v_item.workflow_state not in ('ready_for_production','submitted_to_supplier','in_production') then
    raise exception 'production artwork cannot be uploaded in the current state';
  end if;
  if p_file_kind = 'supplier_file'
     and v_item.workflow_state not in ('ready_for_production','submitted_to_supplier','in_production','production_complete') then
    raise exception 'supplier file cannot be uploaded in the current state';
  end if;
  if v_item.workflow_state in ('delivered','cancelled') then
    raise exception 'completed print order cannot accept files';
  end if;

  update public.print_order_files
  set is_current = false, superseded_at = now()
  where print_order_item_id = p_print_order_item_id
    and file_kind = p_file_kind and is_current;

  insert into public.print_order_files (
    print_order_item_id, file_kind, storage_path, original_filename, mime_type,
    size_bytes, checksum_sha256, uploaded_by_type, uploaded_by_auth_user_id, idempotency_key
  ) values (
    p_print_order_item_id, p_file_kind, p_storage_path, left(p_original_filename, 255),
    p_mime_type, p_size_bytes, p_checksum_sha256, p_actor_type,
    p_actor_auth_user_id, p_idempotency_key
  ) returning id into v_file_id;

  if p_file_kind = 'customer_artwork' then
    update public.print_order_items set
      workflow_state = 'artwork_received', artwork_status = 'received',
      artwork_received_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_file_kind = 'admin_proof' then
    update public.print_proofs set is_current = false, status = 'superseded'
    where print_order_item_id = p_print_order_item_id and is_current;
    select coalesce(max(revision), 0) + 1 into v_revision
    from public.print_proofs where print_order_item_id = p_print_order_item_id;
    insert into public.print_proofs (
      print_order_item_id, proof_file_id, revision, created_by_auth_user_id
    ) values (
      p_print_order_item_id, v_file_id, v_revision, p_actor_auth_user_id
    ) returning id into v_proof_id;
    update public.print_order_items set
      workflow_state = 'proof_preparing', proof_status = 'preparing', workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  end if;

  insert into public.order_activity (
    order_type, order_id, action, actor_type, actor_id, new_value, idempotency_key
  ) values (
    'print_order', p_print_order_item_id,
    case when p_file_kind = 'customer_artwork' then 'artwork_uploaded' else 'file_uploaded' end,
    p_actor_type, p_actor_auth_user_id,
    jsonb_build_object('file_id', v_file_id, 'file_kind', p_file_kind, 'proof_id', v_proof_id),
    p_idempotency_key || ':activity'
  );

  return query select v_file_id, v_proof_id, v_item.workflow_state;
end;
$$;

create or replace function public.transition_print_order_workflow(
  p_print_order_item_id uuid,
  p_action text,
  p_actor_type text,
  p_actor_auth_user_id uuid,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns public.print_order_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.print_order_items%rowtype;
  v_previous_state text;
  v_proof public.print_proofs%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_print_order_item_id is null or p_actor_auth_user_id is null
     or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'invalid transition input';
  end if;

  select * into v_item from public.print_order_items
  where id = p_print_order_item_id for update;
  if not found then raise exception 'print order unavailable'; end if;

  if p_actor_type = 'customer' then
    if p_action not in ('approve_proof','request_proof_revision') or not exists (
      select 1 from public.customers c
      where c.id = v_item.customer_id and c.auth_user_id = p_actor_auth_user_id
    ) then raise exception 'print order unavailable'; end if;
  elsif p_actor_type = 'admin' then
    if p_action in ('approve_proof','request_proof_revision') or not exists (
      select 1 from public.customers c
      where c.auth_user_id = p_actor_auth_user_id and c.is_admin
    ) then raise exception 'admin access required'; end if;
  else
    raise exception 'invalid actor type';
  end if;

  if exists (
    select 1 from public.order_activity a
    where a.idempotency_key = p_idempotency_key and a.order_id = p_print_order_item_id
  ) then return v_item; end if;

  v_previous_state := v_item.workflow_state;

  if p_action = 'begin_artwork_review' and v_item.workflow_state = 'artwork_received' then
    update public.print_order_items set workflow_state = 'artwork_review', artwork_status = 'reviewing', workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'request_artwork_changes' and v_item.workflow_state in ('artwork_received','artwork_review') then
    if coalesce(trim(p_reason), '') = '' then raise exception 'revision reason required'; end if;
    update public.print_order_items set workflow_state = 'artwork_changes_requested', artwork_status = 'changes_requested',
      artwork_review_notes = left(trim(p_reason), 2000), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'approve_artwork' and v_item.workflow_state in ('artwork_received','artwork_review') then
    update public.print_order_items set workflow_state = 'proof_preparing', artwork_status = 'approved',
      artwork_review_notes = null, artwork_approved_at = now(), proof_status = 'preparing', workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'send_proof' and v_item.workflow_state = 'proof_preparing' then
    select * into v_proof from public.print_proofs
    where print_order_item_id = p_print_order_item_id and is_current and status = 'draft' for update;
    if not found then raise exception 'current draft proof required'; end if;
    update public.print_proofs set status = 'sent', sent_at = now() where id = v_proof.id;
    update public.print_order_items set workflow_state = 'proof_sent', proof_status = 'sent', workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'approve_proof' and v_item.workflow_state = 'proof_sent' then
    select * into v_proof from public.print_proofs
    where print_order_item_id = p_print_order_item_id and is_current and status = 'sent' for update;
    if not found then raise exception 'current sent proof required'; end if;
    update public.print_proofs set status = 'approved', approved_at = now(), customer_notes = null where id = v_proof.id;
    update public.print_order_items set workflow_state = 'ready_for_production', proof_status = 'approved',
      proof_approved_at = now(), production_status = 'ready', workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'request_proof_revision' and v_item.workflow_state = 'proof_sent' then
    if coalesce(trim(p_reason), '') = '' then raise exception 'revision reason required'; end if;
    select * into v_proof from public.print_proofs
    where print_order_item_id = p_print_order_item_id and is_current and status = 'sent' for update;
    if not found then raise exception 'current sent proof required'; end if;
    update public.print_proofs set status = 'changes_requested', changes_requested_at = now(),
      customer_notes = left(trim(p_reason), 2000) where id = v_proof.id;
    update public.print_order_items set workflow_state = 'proof_changes_requested', proof_status = 'changes_requested', workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'submit_to_supplier' and v_item.workflow_state = 'ready_for_production' then
    if coalesce(trim(p_metadata->>'supplier'), '') = '' then raise exception 'supplier required'; end if;
    update public.print_order_items set workflow_state = 'submitted_to_supplier', production_status = 'submitted',
      supplier = left(trim(p_metadata->>'supplier'), 255), supplier_order_id = nullif(left(trim(p_metadata->>'supplier_order_id'), 255), ''),
      supplier_submitted_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'start_production' and v_item.workflow_state = 'submitted_to_supplier' then
    update public.print_order_items set workflow_state = 'in_production', production_status = 'in_production',
      production_started_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'complete_production' and v_item.workflow_state in ('submitted_to_supplier','in_production') then
    update public.print_order_items set workflow_state = 'production_complete', production_status = 'completed',
      production_completed_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'fulfill' and v_item.workflow_state = 'production_complete' then
    if coalesce(trim(p_metadata->>'tracking_url'), '') <> '' and (p_metadata->>'tracking_url') !~* '^https?://' then
      raise exception 'tracking URL must use HTTP or HTTPS';
    end if;
    update public.print_order_items set workflow_state = 'fulfilled', fulfillment_status = 'fulfilled',
      carrier = nullif(left(trim(p_metadata->>'carrier'), 255), ''),
      tracking_number = nullif(left(trim(p_metadata->>'tracking_number'), 255), ''),
      tracking_url = nullif(left(trim(p_metadata->>'tracking_url'), 2000), ''),
      shipped_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'mark_delivered' and v_item.workflow_state = 'fulfilled' then
    update public.print_order_items set workflow_state = 'delivered', fulfillment_status = 'delivered',
      delivered_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  elsif p_action = 'cancel' and v_item.workflow_state not in ('delivered','cancelled') then
    update public.print_order_items set workflow_state = 'cancelled', production_status = 'cancelled',
      fulfillment_status = 'cancelled', cancelled_at = now(), workflow_updated_at = now()
    where id = p_print_order_item_id returning * into v_item;
  else
    raise exception 'invalid workflow transition';
  end if;

  insert into public.order_activity (
    order_type, order_id, action, actor_type, actor_id, previous_value, new_value, reason, idempotency_key
  ) values (
    'print_order', p_print_order_item_id, p_action, p_actor_type, p_actor_auth_user_id,
    jsonb_build_object('workflow_state', v_previous_state),
    jsonb_build_object('workflow_state', v_item.workflow_state),
    nullif(left(trim(p_reason), 2000), ''), p_idempotency_key
  );

  return v_item;
end;
$$;

revoke all on function public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.register_print_order_file(uuid,text,text,text,text,bigint,text,text,uuid,text) to service_role;
grant execute on function public.transition_print_order_workflow(uuid,text,text,uuid,text,jsonb,text) to service_role;

comment on table public.print_order_files is 'Private print artwork, proof, production, and supplier file metadata. Objects live in the private print-order-files bucket.';
comment on table public.print_proofs is 'Versioned print proofs with exactly one current proof per print order.';
comment on function public.register_print_order_file is 'Service-only atomic file metadata, proof revision, workflow, and activity registration.';
comment on function public.transition_print_order_workflow is 'Service-only centralized print artwork, proof, production, fulfillment, and audit state machine.';
