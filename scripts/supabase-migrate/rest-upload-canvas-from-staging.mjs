/**
 * Re-upload files from a local staging dir into `canvas` using the Storage HTTP API
 * (`upsert: true`). Use after S3 sync if `download()` / public URLs still 404 — raw S3
 * uploads can diverge from what the Storage gateway serves.
 *
 * Usage:
 *   STAGING_DIR=/tmp/vision-forge-canvas-sync.xxx node scripts/supabase-migrate/rest-upload-canvas-from-staging.mjs
 *
 * Expects repo-root `.env` with VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY (or anon with insert policy).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const envPath = path.join(root, '.env');

function loadEnv() {
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.drawio': 'application/xml',
  };
  return map[ext] ?? 'application/octet-stream';
}

const STAGING_DIR = process.env.STAGING_DIR;
if (!STAGING_DIR || !fs.existsSync(STAGING_DIR)) {
  console.error('Set STAGING_DIR to the directory that contains workflow-media/ (e.g. /tmp/vision-forge-canvas-sync.xxx)');
  process.exit(1);
}

const wm = path.join(STAGING_DIR, 'workflow-media');
if (!fs.existsSync(wm)) {
  console.error('Missing workflow-media under', STAGING_DIR);
  process.exit(1);
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Need VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY (or anon) in .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const files = fs.readdirSync(wm).filter((f) => !f.startsWith('.'));
let ok = 0;
let fail = 0;

for (let i = 0; i < files.length; i++) {
  const base = files[i];
  const full = path.join(wm, base);
  const stat = fs.statSync(full);
  if (!stat.isFile()) continue;
  const objectPath = `workflow-media/${base}`;
  const body = fs.readFileSync(full);
  const { error } = await supabase.storage.from('canvas').upload(objectPath, body, {
    upsert: true,
    contentType: contentTypeFor(base),
    cacheControl: '31536000',
  });
  if (error) {
    console.error(`[${i + 1}/${files.length}] FAIL`, objectPath, error.message);
    fail += 1;
  } else {
    ok += 1;
    if (ok % 20 === 0 || ok === files.length) console.error(`[${i + 1}/${files.length}] uploaded ${ok} ok…`);
  }
}

console.log(JSON.stringify({ ok, fail, total: files.length }, null, 0));
process.exit(fail > 0 ? 1 : 0);
