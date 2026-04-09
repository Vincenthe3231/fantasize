/**
 * Compare a Lighthouse JSON report to scripts/perf/budgets.json.
 * Exit 1 if any threshold is exceeded (for CI / agent gates).
 *
 * Report path: argv[2], or LIGHTHOUSE_REPORT, or newest artifacts/lighthouse-*.json
 */
import { readFile, readdir, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

async function resolveReportPath() {
  const fromEnv = process.env.LIGHTHOUSE_REPORT;
  const fromArgv = process.argv[2];
  if (fromArgv && !fromArgv.startsWith('-')) return fromArgv;
  if (fromEnv) return fromEnv;

  const artifactsDir = join(repoRoot, 'artifacts');
  let names;
  try {
    names = await readdir(artifactsDir);
  } catch {
    throw new Error(`No report path given and ${artifactsDir} is missing or unreadable.`);
  }
  const jsons = names.filter((n) => n.startsWith('lighthouse') && n.endsWith('.json'));
  if (jsons.length === 0) {
    throw new Error(`No lighthouse*.json in ${artifactsDir}. Run pnpm perf:lighthouse first.`);
  }
  let bestPath = null;
  let bestMtime = 0;
  for (const n of jsons) {
    const p = join(artifactsDir, n);
    const st = await stat(p);
    if (st.mtimeMs >= bestMtime) {
      bestMtime = st.mtimeMs;
      bestPath = p;
    }
  }
  return bestPath;
}

function readJson(path) {
  return readFile(path, 'utf8').then((s) => JSON.parse(s));
}

async function main() {
  const reportPath = await resolveReportPath();
  const budgetsPath = join(__dirname, 'budgets.json');
  const [lhr, budgets] = await Promise.all([readJson(reportPath), readJson(budgetsPath)]);

  const failures = [];
  const perfScore = lhr.categories?.performance?.score;
  if (typeof perfScore === 'number' && typeof budgets.minPerformanceScore === 'number') {
    if (perfScore < budgets.minPerformanceScore) {
      failures.push(
        `Performance category score ${(perfScore * 100).toFixed(1)} < min ${(budgets.minPerformanceScore * 100).toFixed(1)}`,
      );
    }
  }

  const auditBudgets = budgets.audits ?? {};
  for (const [auditId, rule] of Object.entries(auditBudgets)) {
    const max = rule?.numericValueMax;
    if (typeof max !== 'number') continue;
    const audit = lhr.audits?.[auditId];
    const val = audit?.numericValue;
    if (typeof val !== 'number') {
      failures.push(`Audit "${auditId}": missing numericValue in report`);
      continue;
    }
    if (val > max) {
      failures.push(`Audit "${auditId}": ${val} > max ${max} (${audit?.numericUnit ?? 'ms'})`);
    }
  }

  if (failures.length) {
    console.error(`[perf:check] FAILED (${reportPath})`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(`[perf:check] OK — ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
