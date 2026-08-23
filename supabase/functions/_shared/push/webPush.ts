// Web push, from the two specifications and nothing else.
//
// WHY THERE IS NO LIBRARY HERE. Every published web-push client is a Node
// package with a transitive dependency tree, and this runs in Deno inside an
// Edge Function. The whole of what is needed is one ECDH, two HKDFs, one
// AES-GCM and one ECDSA signature — all five are in the Web Crypto API that
// both runtimes already have — plus about forty bytes of header assembly. A
// dependency would be more code to audit than the code it replaced.
//
// WHAT IT IMPLEMENTS
//   * RFC 8291 (Message Encryption for Web Push), which is RFC 8188's
//     `aes128gcm` content encoding with a key agreement in front of it;
//   * RFC 8292 (VAPID), which is an ES256 JWT saying who is sending.
//
// THE DERIVATION IS THE PART THAT MUST BE EXACTLY RIGHT, and getting it subtly
// wrong produces ciphertext a browser silently discards — the push service
// answers 201 and the player is never told anything. So the encryption takes
// its salt and its local key pair as ARGUMENTS rather than generating them
// inside: that makes it a deterministic function, and `webPush.test.ts` pins it
// against a body produced by an independent implementation. Randomness lives in
// `generateLocalKeyPair` and in the caller, where a test never needs to reach.
//
// WHAT IT NEVER DOES. It does not decide what to say — `pushPayload.ts` owns
// that — and it does not decide whether to send. It encrypts what it is given
// to the subscription it is given, and reports what the push service answered.

/** One browser, as `public.push_subscriptions` stores it. */
export interface StoredPushSubscription {
  readonly endpoint: string
  /** The browser's public key: base64url of a 65-byte uncompressed P-256 point. */
  readonly p256dh: string
  /** The shared auth secret: base64url of 16 bytes. */
  readonly auth: string
}

/**
 * This deployment's own identity to a push service.
 *
 * The private key is a credential. It is read from the environment by the
 * caller and never logged, never returned and never put in an error message.
 */
export interface VapidKeys {
  /** base64url of the 65-byte uncompressed P-256 public point. Sent as `k=`. */
  readonly publicKey: string
  /** base64url of the 32-byte private scalar. */
  readonly privateKey: string
  /** RFC 8292 `sub`: a `mailto:` or an https origin a push service can contact. */
  readonly subject: string
}

export type PushOutcome =
  /** The push service accepted it. Not "the player saw it", which is unknowable. */
  | { readonly kind: 'accepted'; readonly status: number }
  /**
   * 404 or 410. The subscription is gone for good and must be pruned.
   * Distinguished from every other failure because it is the only one where
   * deleting the row is correct.
   */
  | { readonly kind: 'gone'; readonly status: number }
  /** Anything else: a 429, a 500, a timeout. Transient — retry, prune nothing. */
  | { readonly kind: 'refused'; readonly status: number | null; readonly reason: string }

/** A local key pair for one message. Never reused across messages. */
export interface LocalKeyPair {
  readonly privateKey: CryptoKey
  /** Raw 65-byte uncompressed point; goes in the header as the key id. */
  readonly publicKey: Uint8Array
}

const encoder = new TextEncoder()

/**
 * Whether a VAPID subject is a contact somebody could actually use.
 *
 * A PREFIX CHECK IS NOT ENOUGH, and the difference is not academic: the bare
 * string `mailto:` starts with `mailto:` and is what an operator gets from a
 * half-filled environment variable. It would be signed into every JWT and turn
 * a one-line configuration error into every push being refused by the service,
 * with the reason visible only in a provider's logs.
 */
function contactable(subject: string): boolean {
  if (subject.startsWith('mailto:')) {
    // Not RFC 5322 — deliberately. This is a smoke test for "somebody typed an
    // address", and a full grammar here would reject valid addresses for a
    // field whose only job is to give a push service someone to contact.
    return /^mailto:[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(subject)
  }
  try {
    const url = new URL(subject)
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * Whether an endpoint is a plausible PUBLIC push service.
 *
 * DEFENCE IN DEPTH BEHIND THE SCHEMA, which refuses the same shapes on the way
 * in. Both, because they fail differently: the constraint cannot be bypassed
 * but only sees rows written through it, and this sees every request but is one
 * refactor away from being skipped. A row that predates the constraint, or one
 * written by a future service-role path, still cannot make this function POST
 * to an internal address.
 *
 * NOT AN ORIGIN ALLOW-LIST. Push endpoints live on Google's, Mozilla's,
 * Microsoft's and Apple's services and on self-hosted ones; a hostname list
 * would silently stop working for a browser nobody anticipated. What is refused
 * is the shape that can never be a public push service.
 */
export function isPublicPushEndpoint(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  // An IPv6 literal arrives with the brackets stripped, so it is recognised by
  // its colons rather than by the brackets the URL had.
  if (host.includes(':')) return false
  if (/^[0-9.]+$/.test(host)) return false
  if (!host.includes('.')) return false
  if (/\.(local|internal|localhost|lan|home|corp)$/.test(host)) return false
  return true
}

/** RFC 8188 §2.1. One record, so the padding delimiter is the last-record one. */
const LAST_RECORD_DELIMITER = 0x02
/** Fixed. Every payload this product sends is two short sentences. */
const RECORD_SIZE = 4096
const AES_GCM_TAG_BYTES = 16
const PUBLIC_KEY_BYTES = 65
const SALT_BYTES = 16
/** RFC 8292 §2: at most 24 hours, and shorter is better. */
const VAPID_LIFETIME_SECONDS = 12 * 60 * 60

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const joined = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}

/**
 * HKDF-SHA256 in one call.
 *
 * Web Crypto's `deriveBits` performs extract-then-expand together, which is
 * exactly `HKDF(salt, ikm, info, length)` — the form both RFCs are written in.
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  bytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ])
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    bytes * 8,
  )
  return new Uint8Array(derived)
}

/** A JWK for a P-256 key pair given the raw public point and private scalar. */
function ellipticJwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== PUBLIC_KEY_BYTES || publicKey[0] !== 0x04) {
    throw new Error('A P-256 public key must be 65 uncompressed bytes')
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(publicKey.slice(1, 33)),
    y: bytesToBase64Url(publicKey.slice(33, 65)),
    ...(privateKey ? { d: bytesToBase64Url(privateKey) } : {}),
    ext: true,
  }
}

/** A fresh local key pair. One per message, per RFC 8291 §3.1. */
export async function generateLocalKeyPair(): Promise<LocalKeyPair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey)
  return { privateKey: pair.privateKey, publicKey: new Uint8Array(raw) }
}

/** A named local key pair, so a test can pin the whole derivation. */
export async function importLocalKeyPair(
  publicKeyBase64Url: string,
  privateKeyBase64Url: string,
): Promise<LocalKeyPair> {
  const publicKey = base64UrlToBytes(publicKeyBase64Url)
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    ellipticJwk(publicKey, base64UrlToBytes(privateKeyBase64Url)),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
  return { privateKey, publicKey }
}

/**
 * RFC 8291 §3.4 and RFC 8188 §2, as one deterministic function.
 *
 *   ecdh_secret = ECDH(as_private, ua_public)
 *   IKM   = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
 *   CEK   = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16)
 *   NONCE = HKDF(salt, IKM, "Content-Encoding: nonce\0", 12)
 *
 * and the body is `salt || rs || idlen || as_public || AES-128-GCM(plaintext || 0x02)`.
 *
 * THE KEY ORDER IN `key_info` IS NOT SYMMETRIC — receiver then sender. Reverse
 * the two and every value downstream is still a valid-looking 32 bytes, the
 * push service still answers 201, and no browser ever renders anything.
 */
export async function encryptPushPayload(params: {
  readonly plaintext: Uint8Array
  readonly subscription: StoredPushSubscription
  readonly salt: Uint8Array
  readonly localKeyPair: LocalKeyPair
}): Promise<Uint8Array> {
  const { plaintext, subscription, salt, localKeyPair } = params

  if (salt.length !== SALT_BYTES) {
    throw new Error('A push salt must be 16 bytes')
  }
  // One record only. Nothing this product sends comes close, and refusing is
  // better than emitting a truncated body a browser discards in silence.
  if (plaintext.length + 1 + AES_GCM_TAG_BYTES > RECORD_SIZE) {
    throw new Error('This payload does not fit one aes128gcm record')
  }

  const uaPublic = base64UrlToBytes(subscription.p256dh)
  const authSecret = base64UrlToBytes(subscription.auth)

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaKey },
      localKeyPair.privateKey,
      256,
    ),
  )

  const ikm = await hkdf(
    authSecret,
    sharedSecret,
    concat(encoder.encode('WebPush: info\0'), uaPublic, localKeyPair.publicKey),
    32,
  )
  const contentKey = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentKey as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  )
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, tagLength: AES_GCM_TAG_BYTES * 8 },
      aesKey,
      concat(plaintext, Uint8Array.of(LAST_RECORD_DELIMITER)) as BufferSource,
    ),
  )

  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE, false)

  return concat(
    salt,
    recordSize,
    Uint8Array.of(localKeyPair.publicKey.length),
    localKeyPair.publicKey,
    ciphertext,
  )
}

/**
 * RFC 8292's `Authorization: vapid t=<jwt>, k=<public key>`.
 *
 * The audience is the push service's ORIGIN and nothing more of the endpoint.
 * Sending the full URL is a common mistake and is rejected by some services and
 * silently accepted by others, which is the worst combination to debug.
 *
 * `issuedAtSeconds` is a parameter so the JWT is a pure function of its inputs
 * and a test can assert the exact token rather than that one was produced.
 */
export async function vapidAuthorization(params: {
  readonly endpoint: string
  readonly keys: VapidKeys
  readonly issuedAtSeconds: number
}): Promise<string> {
  const { endpoint, keys, issuedAtSeconds } = params
  const audience = new URL(endpoint).origin

  if (!contactable(keys.subject)) {
    throw new Error('A VAPID subject must be a mailto: or https:// contact')
  }

  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: issuedAtSeconds + VAPID_LIFETIME_SECONDS,
        sub: keys.subject,
      }),
    ),
  )
  const signingInput = `${header}.${claims}`

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    ellipticJwk(base64UrlToBytes(keys.publicKey), base64UrlToBytes(keys.privateKey)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // Web Crypto's ECDSA output is already the raw `r || s` JOSE wants. A DER
  // signature here would be rejected by every push service.
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      encoder.encode(signingInput) as BufferSource,
    ),
  )

  return `vapid t=${signingInput}.${bytesToBase64Url(signature)}, k=${keys.publicKey}`
}

/**
 * Encrypt one payload and post it.
 *
 * `ttlSeconds` is how long the push service may hold it for a device that is
 * offline. A deadline reminder that arrives after the deadline is worse than
 * one that never arrives, so the caller passes the time remaining rather than
 * a constant.
 */
export async function sendWebPush(params: {
  readonly subscription: StoredPushSubscription
  readonly payload: string
  readonly keys: VapidKeys
  readonly ttlSeconds: number
  readonly nowSeconds: number
  readonly fetchImpl?: typeof fetch
}): Promise<PushOutcome> {
  const { subscription, payload, keys, ttlSeconds, nowSeconds } = params
  const performRequest = params.fetchImpl ?? fetch

  let body: Uint8Array
  let authorization: string
  try {
    body = await encryptPushPayload({
      plaintext: encoder.encode(payload),
      subscription,
      salt: crypto.getRandomValues(new Uint8Array(SALT_BYTES)),
      localKeyPair: await generateLocalKeyPair(),
    })
    authorization = await vapidAuthorization({
      endpoint: subscription.endpoint,
      keys,
      issuedAtSeconds: nowSeconds,
    })
  } catch (error) {
    // A key that will not import or a payload that will not fit is a fault in
    // this deployment, not in the push service. Reported as refused so the
    // ledger retries and nothing is pruned on the strength of it.
    return { kind: 'refused', status: null, reason: `encrypt: ${(error as Error).message}` }
  }

  if (!isPublicPushEndpoint(subscription.endpoint)) {
    // Refused BEFORE the request, and reported as this deployment's fault
    // rather than the push service's: nothing was asked, so nothing answered.
    return {
      kind: 'refused',
      status: null,
      reason: 'endpoint is not a public push service',
    }
  }

  let response: Response
  try {
    response = await performRequest(subscription.endpoint, {
      method: 'POST',
      // A push service does not redirect. Following one would take a request
      // that passed the check above to an address that never did.
      redirect: 'error',
      headers: {
        authorization,
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        // Clamped: a negative TTL is rejected, and a very long one keeps a
        // reminder alive past the thing it reminds about.
        ttl: String(Math.max(0, Math.min(Math.round(ttlSeconds), 86400))),
        urgency: 'normal',
      },
      body: body as BodyInit,
    })
  } catch (error) {
    return { kind: 'refused', status: null, reason: `network: ${(error as Error).message}` }
  }

  if (response.status === 404 || response.status === 410) {
    return { kind: 'gone', status: response.status }
  }
  if (response.ok) {
    return { kind: 'accepted', status: response.status }
  }
  // The STATUS, never the body. A push service echoes the request it refused,
  // and that request contains the endpoint.
  return {
    kind: 'refused',
    status: response.status,
    reason: `push service answered ${response.status}`,
  }
}

/**
 * One answer for a player who has several browsers.
 *
 * A reminder is ONE ledger row, so several devices produce one result. The
 * question the ledger is actually asking is "did this reach them", and reaching
 * one of a player's three browsers is reaching them.
 *
 * THE ALL-GONE CASE IS THE ONE THAT MATTERS. Every endpoint disowned means the
 * player has no working device left, every one of them has just been pruned,
 * and the next claim will therefore choose email. Naming it distinctly is what
 * makes that visible in the ledger as a channel change rather than as a
 * mysterious failure followed by a mysterious success.
 */
export function summarisePushOutcomes(
  outcomes: readonly PushOutcome[],
): { readonly delivered: boolean; readonly reason: string | null } {
  if (outcomes.length === 0) {
    // Claimed as push and then no device found: the subscription went between
    // the claim and the send. Not an error, and the retry will say email.
    return { delivered: false, reason: 'push-no-subscription' }
  }
  if (outcomes.some((outcome) => outcome.kind === 'accepted')) {
    return { delivered: true, reason: null }
  }
  if (outcomes.every((outcome) => outcome.kind === 'gone')) {
    return { delivered: false, reason: 'push-subscription-gone' }
  }
  const refused = outcomes.find((outcome) => outcome.kind === 'refused')
  return {
    delivered: false,
    reason: refused && refused.kind === 'refused' ? `push: ${refused.reason}` : 'push-refused',
  }
}
