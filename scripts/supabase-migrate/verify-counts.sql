-- Run against source and target; compare row counts.
select 'auth.users' as tbl, count(*)::bigint as n from auth.users
union all
select 'auth.identities', count(*) from auth.identities
union all
select 'public.profiles', count(*) from public.profiles
union all
select 'public.spaces', count(*) from public.spaces
union all
select 'public.space_node_versions', count(*) from public.space_node_versions
union all
select 'public.space_comment_versions', count(*) from public.space_comment_versions
union all
select 'storage.objects', count(*) from storage.objects;
