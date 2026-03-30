import type { WorkflowSettings } from '@/stores/workflowStore';

/** Edge dash animation while running — off when Performance mode is on (stored `edgeAnimation` preserved). */
export function effectiveEdgeAnimation(settings: WorkflowSettings): boolean {
  return settings.edgeAnimation && !settings.performanceMode;
}

/** Canvas pointer trails — off when Performance mode is on (stored `canvasCursorTrails` preserved). */
export function effectiveCursorTrails(settings: WorkflowSettings): boolean {
  return settings.canvasCursorTrails && !settings.performanceMode;
}
