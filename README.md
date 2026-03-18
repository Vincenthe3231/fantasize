# Vision Forge

**Virtual Production Scout** — a node-based pipeline canvas for exploring virtual production workflows. Build and connect stages (inputs, generators, shot selection, set dressing, lighting, atmosphere, and more) on an infinite React Flow canvas. The UI is local-first today; **Supabase** backs authentication and per-user saved canvases (**spaces**).

## Stack

- **Vite** + **TypeScript** + **React**
- **shadcn/ui**, **Tailwind CSS**
- **Zustand** (canvas state), **React Flow** (graph)
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

Migrations live in [`supabase/migrations/`](supabase/migrations/).

### Tables (MVP)

| Table | Purpose |
|-------|--------|
| `profiles` | One row per signed-up user (display name, avatar). Created automatically via trigger on `auth.users`. |
| `spaces` | User-owned saved canvases: `nodes`, `edges`, `comments`, optional `settings` and `node_grid_layouts` as JSON (matches the app’s Zustand workflow state). |

Row Level Security (RLS) restricts `profiles` and `spaces` to the authenticated user.

### Apply migrations to your remote project

**Option A — Supabase CLI (recommended)**

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Log in: `supabase login`
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

### Security

- Commit **migrations**; do **not** commit `.env`, `secret`, or the **service_role** key.
- The Vite app only needs the **anon** key; RLS enforces access rules.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server with HMR |
| `pnpm build` | Production build to `dist/` |
| `pnpm build:dev` | Build in development mode |
| `pnpm preview` | Preview production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (once) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm db:push-sync` | Push migrations to linked remote DB, then regenerate `types.ts` |
| `pnpm db:types` | Regenerate `types.ts` from linked Supabase only (after `pnpx supabase link`) |

## Guidelines

- Use feature branches; open PRs for non-trivial changes.
- Run `pnpm lint` and `pnpm test` before submitting.
- Keep secrets out of git (see `.gitignore` and `.env.example`).
- Prefer SQL migrations in `supabase/migrations/` over one-off dashboard edits when collaborating.

## Roadmap ideas

- Wire the canvas to **save/load** `spaces` after login (list spaces, debounced upserts).
- Optional **Storage** bucket + metadata table for Upload node assets.
- **workflow_versions** for history without bloating the main `spaces` row.
