# Automated Lighthouse + Puppeteer (app shell)

Lab metrics only: use for **regressions** on JS / main-thread work, not as a substitute for field INP ([web.dev/inp](https://web.dev/inp/)). By default, unauthenticated loads redirect to **`/signin`**, so Lighthouse mostly measures that path unless you enable **perf auth** below. Dense stress scenarios still need real data/fixtures; see `src/lib/canvasScenarios.ts`.

## Requirements

- **Node** ≥ 22.19 (required by Lighthouse 13).
- **Preview** must be reachable at `BASE_URL` (default **`http://localhost:4173/`** — match **localhost** vs **127.0.0.1** consistently; they are different origins for cookies).

## Authenticated canvas (recommended for real app perf)

Add to **`.env`** (see `.env.example`):

```bash
PERF_AUTH_EMAIL=superadmin@example.com
PERF_AUTH_PASSWORD=your_password
```

Scripts load `PERF_*` from `.env` automatically. Then:

1. Puppeteer signs in on `/signin` if the app redirects there.
2. Lighthouse runs with **`disableStorageReset: true`** so the Supabase session in `localStorage` is not cleared before navigation.

Use the **same** `BASE_URL` origin you used to log in (default `http://localhost:4173/`).

## Commands

1. Build and serve preview (terminal A):

   ```bash
   pnpm build && pnpm perf:preview
   ```

2. **Navigation** (initial load baseline — payload, parse cost, LCP-style window):

   ```bash
   pnpm perf:lighthouse
   ```

   Optional: `pnpm perf:lighthouse -- --warmup` to run Puppeteer pan/zoom on the same Chrome port **before** the audit (separate cold load; complements a plain navigation run).

3. **Timespan** (interaction-heavy window — pan/zoom while Lighthouse records):

   ```bash
   pnpm perf:lighthouse:timespan
   ```

   Gestures run **inside** the timespan (default ~5s, override with `PERF_TIMESPAN_GESTURE_MS`). Use together with Navigation to separate **load** vs **dense interaction** (see re-validate note below).

4. **Analyze** (rank offenders — same ordering idea as Lighthouse “JavaScript execution time” / bootup-time table):

   ```bash
   pnpm perf:analyze
   ```

   Reads the **newest** `artifacts/lighthouse*.json` by modification time (or `LIGHTHOUSE_REPORT=...`, or a path argument). Prints:

   - JS URLs ranked by **Total CPU Time** (`bootup-time` audit)
   - **Main-thread** category breakdown (`mainthread-work-breakdown`)
   - **Long tasks** with duration >50ms (`long-tasks` audit), when present
   - **Transfer sizes** from `resource-summary` (reliable in **navigation** reports; often empty/zero in **timespan** — use Navigation for payload tracking)

   Machine-readable: `pnpm perf:analyze -- --json`

5. **Agent brief** (compact Markdown + repo hints for AI assistants):

   ```bash
   pnpm perf:agent-brief
   ```

   Reads the same default report as `perf:analyze`. Outputs a **pasteable** brief: top `bootup-time` URLs mapped to **likely bundles** (`vite.config.ts` manualChunks) and **files to inspect**, plus a short optimization checklist. Does **not** add call stacks (LHR limitation).

   - JSON for tooling: `pnpm perf:agent-brief -- --json`
   - Write to disk (gitignored): `pnpm perf:agent-brief -- --out artifacts/agent-perf-brief.md`

6. **Budget gate**:

   ```bash
   pnpm perf:check
   ```

   Uses the newest report by mtime, or `LIGHTHOUSE_REPORT`, or an explicit path. Override URL for any command: `BASE_URL=http://127.0.0.1:4173/w/foo pnpm perf:lighthouse`

## Optimization workflow (how this maps to triage)

| Priority | What to do | This repo |
|----------|------------|-----------|
| Find top JS offenders | Sort by execution / CPU time on main thread | `perf:analyze` → **Top JS by CPU time** (bootup-time) |
| Long tasks >50ms | See duration and URL; **call stacks** need a trace | `perf:analyze` → long-tasks; stacks: **DevTools Performance** (or record a trace manually) |
| Cut shipped JS | Code-split heavy routes; Coverage in DevTools | Ranked URL list points at chunks to split / lazy-load |
| Interaction cost | Measure while gesturing, not only cold load | `perf:lighthouse:timespan` + compare `perf:analyze` |
| Re-validate | Navigation = baseline load; Timespan = gesture window | Run both; compare `perf:analyze` and budgets |

**Not automated here (by design):** Coverage tab, full Performance trace parsing, and mapping long tasks to **function names** — use Chrome DevTools for those. LHR does not include JS stack samples.

**Product follow-ups** (manual / future fixtures): passive WebGL/hybrid drawing, workers for geometry, state fan-out during pan/zoom, stable image URLs — see `tasks/todo.md` and `src/lib/canvasPerf.ts`.

## Outputs

- `artifacts/lighthouse-<timestamp>.json` / `.html` — navigation mode (gitignored).
- `artifacts/lighthouse-timespan-<timestamp>.json` / `.html` — timespan mode (gitignored).

Thresholds: `budgets.json`. Tighten after you have a stable baseline.

## Agent workflow

Run `perf:preview` in the background, then `perf:lighthouse` and/or `perf:lighthouse:timespan`, then `perf:analyze` or **`perf:agent-brief`** (for LLM-friendly output), then `perf:check`. Compare runs by diffing JSON or pinning `LIGHTHOUSE_REPORT` to a saved baseline file.

**AI coding agents:** paste the output of `pnpm perf:agent-brief` into the chat together with `@src/...` paths listed in the brief; use `perf:agent-brief -- --json` if the agent ingests structured data.
