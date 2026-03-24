# Scout execution — live rollout

This document covers deploying the `scout-execute` Supabase Edge Function and validating the Virtual Production Scout pipeline with a real OpenRouter key.

## Prerequisites

- Supabase project linked (`pnpx supabase link`)
- `OPENROUTER_API_KEY` available as a **secret** (never in the Vite bundle)

## Configure secrets

Use the Supabase CLI via **`pnpx supabase`** (see [README.md](../README.md)).

```bash
pnpx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
```

Optional (OpenRouter app metadata for rankings / dashboard):

```bash
pnpx supabase secrets set OPENROUTER_HTTP_REFERER=https://your-production-app.example
pnpx supabase secrets set OPENROUTER_APP_TITLE="Vision Forge Scout"
```

If unset, the edge function uses safe defaults (`https://vision-forge.local` and `Vision Forge Scout`).

## Deploy the edge function

```bash
pnpm db:deploy-scout-fn
```

Or directly:

```bash
pnpx supabase functions deploy scout-execute --no-verify-jwt
```

Use `--no-verify-jwt` only if you invoke with the anon key from the browser; tighten with JWT verification for production if required.

## Client

The app calls `supabase.functions.invoke('scout-execute', …)` via `src/lib/scoutExecutionApi.ts`. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are set.

## Smoke test sequence

1. **Stage 2 instructions** — Run the Assistant node; verify `result` / `refinedPrompt` on the node.
2. **Stage 2 preview** — Run Image generator and Set dressing; verify `generatedUrl` / `previewUrl`.
3. **Stage 4 lighting** — Commit hero shot, run lighting batch; verify `lastBatchResults` and `accumulatedLighting` lengths match the number of lighting strings.
4. **Stage 5** — Run text and reference atmosphere batches separately; verify `textResults` / `referenceResults` cardinality vs lighting variants.
5. **Finalize** — Use Finalize on Atmosphere test; confirm `scoutPipeline.finalDeliverable`.

## Stage 2 instructions (multimodal + `openrouter/auto`)

- The edge function uses **`@openrouter/sdk`** with **`openrouter/auto`** and **streaming** (aggregated to one string before returning JSON).
- User messages include **text + `image_url` + `video_url`** parts built from [`stage2Multimodal.ts`](/supabase/functions/scout-execute/stage2Multimodal.ts) from resolver context (placement, location media, props, optional placement reference image).
- **`blob:` URLs** are skipped with a warning in the edge logs — OpenRouter cannot fetch them. Use **HTTPS** URLs (e.g. Supabase Storage) for production.

## Fallback

If the edge function fails or returns an error, `scoutRunCoordinator` uses deterministic **mock** image URLs (`picsum.photos` seeds) so local development remains usable without a key.

## Browser console (development)

With `pnpm dev`, open DevTools → **Console**. Scout runs emit **`[Scout]`** `console.debug` lines from:

- `src/lib/scoutRunCoordinator.ts` — run start, resolved context summary, resolve failures, completion (`usedMockFallback` when the client fell back to mock output).
- `src/lib/scoutExecutionApi.ts` — edge request/response summaries and timing.

Logs are **dev-only** (`import.meta.env.DEV`). Strings and nested payloads are **truncated** so the console stays readable. Filter the console by `Scout` to reduce noise.

**Using `OPENROUTER_API_KEY`**

1. **Never** put the key in `.env` for Vite (`VITE_*`) or commit it — the app must not bundle the key.
2. Set it as a **Supabase secret** for the Edge Function (see above): `pnpx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...`
3. Deploy `scout-execute`: `pnpm db:deploy-scout-fn` or `pnpx supabase functions deploy scout-execute --no-verify-jwt`
4. Run the app against your Supabase project (`VITE_SUPABASE_URL` + anon key). Trigger Assistant (Stage 2 instructions): the function will call OpenRouter when the secret is present; console should show `mock: false` (or similar) on success and `usedMockFallback: false` when the server returned real results.

Stage 2 instructions are fixed to **`openrouter/auto`** in [`openrouterClient.ts`](/supabase/functions/scout-execute/openrouterClient.ts) (no separate text-model secret for that path).
