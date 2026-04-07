-- Node traceability and comment versioning
-- Records node changes (type, data, position, updated_at) and comment edit history
-- whenever spaces is updated. No app code changes; trigger runs after each save.

-- ── space_node_versions (append-only node history) ─────────────────────────
create table if not exists public.space_node_versions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  node_id text not null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  position jsonb not null default '{"x":0,"y":0}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists space_node_versions_space_node_updated_idx
  on public.space_node_versions (space_id, node_id, updated_at desc);

alter table public.space_node_versions enable row level security;

drop policy if exists "space_node_versions_select_own" on public.space_node_versions;
create policy "space_node_versions_select_own"
  on public.space_node_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_node_versions.space_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "space_node_versions_insert_own" on public.space_node_versions;
create policy "space_node_versions_insert_own"
  on public.space_node_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_node_versions.space_id and s.owner_id = auth.uid()
    )
  );

-- ── space_comment_versions (versioned comment history) ──────────────────────
create table if not exists public.space_comment_versions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  comment_id text not null,
  version int not null,
  text text not null default '',
  resolved boolean not null default false,
  author text,
  x double precision,
  y double precision,
  updated_at timestamptz not null default now(),
  unique (space_id, comment_id, version)
);

create index if not exists space_comment_versions_space_comment_version_idx
  on public.space_comment_versions (space_id, comment_id, version);

alter table public.space_comment_versions enable row level security;

drop policy if exists "space_comment_versions_select_own" on public.space_comment_versions;
create policy "space_comment_versions_select_own"
  on public.space_comment_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_comment_versions.space_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "space_comment_versions_insert_own" on public.space_comment_versions;
create policy "space_comment_versions_insert_own"
  on public.space_comment_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_comment_versions.space_id and s.owner_id = auth.uid()
    )
  );

-- ── Trigger: record node and comment versions on space update ───────────────
create or replace function public.record_space_node_comment_versions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  new_node jsonb;
  old_node jsonb;
  new_comment jsonb;
  old_comment jsonb;
  next_ver int;
begin
  -- Record changed or new nodes
  for r in select elem from jsonb_array_elements(NEW.nodes) as elem
  loop
    new_node := r.elem;
    select e into old_node
    from jsonb_array_elements(OLD.nodes) as e
    where e->>'id' = new_node->>'id'
    limit 1;
    if old_node is null
       or (old_node->>'type') is distinct from (new_node->>'type')
       or (old_node->'data') is distinct from (new_node->'data')
       or (old_node->'position') is distinct from (new_node->'position')
    then
      insert into public.space_node_versions (space_id, node_id, type, data, position)
      values (
        NEW.id,
        new_node->>'id',
        coalesce(new_node->>'type', ''),
        coalesce(new_node->'data', '{}'::jsonb),
        coalesce(new_node->'position', '{"x":0,"y":0}'::jsonb)
      );
    end if;
  end loop;

  -- Record changed or new comments (with incrementing version per comment)
  for r in select elem from jsonb_array_elements(NEW.comments) as elem
  loop
    new_comment := r.elem;
    select e into old_comment
    from jsonb_array_elements(OLD.comments) as e
    where e->>'id' = new_comment->>'id'
    limit 1;
    if old_comment is null
       or (old_comment->>'text') is distinct from (new_comment->>'text')
       or (old_comment->>'resolved') is distinct from (new_comment->>'resolved')
       or (old_comment->>'author') is distinct from (new_comment->>'author')
       or ((old_comment->>'x')::double precision) is distinct from ((new_comment->>'x')::double precision)
       or ((old_comment->>'y')::double precision) is distinct from ((new_comment->>'y')::double precision)
    then
      select coalesce(max(version), 0) + 1 into next_ver
      from public.space_comment_versions
      where space_id = NEW.id and comment_id = new_comment->>'id';
      insert into public.space_comment_versions (
        space_id, comment_id, version, text, resolved, author, x, y
      )
      values (
        NEW.id,
        new_comment->>'id',
        next_ver,
        coalesce(new_comment->>'text', ''),
        coalesce((new_comment->>'resolved')::boolean, false),
        new_comment->>'author',
        (new_comment->>'x')::double precision,
        (new_comment->>'y')::double precision
      );
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists spaces_record_node_comment_versions on public.spaces;
create trigger spaces_record_node_comment_versions
  after update on public.spaces
  for each row execute function public.record_space_node_comment_versions();
