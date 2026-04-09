/**
 * Programmatic Lighthouse (desktop) against `pnpm perf:preview` (or BASE_URL).
 * Optional `--warmup`: Puppeteer gestures via `puppeteer-warmup.mjs` on the same Chrome debugging port.
 * Optional auth: set PERF_AUTH_EMAIL + PERF_AUTH_PASSWORD in `.env` to measure `/` after sign-in (not `/signin`).
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import * as ChromeLauncher from 'chrome-launcher';
import lighthouse, { generateReport } from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

import { getPerfAuthFromEnv, loadPerfEnvFromRepo, seedPerfAuthSession } from './perf-auth.mjs';
import { runPuppeteerWarmup } from './puppeteer-warmup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

function parseArgs(argv) {
  const warmup = argv.includes('--warmup');
  const noWarmup = argv.includes('--no-warmup');
  return { warmup: warmup && !noWarmup };
}

const { warmup } = parseArgs(process.argv.slice(2));
const baseUrl = (process.env.BASE_URL ?? 'http://localhost:4173').replace(/\/?$/, '/');

async function main() {
  await loadPerfEnvFromRepo(repoRoot);
  const auth = getPerfAuthFromEnv();
  const lhConfig =
    auth != null
      ? {
          ...desktopConfig,
          settings: {
            ...desktopConfig.settings,
            disableStorageReset: true,
          },
        }
      : desktopConfig;

  const artifactsDir = path.join(repoRoot, 'artifacts');
  await mkdir(artifactsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const chrome = await ChromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    logLevel: 'silent',
  });

  const browserURL = `http://127.0.0.1:${chrome.port}`;
  try {
    if (auth) {
      console.error(`[perf:lighthouse] Seeding auth session for ${baseUrl} (${auth.email})`);
      await seedPerfAuthSession(browserURL, { baseUrl, email: auth.email, password: auth.password });
    }

    if (warmup) {
      console.error(`[perf:lighthouse] Warmup (Puppeteer): ${baseUrl}`);
      await runPuppeteerWarmup({ browserURL, baseUrl, durationMs: 4000, auth: auth ?? undefined });
    }

    console.error(`[perf:lighthouse] Lighthouse: ${baseUrl}`);
    const runnerResult = await lighthouse(
      baseUrl,
      {
        hostname: '127.0.0.1',
        port: chrome.port,
        logLevel: 'error',
        onlyCategories: ['performance'],
      },
      lhConfig,
    );

    if (!runnerResult?.lhr) {
      throw new Error('Lighthouse returned no report (lhr).');
    }

    const jsonPath = path.join(artifactsDir, `lighthouse-${stamp}.json`);
    const htmlPath = path.join(artifactsDir, `lighthouse-${stamp}.html`);

    await writeFile(jsonPath, JSON.stringify(runnerResult.lhr, null, 2), 'utf8');
    await writeFile(htmlPath, generateReport(runnerResult.lhr, 'html'), 'utf8');

    const score = runnerResult.lhr.categories?.performance?.score;
    console.error(`[perf:lighthouse] Performance score: ${score != null ? (score * 100).toFixed(1) : 'n/a'}`);
    console.log(jsonPath);
  } finally {
    await chrome.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
