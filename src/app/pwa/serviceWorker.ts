/**
 * The service worker, and the deliberate limits of what it will do.
 *
 * ADR 0016 Phase 1 names a service worker and an offline shell. This is that,
 * and it is written to be boring: it makes the application start without a
 * connection and it makes a returning visit cheap, and it does NOTHING that
 * could make a competitive action look like it succeeded when it did not.
 *
 * ── THREE REFUSALS, AND THEY ARE THE DESIGN ─────────────────────────────────
 *
 * 1. IT NEVER ANSWERS A NON-`GET` REQUEST. Every prediction, Joker, Last Man
 *    Standing pick, join, league creation, Championship action and account
 *    change is a `POST` to Supabase. `handleFetch` returns undefined for them,
 *    the browser performs its ordinary network attempt, and offline it fails —
 *    which is what the player is then told. There is no branch here that could
 *    ever synthesise a response to a write, so no future edit can accidentally
 *    turn "the request never left the device" into "Saved".
 *
 * 2. IT NEVER TOUCHES A CROSS-ORIGIN REQUEST. Supabase reads and writes, the
 *    Sentry ingest endpoint and the breach-corpus check are all cross-origin,
 *    and all of them are left alone. That is the whole of the "do not cache
 *    private API responses" rule: there is no allow-list to get wrong, because
 *    another origin is never considered.
 *
 * 3. IT QUEUES NOTHING. No background sync, no replay, no outbox. The one
 *    offline write path this product has is `INNOV-020`'s local draft store,
 *    which is explicitly not a queue — it holds work on the device, never says
 *    it was submitted, and reconciles through `save_season_predictions_batch`
 *    with the server deciding every item. A second mechanism here would be a
 *    competing authority for the same problem.
 *
 * ── WHAT IT DOES CACHE ──────────────────────────────────────────────────────
 *
 * The shell: the document, the entry JavaScript and its static imports, the
 * stylesheet, the self-hosted fonts, this site's icons and its manifest. Those
 * are precached at install. Lazily-imported route chunks are cached on first
 * use rather than up front, because precaching forty chunks would make
 * installation a several-hundred-kilobyte download for surfaces most players
 * never open in a given week.
 *
 * Everything under `/assets/` carries a content hash in its name, so it is
 * immutable and cache-first is safe. Nothing else same-origin is cached at all
 * — `release.json` in particular, because it is how a deployment is identified
 * and a stale copy would be actively misleading.
 *
 * ── VERSIONING ──────────────────────────────────────────────────────────────
 *
 * One cache per build, named with the release. Activation deletes every other
 * cache this application owns, so a new version cannot serve a mixture of two
 * builds' assets. The worker does NOT call `skipWaiting` on its own: a swap
 * under a player mid-edit is exactly the failure the update flow avoids, so the
 * new worker waits until the application asks, which it does only when the
 * player presses Refresh.
 *
 * Self-contained by construction: `buildServiceWorker.ts` transforms this file
 * alone, so an import added here would be emitted as a broken reference.
 */

/** Replaced at build time. The shell this build precaches. */
declare const __SW_PRECACHE__: readonly string[]
/** Replaced at build time. Identifies this build's cache. */
declare const __SW_VERSION__: string

// `self` is typed as a Window by the DOM library, and `lib.webworker` cannot be
// added to a project that also needs `lib.dom` without the two conflicting. The
// minimum surface this file uses is declared instead.
type ExtendableEventLike = Event & {
  waitUntil: (promise: Promise<unknown>) => void
}
type FetchEventLike = ExtendableEventLike & {
  readonly request: Request
  respondWith: (response: Response | Promise<Response>) => void
}
type ServiceWorkerScope = {
  readonly location: Location
  readonly caches: CacheStorage
  readonly clients: { claim: () => Promise<void> }
  skipWaiting: () => Promise<void>
  addEventListener: (type: string, listener: (event: never) => void) => void
}

const scope = self as unknown as ServiceWorkerScope

const CACHE_PREFIX = 'predictor-shell-'
const CACHE_NAME = `${CACHE_PREFIX}${__SW_VERSION__}`
const PRECACHE: readonly string[] = __SW_PRECACHE__

/** Hashed build output, and the only same-origin family cached on demand. */
const IMMUTABLE_PREFIX = '/assets/'

/**
 * READ THIS BEFORE REMOVING IT: without it the cache silently never hits.
 *
 * Netlify — and Vite's own preview server — answer static assets with
 * `Vary: Origin`. The Cache API honours `Vary` by default, so a stored response
 * only matches a request whose `Origin` header equals the one that fetched it.
 * The precache is filled by the worker's own `fetch`, which sends no `Origin`;
 * the page then asks for the same files through `<script type="module"
 * crossorigin>`, which sends one. Every lookup missed, every asset went to the
 * network, and offline the application would not start — which is exactly what
 * a browser check found before this line existed.
 *
 * Ignoring `Vary` is correct here rather than merely convenient: this cache
 * holds one build's own same-origin static assets, keyed by a URL that already
 * carries a content hash. There is no second representation of any of them for
 * a `Vary` header to be choosing between.
 */
const IGNORE_VARY = { ignoreVary: true }

scope.addEventListener('install', (event: ExtendableEventLike) => {
  event.waitUntil(
    scope.caches.open(CACHE_NAME).then((cache) =>
      // `reload` so an install never adopts a stale HTTP-cached copy of the
      // shell it is about to serve for the life of this version.
      cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' }))),
    ),
  )
})

scope.addEventListener('activate', (event: ExtendableEventLike) => {
  event.waitUntil(
    scope.caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => scope.caches.delete(key)),
        ),
      )
      .then(() => scope.clients.claim()),
  )
})

scope.addEventListener('message', (event: MessageEvent) => {
  // The only instruction this worker accepts, and it comes from the update
  // notice the player pressed. Nothing else is actionable from a page.
  if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
    void scope.skipWaiting()
  }
})

scope.addEventListener('fetch', (event: FetchEventLike) => {
  const handled = handleFetch(event.request)
  if (handled) event.respondWith(handled)
})

/**
 * The whole routing decision, and what it refuses.
 *
 * Returning undefined means "this worker has no opinion": the browser performs
 * the request itself exactly as though no worker were installed. That is the
 * answer for every write, every other origin and everything not named below.
 */
function handleFetch(request: Request): Promise<Response> | undefined {
  if (request.method !== 'GET') return undefined

  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return undefined
  }
  if (url.origin !== scope.location.origin) return undefined

  // A navigation goes to the network first, because the document is how a
  // player learns anything new. Only when the network cannot answer at all does
  // the precached shell stand in — and the shell then renders the application's
  // own offline states rather than a browser error page.
  if (request.mode === 'navigate') {
    return fetch(request).catch(async () => {
      const shell = await scope.caches.match('/index.html', IGNORE_VARY)
      if (shell) return shell
      return new Response('', { status: 503, statusText: 'Offline' })
    })
  }

  if (PRECACHE.includes(url.pathname)) {
    return cacheFirst(request)
  }

  if (url.pathname.startsWith(IMMUTABLE_PREFIX)) {
    return cacheFirst(request)
  }

  return undefined
}

/**
 * Serve from this build's cache, falling back to the network and storing what
 * comes back.
 *
 * Only a complete, same-origin 200 is stored. A partial response, a redirect or
 * an error would otherwise be cached for the life of the version, which is a
 * long time to serve something that failed once.
 */
async function cacheFirst(request: Request): Promise<Response> {
  const cache = await scope.caches.open(CACHE_NAME)
  const cached = await cache.match(request, IGNORE_VARY)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok && response.status === 200 && response.type === 'basic') {
    await cache.put(request, response.clone())
  }
  return response
}
