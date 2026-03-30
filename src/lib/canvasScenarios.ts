/**
 * Documented perf / QA scenarios for canvas work (Phase 0 baseline).
 * Use with Chrome Performance: record while panning, zooming, dragging selection.
 */
export const CANVAS_PERF_SCENARIOS = [
  {
    id: 'empty',
    label: 'Empty graph',
    description: 'New space or cleared template — measure idle pan/zoom baseline.',
  },
  {
    id: 'scout-template',
    label: 'Scout template (~10–15 nodes)',
    description: 'Virtual Production Scout default graph — typical product load.',
  },
  {
    id: 'stress',
    label: 'Stress (50+ nodes, 80+ edges)',
    description: 'Synthetic or duplicated nodes — find long tasks and frame drops.',
  },
] as const;
