/**
 * The service worker, and the deliberate limits of what it will do.
 *
 * ADR 0016 Phase 1 names a service worker and an offline shell. This is that,
 * and it is written to be boring: it makes the application start without a
 * connection and it makes a returning visit cheap, and it does NOTHING that
 * could make a competitive action look like it succeeded when it did not.
 *
 * ── FOUR REFUSALS, AND THEY ARE THE DESIGN ──────────────────────────────────
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
 * 4. IT NEVER TREATS A PUSH PAYLOAD AS INSTRUCTIONS (contract 217). A push
 *    arrives from the network into code that runs with this origin's full
 *    authority, on a device nobody is looking at. So the payload is read as
 *    three strings and one path and NOTHING else: no fetch, no cache write, no
 *    message to a page, no `importScripts`, and no navigation anywhere but a
 *    same-origin path of this application. `notificationTarget` refuses an
 *    absolute URL, another origin and a protocol-relative address, so a
 *    payload that has been tampered with can make a notification say something
 *    wrong — which the server could do anyway — but cannot make a tap leave
 *    this site.
 *
 * ── WHAT PUSH ADDS, AND WHAT IT DOES NOT ────────────────────────────────────
 *
 * `public.reminder_deliveries` decides WHETHER a player is reminded and the
 * Edge Function decides WHAT it says. This worker renders what arrived and
 * opens the application when it is tapped. It does not decide, schedule,
 * suppress or count anything, and it never shows a notification that no push
 * delivered — including, and especially, the "you have unsaved predictions"
 * kind a client-side timer could so easily invent.
 *
 * A push with no readable payload STILL SHOWS SOMETHING, because a browser that
 * is handed a push and shown no notification substitutes its own — "This site
 * has been updated in the background" on Chrome — and may revoke the
 * permission for repeat offences. The stand-in says only that there is
 * something to look at, because at that point that is all this code knows.
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
/** The two events push adds, in the same minimum-surface style as the rest. */
type PushEventLike = ExtendableEventLike & {
  readonly data: { json: () => unknown } | null
}
type NotificationLike = {
  readonly data: unknown
  close: () => void
}
type NotificationEventLike = ExtendableEventLike & {
  readonly notification: NotificationLike
}
type WindowClientLike = {
  readonly url: string
  focus: () => Promise<unknown>
}
type ServiceWorkerScope = {
  readonly location: Location
  readonly caches: CacheStorage
  readonly clients: {
    claim: () => Promise<void>
    matchAll: (options: { type: 'window'; includeUncontrolled: boolean }) => Promise<
      readonly WindowClientLike[]
    >
    openWindow: (url: string) => Promise<unknown>
  }
  readonly registration: {
    showNotification: (title: string, options: Record<string, unknown>) => Promise<void>
  }
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

scope.addEventListener('push', (event: PushEventLike) => {
  // `waitUntil` is not optional here. Without it the worker may be terminated
  // before `showNotification` resolves, and the browser then substitutes its
  // own "site updated in the background" notice.
  event.waitUntil(showPushNotification(readPushPayload(event)))
})

scope.addEventListener('notificationclick', (event: NotificationEventLike) => {
  // Closed first and unconditionally. A notification left open after a tap sits
  // in the tray looking like a reminder that is still outstanding.
  event.notification.close()
  event.waitUntil(openApplication(targetOf(event.notification.data)))
})

/** What the Edge Function sends, and the only fields this worker reads. */
type PushMessage = {
  readonly title: string
  readonly body: string
  readonly tag: string
  readonly url: string
}

/**
 * The stand-in for a push this worker cannot read.
 *
 * Deliberately vague, because at this point nothing here knows what the push
 * was about, and a specific guess ("your predictions lock soon") would be the
 * worker inventing a deadline. Showing nothing is not an option: the browser
 * substitutes its own notice and counts it against the permission.
 */
const UNREADABLE_PUSH: PushMessage = {
  title: 'Predictor',
  body: 'Open Predictor to see what needs your attention.',
  tag: 'predictor',
  url: '/',
}

/**
 * Read the payload as data, never as instructions.
 *
 * Every field is checked for being a non-empty string of its own, so a payload
 * missing one is not rendered with `undefined` in it. Anything unreadable falls
 * back whole rather than half.
 */
function readPushPayload(event: PushEventLike): PushMessage {
  let parsed: unknown
  try {
    parsed = event.data ? event.data.json() : null
  } catch {
    return UNREADABLE_PUSH
  }
  if (!parsed || typeof parsed !== 'object') return UNREADABLE_PUSH

  const message = parsed as Partial<Record<keyof PushMessage, unknown>>
  const title = typeof message.title === 'string' ? message.title.trim() : ''
  const body = typeof message.body === 'string' ? message.body.trim() : ''
  if (!title || !body) return UNREADABLE_PUSH

  return {
    title,
    body,
    tag: typeof message.tag === 'string' && message.tag ? message.tag : UNREADABLE_PUSH.tag,
    url: notificationTarget(message.url),
  }
}

function showPushNotification(message: PushMessage): Promise<void> {
  return scope.registration.showNotification(message.title, {
    body: message.body,
    // A second reminder about the same matchweek REPLACES the first rather
    // than stacking beside it. Two live notices read as two deadlines.
    tag: message.tag,
    // ...and replacing does not re-buzz the phone. The player already knows.
    renotify: false,
    icon: '/icon-192.png',
    // The path travels on the notification rather than being re-derived at
    // click time, so what a tap opens is fixed when it is shown.
    data: { url: message.url },
  })
}

/**
 * The path a notification was shown with, read back off its `data`.
 *
 * SEPARATE FROM `notificationTarget` BECAUSE THE SHAPES DIFFER, and conflating
 * them was a real defect: `showNotification` stores `{ url }`, and passing that
 * OBJECT to a function that only accepts a string returned the hub for every
 * tap. It was invisible in tests because every case happened to expect the hub.
 *
 * The path is validated AGAIN here rather than trusted because it was validated
 * once already. A notification can sit in a tray for hours, and what it stored
 * is the only thing standing between a tampered payload and a navigation.
 */
function targetOf(data: unknown): string {
  if (!data || typeof data !== 'object') return '/'
  return notificationTarget((data as { url?: unknown }).url)
}

/**
 * The only kind of address a notification may open.
 *
 * REFUSES ANYTHING THAT IS NOT A ROOT-RELATIVE PATH OF THIS APPLICATION. An
 * absolute URL, another origin, a `javascript:` scheme and the protocol-
 * relative `//elsewhere.example` form are all rejected in favour of the hub.
 * The check is a whitelist on the first two characters rather than a blacklist
 * of schemes, because a blacklist is the thing that eventually misses one.
 */
function notificationTarget(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

/**
 * Focus the application if it is already open, and open it if it is not.
 *
 * FOCUSING RATHER THAN OPENING is the difference between a player finding the
 * tab they were already using and finding a second copy of it beside the first,
 * having lost whatever they had half-typed into the first.
 */
async function openApplication(path: string): Promise<void> {
  const target = new URL(path, scope.location.origin)
  const clients = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true })

  for (const client of clients) {
    if (new URL(client.url).origin === scope.location.origin) {
      await client.focus()
      return
    }
  }
  await scope.clients.openWindow(target.href)
}

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
