/**
 * Short pan / wheel gestures against the live preview to warm caches before a Lighthouse run.
 * Product canvas scenarios: see `src/lib/canvasScenarios.ts` (shell-only runs do not load stress graphs).
 */
import puppeteer from 'puppeteer';

import { loadPageWithAuth } from './perf-auth.mjs';

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Pan/zoom loop for canvas-like interaction (used after the page is already loaded).
 * @param {import('puppeteer').Page} page Puppeteer page handle
 * @param {{ durationMs?: number }} [opts]
 */
export async function runPanZoomGesturesOnPage(page, { durationMs = 3500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const pane = await page.$('.react-flow__pane');
    let cx = 640;
    let cy = 360;
    if (pane) {
      const box = await pane.boundingBox();
      if (box && box.width > 20 && box.height > 20) {
        cx = box.x + box.width * 0.5;
        cy = box.y + box.height * 0.5;
      }
    }
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 50, { steps: 14 });
    await page.mouse.up();
    await delay(100);
    await page.mouse.wheel({ deltaY: -60 });
    await delay(80);
    await page.mouse.wheel({ deltaY: 40 });
    await delay(80);
  }
}

/**
 * @param {object} opts
 * @param {string} opts.browserURL e.g. http://127.0.0.1:9222 — Chrome remote debugging URL
 * @param {string} opts.baseUrl Page URL (vite preview)
 * @param {{ email?: string; password?: string }} [opts.auth] When set (PERF_AUTH_*), completes sign-in if redirected to `/signin`.
 * @param {number} [opts.durationMs=3500] Upper bound for gesture loop
 */
export async function runPuppeteerWarmup({ browserURL, baseUrl, durationMs = 3500, auth }) {
  const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
  try {
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await loadPageWithAuth(page, {
      baseUrl,
      email: auth?.email,
      password: auth?.password,
    });
    await runPanZoomGesturesOnPage(page, { durationMs });
  } finally {
    await browser.disconnect();
  }
}
