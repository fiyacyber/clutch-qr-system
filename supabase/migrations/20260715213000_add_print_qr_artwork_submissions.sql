-- Versioned, order-linked QR assets. These are separate from customer artwork.

alter table public.print_order_items
  add column qr_setup_status text not null default 'not_required',
  add column qr_setup_submitted_at timestamptz,
  add column qr_setup_current_revision integer;

alter table public.print_order_items
  add constraint print_order_items_qr_setup_status_check
  check (qr_setup_status in ('not_required','setup_required','draft','submitted')),
  add constraint print_order_items_qr_setup_revision_check
  check (
    (qr_setup_status = 'submitted' and qr_setup_submitted_at is not null and qr_setup_current_revision > 0)
    or (qr_setup_status <> 'submitted' and qr_setup_submitted_at is null and qr_setup_current_revision is null)
  );

update public.print_order_items
set qr_setup_status = case
  when tracking_mode <> 'none' and provisioning_status = 'completed' then 'setup_required'
  else 'not_required'
end;

create or replace function public.mark_print_qr_setup_required()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.provisioning_status = 'completed' then
    update public.print_order_items
    set qr_setup_status = case
      when qr_setup_status = 'not_required' then 'setup_required'
      else qr_setup_status
    end
    where id = new.print_order_item_id and tracking_mode <> 'none';
  end if;
  return new;
end
$$;

create trigger mark_print_qr_setup_required_after_provisioning
after insert or update of provisioning_status on public.print_qr_provisionings
for each row execute function public.mark_print_qr_setup_required();

revoke all on function public.mark_print_qr_setup_required() from public, anon, authenticated;
grant execute on function public.mark_print_qr_setup_required() to service_role;

alter table public.print_order_files
  drop constraint print_order_files_file_kind_check;

alter table public.print_order_files
  add constraint print_order_files_file_kind_check
  check (file_kind in ('customer_artwork','admin_proof','production_artwork','supplier_file','qr_artwork_asset'));

drop policy print_order_files_authorized_read on public.print_order_files;
create policy print_order_files_authorized_read
on public.print_order_files for select to authenticated
using (
  (
    file_kind in ('customer_artwork','admin_proof','qr_artwork_asset')
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

create table public.print_qr_artwork_versions (
  id uuid primary key default gen_random_uuid(),
  print_order_item_id uuid not null references public.print_order_items(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  qr_code_id uuid not null references public.qr_codes(id) on delete restrict,
  print_order_file_id uuid not null unique references public.print_order_files(id) on delete restrict,
  revision integer not null check (revision > 0),
  design_snapshot jsonb not null,
  destination_url_snapshot text not null check (destination_url_snapshot ~* '^https?://'),
  status text not null default 'submitted' check (status in ('submitted','superseded','in_artwork','proof_locked')),
  artwork_use_status text not null default 'not_used' check (artwork_use_status in ('not_used','placed_in_artwork','proof_approved')),
  is_current boolean not null default true,
  submitted_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  superseded_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint print_qr_artwork_versions_current_check check (
    (is_current and superseded_at is null and status <> 'superseded')
    or (not is_current and superseded_at is not null and status = 'superseded')
  ),
  unique (print_order_item_id, revision)
);

create unique index print_qr_artwork_versions_current_unique
  on public.print_qr_artwork_versions(print_order_item_id) where is_current;
create index print_qr_artwork_versions_customer_idx
  on public.print_qr_artwork_versions(customer_id, created_at desc);
create index print_qr_artwork_versions_qr_idx
  on public.print_qr_artwork_versions(qr_code_id);

alter table public.print_qr_artwork_versions enable row level security;
create policy print_qr_artwork_versions_authorized_read
on public.print_qr_artwork_versions for select to authenticated
using (
  exists (
    select 1
    from public.print_order_items poi
    join public.customers c on c.id = poi.customer_id
    where poi.id = print_qr_artwork_versions.print_order_item_id
      and poi.customer_id = print_qr_artwork_versions.customer_id
      and c.auth_user_id = (select auth.uid())
  )
  or public.current_user_is_admin()
);

grant select on public.print_qr_artwork_versions to authenticated;
revoke insert, update, delete on public.print_qr_artwork_versions from anon, authenticated;

create or replace function public.sync_print_qr_artwork_use_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.proof_status = 'approved' and old.proof_status is distinct from new.proof_status then
    update public.print_qr_artwork_versions
    set status = 'proof_locked', artwork_use_status = 'proof_approved'
    where print_order_item_id = new.id and is_current;
  elsif new.proof_status = 'sent' and old.proof_status is distinct from new.proof_status then
    update public.print_qr_artwork_versions
    set status = 'in_artwork', artwork_use_status = 'placed_in_artwork'
    where print_order_item_id = new.id and is_current and status = 'submitted';
  end if;
  return new;
end
$$;

create trigger sync_print_qr_artwork_use_after_proof_change
after update of proof_status on public.print_order_items
for each row execute function public.sync_print_qr_artwork_use_status();

revoke all on function public.sync_print_qr_artwork_use_status() from public, anon, authenticated;
grant execute on function public.sync_print_qr_artwork_use_status() to service_role;

create or replace function public.register_print_qr_artwork_submission(
  p_print_order_item_id uuid,
  p_customer_id uuid,
  p_qr_code_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text,
  p_design_snapshot jsonb,
  p_destination_url_snapshot text,
  p_actor_auth_user_id uuid,
  p_idempotency_key text
) returns table(version_id uuid, file_id uuid, revision integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.print_order_items%rowtype;
  v_existing public.print_qr_artwork_versions%rowtype;
  v_previous public.print_qr_artwork_versions%rowtype;
  v_file_id uuid;
  v_version_id uuid;
  v_revision integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_actor_auth_user_id is null or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'invalid submission identity';
  end if;
  if p_destination_url_snapshot !~* '^https?://' then raise exception 'valid destination required'; end if;
  if p_mime_type <> 'image/svg+xml' or p_size_bytes <= 0 or p_size_bytes > 26214400 then
    raise exception 'invalid print QR asset';
  end if;

  select * into v_existing
  from public.print_qr_artwork_versions
  where idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.print_order_file_id, v_existing.revision;
    return;
  end if;

  select * into v_item from public.print_order_items
  where id = p_print_order_item_id and customer_id = p_customer_id for update;
  if not found or v_item.tracking_mode = 'none' or v_item.provisioning_status <> 'completed' then
    raise exception 'print item is not eligible for QR setup';
  end if;
  if v_item.proof_status = 'approved' then
    raise exception 'QR revisions are locked after proof approval';
  end if;
  if not exists (
    select 1 from public.print_qr_provisionings p
    join public.qr_codes q on q.id = p.qr_code_id
    where p.print_order_item_id = p_print_order_item_id
      and p.customer_id = p_customer_id
      and p.qr_code_id = p_qr_code_id
      and q.customer_id = p_customer_id
      and q.slug is not null
  ) then raise exception 'linked QR is unavailable'; end if;

  select * into v_previous from public.print_qr_artwork_versions
  where print_order_item_id = p_print_order_item_id and is_current for update;
  v_revision := coalesce(v_previous.revision, 0) + 1;

  if v_previous.id is not null then
    update public.print_qr_artwork_versions
    set is_current = false, status = 'superseded', superseded_at = now()
    where id = v_previous.id;
    update public.print_order_files
    set is_current = false, superseded_at = now()
    where id = v_previous.print_order_file_id;
  end if;

  insert into public.print_order_files (
    print_order_item_id, file_kind, storage_path, original_filename, mime_type,
    size_bytes, checksum_sha256, uploaded_by_type, uploaded_by_auth_user_id,
    is_current, idempotency_key
  ) values (
    p_print_order_item_id, 'qr_artwork_asset', p_storage_path, left(p_original_filename, 255), p_mime_type,
    p_size_bytes, p_checksum_sha256, 'customer', p_actor_auth_user_id,
    true, p_idempotency_key || ':file'
  ) returning id into v_file_id;

  insert into public.print_qr_artwork_versions (
    print_order_item_id, customer_id, qr_code_id, print_order_file_id, revision,
    design_snapshot, destination_url_snapshot, submitted_by_auth_user_id, idempotency_key
  ) values (
    p_print_order_item_id, p_customer_id, p_qr_code_id, v_file_id, v_revision,
    p_design_snapshot, p_destination_url_snapshot, p_actor_auth_user_id, p_idempotency_key
  ) returning id into v_version_id;

  update public.print_order_items set
    qr_setup_status = 'submitted', qr_setup_submitted_at = now(),
    qr_setup_current_revision = v_revision, workflow_updated_at = now()
  where id = p_print_order_item_id;

  insert into public.order_activity (
    order_type, order_id, action, actor_type, actor_id, new_value, idempotency_key
  ) values (
    'print_order', p_print_order_item_id,
    case when v_revision = 1 then 'qr_artwork_submitted' else 'qr_artwork_revised' end,
    'customer', p_actor_auth_user_id,
    jsonb_build_object('version_id', v_version_id, 'file_id', v_file_id, 'qr_code_id', p_qr_code_id, 'revision', v_revision),
    p_idempotency_key || ':activity'
  );

  return query select v_version_id, v_file_id, v_revision;
end
$$;

revoke all on function public.register_print_qr_artwork_submission(uuid,uuid,uuid,text,text,text,bigint,text,jsonb,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.register_print_qr_artwork_submission(uuid,uuid,uuid,text,text,text,bigint,text,jsonb,text,uuid,text)
  to service_role;

comment on table public.print_qr_artwork_versions is
  'Immutable, versioned QR renderings submitted separately for placement into print artwork.';
comment on function public.register_print_qr_artwork_submission(uuid,uuid,uuid,text,text,text,bigint,text,jsonb,text,uuid,text) is
  'Service-only transactional registration of a frozen order-linked QR artwork revision.';
