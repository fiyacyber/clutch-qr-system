-- Versioned, order-linked QR assets. These are separate from customer artwork.

alter table public.print_order_items
  add column qr_setup_status text not null default 'not_required',
  add column qr_setup_submitted_at timestamptz,
  add column qr_setup_current_revision integer,
  add column placement_mode text not null default 'clutch_choice',
  add column artwork_side text not null default 'not_applicable',
  add column preferred_position text,
  add column placement_instructions text,
  add column preferred_print_size text;

alter table public.print_order_items
  add constraint print_order_items_qr_setup_status_check
  check (qr_setup_status in ('not_required','setup_required','draft','submitted')),
  add constraint print_order_items_qr_setup_revision_check
  check (
    (qr_setup_status = 'submitted' and qr_setup_submitted_at is not null and qr_setup_current_revision > 0)
    or (qr_setup_status <> 'submitted' and qr_setup_submitted_at is null and qr_setup_current_revision is null)
  ),
  add constraint print_order_items_placement_mode_check
    check (placement_mode in ('clutch_choice','customer_preference')),
  add constraint print_order_items_artwork_side_check
    check (artwork_side in ('front','back','either','not_applicable')),
  add constraint print_order_items_preferred_position_check
    check (preferred_position is null or preferred_position in ('top_left','top_right','bottom_left','bottom_right','centered','custom')),
  add constraint print_order_items_placement_consistency_check check (
    (placement_mode = 'clutch_choice' and artwork_side = 'not_applicable' and preferred_position is null)
    or (placement_mode = 'customer_preference' and artwork_side <> 'not_applicable' and preferred_position is not null)
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
  placement_snapshot jsonb not null,
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

create or replace function public.prevent_print_qr_artwork_version_snapshot_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.print_order_item_id is distinct from old.print_order_item_id
     or new.customer_id is distinct from old.customer_id
     or new.qr_code_id is distinct from old.qr_code_id
     or new.print_order_file_id is distinct from old.print_order_file_id
     or new.revision is distinct from old.revision
     or new.design_snapshot is distinct from old.design_snapshot
     or new.placement_snapshot is distinct from old.placement_snapshot
     or new.destination_url_snapshot is distinct from old.destination_url_snapshot
     or new.submitted_by_auth_user_id is distinct from old.submitted_by_auth_user_id
     or new.submitted_at is distinct from old.submitted_at
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'submitted QR artwork snapshots are immutable';
  end if;
  return new;
end
$$;

create trigger prevent_print_qr_artwork_version_snapshot_changes
before update on public.print_qr_artwork_versions
for each row execute function public.prevent_print_qr_artwork_version_snapshot_changes();

revoke all on function public.prevent_print_qr_artwork_version_snapshot_changes() from public, anon, authenticated;
grant execute on function public.prevent_print_qr_artwork_version_snapshot_changes() to service_role;

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

-- New Supabase projects no longer expose tables through implicit grants. The
-- application service client needs explicit access to mediate this workflow.
grant select on public.customers, public.print_qr_provisionings to service_role;
grant select, update on public.qr_codes, public.print_order_items to service_role;
grant select, insert, update on public.print_order_files, public.print_proofs, public.print_qr_artwork_versions, public.order_activity to service_role;

alter table public.print_proofs
  add column qr_artwork_version_id uuid references public.print_qr_artwork_versions(id) on delete restrict,
  add column qr_revision integer,
  add column qr_destination_snapshot text,
  add column qr_placement_note text,
  add column page_labels text[] not null default array['Complete artwork'],
  add column qr_scan_validation_status text not null default 'pending'
    check (qr_scan_validation_status in ('pending','passed','failed','not_required'));

alter table public.print_proofs
  add constraint print_proofs_qr_snapshot_pair_check check (
    (qr_artwork_version_id is null and qr_revision is null and qr_destination_snapshot is null)
    or (qr_artwork_version_id is not null and qr_revision > 0 and qr_destination_snapshot ~* '^https?://')
  );

create index print_proofs_qr_artwork_version_idx on public.print_proofs(qr_artwork_version_id)
  where qr_artwork_version_id is not null;

create or replace function public.snapshot_print_proof_qr_context()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_qr public.print_qr_artwork_versions%rowtype;
  v_item public.print_order_items%rowtype;
begin
  select * into v_item from public.print_order_items where id = new.print_order_item_id;
  select * into v_qr from public.print_qr_artwork_versions
  where print_order_item_id = new.print_order_item_id and is_current;
  if v_qr.id is not null then
    new.qr_artwork_version_id := v_qr.id;
    new.qr_revision := v_qr.revision;
    new.qr_destination_snapshot := v_qr.destination_url_snapshot;
    new.qr_placement_note := case
      when v_item.placement_mode = 'clutch_choice' then 'Clutch will choose the best placement.'
      else concat_ws(' · ', replace(v_item.artwork_side, '_', ' '), replace(v_item.preferred_position, '_', ' '), nullif(v_item.preferred_print_size, ''), nullif(v_item.placement_instructions, ''))
    end;
  end if;
  return new;
end
$$;

create trigger snapshot_print_proof_qr_context
before insert on public.print_proofs
for each row execute function public.snapshot_print_proof_qr_context();

revoke all on function public.snapshot_print_proof_qr_context() from public, anon, authenticated;
grant execute on function public.snapshot_print_proof_qr_context() to service_role;

create or replace function public.guard_print_proof_qr_scan_validation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status
     and new.qr_artwork_version_id is not null
     and new.qr_scan_validation_status <> 'passed' then
    raise exception 'QR scan validation must pass before proof approval';
  end if;
  return new;
end
$$;

create trigger guard_print_proof_qr_scan_validation
before update on public.print_proofs
for each row execute function public.guard_print_proof_qr_scan_validation();

revoke all on function public.guard_print_proof_qr_scan_validation() from public, anon, authenticated;
grant execute on function public.guard_print_proof_qr_scan_validation() to service_role;

create or replace function public.guard_ready_for_production_requires_proof_approval()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.workflow_state = 'ready_for_production'
     and old.workflow_state is distinct from new.workflow_state
     and (
       new.proof_status <> 'approved'
       or not exists (
         select 1 from public.print_proofs p
         where p.print_order_item_id = new.id and p.is_current and p.status = 'approved'
       )
     ) then
    raise exception 'only approval of the current complete artwork proof can ready an order for production';
  end if;
  return new;
end
$$;

create trigger guard_ready_for_production_requires_proof_approval
before update on public.print_order_items
for each row execute function public.guard_ready_for_production_requires_proof_approval();

revoke all on function public.guard_ready_for_production_requires_proof_approval() from public, anon, authenticated;
grant execute on function public.guard_ready_for_production_requires_proof_approval() to service_role;

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

create or replace function public.prepare_print_qr_artwork_submission(
  p_print_order_item_id uuid,
  p_customer_id uuid,
  p_qr_code_id uuid,
  p_actor_auth_user_id uuid,
  p_idempotency_key text,
  p_checksum_sha256 text,
  p_design_snapshot jsonb,
  p_placement_snapshot jsonb
) returns table(version_id uuid, file_id uuid, revision integer, storage_path text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.print_order_items%rowtype;
  v_existing public.print_qr_artwork_versions%rowtype;
  v_existing_file public.print_order_files%rowtype;
begin
  if p_actor_auth_user_id is null or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'invalid submission identity';
  end if;

  select * into v_item from public.print_order_items
  where id = p_print_order_item_id and customer_id = p_customer_id for update;
  if not found or v_item.tracking_mode = 'none' or v_item.provisioning_status <> 'completed' then
    raise exception 'print item is not eligible for QR setup';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.auth_user_id = p_actor_auth_user_id
  ) then raise exception 'print item is not eligible for QR setup'; end if;

  select * into v_existing from public.print_qr_artwork_versions
  where idempotency_key = p_idempotency_key;
  if found then
    select * into v_existing_file from public.print_order_files where id = v_existing.print_order_file_id;
    if v_existing.print_order_item_id <> p_print_order_item_id
       or v_existing.customer_id <> p_customer_id
       or v_existing.qr_code_id <> p_qr_code_id
       or v_existing.submitted_by_auth_user_id <> p_actor_auth_user_id
       or v_existing.design_snapshot <> p_design_snapshot
       or v_existing.placement_snapshot <> p_placement_snapshot
       or v_existing_file.checksum_sha256 is distinct from p_checksum_sha256 then
      raise exception 'idempotency key conflicts with an existing submission';
    end if;
    return query select v_existing.id, v_existing.print_order_file_id, v_existing.revision, v_existing_file.storage_path;
    return;
  end if;

  if v_item.proof_status in ('sent','approved') then
    raise exception 'QR revisions are locked after the complete artwork proof is sent';
  end if;
  if not exists (
    select 1 from public.print_qr_provisionings p
    join public.qr_codes q on q.id = p.qr_code_id
    where p.print_order_item_id = p_print_order_item_id
      and p.customer_id = p_customer_id
      and p.qr_code_id = p_qr_code_id
      and q.customer_id = p_customer_id
      and q.print_order_item_id = p_print_order_item_id
      and q.slug is not null
  ) then raise exception 'linked QR is unavailable'; end if;
  return;
end
$$;

revoke all on function public.prepare_print_qr_artwork_submission(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.prepare_print_qr_artwork_submission(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb)
  to service_role;

create or replace function public.save_print_qr_artwork_draft(
  p_print_order_item_id uuid,
  p_customer_id uuid,
  p_qr_code_id uuid,
  p_actor_auth_user_id uuid,
  p_design jsonb,
  p_placement jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.print_order_items%rowtype;
begin
  select * into v_item from public.print_order_items
  where id = p_print_order_item_id and customer_id = p_customer_id for update;
  if not found or v_item.tracking_mode = 'none' or v_item.provisioning_status <> 'completed'
     or v_item.proof_status = 'approved'
     or not exists (
       select 1 from public.customers c
       where c.id = p_customer_id and c.auth_user_id = p_actor_auth_user_id
     )
     or not exists (
       select 1 from public.print_qr_provisionings p
       where p.print_order_item_id = p_print_order_item_id
         and p.customer_id = p_customer_id and p.qr_code_id = p_qr_code_id
         and p.provisioning_status = 'completed'
     ) then raise exception 'print item is not eligible for QR setup'; end if;
  if coalesce(p_placement->>'placementMode', '') not in ('clutch_choice','customer_preference')
     or coalesce(p_placement->>'artworkSide', '') not in ('front','back','either','not_applicable')
     or coalesce(p_placement->>'preferredPosition', '') not in ('','top_left','top_right','bottom_left','bottom_right','centered','custom')
     or (p_placement->>'placementMode' = 'clutch_choice' and (p_placement->>'artworkSide' <> 'not_applicable' or coalesce(p_placement->>'preferredPosition', '') <> ''))
     or (p_placement->>'placementMode' = 'customer_preference' and (p_placement->>'artworkSide' = 'not_applicable' or coalesce(p_placement->>'preferredPosition', '') = ''))
     then raise exception 'invalid placement preferences'; end if;

  update public.qr_codes set
    name = left(p_design->>'codeName', 80), destination_url = p_design->>'destinationUrl',
    foreground_color = p_design->>'foregroundColor', background_color = p_design->>'backgroundColor',
    dot_style = p_design->>'dotStyle', corner_style = p_design->>'cornerStyle',
    logo_enabled = coalesce(p_design->>'logoPath', '') <> '',
    logo_path = nullif(p_design->>'logoPath', ''), logo_url = nullif(p_design->>'logoUrl', ''),
    style_config = coalesce(style_config, '{}'::jsonb) || jsonb_build_object(
      'campaignName', p_design->>'campaignName', 'dotStyle', p_design->>'dotStyle',
      'cornerStyle', p_design->>'cornerStyle', 'frameStyle', p_design->>'frameStyle',
      'frameColor', p_design->>'frameColor', 'frameLabel', p_design->>'frameLabel',
      'logoPath', p_design->>'logoPath', 'logoUrl', p_design->>'logoUrl', 'logoSize', p_design->'logoSize'
    )
  where id = p_qr_code_id and customer_id = p_customer_id and print_order_item_id = p_print_order_item_id;
  if not found then raise exception 'linked QR is unavailable'; end if;

  update public.print_order_items set
    qr_setup_status = case when qr_setup_status = 'submitted' then qr_setup_status else 'draft' end,
    placement_mode = p_placement->>'placementMode', artwork_side = p_placement->>'artworkSide',
    preferred_position = nullif(p_placement->>'preferredPosition', ''),
    placement_instructions = nullif(left(trim(p_placement->>'placementInstructions'), 2000), ''),
    preferred_print_size = nullif(left(trim(p_placement->>'preferredPrintSize'), 100), ''),
    workflow_updated_at = now()
  where id = p_print_order_item_id;
end
$$;

revoke all on function public.save_print_qr_artwork_draft(uuid,uuid,uuid,uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_print_qr_artwork_draft(uuid,uuid,uuid,uuid,jsonb,jsonb)
  to service_role;

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
  p_placement_snapshot jsonb,
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
  if p_actor_auth_user_id is null or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'invalid submission identity';
  end if;
  if p_destination_url_snapshot !~* '^https?://' then raise exception 'valid destination required'; end if;
  if p_mime_type <> 'image/svg+xml' or p_size_bytes <= 0 or p_size_bytes > 26214400 then
    raise exception 'invalid print QR asset';
  end if;
  if p_storage_path not like p_customer_id::text || '/' || p_print_order_item_id::text || '/qr-artwork/%'
     or p_checksum_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'invalid print QR storage metadata'; end if;
  if p_placement_snapshot->>'placementMode' not in ('clutch_choice','customer_preference')
     or p_placement_snapshot->>'artworkSide' not in ('front','back','either','not_applicable')
     or coalesce(p_placement_snapshot->>'preferredPosition', '') not in ('','top_left','top_right','bottom_left','bottom_right','centered','custom')
     or (
       p_placement_snapshot->>'placementMode' = 'clutch_choice'
       and (p_placement_snapshot->>'artworkSide' <> 'not_applicable' or coalesce(p_placement_snapshot->>'preferredPosition', '') <> '')
     )
     or (
       p_placement_snapshot->>'placementMode' = 'customer_preference'
       and (p_placement_snapshot->>'artworkSide' = 'not_applicable' or coalesce(p_placement_snapshot->>'preferredPosition', '') = '')
     ) then raise exception 'invalid placement preferences'; end if;

  select * into v_item from public.print_order_items
  where id = p_print_order_item_id and customer_id = p_customer_id for update;
  if not found or v_item.tracking_mode = 'none' or v_item.provisioning_status <> 'completed' then
    raise exception 'print item is not eligible for QR setup';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.auth_user_id = p_actor_auth_user_id
  ) then raise exception 'print item is not eligible for QR setup'; end if;

  select * into v_existing from public.print_qr_artwork_versions
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.print_order_item_id <> p_print_order_item_id
       or v_existing.customer_id <> p_customer_id
       or v_existing.qr_code_id <> p_qr_code_id
       or v_existing.submitted_by_auth_user_id <> p_actor_auth_user_id
       or v_existing.design_snapshot <> p_design_snapshot
       or v_existing.placement_snapshot <> p_placement_snapshot
       or not exists (
         select 1 from public.print_order_files f
         where f.id = v_existing.print_order_file_id
           and f.storage_path = p_storage_path
           and f.checksum_sha256 = p_checksum_sha256
       ) then raise exception 'idempotency key conflicts with an existing submission'; end if;
    return query select v_existing.id, v_existing.print_order_file_id, v_existing.revision;
    return;
  end if;

  if v_item.proof_status in ('sent','approved') then
    raise exception 'QR revisions are locked after the complete artwork proof is sent';
  end if;
  if not exists (
    select 1 from public.print_qr_provisionings p
    join public.qr_codes q on q.id = p.qr_code_id
    where p.print_order_item_id = p_print_order_item_id
      and p.customer_id = p_customer_id
      and p.qr_code_id = p_qr_code_id
      and q.customer_id = p_customer_id
      and q.print_order_item_id = p_print_order_item_id
      and q.slug is not null
  ) then raise exception 'linked QR is unavailable'; end if;

  update public.qr_codes set
    name = left(p_design_snapshot->>'codeName', 80),
    destination_url = p_destination_url_snapshot,
    foreground_color = p_design_snapshot->>'foregroundColor',
    background_color = p_design_snapshot->>'backgroundColor',
    dot_style = p_design_snapshot->>'dotStyle',
    corner_style = p_design_snapshot->>'cornerStyle',
    logo_enabled = coalesce(p_design_snapshot->>'logoPath', '') <> '',
    logo_path = nullif(p_design_snapshot->>'logoPath', ''),
    logo_url = nullif(p_design_snapshot->>'logoUrl', ''),
    style_config = coalesce(style_config, '{}'::jsonb) || jsonb_build_object(
      'campaignName', p_design_snapshot->>'campaignName',
      'dotStyle', p_design_snapshot->>'dotStyle',
      'cornerStyle', p_design_snapshot->>'cornerStyle',
      'frameStyle', p_design_snapshot->>'frameStyle',
      'frameColor', p_design_snapshot->>'frameColor',
      'frameLabel', p_design_snapshot->>'frameLabel',
      'logoPath', p_design_snapshot->>'logoPath',
      'logoUrl', p_design_snapshot->>'logoUrl',
      'logoSize', p_design_snapshot->'logoSize'
    )
  where id = p_qr_code_id and customer_id = p_customer_id and print_order_item_id = p_print_order_item_id;
  if not found then raise exception 'linked QR is unavailable'; end if;

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
    design_snapshot, placement_snapshot, destination_url_snapshot, submitted_by_auth_user_id, idempotency_key
  ) values (
    p_print_order_item_id, p_customer_id, p_qr_code_id, v_file_id, v_revision,
    p_design_snapshot, p_placement_snapshot, p_destination_url_snapshot, p_actor_auth_user_id, p_idempotency_key
  ) returning id into v_version_id;

  update public.print_order_items set
    qr_setup_status = 'submitted', qr_setup_submitted_at = now(),
    qr_setup_current_revision = v_revision,
    placement_mode = p_placement_snapshot->>'placementMode',
    artwork_side = p_placement_snapshot->>'artworkSide',
    preferred_position = nullif(p_placement_snapshot->>'preferredPosition', ''),
    placement_instructions = nullif(left(trim(p_placement_snapshot->>'placementInstructions'), 2000), ''),
    preferred_print_size = nullif(left(trim(p_placement_snapshot->>'preferredPrintSize'), 100), ''),
    workflow_updated_at = now()
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

revoke all on function public.register_print_qr_artwork_submission(uuid,uuid,uuid,text,text,text,bigint,text,jsonb,jsonb,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.register_print_qr_artwork_submission(uuid,uuid,uuid,text,text,text,bigint,text,jsonb,jsonb,text,uuid,text)
  to service_role;

create or replace function public.update_print_proof_review_metadata(
  p_print_order_item_id uuid,
  p_proof_id uuid,
  p_actor_auth_user_id uuid,
  p_page_labels text[],
  p_qr_placement_note text,
  p_scan_validation_status text
) returns public.print_proofs
language plpgsql security definer set search_path = ''
as $$
declare
  v_proof public.print_proofs%rowtype;
begin
  if p_scan_validation_status not in ('pending','passed','failed','not_required')
     or not exists (
       select 1 from public.customers c
       where c.auth_user_id = p_actor_auth_user_id and c.is_admin
     ) then raise exception 'admin access required'; end if;
  select * into v_proof from public.print_proofs
  where id = p_proof_id and print_order_item_id = p_print_order_item_id and is_current and status = 'draft'
  for update;
  if not found then raise exception 'current draft proof required'; end if;
  update public.print_proofs set
    page_labels = case when coalesce(array_length(p_page_labels, 1), 0) = 0
      then array['Complete artwork']
      else array(select left(trim(label), 80) from unnest(p_page_labels[1:20]) label where trim(label) <> '')
    end,
    qr_placement_note = coalesce(nullif(left(trim(p_qr_placement_note), 500), ''), qr_placement_note),
    qr_scan_validation_status = p_scan_validation_status
  where id = p_proof_id returning * into v_proof;
  return v_proof;
end
$$;

revoke all on function public.update_print_proof_review_metadata(uuid,uuid,uuid,text[],text,text)
  from public, anon, authenticated;
grant execute on function public.update_print_proof_review_metadata(uuid,uuid,uuid,text[],text,text)
  to service_role;

comment on table public.print_qr_artwork_versions is
  'Immutable, versioned QR renderings submitted separately for placement into print artwork.';
comment on function public.register_print_qr_artwork_submission(uuid,uuid,uuid,text,text,text,bigint,text,jsonb,jsonb,text,uuid,text) is
  'Service-only transactional registration of a frozen order-linked QR artwork revision.';
