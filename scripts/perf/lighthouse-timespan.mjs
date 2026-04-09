/**
 * Lighthouse **timespan** mode: measures performance while Puppeteer runs pan/zoom on an already-loaded page.
 * Optional auth: PERF_AUTH_EMAIL + PERF_AUTH_PASSWORD in `.env` so the page is the canvas, not `/signin`.
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import * as ChromeLauncher from 'chrome-launcher';
import { generateReport, startTimespan } from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import puppeteer from 'puppeteer';

import { getPerfAuthFromEnv, loadPageWithAuth, loadPerfEnvFromRepo } from './perf-auth.mjs';
import { runPanZoomGesturesOnPage } from './puppeteer-warmup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

const baseUrl = (process.env.BASE_URL ?? 'http://localhost:4173').replace(/\/?$/, '/');
const gestureMs = Number(process.env.PERF_TIMESPAN_GESTURE_MS ?? '5000');

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
  const browser = await puppeteer.connect({ browserURL, defaultViewport: null });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    console.error(`[perf:lighthouse:timespan] Loading ${baseUrl}${auth ? ` (auth: ${auth.email})` : ''}`);
    await loadPageWithAuth(page, {
      baseUrl,
      email: auth?.email,
      password: auth?.password,
    });

    console.error('[perf:lighthouse:timespan] startTimespan + gestures');
    const { endTimespan } = await startTimespan(page, {
      config: lhConfig,
      flags: {
        logLevel: 'error',
        onlyCategories: ['performance'],
      },
    });

    await runPanZoomGesturesOnPage(page, { durationMs: gestureMs });

    const runnerResult = await endTimespan();
    if (!runnerResult?.lhr) {
      throw new Error('Timespan Lighthouse returned no report (lhr).');
    }

    const jsonPath = path.join(artifactsDir, `lighthouse-timespan-${stamp}.json`);
    const htmlPath = path.join(artifactsDir, `lighthouse-timespan-${stamp}.html`);
    await writeFile(jsonPath, JSON.stringify(runnerResult.lhr, null, 2), 'utf8');
    await writeFile(htmlPath, generateReport(runnerResult.lhr, 'html'), 'utf8');

    const score = runnerResult.lhr.categories?.performance?.score;
    console.error(`[perf:lighthouse:timespan] Performance score: ${score != null ? (score * 100).toFixed(1) : 'n/a'}`);
    console.log(jsonPath);
  } finally {
    await browser.disconnect();
    await chrome.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
