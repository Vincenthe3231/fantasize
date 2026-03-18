-- Persist React Flow viewport (pan + zoom)
alter table public.spaces
  add column if not exists viewport jsonb default '{"x":0,"y":0,"zoom":1}'::jsonb;
