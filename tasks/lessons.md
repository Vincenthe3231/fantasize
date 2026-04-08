# Lessons (session corrections)

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
- **Fix:** use the same strict test as gesture end — **`getNodesFullyInsideRect`** in flow space — and apply it in **`useLayoutEffect`** when `userSelectionActive` + `userSelectionRect` update (after the store commits the new rect), plus **`onSelectionChange`** while marquee is active so Zustand stays aligned. **`flowRectFromPaneSelection`** keeps conversion consistent with **`onSelectionEnd`**.

_Date: 2026-04-07 — marquee selecting out-of-bounds nodes._

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
