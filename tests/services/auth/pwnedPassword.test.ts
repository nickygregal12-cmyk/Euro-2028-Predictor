import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PWNED_PASSWORDS_ORIGIN,
  countInRangeResponse,
  pwnedCount,
} from '../../../src/services/auth/pwnedPassword'

/**
 * The AUTH-002 breach-corpus check.
 *
 * The network tests use MSW rather than replacing `fetch`, so the production
 * request construction, headers and Fetch API failure behaviour all cross the
 * same HTTP boundary they use in the browser.
 */

const PASSWORD_SHA1 = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8' // betterleaks:allow -- public SHA-1 test vector for the literal "password"
const PASSWORD_PREFIX = PASSWORD_SHA1.slice(0, 5)
const PASSWORD_SUFFIX = PASSWORD_SHA1.slice(5)
const RANGE_URL = `${PWNED_PASSWORDS_ORIGIN}/range/:prefix`

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterAll(() => {
  server.close()
})

describe('countInRangeResponse', () => {
  it('finds a suffix and returns its count', () => {
    const body = `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${PASSWORD_SUFFIX}:10382543\r\n`
    expect(countInRangeResponse(body, PASSWORD_SUFFIX)).toBe(10382543)
  })

  it('returns zero when the suffix is absent from the bucket', () => {
    expect(countInRangeResponse('0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n', PASSWORD_SUFFIX)).toBe(0)
  })

  it('matches case-insensitively, because the caller must not have to care', () => {
    const body = `${PASSWORD_SUFFIX}:5\r\n`
    expect(countInRangeResponse(body, PASSWORD_SUFFIX.toLowerCase())).toBe(5)
  })

  it('treats a matching line with an unreadable count as a hit, not a miss', () => {
    expect(countInRangeResponse(`${PASSWORD_SUFFIX}:not-a-number\r\n`, PASSWORD_SUFFIX)).toBe(1)
  })

  it('returns zero for an empty body', () => {
    expect(countInRangeResponse('', PASSWORD_SUFFIX)).toBe(0)
  })
})

describe('pwnedCount', () => {
  it('sends only the five-character prefix and requests padded responses', async () => {
    let observedUrl = ''
    let observedPadding: string | null = null

    server.use(
      http.get(RANGE_URL, ({ request }) => {
        observedUrl = request.url
        observedPadding = request.headers.get('Add-Padding')
        return HttpResponse.text(`${PASSWORD_SUFFIX}:10382543\r\n`)
      }),
    )

    await pwnedCount('password')

    expect(observedUrl).toBe(`${PWNED_PASSWORDS_ORIGIN}/range/${PASSWORD_PREFIX}`)
    const path = observedUrl.slice(PWNED_PASSWORDS_ORIGIN.length)
    expect(path).not.toContain(PASSWORD_SUFFIX)
    expect(path).not.toContain('password')
    expect(path.replace('/range/', '')).toHaveLength(5)
    expect(observedPadding).toBe('true')
  })

  it('reports the breach count for a known-breached password', async () => {
    server.use(
      http.get(RANGE_URL, () => HttpResponse.text(`${PASSWORD_SUFFIX}:10382543\r\n`)),
    )
    await expect(pwnedCount('password')).resolves.toBe(10382543)
  })

  it('reports zero for a password the corpus does not hold', async () => {
    server.use(
      http.get(RANGE_URL, () =>
        HttpResponse.text('0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n'),
      ),
    )
    await expect(pwnedCount('password')).resolves.toBe(0)
  })

  it('fails open when the request rejects', async () => {
    server.use(http.get(RANGE_URL, () => HttpResponse.error()))
    await expect(pwnedCount('password')).resolves.toBe(0)
  })

  it('fails open on a non-OK response', async () => {
    server.use(
      http.get(RANGE_URL, () => new HttpResponse(null, { status: 503 })),
    )
    await expect(pwnedCount('password')).resolves.toBe(0)
  })

  it('fails open where Web Crypto is unavailable without making a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.stubGlobal('crypto', {})

    expect(await pwnedCount('password')).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('spends no request on an empty password', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    expect(await pwnedCount('')).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
