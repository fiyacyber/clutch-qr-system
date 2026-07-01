alter table public.profile_leads
  add column if not exists status text not null default 'new',
  add column if not exists archived_at timestamptz,
  add column if not exists contacted_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists crm_notes text,
  add column if not exists updated_at timestamptz default now();

update public.profile_leads
set status = 'new'
where status is null
  or lower(status) not in ('new', 'contacted', 'qualified', 'converted', 'closed', 'archived');

update public.profile_leads
set status = lower(status)
where status <> lower(status);

alter table public.profile_leads
  alter column status set default 'new',
  alter column status set not null,
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_leads_status_check'
      and conrelid = 'public.profile_leads'::regclass
  ) then
    alter table public.profile_leads
      add constraint profile_leads_status_check
      check (status in ('new', 'contacted', 'qualified', 'converted', 'closed', 'archived'));
  end if;
end $$;

create index if not exists profile_leads_profile_status_idx on public.profile_leads(profile_id, status);
create index if not exists profile_leads_archived_at_idx on public.profile_leads(archived_at);
create index if not exists profile_leads_updated_at_idx on public.profile_leads(updated_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profile_leads_updated_at on public.profile_leads;
create trigger set_profile_leads_updated_at
before update on public.profile_leads
for each row
execute function public.set_updated_at();

drop policy if exists "Owners and admins can update profile leads" on public.profile_leads;
create policy "Owners and admins can update profile leads"
  on public.profile_leads
  for update
  using (
    public.current_user_is_admin() or profile_id in (
      select p.id from public.profiles p
      join public.customers c on c.id = p.customer_id
      where c.auth_user_id = auth.uid()
    )
  )
  with check (
    public.current_user_is_admin() or profile_id in (
      select p.id from public.profiles p
      join public.customers c on c.id = p.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

grant update on public.profile_leads to authenticated;
