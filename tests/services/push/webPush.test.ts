// @vitest-environment node
//
// The two specifications, checked against something that is not this code.
//
// ============================ WHY A PINNED VECTOR ==========================
//
// A round trip proves nothing here. Encrypting and then decrypting through the
// same derivation agrees with itself whether or not the derivation is right,
// and the failure mode of getting it wrong is invisible from the sender's side:
// the push service answers 201, the browser cannot decrypt what arrives, and
// the notification is silently discarded. Nobody is told, least of all us.
//
// So the body below was produced by `http_ece@1.2.1` — a zero-dependency Node
// implementation of RFC 8188 and RFC 8291 written by neither this repository
// nor its author — driven with the fixed salt and key pair recorded here. Two
// implementations agreeing on the exact bytes is the evidence. If a refactor
// reverses the two public keys in `key_info`, swaps the salt and the IKM, or
// emits a DER signature, this file fails and the deployed sender does not have
// to teach us by going quiet.
//
// The keys are throwaway values generated for this file. They are not a
// credential of any environment and reach no push service.
import { describe, expect, it } from 'vitest'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  encryptPushPayload,
  generateLocalKeyPair,
  importLocalKeyPair,
  sendWebPush,
  vapidAuthorization,
} from '../../../supabase/functions/_shared/push/webPush'

/** Produced by http_ece@1.2.1. See the header. */
const VECTOR = {
  uaPublic: 'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
  asPublic: 'BCWiVOGr0ZzQENGF-sSe47c6Sgqf9ufuLsW0x-ykdk9NVWOspcv1colEhpmBhGjKY7sM1Vnm2Q07IZs1f7hVjIQ',
  asPrivate: 'Py8KbB1LjpB1ocPlt9nxAjRWeJCrze8BI0VniavN7wE',
  auth: 'Dx4tPEtaaXiHlqW0w9Lh8A',
  salt: 'obLD1OX2BxgpOktcbX6PkA',
  plaintext: 'A nudge before your predictions lock.',
  body: 'obLD1OX2BxgpOktcbX6PkAAAEABBBCWiVOGr0ZzQENGF-sSe47c6Sgqf9ufuLsW0x-ykdk9NVWOspcv1colEhpmBhGjKY7sM1Vnm2Q07IZs1f7hVjIRnxVWahFW6KPm1FH9sOl9maB7Vt8OIyju5q8VgMNXkZNSHEsJC5B22pR4GvzpjPK1YR48W8yU',
} as const

const SUBSCRIPTION = {
  endpoint: 'https://push.example.test/subscription/one',
  p256dh: VECTOR.uaPublic,
  auth: VECTOR.auth,
} as const

describe('RFC 8291 encryption agrees with an independent implementation', () => {
  it('produces the pinned body byte for byte', async () => {
    const encrypted = await encryptPushPayload({
      plaintext: new TextEncoder().encode(VECTOR.plaintext),
      subscription: SUBSCRIPTION,
      salt: base64UrlToBytes(VECTOR.salt),
      localKeyPair: await importLocalKeyPair(VECTOR.asPublic, VECTOR.asPrivate),
    })

    expect(bytesToBase64Url(encrypted)).toBe(VECTOR.body)
  })

  it('lays the aes128gcm header out as RFC 8188 §2.1 describes it', async () => {
    // Asserted separately from the vector because a header assembled in the
    // wrong ORDER can still round-trip through a matching decoder, and a real
    // browser's decoder is not ours.
    const encrypted = await encryptPushPayload({
      plaintext: new TextEncoder().encode(VECTOR.plaintext),
      subscription: SUBSCRIPTION,
      salt: base64UrlToBytes(VECTOR.salt),
      localKeyPair: await importLocalKeyPair(VECTOR.asPublic, VECTOR.asPrivate),
    })

    expect(bytesToBase64Url(encrypted.slice(0, 16))).toBe(VECTOR.salt)
    expect(new DataView(encrypted.buffer, encrypted.byteOffset, 21).getUint32(16, false)).toBe(4096)
    expect(encrypted[20]).toBe(65)
    expect(bytesToBase64Url(encrypted.slice(21, 86))).toBe(VECTOR.asPublic)
    // 37 bytes of text, one padding delimiter, a 16-byte tag.
    expect(encrypted.length).toBe(86 + 37 + 1 + 16)
  })

  it('encrypts differently every time, given a fresh salt and key pair', async () => {
    // RFC 8291 §3.1 requires a new local key pair per message. Two identical
    // bodies would mean one of the two was being reused, which is the property
    // the whole scheme rests on.
    const twice = await Promise.all(
      [0, 1].map(async () =>
        bytesToBase64Url(
          await encryptPushPayload({
            plaintext: new TextEncoder().encode(VECTOR.plaintext),
            subscription: SUBSCRIPTION,
            salt: crypto.getRandomValues(new Uint8Array(16)),
            localKeyPair: await generateLocalKeyPair(),
          }),
        ),
      ),
    )

    expect(twice[0]).not.toBe(twice[1])
  })

  it('refuses a salt that is not sixteen bytes', async () => {
    await expect(
      encryptPushPayload({
        plaintext: new TextEncoder().encode('x'),
        subscription: SUBSCRIPTION,
        salt: new Uint8Array(8),
        localKeyPair: await importLocalKeyPair(VECTOR.asPublic, VECTOR.asPrivate),
      }),
    ).rejects.toThrow(/16 bytes/)
  })

  it('refuses a payload that will not fit one record', async () => {
    // Silently truncating would produce a body a browser discards without
    // saying why, which is the failure this whole file exists to make loud.
    await expect(
      encryptPushPayload({
        plaintext: new TextEncoder().encode('x'.repeat(4096)),
        subscription: SUBSCRIPTION,
        salt: base64UrlToBytes(VECTOR.salt),
        localKeyPair: await importLocalKeyPair(VECTOR.asPublic, VECTOR.asPrivate),
      }),
    ).rejects.toThrow(/one aes128gcm record/)
  })
})

describe('RFC 8292 says who is sending, and to which service', () => {
  const KEYS = {
    publicKey: VECTOR.asPublic,
    privateKey: VECTOR.asPrivate,
    subject: 'mailto:operations@example.test',
  } as const

  it('signs a JWT for the push service ORIGIN, not the endpoint', async () => {
    const authorization = await vapidAuthorization({
      endpoint: 'https://push.example.test/subscription/one?token=abc',
      keys: KEYS,
      issuedAtSeconds: 1_800_000_000,
    })

    const [, token] = /^vapid t=([^,]+), k=(.+)$/.exec(authorization) ?? []
    const claims = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes((token ?? '').split('.')[1] ?? '')),
    ) as Record<string, unknown>

    // Sending the whole endpoint here is the common mistake, and it is rejected
    // by some push services and quietly accepted by others.
    expect(claims.aud).toBe('https://push.example.test')
    expect(claims.sub).toBe('mailto:operations@example.test')
    expect(claims.exp).toBe(1_800_000_000 + 12 * 60 * 60)
  })

  it('carries the public key in `k=` so the service can check the signature', async () => {
    const authorization = await vapidAuthorization({
      endpoint: 'https://push.example.test/one',
      keys: KEYS,
      issuedAtSeconds: 1_800_000_000,
    })
    expect(authorization.endsWith(`, k=${VECTOR.asPublic}`)).toBe(true)
  })

  it('emits a 64-byte JOSE signature rather than a DER one', async () => {
    // Web Crypto gives raw `r || s`, which is what JWS wants. A DER-encoded
    // signature is a valid ECDSA signature that every push service rejects.
    const authorization = await vapidAuthorization({
      endpoint: 'https://push.example.test/one',
      keys: KEYS,
      issuedAtSeconds: 1_800_000_000,
    })
    const token = /^vapid t=([^,]+),/.exec(authorization)?.[1] ?? ''
    expect(base64UrlToBytes(token.split('.')[2] ?? '')).toHaveLength(64)
  })

  it('verifies against the public key it advertises', async () => {
    // The end-to-end check: a push service does exactly this, and a mismatch
    // between the signing key and the advertised one is a 403 nobody sees until
    // a real send.
    const authorization = await vapidAuthorization({
      endpoint: 'https://push.example.test/one',
      keys: KEYS,
      issuedAtSeconds: 1_800_000_000,
    })
    const token = /^vapid t=([^,]+),/.exec(authorization)?.[1] ?? ''
    const [header, claims, signature] = token.split('.')
    const raw = base64UrlToBytes(VECTOR.asPublic)
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToBase64Url(raw.slice(1, 33)),
        y: bytesToBase64Url(raw.slice(33, 65)),
        ext: true,
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    await expect(
      crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        base64UrlToBytes(signature ?? '') as BufferSource,
        new TextEncoder().encode(`${header}.${claims}`) as BufferSource,
      ),
    ).resolves.toBe(true)
  })

  it('refuses a subject a push service could not contact', async () => {
    await expect(
      vapidAuthorization({
        endpoint: 'https://push.example.test/one',
        keys: { ...KEYS, subject: 'Predictor' },
        issuedAtSeconds: 1_800_000_000,
      }),
    ).rejects.toThrow(/mailto:/)
  })
})

describe('what the push service answered, and what it means', () => {
  const KEYS = {
    publicKey: VECTOR.asPublic,
    privateKey: VECTOR.asPrivate,
    subject: 'mailto:operations@example.test',
  } as const

  async function send(reply: Response | Error) {
    const seen: { request?: Request } = {}
    const outcome = await sendWebPush({
      subscription: SUBSCRIPTION,
      payload: '{"title":"x"}',
      keys: KEYS,
      ttlSeconds: 3600,
      nowSeconds: 1_800_000_000,
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.request = new Request(input as RequestInfo, init)
        if (reply instanceof Error) throw reply
        return reply
      }) as typeof fetch,
    })
    return { outcome, request: seen.request }
  }

  it('sends the headers a push service requires', async () => {
    const { request } = await send(new Response(null, { status: 201 }))
    expect(request?.method).toBe('POST')
    expect(request?.headers.get('content-encoding')).toBe('aes128gcm')
    expect(request?.headers.get('content-type')).toBe('application/octet-stream')
    expect(request?.headers.get('ttl')).toBe('3600')
    expect(request?.headers.get('authorization')?.startsWith('vapid t=')).toBe(true)
  })

  it('clamps a ttl that would outlive the thing it reminds about', async () => {
    const seen: { ttl?: string | null } = {}
    await sendWebPush({
      subscription: SUBSCRIPTION,
      payload: '{}',
      keys: KEYS,
      ttlSeconds: 999_999,
      nowSeconds: 1_800_000_000,
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.ttl = new Request(input as RequestInfo, init).headers.get('ttl')
        return new Response(null, { status: 201 })
      }) as typeof fetch,
    })
    expect(seen.ttl).toBe('86400')
  })

  it('never sends the payload in the clear', async () => {
    // The endpoint belongs to a third party. Everything readable there must be
    // ciphertext, so a push service operator learns nothing about a player.
    const { request } = await send(new Response(null, { status: 201 }))
    const body = new Uint8Array(await (request as Request).arrayBuffer())
    expect(new TextDecoder().decode(body)).not.toContain('title')
    expect(body.length).toBeGreaterThan(86)
  })

  it('reads 201 as accepted', async () => {
    const { outcome } = await send(new Response(null, { status: 201 }))
    expect(outcome).toEqual({ kind: 'accepted', status: 201 })
  })

  it.each([404, 410])('reads %i as gone for good, which is the only prunable answer', async (status) => {
    const { outcome } = await send(new Response(null, { status }))
    expect(outcome).toEqual({ kind: 'gone', status })
  })

  it.each([429, 500, 503])('reads %i as transient, so nothing is deleted', async (status) => {
    // A push service having a bad ten minutes must not silently opt every
    // player out of a channel they chose.
    const { outcome } = await send(new Response('rate limited', { status }))
    expect(outcome.kind).toBe('refused')
    expect(outcome).not.toHaveProperty('gone')
  })

  it('never repeats the refusal body, which quotes the endpoint back', async () => {
    const { outcome } = await send(
      new Response('rejected request to https://push.example.test/subscription/one', {
        status: 400,
      }),
    )
    expect(outcome.kind).toBe('refused')
    expect(JSON.stringify(outcome)).not.toContain('push.example.test')
  })

  it('treats a network failure as transient rather than gone', async () => {
    const { outcome } = await send(new Error('connect ETIMEDOUT'))
    expect(outcome).toEqual({
      kind: 'refused',
      status: null,
      reason: 'network: connect ETIMEDOUT',
    })
  })
})

describe('one answer for a player with several browsers', () => {
  it('counts one accepted device as reaching the player', async () => {
    const { summarisePushOutcomes } = await import(
      '../../../supabase/functions/_shared/push/webPush'
    )
    expect(
      summarisePushOutcomes([
        { kind: 'gone', status: 410 },
        { kind: 'accepted', status: 201 },
      ]),
    ).toEqual({ delivered: true, reason: null })
  })

  it('names the all-gone case distinctly, because it is a channel change', async () => {
    // Every endpoint disowned means the player has no working device left and
    // every one has just been pruned, so the retry will choose email. In the
    // ledger that must read as a channel change rather than as a mystery.
    const { summarisePushOutcomes } = await import(
      '../../../supabase/functions/_shared/push/webPush'
    )
    expect(
      summarisePushOutcomes([
        { kind: 'gone', status: 410 },
        { kind: 'gone', status: 404 },
      ]),
    ).toEqual({ delivered: false, reason: 'push-subscription-gone' })
  })

  it('does not call a transient refusal gone, even beside one that is', async () => {
    // The distinction decides whether a row is deleted. A push service having a
    // bad ten minutes must never opt a player out of a channel they chose.
    const { summarisePushOutcomes } = await import(
      '../../../supabase/functions/_shared/push/webPush'
    )
    const summary = summarisePushOutcomes([
      { kind: 'gone', status: 410 },
      { kind: 'refused', status: 503, reason: 'push service answered 503' },
    ])
    expect(summary.delivered).toBe(false)
    expect(summary.reason).toBe('push: push service answered 503')
  })

  it('says so when the subscription vanished between the claim and the send', async () => {
    const { summarisePushOutcomes } = await import(
      '../../../supabase/functions/_shared/push/webPush'
    )
    expect(summarisePushOutcomes([])).toEqual({
      delivered: false,
      reason: 'push-no-subscription',
    })
  })
})
