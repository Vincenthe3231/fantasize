-- Freehand canvas strokes (flow-space polylines), persisted with the space graph.
alter table public.spaces
  add column if not exists canvas_drawings jsonb not null default '[]'::jsonb;

comment on column public.spaces.canvas_drawings is 'Array of {id, points, color, widthPx} in flow coordinates; default []';
