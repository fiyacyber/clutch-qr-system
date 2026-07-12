-- Capture profile schema changes that exist in production but were originally
-- applied from undated SQL files. Every statement is safe on both the current
-- production-shaped schema and a fresh migration run.

alter table public.profiles
  add column if not exists layout text default 'grid',
  add column if not exists show_card_showcase boolean default true,
  add column if not exists show_lead_form boolean default true,
  add column if not exists builder_config jsonb default null;

alter table public.profiles
  drop constraint if exists profiles_layout_check;

alter table public.profiles
  add constraint profiles_layout_check
  check (layout in ('grid', 'stack', 'buttons'));

alter table public.profile_links
  add column if not exists custom_color text,
  add column if not exists icon_style text default 'emoji',
  add column if not exists description text,
  add column if not exists platform text;

alter table public.profile_links
  drop constraint if exists profile_links_icon_style_check;

alter table public.profile_links
  add constraint profile_links_icon_style_check
  check (icon_style in ('emoji', 'solid', 'outline', 'none'));

create index if not exists profiles_builder_config_idx
  on public.profiles using gin (builder_config);

create index if not exists profile_links_platform_idx
  on public.profile_links(platform);

create index if not exists profile_links_is_active_idx
  on public.profile_links(is_active);

comment on column public.profiles.builder_config is
  'JSONB configuration for block-based profile builder. Contains theme, blocks, and form definitions.';
