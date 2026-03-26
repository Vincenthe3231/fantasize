import { describe, expect, it } from 'vitest';
import {
  SCOPED_PORT_SEP,
  edgeHandleForNode,
  logicalPortId,
  migrateEdgesToScopedHandles,
  scopedPortHandle,
} from '@/lib/portHandles';
import type { Edge } from 'reactflow';

describe('portHandles', () => {
  it('scopes and parses logical port ids', () => {
    const id = scopedPortHandle('upload-1', 'text-out');
    expect(id).toBe(`upload-1${SCOPED_PORT_SEP}text-out`);
    expect(logicalPortId(id)).toBe('text-out');
    expect(logicalPortId('text-out')).toBe('text-out');
    expect(logicalPortId(null)).toBe('default');
  });

  it('migrateEdgesToScopedHandles leaves already-scoped handles unchanged', () => {
    const scoped: Edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: scopedPortHandle('a', 'text-out'),
      targetHandle: scopedPortHandle('b', 'text-in'),
      type: 'custom',
    };
    const out = migrateEdgesToScopedHandles([scoped]);
    expect(out[0].sourceHandle).toBe(scoped.sourceHandle);
    expect(out[0].targetHandle).toBe(scoped.targetHandle);
  });

  it('migrateEdgesToScopedHandles prefixes legacy logical ids', () => {
    const legacy: Edge = {
      id: 'e1',
      source: 'text-1',
      target: 'assistant-1',
      sourceHandle: 'text-out',
      targetHandle: 'text-in',
      type: 'custom',
    };
    const [e] = migrateEdgesToScopedHandles([legacy]);
    expect(e.sourceHandle).toBe(scopedPortHandle('text-1', 'text-out'));
    expect(e.targetHandle).toBe(scopedPortHandle('assistant-1', 'text-in'));
  });

  it('edgeHandleForNode does not double-scope', () => {
    const full = scopedPortHandle('n', 'image-in');
    expect(edgeHandleForNode('n', full)).toBe(full);
    expect(edgeHandleForNode('n', 'image-in')).toBe(full);
  });
});
