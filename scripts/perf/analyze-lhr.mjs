/**
 * Extract actionable signals from a Lighthouse JSON report (LHR):
 * - Rank JS by CPU time (bootup-time audit — same data as "JavaScript execution time" in the HTML report)
 * - Main-thread category breakdown (mainthread-work-breakdown)
 * - Long tasks over a threshold (long-tasks audit)
 * - Transfer sizes (resource-summary)
 *
 * For hot call stacks (which function), use Chrome DevTools Performance with a recorded trace;
 * LHR does not include JS stack samples. Optional: save a trace via Puppeteer tracing (not wired here).
 */
import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

const LONG_TASK_MS = 50;

function parseArgs(argv) {
  const jsonOut = argv.includes('--json');
  const positional = argv.filter((a) => a !== '--json' && !a.startsWith('-'));
  const pathArg = positional[0];
  return { jsonOut, pathArg };
}

export async function resolveReportPath(explicit) {
  if (explicit) return explicit;
  const fromEnv = process.env.LIGHTHOUSE_REPORT;
  if (fromEnv) return fromEnv;
  const artifactsDir = path.join(repoRoot, 'artifacts');
  const names = await readdir(artifactsDir);
  const jsons = names.filter((n) => n.startsWith('lighthouse') && n.endsWith('.json'));
  if (jsons.length === 0) {
    throw new Error(`No lighthouse*.json in ${artifactsDir}. Run perf:lighthouse or perf:lighthouse:timespan first.`);
  }
  let bestPath = null;
  let bestMtime = 0;
  for (const n of jsons) {
    const p = path.join(artifactsDir, n);
    const st = await stat(p);
    if (st.mtimeMs >= bestMtime) {
      bestMtime = st.mtimeMs;
      bestPath = p;
    }
  }
  return bestPath;
}

function shortUrl(u) {
  try {
    const x = new URL(u);
    const base = x.pathname.split('/').pop() || x.pathname;
    return base.length > 56 ? `${base.slice(0, 24)}…${base.slice(-20)}` : base;
  } catch {
    return String(u).slice(0, 64);
  }
}

/**
 * @param {object} lhr Lighthouse result JSON
 * @param {{ longTaskThresholdMs?: number }} [opts]
 */
export function summarizeLhr(lhr, opts = {}) {
  const threshold = opts.longTaskThresholdMs ?? LONG_TASK_MS;
  const mode = lhr.gatherMode ?? 'unknown';
  const perf = lhr.categories?.performance?.score;

  const boot = lhr.audits?.['bootup-time'];
  const items = [...(boot?.details?.items ?? [])].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

  const mt = lhr.audits?.['mainthread-work-breakdown'];
  const mtItems = [...(mt?.details?.items ?? [])].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));

  const lt = lhr.audits?.['long-tasks'];
  const ltRows = lt?.details?.items ?? [];
  const longTasks = ltRows.filter((row) => (row.duration ?? 0) > threshold);

  const rs = lhr.audits?.['resource-summary'];
  const rsItems = rs?.details?.items ?? [];
  const totalRow = rsItems.find((i) => i.resourceType === 'total');
  const scriptRow = rsItems.find((i) => i.resourceType === 'script');

  return {
    gatherMode: mode,
    performanceScore: perf,
    requestedUrl: lhr.requestedUrl ?? lhr.finalUrl ?? null,
    finalDisplayedUrl: lhr.finalDisplayedUrl,
    mainThreadWorkMs: mt?.numericValue,
    scriptEvaluationBreakdownMs: mtItems.find((i) => i.group === 'scriptEvaluation')?.duration,
    jsExecutionTotalMs: boot?.numericValue,
    topJsByCpuTime: items.slice(0, 25).map((row) => ({
      url: row.url,
      shortLabel: shortUrl(row.url),
      totalMs: row.total,
      scriptingMs: row.scripting,
      parseMs: row.scriptParseCompile,
    })),
    mainThreadCategories: mtItems.map((row) => ({
      label: row.groupLabel,
      durationMs: row.duration,
      group: row.group,
    })),
    longTaskThresholdMs: threshold,
    longTaskCountOverThreshold: longTasks.length,
    longTasks: longTasks.map((row) => ({
      url: row.url,
      startTimeMs: row.startTime,
      durationMs: row.duration,
    })),
    transferBytesTotal: totalRow?.transferSize,
    transferBytesScript: scriptRow?.transferSize,
    requestCountTotal: totalRow?.requestCount,
  };
}

function printHuman(summary) {
  const lines = [];
  lines.push(`=== Lighthouse analysis (${summary.gatherMode}) ===`);
  lines.push(`Performance score: ${summary.performanceScore != null ? (summary.performanceScore * 100).toFixed(1) : 'n/a'}`);
  lines.push(`Requested: ${summary.requestedUrl ?? 'n/a (timespan has no navigation URL)'}`);
  lines.push(`Displayed: ${summary.finalDisplayedUrl ?? 'n/a'}`);
  lines.push('');
  lines.push('--- Payload (resource-summary) ---');
  lines.push(
    `Total transfer: ${summary.transferBytesTotal ?? 'n/a'} bytes (${summary.requestCountTotal ?? '?'} requests)`,
  );
  lines.push(`Script transfer: ${summary.transferBytesScript ?? 'n/a'} bytes`);
  if ((summary.transferBytesTotal ?? 0) === 0 && summary.gatherMode === 'timespan') {
    lines.push('  (Timespan runs often omit network totals in resource-summary; use Navigation for payload size.)');
  }
  lines.push('');
  lines.push('--- Main-thread totals ---');
  lines.push(`Main-thread work (breakdown sum metric): ${summary.mainThreadWorkMs != null ? `${summary.mainThreadWorkMs.toFixed(1)} ms` : 'n/a'}`);
  lines.push(`JS execution total (bootup-time metric): ${summary.jsExecutionTotalMs != null ? `${summary.jsExecutionTotalMs.toFixed(1)} ms` : 'n/a'}`);
  lines.push('');
  lines.push('--- Main-thread by category (mainthread-work-breakdown) ---');
  for (const row of summary.mainThreadCategories) {
    lines.push(`  ${row.label}: ${row.durationMs != null ? row.durationMs.toFixed(1) : '?'} ms`);
  }
  lines.push('');
  lines.push('--- Top JS by CPU time (bootup-time), highest first — prioritize bundle/code splitting here ---');
  let rank = 1;
  for (const row of summary.topJsByCpuTime) {
    lines.push(
      `  ${rank}. ${row.shortLabel}`,
    );
    lines.push(
      `      total ${row.totalMs?.toFixed?.(1) ?? row.totalMs} ms | eval ${row.scriptingMs?.toFixed?.(1) ?? row.scriptingMs} ms | parse ${row.parseMs?.toFixed?.(1) ?? row.parseMs} ms`,
    );
    lines.push(`      ${row.url}`);
    rank++;
  }
  lines.push('');
  lines.push(`--- Long main-thread tasks (>${summary.longTaskThresholdMs} ms) ---`);
  lines.push(`Count: ${summary.longTaskCountOverThreshold}`);
  for (const t of summary.longTasks.slice(0, 20)) {
    lines.push(`  ${t.durationMs?.toFixed?.(1) ?? t.durationMs} ms @ ${t.startTimeMs?.toFixed?.(1) ?? t.startTimeMs} ms — ${t.url || 'unknown'}`);
  }
  if (summary.longTasks.length === 0) {
    lines.push('  (none in report — common on fast loads; use Timespan + gestures for interaction-heavy checks.)');
  }
  lines.push('');
  lines.push(
    'Note: LHR does not include JS call stacks. Record a Performance trace in DevTools (or Chromium) to map long tasks to functions.',
  );
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const { jsonOut, pathArg } = parseArgs(argv);
  const reportPath = await resolveReportPath(pathArg);
  const raw = await readFile(reportPath, 'utf8');
  const lhr = JSON.parse(raw);
  const summary = summarizeLhr(lhr);
  if (jsonOut) {
    console.log(JSON.stringify({ reportPath, ...summary }, null, 2));
  } else {
    console.log(printHuman(summary));
  }
}

const isMain =
  process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
