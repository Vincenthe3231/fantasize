-- Vision Forge: profiles + per-user canvas spaces (React Flow graph JSON)

-- ── Profiles (one row per auth user) ─────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Spaces (saved canvases) ────────────────────────────────────
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled space',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  settings jsonb,
  node_grid_layouts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spaces_owner_id_idx on public.spaces (owner_id);
create index if not exists spaces_owner_updated_idx on public.spaces (owner_id, updated_at desc);

create or replace function public.set_spaces_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spaces_set_updated_at on public.spaces;
create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_spaces_updated_at();

alter table public.spaces enable row level security;

drop policy if exists "spaces_select_own" on public.spaces;
create policy "spaces_select_own"
  on public.spaces for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "spaces_insert_own" on public.spaces;
create policy "spaces_insert_own"
  on public.spaces for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "spaces_update_own" on public.spaces;
create policy "spaces_update_own"
  on public.spaces for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "spaces_delete_own" on public.spaces;
create policy "spaces_delete_own"
  on public.spaces for delete
  to authenticated
  using (owner_id = auth.uid());
