# Vision Forge

**Virtual Production Scout** — a node-based pipeline canvas for exploring virtual production workflows. Build and connect stages (inputs, generators, shot selection, set dressing, lighting, atmosphere, and more) on an infinite React Flow canvas. The UI is local-first today; **Supabase** backs authentication and per-user saved canvases (**spaces**).

## Stack

- **Vite** + **TypeScript** + **React**
- **shadcn/ui**, **Tailwind CSS**
- **Zustand** (canvas state), **TanStack Query** (load/save space + persisted cache), **React Flow** (graph)
- **Supabase** (Postgres, Auth, RLS)

## Prerequisites

- Node.js 18+
- **pnpm** or **npm**
- A [Supabase](https://supabase.com) project (for backend features)

## Setup

```sh
git clone <YOUR_REPO_URL>
cd Vision-Forge
pnpm install   # or: npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Where to find it |
|----------|------------------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → **Project Settings** → **API** → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Same page → **anon public** key (not `service_role`) |

```sh
pnpm dev       # or: npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Supabase: schema and remote migration

**CLI convention:** run every Supabase CLI command with **`pnpx supabase …`** (uses the project’s CLI via pnpm; same flags as `supabase` in the official docs).

Migrations live in [`supabase/migrations/`](supabase/migrations/).

### Tables (MVP)

| Table | Purpose |
|-------|--------|
| `profiles` | One row per signed-up user (display name, avatar). Created automatically via trigger on `auth.users`. |
| `spaces` | User-owned saved canvases: `nodes`, `edges`, `comments`, `settings`, `node_grid_layouts`, `viewport` (pan/zoom) as JSON. |

### Auth (canvas load/save)

1. In **Authentication → Providers**, enable **Anonymous sign-ins** so the app can create a session and load/save the user’s single space.
2. Optional: users can **Create account** (top bar) to attach email/password to the same anonymous session via `updateUser`.

Row Level Security (RLS) restricts `profiles` and `spaces` to the authenticated user.

### Storage (Upload node)

1. Set **`VITE_SUPABASE_STORAGE_BUCKET`** in `.env` to your bucket id (must match the name in **Storage → Buckets**). Repo migrations ensure **`uploads`**, **`canvas`**, **`workflow-media`**, and **`bucket-1`** are allowed (see [`20260321120000_storage_upload_policies.sql`](supabase/migrations/20260321120000_storage_upload_policies.sql) and [`20260403120000_storage_bucket_1_policies.sql`](supabase/migrations/20260403120000_storage_bucket_1_policies.sql)).
2. **Apply storage policies** (fixes **403** / RLS on upload): run **`pnpm db:push-sync`** (or `pnpx supabase db push`) so those migrations run — they create buckets if missing and add **INSERT** (`authenticated`) + **SELECT** (`public`) on `storage.objects`.
3. **Authentication → Providers → Anonymous** — keep **Anonymous sign-in** enabled (the app uses `signInAnonymously()` so uploads use the `authenticated` role).
4. If your bucket id is **not** one of the three above, add it to the `array['uploads', ...]` in that migration (or run [`docs/supabase-storage-upload-policies.sql`](docs/supabase-storage-upload-policies.sql) in **SQL Editor** with your bucket name).

The S3-style env vars (`VITE_SUPABASE_STORAGE_ACCESS_KEY`, etc.) are optional; the app uploads via the Supabase JS client (REST), not direct S3.

**Caching & URLs:** Workflow uploads use **`getPublicUrl`** (not per-request signed URLs). Each file gets a **new object path** (`workflow-media/{time}-{id}-{name}`) so content changes do not fight the browser cache. Uploads set a **long `cacheControl` max-age** (1 year) via [`src/lib/uploadStorage.ts`](src/lib/uploadStorage.ts). **Objects uploaded before this change** keep their previous TTL until re-uploaded or updated in the dashboard.

### Apply migrations to your remote project

**Option A — Supabase CLI (recommended)**

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) (or rely on **`pnpx`** to run it without a global install).
2. Log in: **`pnpx supabase login`**
3. Link this repo to your project (project ref is in the dashboard URL):

   ```sh
   pnpx supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Push migrations and regenerate TypeScript types (one step):

   ```sh
   pnpm db:push-sync
   ```

   This runs `pnpx supabase db push` then `pnpm db:types`. Use **`pnpm db:types`** alone if you only changed the schema in the dashboard and need types updated, or **`pnpx supabase db push`** alone if you only need to apply migrations.

**Option B — SQL Editor**

1. Open **SQL Editor** in the Supabase Dashboard.
2. Paste the contents of `supabase/migrations/20260318120000_init_vision_forge.sql` and run it.

If you edit the schema only in the dashboard, run **`pnpm db:types`** so [`src/integrations/supabase/types.ts`](src/integrations/supabase/types.ts) stays in sync.

### Moving data to a new Supabase project

See **[`docs/supabase-migrate-between-projects.md`](docs/supabase-migrate-between-projects.md)** and [`scripts/supabase-migrate/`](scripts/supabase-migrate/) (`export-auth.sh`, `export-public.sh`, `import-to-target.sh`, `verify-counts.sql`).

### Edge Function: `scout-execute` (Virtual Production Scout)

Deploy the OpenRouter-backed pipeline function after linking the project:

```sh
pnpm db:deploy-scout-fn
```

Equivalent: **`pnpx supabase functions deploy scout-execute --no-verify-jwt`**. Set secrets first (e.g. `pnpx supabase secrets set OPENROUTER_API_KEY=…`). See [`docs/SCOUT_LIVE_ROLLOUT.md`](docs/SCOUT_LIVE_ROLLOUT.md).

### Security

- Commit **migrations**; do **not** commit `.env`, `secret`, or the **service_role** key.
- The Vite app only needs the **anon** key; RLS enforces access rules.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev --port 8082 --host` | Dev server with HMR |
| `pnpm build` | Production build to `dist/` |
| `pnpm build:dev` | Build in development mode |
| `pnpm preview` | Preview production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (once) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm db:push-sync` | Push migrations to linked remote DB, then regenerate `types.ts` |
| `pnpm db:types` | Regenerate `types.ts` from linked Supabase only (after `pnpx supabase link`) |
| `pnpm db:deploy-scout-fn` | Deploy Edge Function `scout-execute` (`pnpx supabase functions deploy …`) |

## Guidelines

- Use feature branches; open PRs for non-trivial changes.
- Run `pnpm lint` and `pnpm test` before submitting.
- Keep secrets out of git (see `.gitignore` and `.env.example`).
- Prefer SQL migrations in `supabase/migrations/` over one-off dashboard edits when collaborating.

## Roadmap ideas

- Wire the canvas to **save/load** `spaces` after login (list spaces, debounced upserts).
- Optional **Storage** bucket + metadata table for Upload node assets.
- **workflow_versions** for history without bloating the main `spaces` row.
