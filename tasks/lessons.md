# Lessons (session corrections)

## “Newer” IndexedDB draft must not wipe a full Supabase graph

- **Symptom:** Preview build shows full canvas; another port / browser has empty or stale graph even after remote save. IDB shows `draft:<spaceId>` with a **newer** `clientUpdatedAt` than the server but a **bad** payload (no edges, etc.).
- **Cause:** `shouldRestoreDraftFromLocal` trusted **only** `clientUpdatedAt > space.updated_at`. A stray `writeSpaceDraft` (race, clock skew, bad snapshot) could win over the row fetched from Postgres.
- **Fix:** `localDraftIsRegressiveVersusServer` — if the draft would clearly **lose** work vs the server row (e.g. empty graph, or ≥8 server edges and **0** draft edges), **clear** the draft and hydrate from Supabase.

_Date: 2026-04-14._

## `/` vs `/w/:spaceId` — “latest space” is not your edited space

- **Symptom:** Same account, “saved to Supabase,” but another browser or tab shows old/empty canvas; reopening one browser still looks correct.
- **Cause:** `/` uses `fetchOrCreateSpace` → **latest row** by `updated_at`. Multiple `spaces` rows per user mean you can edit space **A** while **B** stays “latest,” or a duplicate empty insert becomes latest. Same-browser reopen can still show **local draft** or the row you last loaded under `/w/:id` in session.
- **Fix:** Pin the workspace in the URL (`/w/<uuid>`); after default resolve, replace-state navigate and seed React Query cache for that id.

_Date: 2026-04-14._

## `fetchOrCreateSpace`: avoid head + full split query

- **Symptom:** Canvas empty or load error after a `spaceApi` change; “progress gone” in browser.
- **Cause:** `id`-only head then `fetchSpaceById` could yield **no row** on the second request while the first succeeded (session/RLS timing). Follow-up either **inserted a duplicate empty space** or **threw**, breaking hydration. IndexedDB drafts are keyed by `spaceId` — a new id means drafts no longer apply.
- **Fix:** Load latest space with **one** `select(SPACE_SELECT_FULL)…eq(owner_id)…order(updated_at)…limit(1)`; insert only when zero rows.

_Date: 2026-04-14._

## `normalizeSnapshotPayload` must tolerate missing `payload`

- **Symptom:** `TypeError: Cannot read properties of undefined (reading 'canvas_drawings')` in `spaceDraftStorage.ts` when restoring a draft from IndexedDB/localStorage.
- **Cause:** Legacy or corrupted stored rows can omit `payload` or store a non-object; `withNormalizedDraft` still called `normalizeSnapshotPayload(d.payload)`.
- **Fix:** Treat `null` / non-object `p` as empty snapshot; for objects, default `nodes`/`edges`/etc. with `Array.isArray` / shape checks instead of only spreading `...p`.

_Date: 2026-04-14._

## Draw toolbar must be excluded from pane draw hit-testing

- **Symptom:** Starting a stroke when clicking the bottom draw palette, or odd gesture behavior near controls.
- **Fix:** Put the floating bar in a container with **`data-vf-no-draw`** (see `isCanvasDrawUiBlocklist`) so `CanvasDrawInteraction` does not treat it as the pane.

_Date: 2026-04-14._

## PostgREST `42703` after adding a `spaces` column to `select`

- **Symptom:** `GET …/rest/v1/spaces?select=…,canvas_drawings,…` returns **400** with **`"code":"42703"`** and **`column spaces.canvas_drawings does not exist`**.
- **Cause:** The **remote** database was never migrated; the app and `SPACE_SELECT_FULL` in `spaceApi.ts` already expect the column.
- **Fix:** Apply the repo migration to that project (e.g. **`pnpm db:push-sync`** / **`pnpx supabase db push`** with the project linked, or run the SQL from `supabase/migrations/20260414120000_spaces_canvas_drawings.sql` in the Supabase **SQL Editor**). Merging code does not run DDL on production.

_Date: 2026-04-14._

## Radix `composeEventHandlers` and `preventDefault` on triggers

- **Symptom:** **`DropdownMenu`** / **`Popover`** trigger appears to ignore clicks — menu never opens.
- **Cause:** Radix composes **`props.onPointerDown` first**, then its internal handler. **`@radix-ui/primitive` `composeEventHandlers`** skips the second handler when **`event.defaultPrevented`** is true.
- **Fix:** Do not call **`preventDefault()`** on the trigger’s **`onPointerDown`** unless you replicate open/close yourself. Use **`stopPropagation()`** if you only need to keep events off the canvas. For portaled chrome above **`z-[6000]`**, raise portaled **`Content`** above the bar (e.g. **`z-[6200]`**) so the menu is not painted under it.

_Date: 2026-04-13._

## Supabase Edge: HTML 502 is not the same as “import broken” in repo

- **Symptom:** Browser shows **CORS missing** + **502** with **`content-type: text/html`** on `…/functions/v1/scout-execute`.
- **Repo check:** From `supabase/functions/scout-execute`, run **`deno check index.ts`** (install Deno if needed; set **`DENO_DIR`** to a writable folder if the default cache is not writable). If **`npm:@openrouter/sdk`** / **`npm:@toon-format/toon`** fetch and type-check proceeds past resolution, **dependencies are not “missing”** at the import level.
- **Action:** **Edge Function logs** in the Supabase project + **redeploy** (needs org access). Without deploy rights, only a project **Owner/Developer** can fix a broken remote bundle or platform error.

_Date: 2026-04-10._

## OpenRouter `Response validation failed` on `scout-execute`

- **Meaning:** `@openrouter/sdk` could not Zod-parse the HTTP body from OpenRouter (response shape drift vs SDK).
- **Try without redeploy:** Supabase Edge **secrets** — `OPENROUTER_IMAGE_GEN_MODALITIES=image,text` (or `image`), or change `OPENROUTER_IMAGE_GEN_MODEL` to another image model.
- **Then:** Redeploy `scout-execute` with **`supabase/functions/scout-execute/deno.json`** `@openrouter/sdk` pin aligned to current npm (see `docs/SCOUT_LIVE_ROLLOUT.md`).

_Date: 2026-04-10._

## OpenRouter SDK 0.11.x: `chat.send` expects `chatRequest`, not `chatGenerationParams`

- **Symptom:** JSON error like **`Invalid input: expected object, received undefined` → at `chatRequest`** (often surfaced as “schema mismatch” on the image path).
- **Cause:** **`@openrouter/sdk` ≥ 0.11** validates **`openrouter.chat.send({ chatRequest: { … }, httpReferer?, appTitle? })`**. Passing **`chatGenerationParams`** leaves **`chatRequest`** undefined; **`xTitle`** is not a valid field (use **`appTitle`** on the client options and on the per-request object).
- **Fix:** Map env **`OPENROUTER_APP_TITLE`** to **`appTitle`**; nest model/messages/stream/modalities under **`chatRequest`**.

_Date: 2026-04-13._

## OpenRouter image responses: strict SDK parse vs broken JSON / odd error bodies

- **Symptoms:** `Bad control character in string literal in JSON` (often **unescaped newlines inside a long `data:` URL** in the HTTP body), or **`Response validation failed` → `at error`** when the HTTP **error JSON** does not match **`@openrouter/sdk`** Zod shapes (e.g. missing nested `error` object).
- **Pattern:** Stage 2 / Stage 3 **image** path uses **`postOpenRouterChatCompletions`** (`openrouterChatCompletionFetch.ts`): **`fetch`** + **`parseJsonLenient`** (`jsonLenientParse.ts`). **`OPENROUTER_API_BASE`** overrides the default **`https://openrouter.ai/api/v1`**.
- **Cloudflare 1102 / HTTP 503 on `openrouter.ai`:** OpenRouter’s edge may terminate oversized multimodal requests. Mitigations: default **`OPENROUTER_IMAGE_GEN_MAX_ANCHORS=3`**, **`MAX_IMAGE_GEN_COMBINED_TEXT_CHARS`**, and **`formatOpenRouterImageHttpError`** user-facing copy. **`scout-execute` POST body** uses **`parseJsonLenient`** after **`req.text()`** so slightly broken inbound JSON (raw controls in strings) still parses.

_Date: 2026-04-13._

## Automated Lighthouse + Puppeteer (shell perf harness)

- **Use:** regression signal on **lab** performance (main-thread / load) for the **app shell** — not a substitute for field INP; dense canvas scenarios need auth/fixtures before this harness covers them.
- **Flow:** set **`PERF_AUTH_EMAIL` / `PERF_AUTH_PASSWORD`** in `.env` to measure **canvas** (`/`) vs **`/signin`**; **`BASE_URL`** default `http://localhost:4173/` (keep origin consistent — if preview prints **4174** because **4173** is in use, export **`BASE_URL=http://127.0.0.1:4174/`** for all perf scripts). Then `pnpm build && pnpm perf:preview` → **`perf:lighthouse`** / **`perf:lighthouse:timespan`** → **`perf:analyze`** or **`perf:agent-brief`** → **`perf:check`**. Optional **`perf:lighthouse -- --warmup`**.
- **Limits:** LHR has **no JS call stacks**; use DevTools Performance trace for hot functions. **Coverage** and **script treemap** remain manual in Chrome.
- **Node:** Lighthouse 13 expects Node ≥ 22.19.

_Date: 2026-04-09; timespan + analyze 2026-04-09._

## Canvas: aesthetics and heavy work must respect the frame budget

> **Important:** While building aesthetic components and transition with heavy computations, prioritize canvas performance to keep the overall canvas at stable and consistent 60 FPS with acceptable Interaction to Next Paint (INP) and lowest presentation delay as possible.

- While building **aesthetic components** and **transitions** that involve **heavy computation**, **prioritize canvas performance** so the **overall canvas** stays at a **stable, consistent ~60 FPS**, with **acceptable Interaction to Next Paint (INP)** and the **lowest presentation delay** feasible.
- **Implications:** defer or coalesce React commits during pan/zoom/drag; avoid subscribing UI to full viewport `x/y/z` when only zoom or quantized position is needed; do not rebuild large derived structures (maps, graphs) on transform-only store updates; keep hybrid/WebGL layers in sync with cheap per-frame work and expensive work on graph-change only; quantize floating chrome that tracks the viewport during gestures; prefer motion that does not force layout or full-graph work every frame.
- **Related implementation:** `tasks/todo.md` (Design principle + 2026-04-09 review); `Index.tsx` marquee `tk`, `PixiHybridBackground` incremental rebuild, `SelectionOverlay` / `canvasPerf` strong quantize, `BottomBar` zoom-only store selector.

_Date: 2026-04-09 — pan/zoom FPS optimization pass._

## WebGL-first / hybrid flags (dense pan FPS)

- **`edgeDomZoomDecimalPlaces`:** `CustomEdge` only; `0` = full precision (default). Set `3`–`4` via `?canvasEdgeZoomDecimals=` or `vf.perf.canvasEdgeZoomDecimals` to reduce edge re-renders on tiny zoom deltas during wheel/pinch — validate bezier near LOD thresholds (`CustomEdge` vs `ConnectionLineDomSource` unchanged).
- **`hybridGridCullToView` / `hybridEdgeCullToView`:** Pixi hybrid draws grid/edge mirror only in the visible flow rect (`ResizeObserver` on host). Disable with `?canvasHybridGridCull=0` / `?canvasHybridEdgeCull=0` if a driver shows missing lines at extreme zoom.
- **Pixi board `pagehide` / `visibilitychange`:** `PixiBoardViewport` writes `lastViewport` from `vpRef` so IndexedDB/remote parity sees the latest view if the user leaves mid-gesture.
- **`canvasImageUnmountDuringGesture`:** default **off**; enable for max savings during gestures at the cost of brief blank thumbs (`?canvasImageGestureUnmount=1`).

_Date: 2026-04 — WebGL-first conservative FPS plan._

## React Flow node `id` in JSX and string APIs

- **`Node.id`** is typed as `string` but persisted or merged state can still surface **non-strings**. Never render **`{n.id}`** directly when the value might not be coercible to a safe text child; use **`String(n.id)`** for display and list **`key`s**, and use **`String(a.id).localeCompare(String(b.id))`** (same for labels from node data) before **`localeCompare`** / **`.length` / `.slice`**.
- Upstream image URLs: only call **`.trim()`** when **`typeof url === 'string'`** — optional chaining on a non-string does not produce a string.

_Date: 2026-04-08 — `GroupNode`, `SelectionConnectMenu`, `SelectionOverlay`._

## Supabase Storage: public URLs + long max-age + new path per revision

- Prefer **`getPublicUrl`** for canvas/node image fields — avoid per-request **signed** URLs in persisted JSON (new token → new cache key → repeated full downloads).
- Set **`cacheControl`** on **upload** (Supabase defaults to 1h). Use a **long max-age** only when each object path is **immutable**; on content change, **upload to a new key** and update the stored URL (this app uses `workflow-media/{timestamp}-{rand}-{filename}`, `upsert: false`).
- **`immutable`** is not set via the JS client’s numeric `cacheControl` field; unique paths + long max-age achieve the same practical outcome for browsers.

_Date: 2026-04-07 — `uploadStorage.ts` + README._

## Supabase: `VITE_SUPABASE_URL` vs `VITE_SUPABASE_STORAGE_PUBLIC_URL`

- **Public `<img>` / `getPublicUrl` URLs** use the **project API host** `https://<ref>.supabase.co` from **`VITE_SUPABASE_URL`** (via `createClient` + `storage.getPublicUrl`). There is **no** app code that reads `VITE_SUPABASE_STORAGE_PUBLIC_URL`.
- **`*.storage.supabase.co/.../storage/v1/s3`** is the **S3-compatible API** for tools (e.g. `aws s3 sync`), not the browser public object path (`/storage/v1/object/public/...`).
- **Migrated spaces** can still contain **full old-host strings** in JSON; changing `.env` does not rewrite persisted URLs.
- **`storage.objects` row parity ≠ downloadable blobs:** Importing metadata without `aws s3 sync` (or equivalent) leaves **404** on the target for those paths. Verify with **HTTP GET** to `/storage/v1/object/public/{bucket}/{path}` (URL-encoded), not only row counts.
- **After blob migration:** Run **Phase F** SQL (`apply-supabase-host-rewrite.sql`) on the **target** DB so `spaces` / `space_node_versions` JSON no longer embed the old project host — otherwise the browser still requests the old domain. Clear **local drafts** (`vf-space-draft:` / `vision-forge-drafts-v2`) if needed.
- **New Supabase project:** Redeploy Edge Functions (`scout-execute`) and **secrets** (`OPENROUTER_API_KEY`) on that project. **`POST /functions/v1/scout-execute` → 404 / `NOT_FOUND`** surfaces as **CORS preflight failed** in the browser; fix is deploy, not CORS headers.
- **Edge Function CORS preflight:** Responses (including **`OPTIONS`**) must include **`Access-Control-Allow-Methods`** (e.g. **`POST, OPTIONS`**) when the real request is **`POST`** with custom headers; **`Access-Control-Allow-Headers`** alone is not always enough for a successful preflight.
- **Edge Functions vs SQL:** Function code and Edge secrets are **not** applied via `supabase/migrations` SQL — use **`supabase functions deploy`** + **`supabase secrets set`** (or Dashboard). See `scripts/supabase-migrate/sql/edge-functions-not-migrated-via-sql.sql` + `deploy-scout-execute-target.sh`.

_Date: 2026-04-07 — env audit + `client.ts` / `uploadStorage.ts`; storage HEAD/GET verify; Postgres URL rewrite; Scout 404 vs CORS; Edge deploy vs SQL._

## Supabase migrations: idempotent DDL for CI re-runs

- Use **`create table if not exists`** / **`create index if not exists`**. PostgreSQL has no **`create policy if exists`** — use **`drop policy if exists … on …;` then `create policy`** (same for **`drop trigger if exists`** before **`create trigger`**).
- **`if not exists`** skips creation when an object is present; it does **not** fix mismatched columns.

_Date: 2026-04-08 — `supabase/migrations` init + node_comment_versions._

## Supabase Git: migrations ≠ Edge Functions

- The **database migration** pipeline (branching / Git integration) applies **`supabase/migrations/*.sql`** only. **`No functions to deploy`** means that job does not publish **`supabase/functions/**`** — use **`supabase functions deploy`** in CI (e.g. GitHub Actions) or manually.

_Date: 2026-04-08 — SCOUT_LIVE_ROLLOUT + `.github/workflows/deploy-supabase-edge-functions.yml`._

## Supabase image transform: WebP default + `origin` fallback + dimension cap

- **`getPublicUrl()`** returns **`/storage/v1/object/public/{bucket}/{path}`**. **Image transforms** are served from **`/storage/v1/render/image/public/{bucket}/{path}`** with query params — same shape the JS SDK uses when you pass **`transform`** to **`getPublicUrl`**. Appending **`?width=`** only to an **object** URL does **not** run imgproxy; **`imageDelivery`** rewrites **object → render** before adding params.
- **Storage `format` query:** only **`format=origin`** is valid to opt out of auto WebP; **`format=webp`** returns **400** (`querystring/format must be equal to one of the allowed values`). Default transform URLs **omit** `format` (Supabase serves auto WebP). **`CanvasNodeImage`** falls back to **`format=origin`** on first **`error`**.
- Cap requested **`width` / `height`** at **`SUPABASE_TRANSFORM_SAFE_MAX_DIMENSION` (2500)** in `imageDelivery` to reduce failures near ~2560px transform limits.
- Client-side WebP transcoding (canvas/`toBlob`) is usually **worse** here: **CORS/taint**, memory, and CPU vs a single CDN transform; server fallback is the right default.
- **Hosted projects:** Image transformation requires a **Pro** (or higher) plan per [Supabase docs](https://supabase.com/docs/guides/storage/serving/image-transformations). **Self-hosted / local** needs **imgproxy** + **`ENABLE_IMAGE_TRANSFORMATION`** on the storage API.

_Date: 2026-04-07 — `imageDelivery.ts` + `CanvasNodeImage`; 2026-04-08 — object→render rewrite + plan note._

## Canvas dataflow: edges = context link only (no target `data` sync)

- **`applyReactiveDataflow`** / `computeNodeInputPatch` used to **copy** upstream packets into downstream node fields (`prompt`, `mediaUrl`, `wiredTextFromEdges`, list `items`, etc.). That made wired **content** appear on the target node UI.
- **Pattern:** all input `apply` handlers are **no-ops** — **edges remain** for graph structure. **Scout** resolves context by walking **incoming edges** and reading **sources**; **`upstreamTextFromNode(n, nodes, edges)`** must receive **`edges`** so **assistant** / **image generator** nodes include text from **incoming** wires (not stored in `data`) when they sit mid-chain (e.g. Text → Assistant → IG).
- **Verify:** connect Text → Image generator — target **prompt** stays empty; run Stage 2 resolve / Scout — **wired** text still included; Text → Assistant → IG chain still resolves **wiredTextFromEdges**.

_Date: 2026-04-08 — `nodePortDataTypes.ts` `dataflowApplyNoOp`; `nodeDataflow.test.ts`._

## Supabase image transforms: do not key URLs to live CSS box × zoom (canvas)

- Measuring node thumbnails with **ResizeObserver** under a **zoomed** React Flow viewport makes **CSS pixel width change on every zoom** → different `?width=` query params → new transform + egress.
- **Pattern:** one **stable** URL per asset for canvas previews (`fixed` max width transform, or `fixedCssWidth` for tiny grid cells); **CSS `object-fit`** scales the decoded bitmap. Request-time transforms should not track pan/zoom.

_Date: 2026-04-03 — stable `canvasStableImageUrl` + `CanvasNodeImage` refactor._

## Canvas images: avoid `loading="lazy"` inside React Flow’s transformed viewport

- Native **lazy** uses intersection with the viewport; **pan/zoom** via CSS transform can cause **re-load attempts** (DevTools `lazy-img`) even when `src` is stable. Prefer **`loading="eager"`** (or default eager in `CanvasNodeImage`) for in-flow node thumbnails; keep **lazy** only for off-canvas cases (e.g. dialog until opened).

_Date: 2026-04-06 — `canvasImageEagerInFlow` + eager default._

## Low-zoom thumbnails: hysteresis + keep `<img>` mounted (abort / egress)

- A **single** zoom threshold makes **flapping** when wheel-zoom hovers near 50% → repeated unmount/`src` clear → **`NS_BINDING_ABORTED`** and wasted fetches. Use **dual thresholds** around a center (`canvasImageLowZoomMax` ± `canvasImageLowZoomHysteresis`, default **45% / 55%**) with a **latched** boolean in `CanvasViewportImagePolicyBridge`.
- Do **not** remove `<img>` or set `src=""` for low zoom — keep **stable URL** + **`loading="eager"`** in canvas and hide with **`opacity-0` / `invisible`** so loads can finish and **HTTP cache** works. Reserve **retries** for **`onError`** only, capped (e.g. 2), not for user-driven aborts.

_Date: 2026-04-07 — hysteresis + visual hide + `CanvasNodeImage` error retries._

## React Flow: Select tool vs Hand tool — do not disable `selectionOnDrag` to “fix” pan

- **Select** (marquee, node picking) needs **`selectionOnDrag`** when the select tool is active; **`panOnDrag`** must **not** include left button (`0`) in that mode, or left-drag on the pane cannot draw the marquee (RF prioritizes one gesture).
- **Hand** is the dedicated **left-drag pan** mode: set **`panOnDrag`** to **`[0, 1]`** (or `true` for left-only) **only for hand**, and keep **`selectionOnDrag`** off when hand is selected (it already is if `selectionOnDrag` is gated on `selectedTool === 'select'`).
- Never replace that split with global `selectionOnDrag={false}` + `panOnDrag` including `0` for all tools — it removes marquee and blurs product meaning of the toolbar.

_Date: 2026-04-02 — correction after mistaken removal of marquee._

## Canvas wheel vs middle-button drag

- **Mouse wheel** (Zoom vs Pan mode in settings) only changes **scale** (zoom mode) or **translates the viewport** (pan mode) — do not disable these while the middle button is held; that conflates **wheel** with **middle-drag pan** and breaks the mental model.
- **Middle mouse drag** is **`panOnDrag` button `1`** in React Flow: moves the viewing area at the same scale, independent of wheel mode.

_Date: 2026-04-02 — after removing `middleMouseButtonHeld` wheel gating._

## Browser MCP when the user asks for in-app verification

- If the user asks to **test in the browser**, **@Browser**, or to reproduce something at a given zoom (e.g. ~10%), **use the Cursor IDE Browser MCP** (`cursor-ide-browser`): read tool descriptors under the project `mcps` folder, then run a short loop — `browser_tabs` (list) → optional `browser_navigate` → `browser_lock` before interactions → `browser_snapshot` / `browser_click` / `browser_take_screenshot` → `browser_unlock` when finished.
- **Do not** substitute-only code reasoning when they explicitly requested live browser verification; pair explanation with MCP steps and report what the snapshot/screenshot showed (e.g. zoom %, whether controls/edges behaved).
- If interactions fail with **intercepted** or **script** errors after `browser_lock`, try **`browser_unlock`** and retry; lock can block hovers/clicks on the canvas.

_Date: 2026-03-27 — correction after user asked for browser MCP testing and EdgeLabelRenderer/low-zoom edge UI work._

## React Flow handle bounds vs viewport (edge alignment)

- Edge endpoints come from cached **`handleBounds`**; RF recomputes them in `updateNodeDimensions` using the **current viewport zoom**. Pan/zoom does not resize `.react-flow__node`, so **ResizeObserver** often does not run — subscribe to a **primitive derived from `transform`** (e.g. `` `${x},${y},${z}` ``), **not** the `transform` tuple with `shallow`: the store may mutate x/y/z **in place**, so the array reference stays the same and Zustand skips updates. Batch **`updateNodeInternals(all ids)`** (see `useViewportHandleBoundsSync`).
- **Animated** `fitView` / `zoomIn` / `setViewport({ duration })` need the same refresh after the transform settles; transform subscription covers that without relying only on `onMoveEnd`.
- **Group nodes**: prefer **pixel** `top` for handles from the node’s `style.height` when `%` layout can diverge from the measured RF box (floating label + subflows).
- If misalignment remains with v11 + deep groups, evaluate **@xyflow/react** (v12) migration notes for subflow/handle behavior before adding more workarounds.

_Date: 2026-03-27 — plan implementation for persistent handle/edge mismatch._

## Store ↔ React Flow: never substitute raw `storeNodes` if RF has fresher geometry

- **`useNodesState(storeNodes)` + `useEffect` that does `setNodes(storeNodes)`** will revert React Flow’s **measured** `width`/`height` to whatever Zustand last saved whenever **any** node update hits the store. Content-driven growth (ResizeObserver) updates RF locally but often **does not** write back unless you handle **`dimensions`** changes that lack NodeResizer’s `resizing` flag.
- **Fix pattern:** On every store-driven sync, **`mergeStoreNodesWithFlowGeometry(storeNodes, getNodes())`** so live `position`, `width`, `height`, and `style` win. Persist **`dimensions`** to the store for organic resizes (and resize end); optionally **skip** `setNodesSilently` on every `resizing: true` frame to limit churn.

_Date: 2026-03-27 — after persistent handle/edge offset with growing nodes._

## React Flow handles: avoid CSS `transform: scale` on `.react-flow__handle`

- RF caches **handle bounds** from the handle element’s geometry; scaling the **root** handle makes the **painted** port disagree with **math** used for the connection line and edges. Prefer hover feedback via **box-shadow** or scale a **child** (e.g. inner glyph) only.

_Date: 2026-03-27 — edge origin mismatch persisted after store/viewport fixes._

## React Flow edge / connection SVGs: keep `.react-flow__container` positioning

- RF edge and connection-line `<svg>` elements use **`react-flow__container`**, which is **`position: absolute; top: 0; left: 0; width/height: 100%`** under the transformed viewport. Overriding those SVGs to **`position: relative`** (e.g. for z-index) **breaks the full-pane overlay** — paths are still in **flow coordinates**, but the SVG box no longer aligns with the pane, so the preview can look **hundreds of px offset** from handles and the pointer even when debug logs show correct `fromX`/`toX`.
- **Fix:** use **`position: absolute !important; top: 0; left: 0`** (preserve RF sizing) and control stacking with **`z-index`** only.

_Date: 2026-04-07 — after connection preview drift with correct `canvasEdgeDebug` coordinates._

## React Flow marquee: clamp selection; don’t trust `getNodesInside` alone

- During pane marquee, RF’s **`getNodesInside`** marks **`notInitialized`** (no `width`/`height`) and **`dragging`** nodes as selected regardless of overlap with the rectangle.
- **Fix:** use the same hit-test as gesture end in flow space — **`getNodesMarqueeIntersectRect`** (bbox **intersects** marquee, `overlap > 0`; still requires measured `width`/`height` so unmeasured nodes are skipped) — and apply it in **`useLayoutEffect`** when `userSelectionActive` + `userSelectionRect` update, plus **`onSelectionChange`** while marquee is active. **`flowRectFromPaneSelection`** keeps conversion consistent with **`onSelectionEnd`**. (Earlier **`getNodesFullyInsideRect`** required 100% containment and felt glitchy for partial overlaps.)

_Date: 2026-04-07 — marquee selecting out-of-bounds nodes; intersection update 2026-04-13._

## Store → RF merge: do not force `selected` from `live` when Zustand was just synced

- **`mergeStoreNodesWithFlowGeometry`** had `selected: live.selected`, so the `[storeNodes]` effect overwrote multi-select coming from **`onSelectionChange` / `setNodesSilently`** whenever React Flow’s node state was stale. RF’s pane marquee only calls **`onNodesChange` when the number of selected nodes changes**, so expanding a box from 1 → 3 nodes often never emits updates for the extra IDs — **`live` stayed at one `selected: true`** and the merge **wiped** the store-correct set. **Fix:** use **`selected: sn.selected`** when merging store into RF (geometry still from `live`).

_Date: 2026-04-07 — marquee only selected one node._

## Marquee + `storeNodes` merge: skip the effect while `userSelectionActive`

- Even with **`selected: sn.selected`**, the **`[storeNodes]` → `mergeStoreNodesWithFlowGeometry`** effect can run **before** **`onSelectionChange`** updates Zustand (layout clamp vs passive effect order). **`storeNodes` still has the old single selection**, so the merge **overwrites** the multi-select the layout effect just wrote to React. **Fix:** **`if (storeApi.getState().userSelectionActive) return`** before merging during marquee; resume after release so geometry + selection stay in sync from **`onSelectionEnd`**.

_Date: 2026-04-07 — marquee still one node after `sn.selected` fix._

## Never call Zustand `set` inside React `setEdges` / `setNodes` updaters

- **`useEdgesState` + `setEdges((eds) => { connectEdgeWithHistory(...); return next; })`** triggers `set({ edges })` on the store **during** React’s state update → “Cannot update CanvasInner while rendering CanvasInner” / **maximum update depth**. Compute `next` with **`getEdges()`**, **`setEdges(next)`**, then **`queueMicrotask(() => connectEdgeWithHistory(...))`**. Same pattern for **`onEdgesChangeTracked`** vs `applyEdgeRemoval` / `setEdgesSilently`.

_Date: 2026-03-27 — after connect-start debug + infinite loop in console._

## `setNodesSilently` / selection sync must not run full dataflow

- **`setNodesSilently` / `setEdgesSilently`** are used to mirror React Flow into Zustand (selection flags, resize commits). Calling **`applyReactiveDataflow([], true)`** there re-runs propagation for **every node** on **every** selection tick — React Flow can emit many updates while connecting or dragging, which **freezes the UI** and floods devtools if debug logs run before the “no actual change” check.
- Keep full recompute for **hydrate**, **saved row apply**, **edge removal**, **delete node**, etc.; wire incremental sources from **`connectEdgeWithHistory`** / **`updateNodeData`** as before.

_Date: 2026-03-27 — fix after console spam + canvas freeze on connect._

## `onConnectStart`: never `updateNodeInternals` for the whole graph

- **`refreshAllHandleBounds()`** → `updateNodeInternals(allIds)` scales with **node count** and runs in the **handle pointer** critical path → poor INP (multi-second **processing duration** on large canvases).
- Prefer **`updateNodeInternals([sourceId, …parentIds])`** (walk `parentId` chain for nested groups) plus at most one **`requestAnimationFrame`** retry — keep **viewport-wide** refresh for **pan/zoom** (`useViewportHandleBoundsSync`, `onMoveEnd`) only.
- Avoid **`flushSync`** for connection UI flags; **`startTransition`** is enough for `vf-connecting-edge` toggling.

_Date: 2026-03-27 — after Chrome Performance showed ~2s handle pointer processing._

## Viewport handle sync: zoom subscription, not full transform

- Subscribing to **`transform` x/y/z** and calling **`updateNodeInternals(all nodes)`** on every change runs that work **on every pan frame** → poor INP / presentation delay on large graphs.
- Prefer **zoom (`transform[2]`) only** for continuous sync; run a **full refresh on `onMoveEnd`** (and connect / hydrate paths) so pan still ends in a consistent state.

_Date: 2026-03-27 — pan vs hand tool performance._

## React Flow connection preview: do not override `fromX`/`fromY` with a second DOM→flow pipeline

- **`ConnectionLine`** already passes **`fromX`/`fromY`** from **`handleBounds`** + **`positionAbsolute`**; audits showed these match **DOM handle centers** after the viewport transform.
- Re-projecting with a custom **`(client − domRect − transform) / zoom`** and **replacing** the preview source can **diverge** from RF’s pipeline (e.g. wrong relative origin → flow for **viewport (0,0)** instead of the handle → huge `fromRfVsMeasured` and visible drift).
- **Pattern:** use RF’s **`fromX`/`fromY`** for the live **`connectionLineComponent`** path; reserve DOM measurement for **debug-only** comparison, or fix the projection to match **`screenToFlowPosition`** exactly before trusting it for paint.

_Date: 2026-04-07 — after `connection+audit` showed `fromMeasured` at viewport origin while `fromRf` matched DOM._
