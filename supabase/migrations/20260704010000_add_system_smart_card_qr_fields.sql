-- Additive fields and constraints for system-managed Smart Card Link records.

alter table public.qr_codes
  add column if not exists is_system boolean not null default false,
  add column if not exists qr_type text not null default 'url',
  add column if not exists card_order_id uuid,
  add column if not exists connect_profile_id uuid,
  add column if not exists profile_id uuid;

-- Keep qr_type flexible enough for existing builder types and add smart_card.
alter table public.qr_codes
  drop constraint if exists qr_codes_qr_type_check;

alter table public.qr_codes
  add constraint qr_codes_qr_type_check
  check (
    qr_type in (
      'url',
      'connect_profile',
      'text',
      'wifi',
      'email',
      'sms',
      'image',
      'pdf',
      'vcard',
      'smart_card'
    )
  );

-- Add profile references if constraints are not present yet.
do $$
begin
  if exists (select 1 from pg_class where relname = 'profiles' and relnamespace = 'public'::regnamespace)
     and not exists (
       select 1
       from pg_constraint
       where conname = 'qr_codes_profile_id_fkey'
         and conrelid = 'public.qr_codes'::regclass
     ) then
    alter table public.qr_codes
      add constraint qr_codes_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_class where relname = 'profiles' and relnamespace = 'public'::regnamespace)
     and not exists (
       select 1
       from pg_constraint
       where conname = 'qr_codes_connect_profile_id_fkey'
         and conrelid = 'public.qr_codes'::regclass
     ) then
    alter table public.qr_codes
      add constraint qr_codes_connect_profile_id_fkey
      foreign key (connect_profile_id) references public.profiles(id) on delete set null;
  end if;
end
$$;

-- card_orders reference is optional depending on table existence.
do $$
begin
  if exists (select 1 from pg_class where relname = 'card_orders' and relnamespace = 'public'::regnamespace)
     and not exists (
       select 1
       from pg_constraint
       where conname = 'qr_codes_card_order_id_fkey'
         and conrelid = 'public.qr_codes'::regclass
     ) then
    alter table public.qr_codes
      add constraint qr_codes_card_order_id_fkey
      foreign key (card_order_id) references public.card_orders(id) on delete set null;
  end if;
end
$$;

create index if not exists qr_codes_is_system_idx on public.qr_codes(is_system);
create index if not exists qr_codes_card_order_id_idx on public.qr_codes(card_order_id);
create index if not exists qr_codes_qr_type_is_system_idx on public.qr_codes(qr_type, is_system);
create index if not exists qr_codes_connect_profile_id_idx on public.qr_codes(connect_profile_id);
create index if not exists qr_codes_profile_id_idx on public.qr_codes(profile_id);
