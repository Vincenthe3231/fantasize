# Space save payload — Supabase diagnostics

Use these in the Supabase SQL Editor after deploying payload optimizations to confirm smaller `spaces` rows and fewer timeouts.

## Per-space JSON size

```sql
select
  id,
  pg_column_size(nodes) as nodes_bytes,
  pg_column_size(edges) as edges_bytes,
  pg_column_size(comments) as comments_bytes,
  (pg_column_size(nodes)+pg_column_size(edges)+pg_column_size(comments)+pg_column_size(coalesce(settings,'{}'::jsonb))+pg_column_size(node_grid_layouts)+pg_column_size(coalesce(viewport,'{}'::jsonb))) as total_bytes
from public.spaces
order by total_bytes desc
limit 20;
```

## Recent statement timeouts

```sql
select
  cast(t.timestamp as timestamp) as ts,
  p.error_severity,
  event_message
from postgres_logs as t
cross join unnest(metadata) as m
cross join unnest(m.parsed) as p
where p.error_severity in ('ERROR','FATAL','PANIC')
  and (event_message ilike '%statement timeout%' or event_message ilike '%57014%' or event_message ilike '%spaces%')
order by ts desc
limit 200;
```

## Slow updates on `spaces` (if `pg_stat_statements` is available)

```sql
select
  calls,
  round(mean_exec_time::numeric,2) as mean_ms,
  round(max_exec_time::numeric,2) as max_ms,
  left(query, 400) as query_preview
from pg_stat_statements
where query ilike '%update%spaces%'
order by max_exec_time desc
limit 20;
```
