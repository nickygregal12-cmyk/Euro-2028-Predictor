import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PWNED_PASSWORDS_ORIGIN,
  countInRangeResponse,
  pwnedCount,
} from '../../../src/services/auth/pwnedPassword'

/**
 * The AUTH-002 breach-corpus check.
 *
 * Two properties carry the weight here, and neither is "it finds the password":
 *
 *   1. **It never sends the password, or enough of its hash to identify one.**
 *      A regression that sent the whole digest would still work perfectly and
 *      would silently disclose every candidate password to a third party. The
 *      request URL is asserted for that reason, not for tidiness.
 *   2. **It fails open on every error path.** The forms block submission on a
 *      non-zero count, so a check that threw or returned a truthy value on a
 *      network failure would lock people out of account creation whenever HIBP
 *      had a bad day.
 */

// SHA-1 of 'password' is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 — the single
// most-breached password there is, and a fixed, publicly documented digest. Used
// here so the prefix/suffix split is checked against a real value rather than
// against whatever the implementation happens to produce.
const PASSWORD_SHA1 = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'
const PASSWORD_PREFIX = PASSWORD_SHA1.slice(0, 5)
const PASSWORD_SUFFIX = PASSWORD_SHA1.slice(5)

function rangeResponse(body: string, ok = true): Response {
  return { ok, text: async () => body } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('countInRangeResponse', () => {
  it('finds a suffix and returns its count', () => {
    const body = `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${PASSWORD_SUFFIX}:10382543\r\n`
    expect(countInRangeResponse(body, PASSWORD_SUFFIX)).toBe(10382543)
  })

  it('returns zero when the suffix is absent from the bucket', () => {
    // The ordinary good case: the prefix matched 500-odd hashes and none of them
    // was this one.
    expect(countInRangeResponse('0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n', PASSWORD_SUFFIX)).toBe(0)
  })

  it('matches case-insensitively, because the caller must not have to care', () => {
    const body = `${PASSWORD_SUFFIX}:5\r\n`
    expect(countInRangeResponse(body, PASSWORD_SUFFIX.toLowerCase())).toBe(5)
  })

  it('treats a matching line with an unreadable count as a hit, not a miss', () => {
    // The one direction this function must never fail in. A malformed count on a
    // line whose suffix matched still means the password is in the corpus, and
    // returning 0 there would convert a hit into a silent pass.
    expect(countInRangeResponse(`${PASSWORD_SUFFIX}:not-a-number\r\n`, PASSWORD_SUFFIX)).toBe(1)
  })

  it('returns zero for an empty body', () => {
    expect(countInRangeResponse('', PASSWORD_SUFFIX)).toBe(0)
  })
})

describe('pwnedCount', () => {
  it('sends only the five-character prefix, never the password or the full hash', async () => {
    // The k-anonymity property, asserted directly. If this ever fails, the check
    // has become a disclosure channel while continuing to work.
    const fetchMock = vi.fn(async () => rangeResponse(`${PASSWORD_SUFFIX}:10382543\r\n`))
    vi.stubGlobal('fetch', fetchMock)

    await pwnedCount('password')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${PWNED_PASSWORDS_ORIGIN}/range/${PASSWORD_PREFIX}`)

    // Asserted against the PATH rather than the whole URL, because the origin is
    // literally `api.pwnedpasswords.com` — a naive `not.toContain('password')`
    // over the full URL fails on the hostname and proves nothing about what was
    // disclosed.
    const path = url.slice(PWNED_PASSWORDS_ORIGIN.length)
    expect(path).not.toContain(PASSWORD_SUFFIX)
    expect(path).not.toContain('password')
    expect(path.replace('/range/', '')).toHaveLength(5)
    // Uniform response size, so the bucket cannot be inferred from the length.
    expect((init.headers as Record<string, string>)['Add-Padding']).toBe('true')
  })

  it('reports the breach count for a known-breached password', async () => {
    vi.stubGlobal('fetch', async () => rangeResponse(`${PASSWORD_SUFFIX}:10382543\r\n`))
    expect(await pwnedCount('password')).toBe(10382543)
  })

  it('reports zero for a password the corpus does not hold', async () => {
    vi.stubGlobal('fetch', async () => rangeResponse('0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n'))
    expect(await pwnedCount('password')).toBe(0)
  })

  it('fails open when the request rejects', async () => {
    // Offline, DNS failure, or the CSP refusing the connection. None of these
    // may become an outage on the signup form.
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down')
    })
    await expect(pwnedCount('password')).resolves.toBe(0)
  })

  it('fails open on a non-OK response', async () => {
    vi.stubGlobal('fetch', async () => rangeResponse('', false))
    expect(await pwnedCount('password')).toBe(0)
  })

  it('fails open where Web Crypto is unavailable', async () => {
    // `crypto.subtle` is undefined outside a secure context. Somebody on a
    // plain-HTTP preview must still be able to create an account.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('crypto', {})

    expect(await pwnedCount('password')).toBe(0)
    expect(fetchMock, 'no request should be attempted without a digest').not.toHaveBeenCalled()
  })

  it('spends no request on an empty password', async () => {
    // Length is the form's own check. Asking the corpus about '' would burn a
    // round trip to learn nothing.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await pwnedCount('')).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
