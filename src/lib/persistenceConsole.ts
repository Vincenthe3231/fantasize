/** Filter DevTools console with: VF:persistence */

const PREFIX = '[VF:persistence]';
/** Avoid flooding console during drag (many rAF writes per second) */
const LOCAL_WRITE_LOG_INTERVAL_MS = 2000;
let lastLocalWriteLogAt = 0;

export function logLocalDraftWrite(
  ok: boolean,
  detail: {
    spaceId: string;
    clientUpdatedAt?: number;
    nodes?: number;
    edges?: number;
    error?: unknown;
    force?: boolean;
  }
) {
  if (ok) {
    const now = Date.now();
    if (!detail.force && now - lastLocalWriteLogAt < LOCAL_WRITE_LOG_INTERVAL_MS) return;
    lastLocalWriteLogAt = now;
    console.info(PREFIX, 'localDraft', 'written', {
      spaceId: detail.spaceId.slice(0, 8) + '…',
      clientUpdatedAt: detail.clientUpdatedAt,
      nodes: detail.nodes,
      edges: detail.edges,
    });
  } else {
    console.warn(PREFIX, 'localDraft', 'write_failed', {
      spaceId: detail.spaceId.slice(0, 8) + '…',
      error: detail.error,
    });
  }
}

export function logLocalDraftCleared(spaceId: string) {
  console.info(PREFIX, 'localDraft', 'cleared_after_remote', {
    spaceId: spaceId.slice(0, 8) + '…',
  });
}

export type RemoteFlushReason = 'explicit' | 'autosave' | 'visibility';

export function logRemoteFlush(
  phase: 'start' | 'ok' | 'fail' | 'skip',
  detail: {
    spaceId: string;
    reason?: RemoteFlushReason;
    durationMs?: number;
    error?: unknown;
    skipReason?: 'not_dirty' | 'wrong_space' | 'flush_in_flight';
    payloadBytesBefore?: number;
    payloadBytesAfter?: number;
    attempt?: number;
    statementTimeout?: boolean;
  }
) {
  const sid = detail.spaceId.slice(0, 8) + '…';
  switch (phase) {
    case 'start':
      console.info(PREFIX, 'remoteFlush', 'started', {
        spaceId: sid,
        reason: detail.reason,
        payloadBytesApprox: detail.payloadBytesAfter ?? detail.payloadBytesBefore,
      });
      break;
    case 'ok':
      console.info(PREFIX, 'remoteFlush', 'completed', {
        spaceId: sid,
        reason: detail.reason,
        durationMs: detail.durationMs,
        payloadBytesBefore: detail.payloadBytesBefore,
        payloadBytesAfter: detail.payloadBytesAfter,
      });
      break;
    case 'fail':
      console.error(PREFIX, 'remoteFlush', 'failed', {
        spaceId: sid,
        reason: detail.reason,
        error: detail.error,
        attempt: detail.attempt,
        payloadBytesBefore: detail.payloadBytesBefore,
        payloadBytesAfter: detail.payloadBytesAfter,
        statementTimeout: detail.statementTimeout,
      });
      break;
    case 'skip':
      if (detail.skipReason === 'not_dirty') {
        console.debug(PREFIX, 'remoteFlush', 'skipped', { reason: 'not_dirty' });
      } else if (detail.skipReason === 'flush_in_flight') {
        console.debug(PREFIX, 'remoteFlush', 'skipped', { skipReason: 'flush_in_flight' });
      } else {
        console.info(PREFIX, 'remoteFlush', 'skipped', {
          spaceId: sid,
          skipReason: detail.skipReason,
        });
      }
      break;
    default:
      break;
  }
}
