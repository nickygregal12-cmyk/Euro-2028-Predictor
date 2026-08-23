import { describe, expect, it } from 'vitest'
import {
  buildServiceWorker,
  serviceWorkerVersion,
} from '../../src/app/pwa/buildServiceWorker'

/**
 * The service worker, executed — not read.
 *
 * WHY THE REAL ARTEFACT AND NOT A PARAPHRASE. The claims this file makes are
 * about what a deployed worker does to a player's prediction on a train with no
 * signal, and a test that re-implemented the routing rules in its own words
 * would prove only that two files agree. So it runs the exact transform
 * `vite.config.ts` runs, evaluates the JavaScript that comes out inside a fake
 * service worker scope, and dispatches real events at it.
 *
 * The three refusals in `src/app/pwa/serviceWorker.ts` are the ones worth a
 * gate: no write is ever answered, no other origin is ever touched, and nothing
 * is ever queued for later. The first two are driven through `fetch` events;
 * the third is structural, because "there is no code that does this" is the
 * only honest way to assert an absence.
 */

const ORIGIN = 'https://predictorhub.example'

const PRECACHE = [
  '/assets/index-abc123.js',
  '/assets/style-def456.css',
  '/favicon.svg',
  '/index.html',
  '/manifest.webmanifest',
]

const VERSION = serviceWorkerVersion('testcommit', PRECACHE)

type Listener = (event: unknown) => void

function pathOf(request: Request | string): string {
  return new URL(typeof request === 'string' ? request : request.url, ORIGIN)
    .pathname
}

/**
 * A cache that honours `Vary`, because the real one does and it mattered.
 *
 * Netlify and Vite's preview server both answer static assets with
 * `Vary: Origin`. The worker fills its precache with its own `fetch`, which
 * sends no `Origin`; the page then asks for the same files through
 * `<script type="module" crossorigin>`, which sends one. A `Cache.match` that
 * honours `Vary` misses every time — the application would not start offline —
 * and a harness with a plain `Map` would report all of it green.
 *
 * So each entry remembers the `Origin` it was stored under, and a lookup
 * matches only when the origins agree OR the caller passed `ignoreVary`.
 */
class FakeCache {
  readonly entries = new Map<
    string,
    { readonly response: Response; readonly origin: string | null }
  >()

  async match(request: Request | string, options?: { ignoreVary?: boolean }) {
    const entry = this.entries.get(pathOf(request))
    if (!entry) return undefined
    if (options?.ignoreVary) return entry.response
    const asked = typeof request === 'string' ? null : request.headers.get('origin')
    return asked === entry.origin ? entry.response : undefined
  }

  async put(request: Request | string, response: Response) {
    this.entries.set(pathOf(request), {
      response,
      origin: typeof request === 'string' ? null : request.headers.get('origin'),
    })
  }

  async addAll(requests: (Request | string)[]) {
    for (const request of requests) {
      await this.put(request, new Response('precached'))
    }
  }
}

class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>()

  async open(name: string) {
    const existing = this.caches.get(name)
    if (existing) return existing
    const created = new FakeCache()
    this.caches.set(name, created)
    return created
  }

  async keys() {
    return [...this.caches.keys()]
  }

  async delete(name: string) {
    return this.caches.delete(name)
  }

  async match(request: Request | string, options?: { ignoreVary?: boolean }) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request, options)
      if (hit) return hit
    }
    return undefined
  }
}

type Network = (request: Request) => Promise<Response>

/**
 * The network a normal harness presents.
 *
 * `Response.type` is read-only and 'default' on a hand-built response, while
 * the worker stores only a 'basic' one — so a plain `new Response()` here would
 * silently exercise the "do not cache this" branch and prove nothing. The
 * property is defined explicitly instead.
 */
function sameOriginResponse(body: string): Response {
  const response = new Response(body, { status: 200 })
  Object.defineProperty(response, 'type', { value: 'basic' })
  return response
}

/**
 * A navigation request, which cannot be constructed directly.
 *
 * The Fetch specification forbids `new Request(url, { mode: 'navigate' })`, and
 * the runner enforces it — but a navigation is exactly the case the offline
 * shell exists for, so the mode is set on a real request afterwards. Everything
 * the worker reads (`method`, `url`, `mode`) is then what a browser would hand
 * it.
 */
function navigationRequest(url: string): Request {
  const request = new Request(url)
  Object.defineProperty(request, 'mode', { value: 'navigate' })
  return request
}

const OFFLINE: Network = async (request) => {
  // The install-time precache uses `cache: 'reload'`; only page fetches fail,
  // so a worker can be installed and then taken offline.
  if (request.cache === 'reload') return sameOriginResponse('precached')
  throw new TypeError('Failed to fetch')
}

async function harness(
  options: { precache?: readonly string[]; network?: Network } = {},
) {
  const precache = options.precache ?? PRECACHE
  const code = await buildServiceWorker({
    precache,
    version: serviceWorkerVersion('testcommit', precache),
  })

  const listeners = new Map<string, Listener[]>()
  const caches = new FakeCacheStorage()
  const fetched: Request[] = []
  let claimed = false
  let skipped = false
  // Contract 217. What the worker showed and what it opened, recorded rather
  // than stubbed away: both are the whole observable behaviour of a push.
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const opened: string[] = []
  const focused: string[] = []
  let windows: readonly string[] = []

  const network: Network =
    options.network ?? (async () => sameOriginResponse('from the network'))

  const scope = {
    location: new URL(`${ORIGIN}/`),
    caches,
    clients: {
      claim: async () => {
        claimed = true
      },
      matchAll: async () =>
        windows.map((url) => ({
          url,
          focus: async () => {
            focused.push(url)
          },
        })),
      openWindow: async (url: string) => {
        opened.push(url)
      },
    },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options })
      },
    },
    skipWaiting: async () => {
      skipped = true
    },
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    },
  }

  const fetchImpl = (input: Request | string) => {
    const request = input instanceof Request ? input : new Request(input)
    fetched.push(request)
    return network(request)
  }

  // A real worker resolves a relative request against its own location; the
  // runner's `Request` refuses one outright, so the harness supplies the base
  // the browser would. Without this the precache — which is a list of
  // root-relative paths — cannot be constructed at all.
  class ScopedRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(
        typeof input === 'string' ? new URL(input, ORIGIN).toString() : input,
        init,
      )
    }
  }

  // Executing the shipped artefact IS the test; see the header.
  const run = new Function('self', 'fetch', 'Response', 'Request', 'URL', code)
  run(scope, fetchImpl, Response, ScopedRequest, URL)

  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = []
    for (const handler of listeners.get(type) ?? []) {
      handler({
        ...event,
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      })
    }
    await Promise.all(pending)
  }

  /** The worker's answer, or null when it declined to answer at all. */
  const answer = async (request: Request): Promise<Response | null> => {
    let given: Response | Promise<Response> | null = null
    for (const handler of listeners.get('fetch') ?? []) {
      handler({
        request,
        waitUntil: () => {},
        respondWith: (response: Response | Promise<Response>) => {
          given = response
        },
      })
    }
    return given === null ? null : await given
  }

  return {
    caches,
    fetched,
    dispatch,
    answer,
    install: () => dispatch('install'),
    claimed: () => claimed,
    skipped: () => skipped,
    shown,
    opened,
    focused,
    /** Which windows this origin already has open when a notification is tapped. */
    setWindows: (urls: readonly string[]) => {
      windows = urls
    },
    /** A push carrying `payload`, or an unreadable one when it is not an object. */
    push: (payload: unknown) =>
      dispatch('push', {
        data:
          payload === undefined
            ? null
            : {
                json: () => {
                  if (typeof payload === 'string') return JSON.parse(payload)
                  return payload
                },
              },
      }),
    tap: (data: unknown) =>
      dispatch('notificationclick', {
        notification: { data, close: () => {} },
      }),
  }
}

describe('the worker never answers a competitive write', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    'leaves a %s to the network, so an offline save fails as a failed save',
    async (method) => {
      const sw = await harness({ network: OFFLINE })
      await sw.install()
      const request = new Request(`${ORIGIN}/rest/v1/rpc/save_season_prediction`, {
        method,
      })
      expect(await sw.answer(request)).toBeNull()
    },
  )

  it('leaves every other origin alone, reads and writes alike', async () => {
    const sw = await harness()
    await sw.install()
    expect(
      await sw.answer(
        new Request('https://project.supabase.co/rest/v1/rpc/get_season_card'),
      ),
    ).toBeNull()
    expect(
      await sw.answer(new Request('https://o1.ingest.sentry.io/api/1/envelope/')),
    ).toBeNull()
    expect(
      await sw.answer(new Request('https://api.pwnedpasswords.com/range/ABCDE')),
    ).toBeNull()
  })

  it('registers no sync, periodic sync or background replay of any kind', async () => {
    const code = await buildServiceWorker({ precache: PRECACHE, version: 'v1' })
    // `async` contains the substring, so the event NAMES are what is checked.
    expect(code).not.toMatch(/addEventListener\(\s*["']sync["']/)
    expect(code).not.toMatch(/addEventListener\(\s*["']periodicsync["']/)
    expect(code).not.toMatch(/indexedDB/i)
    expect(code).not.toMatch(/SyncManager/)
  })
})

describe('the shell it does cache', () => {
  it('precaches exactly the list the build gave it, under this build’s name', async () => {
    const sw = await harness()
    await sw.install()

    expect(await sw.caches.keys()).toEqual([`predictor-shell-${VERSION}`])
    const cache = await sw.caches.open(`predictor-shell-${VERSION}`)
    expect([...cache.entries.keys()].sort()).toEqual([...PRECACHE].sort())
  })

  it('serves a precached asset without touching the network', async () => {
    const sw = await harness()
    await sw.install()
    sw.fetched.length = 0

    const response = await sw.answer(new Request(`${ORIGIN}/assets/style-def456.css`))
    expect(await response?.text()).toBe('precached')
    expect(sw.fetched).toHaveLength(0)
  })

  it('hits the cache even though the host answers with Vary: Origin', async () => {
    // A page requests its entry chunk through `<script type="module"
    // crossorigin>`, which sends an `Origin` header the worker's own precache
    // fetch never sent. Honouring `Vary` there means a permanent miss and an
    // application that will not start offline; this is the regression that
    // found it.
    const sw = await harness()
    await sw.install()
    sw.fetched.length = 0

    const crossOriginStyle = new Request(`${ORIGIN}/assets/index-abc123.js`, {
      headers: { origin: ORIGIN },
    })
    expect(await (await sw.answer(crossOriginStyle))?.text()).toBe('precached')
    expect(sw.fetched).toHaveLength(0)
  })

  it('caches a lazily-loaded hashed chunk on first use, and serves it after', async () => {
    const sw = await harness()
    await sw.install()

    const request = new Request(`${ORIGIN}/assets/LeagueDetail-xyz789.js`)
    expect(await (await sw.answer(request))?.text()).toBe('from the network')
    expect(sw.fetched.map((call) => call.url)).toContain(request.url)

    sw.fetched.length = 0
    expect(await (await sw.answer(request))?.text()).toBe('from the network')
    expect(sw.fetched).toHaveLength(0)
  })

  it('never caches release.json, because a stale one misidentifies the deployment', async () => {
    const sw = await harness()
    await sw.install()
    expect(await sw.answer(new Request(`${ORIGIN}/release.json`))).toBeNull()
  })
})

describe('a navigation with no connection', () => {
  it('falls back to the precached document rather than a browser error page', async () => {
    const sw = await harness({ network: OFFLINE })
    await sw.install()

    const response = await sw.answer(
      navigationRequest(`${ORIGIN}/competitions/premier-league/2026-27`),
    )
    expect(await response?.text()).toBe('precached')
  })

  it('goes to the network first when there is one, so the document is never stale', async () => {
    const sw = await harness()
    await sw.install()
    sw.fetched.length = 0

    const request = navigationRequest(`${ORIGIN}/matches`)
    expect(await (await sw.answer(request))?.text()).toBe('from the network')
    expect(sw.fetched.map((call) => call.url)).toContain(request.url)
  })
})

describe('activation and update', () => {
  it('deletes the previous build’s cache and leaves anything else alone', async () => {
    const sw = await harness()
    await sw.caches.open('predictor-shell-an-older-build')
    await sw.caches.open('something-else-entirely')
    await sw.install()
    await sw.dispatch('activate')

    const remaining = await sw.caches.keys()
    expect(remaining).not.toContain('predictor-shell-an-older-build')
    expect(remaining).toContain('something-else-entirely')
    expect(remaining).toContain(`predictor-shell-${VERSION}`)
    expect(sw.claimed()).toBe(true)
  })

  it('takes control only when the application asks it to', async () => {
    const sw = await harness()
    await sw.dispatch('message', { data: { type: 'ANYTHING_ELSE' } })
    expect(sw.skipped()).toBe(false)

    await sw.dispatch('message', { data: { type: 'SKIP_WAITING' } })
    expect(sw.skipped()).toBe(true)
  })
})

describe('the cache version', () => {
  it('changes when anything precached changes, and when the release does', () => {
    const base = serviceWorkerVersion('abc', ['/index.html', '/assets/one.js'])
    expect(serviceWorkerVersion('abc', ['/assets/one.js', '/index.html'])).toBe(base)
    expect(serviceWorkerVersion('abc', ['/index.html', '/assets/two.js'])).not.toBe(base)
    expect(serviceWorkerVersion('def', ['/index.html', '/assets/one.js'])).not.toBe(base)
  })
})

describe('the fourth refusal: a push payload is data, never instructions', () => {
  const REMINDER = {
    title: 'Matchweek 4 closes soon',
    body: '3 predictions still to make before it locks.',
    tag: 'matchweek-4',
    url: '/',
  }

  it('shows exactly what the Edge Function sent', async () => {
    const sw = await harness()
    await sw.install()
    await sw.push(REMINDER)

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0]?.title).toBe('Matchweek 4 closes soon')
    expect(sw.shown[0]?.options.body).toBe('3 predictions still to make before it locks.')
    expect(sw.shown[0]?.options.tag).toBe('matchweek-4')
  })

  it('does not touch the network to render one', async () => {
    // The refusal in one assertion. A worker that fetched to decorate a
    // notification would be running a network request nobody asked for, on a
    // device nobody is looking at, with this origin's full authority.
    const sw = await harness()
    await sw.install()
    sw.fetched.length = 0
    await sw.push(REMINDER)
    expect(sw.fetched).toEqual([])
  })

  it('does not cache anything a push carried', async () => {
    const sw = await harness()
    await sw.install()
    const before = [...(await sw.caches.open(`predictor-shell-${VERSION}`)).entries.keys()]
    await sw.push(REMINDER)
    const after = [...(await sw.caches.open(`predictor-shell-${VERSION}`)).entries.keys()]
    expect(after).toEqual(before)
  })

  it.each([
    ['https://elsewhere.example/steal', 'an absolute URL to another origin'],
    ['//elsewhere.example/steal', 'the protocol-relative form'],
    ['javascript:alert(1)', 'a javascript: scheme'],
    ['https://predictor.example/still-absolute', 'an absolute URL to this origin'],
    [42, 'a value that is not a string at all'],
  ])('refuses %s as a tap target — %s', async (url, _why) => {
    // A payload that has been tampered with can make a notification SAY
    // something wrong, which the server could do anyway. It must not be able to
    // make a tap leave this site.
    const sw = await harness()
    await sw.install()
    await sw.push({ ...REMINDER, url })
    expect(sw.shown[0]?.options.data).toEqual({ url: '/' })
  })

  it('keeps a root-relative path of this application', async () => {
    const sw = await harness()
    await sw.install()
    await sw.push({ ...REMINDER, url: '/competitions/premier-league/2026/play' })
    expect(sw.shown[0]?.options.data).toEqual({
      url: '/competitions/premier-league/2026/play',
    })
  })

  it('replaces an earlier notice about the same matchweek without buzzing again', async () => {
    // Two live notices about one deadline read as two deadlines, and a second
    // vibration for the same fact is the thing that gets notifications turned
    // off for good.
    const sw = await harness()
    await sw.install()
    await sw.push(REMINDER)
    expect(sw.shown[0]?.options.renotify).toBe(false)
  })
})

describe('a push it cannot read still shows something, and says nothing specific', () => {
  it.each([
    ['no payload at all', undefined],
    ['a payload that is not JSON', 'not json{'],
    ['a payload that is not an object', 42],
    ['a payload with no title', { body: 'something', tag: 't', url: '/' }],
    ['a payload with a blank body', { title: 'Predictor', body: '   ', tag: 't', url: '/' }],
  ])('%s falls back whole rather than half', async (_case, payload) => {
    // A browser handed a push and shown NO notification substitutes its own —
    // "This site has been updated in the background" — and counts it against
    // the permission. Showing nothing is not an option.
    const sw = await harness()
    await sw.install()
    await sw.push(payload)

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0]?.title).toBe('Predictor')
    expect(String(sw.shown[0]?.options.body)).not.toContain('undefined')
  })

  it('invents no deadline it has no way of knowing', async () => {
    // The specific temptation: "your predictions lock soon" reads plausibly and
    // would be the worker making up a deadline from a push it could not parse.
    const sw = await harness()
    await sw.install()
    await sw.push('not json{')
    const rendered = `${sw.shown[0]?.title} ${sw.shown[0]?.options.body}`.toLowerCase()
    expect(rendered).not.toMatch(/lock|deadline|matchweek|\d/)
  })
})

describe('tapping a notification finds the tab the player was already using', () => {
  it('focuses an open window rather than opening a second one', async () => {
    // Opening a second copy loses whatever was half-typed into the first, which
    // on this product is a partly-filled prediction card.
    const sw = await harness()
    await sw.install()
    sw.setWindows([`${ORIGIN}/competitions/premier-league/2026/play`])
    await sw.tap({ url: '/' })

    expect(sw.focused).toEqual([`${ORIGIN}/competitions/premier-league/2026/play`])
    expect(sw.opened).toEqual([])
  })

  it('opens the path the notification was shown with, not just the hub', async () => {
    // THE CASE THAT WAS MISSING, and its absence hid a real defect: every other
    // click case here happened to expect `/`, so passing the whole `data` OBJECT
    // to a validator that only accepts a string looked correct. Every non-root
    // target was being discarded.
    const sw = await harness()
    await sw.install()
    sw.setWindows([])
    await sw.tap({ url: '/competitions/premier-league/2026/play' })

    expect(sw.opened).toEqual([`${ORIGIN}/competitions/premier-league/2026/play`])
  })

  it('still refuses a target that is not a path of this application', async () => {
    // Validated a SECOND time on the way out. A notification can sit in a tray
    // for hours, and what it stored is all that stands between a tampered
    // payload and a navigation.
    const sw = await harness()
    await sw.install()
    sw.setWindows([])
    await sw.tap({ url: '//elsewhere.example/steal' })

    expect(sw.opened).toEqual([`${ORIGIN}/`])
  })

  it('opens the hub when a notification carries no data at all', async () => {
    const sw = await harness()
    await sw.install()
    sw.setWindows([])
    await sw.tap(undefined)

    expect(sw.opened).toEqual([`${ORIGIN}/`])
  })

  it('opens one when the application is not running', async () => {
    const sw = await harness()
    await sw.install()
    sw.setWindows([])
    await sw.tap({ url: '/' })

    expect(sw.opened).toEqual([`${ORIGIN}/`])
  })

  it('ignores a window on another origin', async () => {
    const sw = await harness()
    await sw.install()
    sw.setWindows(['https://elsewhere.example/'])
    await sw.tap({ url: '/' })

    expect(sw.focused).toEqual([])
    expect(sw.opened).toEqual([`${ORIGIN}/`])
  })

  it('refuses to open another origin even when the notification names one', async () => {
    const sw = await harness()
    await sw.install()
    sw.setWindows([])
    await sw.tap({ url: 'https://elsewhere.example/steal' })

    expect(sw.opened).toEqual([`${ORIGIN}/`])
  })
})
