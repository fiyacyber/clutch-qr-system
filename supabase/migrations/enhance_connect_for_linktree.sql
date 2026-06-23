-- Enhance profiles table for Linktree-style grid layout
alter table public.profiles 
add column if not exists layout text default 'grid' check (layout in ('grid', 'stack', 'buttons'));

alter table public.profiles 
add column if not exists show_card_showcase boolean default true;

alter table public.profiles 
add column if not exists show_lead_form boolean default true;

-- Enhance profile_links table for link customization
alter table public.profile_links 
add column if not exists custom_color text;

alter table public.profile_links 
add column if not exists icon_style text default 'emoji' check (icon_style in ('emoji', 'solid', 'outline', 'none'));

alter table public.profile_links 
add column if not exists description text;

alter table public.profile_links 
add column if not exists platform text;

-- Add indexes for better query performance
create index if not exists profile_links_platform_idx on public.profile_links(platform);
create index if not exists profile_links_is_active_idx on public.profile_links(is_active);
