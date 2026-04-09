/**
 * Compact brief for humans + AI agents: top JS offenders from LHR + repo-aligned hints.
 * Does not prove line-level causes (no stacks in Lighthouse JSON).
 */
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolveReportPath, summarizeLhr } from './analyze-lhr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

/**
 * Map built asset filename (from bootup-time URL) to likely areas in this repo.
 * Aligns with `vite.config.ts` manualChunks: react-vendor, reactflow-vendor, supabase-vendor.
 */
export function hintsForChunkFilename(shortLabel) {
  const l = String(shortLabel).toLowerCase();
  if (l.includes('react-vendor'))
    return {
      bundle: 'react-vendor',
      viteRule: 'node_modules/react / react-dom',
      lookAt: ['Reduce unnecessary re-renders; avoid subscribing whole tree to pan/zoom'],
    };
  if (l.includes('reactflow-vendor'))
    return {
      bundle: 'reactflow-vendor',
      viteRule: 'node_modules/reactflow',
      lookAt: [
        'src/pages/Index.tsx',
        'src/components/canvas/*',
        'src/lib/canvasFlowLazy.ts',
        'src/lib/canvasPerf.ts',
      ],
    };
  if (l.includes('supabase-vendor'))
    return {
      bundle: 'supabase-vendor',
      viteRule: 'node_modules/@supabase',
      lookAt: ['Defer Supabase-heavy paths until after shell; queryClient persistence'],
    };
  if (l.includes('pixi') || l.includes('pixihybrid') || l.includes('webgl') || l.includes('webgpu'))
    return {
      bundle: 'pixi / WebGL',
      viteRule: 'dynamic imports (lazy)',
      lookAt: ['src/components/canvas/PixiHybridBackground.tsx', 'PixiBoardViewport.tsx', 'canvasPerf.ts'],
    };
  if (l.includes('index-'))
    return {
      bundle: 'Index route chunk',
      viteRule: 'lazy route',
      lookAt: ['src/pages/Index.tsx', 'src/pages/CanvasInnerPixi.tsx'],
    };
  if (l.includes('assistant') || l.includes('listnode') || l.includes('scout'))
    return {
      bundle: 'feature chunk',
      viteRule: 'dynamic import in canvasFlowLazy',
      lookAt: ['src/components/canvas nodes matching name', 'lazy graph in canvasFlowLazy.ts'],
    };
  return {
    bundle: 'app / other chunk',
    viteRule: 'see pnpm build:analyze → dist/stats.html',
    lookAt: ['Match filename prefix to chunk in build output; use stats.html treemap'],
  };
}

const OPTIMIZATION_CHECKLIST = [
  'JS: rank bootup-time URLs → split or lazy-load heavy routes (see vite.config.ts manualChunks).',
  'Canvas: reduce store/React updates during pan/zoom — canvasPerf.ts, Pixi hybrid, CustomEdge.',
  'Workers: edge/geometry hot paths — existing WASM/worker patterns in repo where applicable.',
  'Images: stable transform URLs + gesture suppression — CanvasNodeImage, imageDelivery.ts.',
  'Verify: DevTools Performance trace for call stacks; LHR has no JS stacks.',
];

function buildMarkdown(summary, reportPath) {
  const lines = [];
  lines.push('# Agent perf brief');
  lines.push('');
  lines.push(`- **Source report:** \`${reportPath}\``);
  lines.push(`- **Gather mode:** ${summary.gatherMode}`);
  lines.push(
    `- **Performance score:** ${summary.performanceScore != null ? (summary.performanceScore * 100).toFixed(1) : 'n/a'}`,
  );
  lines.push(`- **Final URL:** ${summary.finalDisplayedUrl ?? 'n/a'}`);
  lines.push('');
  lines.push('## Payload (navigation runs only)');
  lines.push(
    `- Total: ${summary.transferBytesTotal ?? 'n/a'} bytes | Script: ${summary.transferBytesScript ?? 'n/a'} bytes`,
  );
  lines.push('');
  lines.push('## Top JS by CPU time → where to look in repo');
  lines.push('');
  let i = 1;
  for (const row of summary.topJsByCpuTime.slice(0, 12)) {
    const h = hintsForChunkFilename(row.shortLabel);
    lines.push(`### ${i}. ${row.shortLabel}`);
    lines.push(`- **CPU:** total ${row.totalMs?.toFixed?.(1) ?? row.totalMs} ms (eval ${row.scriptingMs?.toFixed?.(1) ?? row.scriptingMs} ms)`);
    lines.push(`- **Mapped bundle:** ${h.bundle} (${h.viteRule})`);
    lines.push('- **Files / actions:**');
    for (const x of h.lookAt) lines.push(`  - ${x}`);
    lines.push(`- **URL:** ${row.url}`);
    lines.push('');
    i++;
  }
  lines.push('## Main-thread categories');
  for (const c of summary.mainThreadCategories.slice(0, 8)) {
    lines.push(`- ${c.label}: ${c.durationMs != null ? c.durationMs.toFixed(1) : '?'} ms`);
  }
  lines.push('');
  lines.push(`## Long tasks (>${summary.longTaskThresholdMs} ms): ${summary.longTaskCountOverThreshold}`);
  if (summary.longTasks.length === 0) {
    lines.push('*(none — use timespan + gestures or DevTools trace for interaction stalls.)*');
  } else {
    for (const t of summary.longTasks.slice(0, 10)) {
      lines.push(`- ${t.durationMs?.toFixed?.(1) ?? t.durationMs} ms — ${t.url || 'unknown'}`);
    }
  }
  lines.push('');
  lines.push('## Optimization checklist (repo-aligned)');
  for (const c of OPTIMIZATION_CHECKLIST) lines.push(`- ${c}`);
  lines.push('');
  lines.push('---');
  lines.push('*Generated by `pnpm perf:agent-brief`. Paste this whole block into an AI coding agent with `@src/…` files you are changing.*');
  return lines.join('\n');
}

function buildAgentJson(summary, reportPath) {
  const ranked = summary.topJsByCpuTime.slice(0, 15).map((row, idx) => ({
    rank: idx + 1,
    ...row,
    hints: hintsForChunkFilename(row.shortLabel),
  }));
  return {
    reportPath,
    gatherMode: summary.gatherMode,
    performanceScore: summary.performanceScore,
    finalDisplayedUrl: summary.finalDisplayedUrl,
    transferBytesTotal: summary.transferBytesTotal,
    transferBytesScript: summary.transferBytesScript,
    mainThreadWorkMs: summary.mainThreadWorkMs,
    jsExecutionTotalMs: summary.jsExecutionTotalMs,
    rankedOffenders: ranked,
    longTasksOverThreshold: summary.longTasks,
    optimizationChecklist: OPTIMIZATION_CHECKLIST,
    limits:
      'LHR has no JS call stacks. Use Chrome DevTools Performance + React Profiler for line-level causes.',
  };
}

function parseArgs(argv) {
  const jsonOut = argv.includes('--json');
  let outPath = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') continue;
    if (argv[i] === '--out' && argv[i + 1]) {
      outPath = argv[++i];
      continue;
    }
    rest.push(argv[i]);
  }
  const pathArg = rest.find((a) => !a.startsWith('-'));
  return { jsonOut, outPath, pathArg };
}

async function main() {
  const argv = process.argv.slice(2);
  const { jsonOut, outPath, pathArg } = parseArgs(argv);
  const reportPath = await resolveReportPath(pathArg);
  const raw = await readFile(reportPath, 'utf8');
  const lhr = JSON.parse(raw);
  const summary = summarizeLhr(lhr);

  if (jsonOut) {
    console.log(JSON.stringify(buildAgentJson(summary, reportPath), null, 2));
    return;
  }

  const md = buildMarkdown(summary, reportPath);
  if (outPath) {
    const abs = outPath.startsWith('/') ? outPath : join(repoRoot, outPath);
    await writeFile(abs, md, 'utf8');
    console.error(`[perf:agent-brief] Wrote ${abs}`);
  }
  console.log(md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
