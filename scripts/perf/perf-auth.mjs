/**
 * Optional email/password sign-in for perf runs so Lighthouse measures `/` (canvas) instead of `/signin`.
 * Set PERF_AUTH_EMAIL + PERF_AUTH_PASSWORD in `.env` (see `.env.example`).
 */
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Merge `PERF_*` keys from repo `.env` into `process.env` when unset.
 * @param {string} repoRoot
 */
export async function loadPerfEnvFromRepo(repoRoot) {
  try {
    const envPath = path.join(repoRoot, '.env');
    const text = await readFile(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key.startsWith('PERF_')) continue;
      if (process.env[key] !== undefined) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // no .env or unreadable
  }
}

/**
 * @returns {{ email: string, password: string } | null}
 */
export function getPerfAuthFromEnv() {
  const email = process.env.PERF_AUTH_EMAIL?.trim();
  if (!email) return null;
  const password = process.env.PERF_AUTH_PASSWORD ?? '';
  return { email, password };
}

/**
 * Navigate to `baseUrl` and sign in if redirected to `/signin` and credentials are set.
 * @param {import('puppeteer').Page} page
 * @param {{ baseUrl: string; email?: string; password?: string }} opts
 */
export async function loadPageWithAuth(page, { baseUrl, email, password }) {
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 120_000 });
  await page.waitForSelector('#root', { timeout: 30_000 });

  if (!email) return;

  const url = page.url();
  if (!url.includes('/signin')) {
    return;
  }

  await page.waitForSelector('#signin-email', { visible: true, timeout: 60_000 });
  await page.click('#signin-email', { clickCount: 3 });
  await page.keyboard.type(email, { delay: 5 });
  await page.click('#signin-password', { clickCount: 3 });
  await page.keyboard.type(password ?? '', { delay: 5 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120_000 }),
    page.click('form button[type="submit"]'),
  ]);

  const after = page.url();
  if (after.includes('/signin')) {
    throw new Error(
      '[perf:auth] Sign-in failed (still on /signin). Check PERF_AUTH_EMAIL / PERF_AUTH_PASSWORD and that the user exists in Supabase.',
    );
  }
}

/**
 * Same browser session: open a tab, establish auth, close tab. Used before Lighthouse navigation
 * so the default browser context keeps localStorage/session for the next navigation.
 * @param {string} browserURL
 * @param {{ baseUrl: string; email: string; password: string }} auth
 */
export async function seedPerfAuthSession(browserURL, { baseUrl, email, password }) {
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await loadPageWithAuth(page, { baseUrl, email, password });
    await page.close();
  } finally {
    await browser.disconnect();
  }
}
