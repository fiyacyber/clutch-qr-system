-- Unified analytics bridge for QR + Clutch Connect.
-- Additive migration that preserves existing qr_scans/profile_click_events behavior.

create extension if not exists "pgcrypto";

-- Naming compatibility for downstream analytics specs.
create or replace view public.clutch_connect_profiles as
select * from public.profiles;

alter table public.qr_codes
  add column if not exists connect_profile_id uuid references public.profiles(id) on delete set null;

update public.qr_codes
set connect_profile_id = profile_id
where connect_profile_id is null
  and profile_id is not null;

alter table public.profiles
  add column if not exists primary_qr_code_id uuid references public.qr_codes(id) on delete set null;

create index if not exists qr_codes_connect_profile_id_idx on public.qr_codes(connect_profile_id);
create index if not exists profiles_primary_qr_code_id_idx on public.profiles(primary_qr_code_id);

create table if not exists public.qr_scan_events (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid references public.qr_codes(id) on delete set null,
  connect_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null default 'scan',
  visitor_id text,
  ip_hash text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  referrer text,
  created_at timestamptz not null default now()
);

create table if not exists public.connect_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  qr_code_id uuid references public.qr_codes(id) on delete set null,
  event_type text not null,
  link_id uuid references public.profile_links(id) on delete set null,
  link_label text,
  link_url text,
  visitor_id text,
  ip_hash text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists qr_scan_events_qr_code_id_idx on public.qr_scan_events(qr_code_id);
create index if not exists qr_scan_events_connect_profile_id_idx on public.qr_scan_events(connect_profile_id);
create index if not exists qr_scan_events_created_at_idx on public.qr_scan_events(created_at);
create index if not exists qr_scan_events_visitor_id_idx on public.qr_scan_events(visitor_id);

create index if not exists connect_events_profile_id_idx on public.connect_events(profile_id);
create index if not exists connect_events_qr_code_id_idx on public.connect_events(qr_code_id);
create index if not exists connect_events_event_type_idx on public.connect_events(event_type);
create index if not exists connect_events_created_at_idx on public.connect_events(created_at);
create index if not exists connect_events_visitor_id_idx on public.connect_events(visitor_id);

alter table public.qr_scan_events enable row level security;
alter table public.connect_events enable row level security;

drop policy if exists "Owners and admins can view qr scan events" on public.qr_scan_events;
create policy "Owners and admins can view qr scan events"
  on public.qr_scan_events
  for select
  using (
    public.current_user_is_admin()
    or qr_code_id in (
      select q.id
      from public.qr_codes q
      join public.customers c on c.id = q.customer_id
      where c.auth_user_id = auth.uid()
    )
    or connect_profile_id in (
      select p.id
      from public.profiles p
      join public.customers c on c.id = p.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Public can submit qr scan events" on public.qr_scan_events;
create policy "Public can submit qr scan events"
  on public.qr_scan_events
  for insert
  with check (true);

drop policy if exists "Owners and admins can view connect events" on public.connect_events;
create policy "Owners and admins can view connect events"
  on public.connect_events
  for select
  using (
    public.current_user_is_admin() or profile_id in (
      select p.id from public.profiles p
      join public.customers c on c.id = p.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Public can submit connect events" on public.connect_events;
create policy "Public can submit connect events"
  on public.connect_events
  for insert
  with check (profile_id in (
    select id from public.profiles where is_active = true
  ));

grant select on public.qr_scan_events to authenticated;
grant insert on public.qr_scan_events to anon, authenticated;
grant select on public.connect_events to authenticated;
grant insert on public.connect_events to anon, authenticated;
