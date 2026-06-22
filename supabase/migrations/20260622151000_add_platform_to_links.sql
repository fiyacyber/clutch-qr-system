-- Add platform field to profile_links table
alter table public.profile_links add column if not exists platform text;

-- Add updated_at column for tracking updates
alter table public.profile_links add column if not exists updated_at timestamptz default now();

-- Create updated_at trigger for profile_links
create or replace function public.update_profile_links_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profile_links_updated_at on public.profile_links;

create trigger profile_links_updated_at
before update on public.profile_links
for each row
execute function update_profile_links_updated_at();
