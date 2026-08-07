import {
  decodeProviderPayload,
  ProviderDecodeError,
  type ProviderName,
} from './providerDecoders.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const DECODER_VERSION = 'contract-132-v1'
// UNDERSCORE, and not the same string as the function slug. The function is
// deployed as `provider-poll` and lives at `/functions/v1/provider-poll`; the
// secret key it authorises callers against is `provider_poll`, because Supabase
// rejects a hyphen in a secret key name. The two looking alike is exactly why
// this is worth a comment: the first version of this constant used the slug,
// and the only symptom was a 500 saying the key was missing.
const CALLER_KEY_NAME = 'provider_poll'
const PROCESSING_MAX_RESPONSE_BYTES = 10 * 1024 * 1024
const ARCHIVE_MAX_RESPONSE_BYTES = 12 * 1024 * 1024
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }
const FORBIDDEN_CREDENTIAL_PARAMETERS = new Set([
  'api_token',
  'api_key',
  'apikey',
  'token',
  'key',
  'authorization',
  'x-auth-token',
  'x-apisports-key',
])

type PollRequest = {
  provider: ProviderName
  path: string
}

type ProviderConfig = {
  baseUrl: string
  headers: (secret: string) => Record<string, string>
  secretName: string
}

class ProviderResponseTooLargeError extends Error {
  readonly byteLimit: number
  readonly observedBytes: number | null

  constructor(byteLimit: number, observedBytes: number | null) {
    super(`Provider response exceeded the ${byteLimit}-byte archive limit`)
    this.name = 'ProviderResponseTooLargeError'
    this.byteLimit = byteLimit
    this.observedBytes = observedBytes
  }
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  sportmonks: {
    baseUrl: 'https://api.sportmonks.com/v3/football/',
    secretName: 'SPORTMONKS_API_TOKEN',
    headers: (secret) => ({ Authorization: secret }),
  },
  'api-football': {
    baseUrl: 'https://v3.football.api-sports.io/',
    secretName: 'API_FOOTBALL_API_KEY',
    headers: (secret) => ({ 'x-apisports-key': secret }),
  },
  'football-data': {
    baseUrl: 'https://api.football-data.org/v4/',
    secretName: 'FOOTBALL_DATA_API_KEY',
    headers: (secret) => ({ 'X-Auth-Token': secret }),
  },
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required Edge Function secret: ${name}`)
  return value
}

function localLegacyServiceKey(): string | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !legacyKey) return null

  let hostname: string
  try {
    hostname = new URL(supabaseUrl).hostname
  } catch {
    return null
  }
  const localHosts = new Set(['127.0.0.1', 'localhost', 'kong', 'host.docker.internal'])
  return localHosts.has(hostname) ? legacyKey : null
}

function projectSecretKey(): string {
  const configured = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (configured) {
    let parsed: unknown
    try {
      parsed = JSON.parse(configured)
    } catch {
      throw new Error('SUPABASE_SECRET_KEYS must be a JSON object')
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('SUPABASE_SECRET_KEYS must be a JSON object')
    }
    const key = (parsed as Record<string, unknown>)[CALLER_KEY_NAME]
    if (typeof key === 'string' && key.length > 0) return key
  }

  const localLegacyKey = localLegacyServiceKey()
  if (localLegacyKey) return localLegacyKey
  throw new Error(`Missing named Supabase secret key: ${CALLER_KEY_NAME}`)
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  let mismatch = leftBytes.length ^ rightBytes.length

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return mismatch === 0
}

function authorized(request: Request, secretKey: string): boolean {
  const supplied = request.headers.get('apikey')
  return supplied !== null && constantTimeEqual(supplied, secretKey)
}

function parseRequest(value: unknown): PollRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Request body must be an object')
  }
  const provider = (value as Record<string, unknown>).provider
  const path = (value as Record<string, unknown>).path
  if (
    provider !== 'sportmonks'
    && provider !== 'api-football'
    && provider !== 'football-data'
  ) {
    throw new Error('provider must be sportmonks, api-football, or football-data')
  }
  if (
    typeof path !== 'string'
    || !path.startsWith('/')
    || path === '/'
    || path.startsWith('//')
    || path.includes('..')
    || path.includes('://')
    || path.includes('#')
    || path.length > 1024
  ) {
    throw new Error('path must be a bounded provider-relative path')
  }
  return { provider, path }
}

function providerUrl(config: ProviderConfig, path: string): URL {
  const base = new URL(config.baseUrl)
  const target = new URL(path.slice(1), base)
  if (
    target.protocol !== 'https:'
    || target.origin !== base.origin
    || !target.pathname.startsWith(base.pathname)
    || target.username !== ''
    || target.password !== ''
    || target.hash !== ''
  ) {
    throw new Error('provider path escaped its fixed HTTPS origin')
  }
  for (const parameter of target.searchParams.keys()) {
    if (FORBIDDEN_CREDENTIAL_PARAMETERS.has(parameter.toLowerCase())) {
      throw new Error('provider credentials must be supplied only through headers')
    }
  }
  return target
}

function responseHeaders(response: Response): Record<string, string> {
  const retained = [
    'content-type',
    'content-length',
    'date',
    'etag',
    'last-modified',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ]
  return Object.fromEntries(
    retained.flatMap((name) => {
      const value = response.headers.get(name)
      return value === null ? [] : [[name, value]]
    }),
  )
}

async function readBoundedResponseText(
  response: Response,
  byteLimit: number,
): Promise<{ rawBody: string; responseBytes: number }> {
  const declaredLength = response.headers.get('content-length')
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength)
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > byteLimit) {
      await response.body?.cancel('provider response exceeded archive limit')
      throw new ProviderResponseTooLargeError(byteLimit, declaredBytes)
    }
  }

  if (!response.body) return { rawBody: '', responseBytes: 0 }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let responseBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      responseBytes += value.byteLength
      if (responseBytes > byteLimit) {
        await reader.cancel('provider response exceeded archive limit')
        throw new ProviderResponseTooLargeError(byteLimit, responseBytes)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(responseBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return {
    rawBody: new TextDecoder().decode(bytes),
    responseBytes,
  }
}

async function rpcUuid(
  supabaseUrl: string,
  secretKey: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${functionName} failed (${response.status}): ${text.slice(0, 500)}`)
  }
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'string' || parsed.length === 0) {
    throw new Error(`${functionName} returned an invalid identifier`)
  }
  return parsed
}

async function recordFailure(
  supabaseUrl: string,
  secretKey: string,
  rawResponseId: string,
  errorCode: string,
  errorDetail: string,
): Promise<void> {
  await rpcUuid(supabaseUrl, secretKey, 'record_provider_response_processing', {
    p_raw_response_id: rawResponseId,
    p_decoder_version: DECODER_VERSION,
    p_succeeded: false,
    p_error_code: errorCode,
    p_error_detail: errorDetail.slice(0, 4000),
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let secretKey: string
  try {
    secretKey = projectSecretKey()
  } catch (error) {
    return json(500, {
      error: 'function_not_configured',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
  if (!authorized(request, secretKey)) return json(401, { error: 'unauthorized' })

  let poll: PollRequest
  try {
    poll = parseRequest(await request.json())
  } catch (error) {
    return json(400, {
      error: 'invalid_request',
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  const config = PROVIDERS[poll.provider]
  let supabaseUrl: string
  let providerSecret: string
  try {
    supabaseUrl = requiredEnvironment('SUPABASE_URL')
    providerSecret = requiredEnvironment(config.secretName)
  } catch (error) {
    return json(500, {
      error: 'function_not_configured',
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  let target: URL
  try {
    target = providerUrl(config, poll.path)
  } catch (error) {
    return json(400, {
      error: 'invalid_request',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
  const correlationId = crypto.randomUUID()

  let providerResponse: Response
  try {
    providerResponse = await fetch(target, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...config.headers(providerSecret),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    return json(502, {
      error: 'provider_transport_failed',
      detail: error instanceof Error ? error.message : String(error),
      correlationId,
    })
  }

  let rawBody: string
  let responseBytes: number
  try {
    ({ rawBody, responseBytes } = await readBoundedResponseText(
      providerResponse,
      ARCHIVE_MAX_RESPONSE_BYTES,
    ))
  } catch (error) {
    if (error instanceof ProviderResponseTooLargeError) {
      return json(413, {
        error: 'provider_response_exceeds_archive_limit',
        byteLimit: error.byteLimit,
        observedBytes: error.observedBytes,
        correlationId,
      })
    }
    return json(502, {
      error: 'provider_body_read_failed',
      detail: error instanceof Error ? error.message : String(error),
      correlationId,
    })
  }

  let rawResponseId: string
  try {
    rawResponseId = await rpcUuid(supabaseUrl, secretKey, 'archive_provider_response', {
      p_provider: poll.provider,
      p_request_url: target.toString(),
      p_request_method: 'GET',
      p_response_status: providerResponse.status,
      p_response_headers: responseHeaders(providerResponse),
      p_raw_body: rawBody,
      p_correlation_id: correlationId,
    })
  } catch (error) {
    return json(500, {
      error: 'archive_failed',
      detail: error instanceof Error ? error.message : String(error),
      correlationId,
    })
  }

  if (!providerResponse.ok) {
    try {
      await recordFailure(
        supabaseUrl,
        secretKey,
        rawResponseId,
        'provider_http_error',
        `Provider returned HTTP ${providerResponse.status}`,
      )
    } catch (error) {
      return json(500, {
        error: 'processing_record_failed',
        detail: error instanceof Error ? error.message : String(error),
        rawResponseId,
        correlationId,
      })
    }
    return json(502, {
      error: 'provider_http_error',
      status: providerResponse.status,
      rawResponseId,
      correlationId,
    })
  }

  if (responseBytes > PROCESSING_MAX_RESPONSE_BYTES) {
    try {
      await recordFailure(
        supabaseUrl,
        secretKey,
        rawResponseId,
        'provider_response_too_large',
        `Provider response was ${responseBytes} bytes; processing limit is ${PROCESSING_MAX_RESPONSE_BYTES}`,
      )
    } catch (error) {
      return json(500, {
        error: 'processing_record_failed',
        detail: error instanceof Error ? error.message : String(error),
        rawResponseId,
        correlationId,
      })
    }
    return json(413, { error: 'provider_response_too_large', rawResponseId, correlationId })
  }

  try {
    const parsed: unknown = JSON.parse(rawBody)
    const fixtures = decodeProviderPayload(poll.provider, parsed)
    await rpcUuid(supabaseUrl, secretKey, 'record_provider_response_processing', {
      p_raw_response_id: rawResponseId,
      p_decoder_version: DECODER_VERSION,
      p_succeeded: true,
      p_decoded_fixture_count: fixtures.length,
      p_normalized_payload: fixtures,
    })
    return json(200, {
      rawResponseId,
      correlationId,
      fixtureCount: fixtures.length,
      fixtures,
    })
  } catch (error) {
    const errorCode = error instanceof ProviderDecodeError
      ? 'provider_contract_mismatch'
      : 'invalid_json'
    try {
      await recordFailure(
        supabaseUrl,
        secretKey,
        rawResponseId,
        errorCode,
        error instanceof Error ? error.message : String(error),
      )
    } catch (recordError) {
      return json(500, {
        error: 'processing_record_failed',
        detail: recordError instanceof Error ? recordError.message : String(recordError),
        rawResponseId,
        correlationId,
      })
    }
    return json(422, { error: errorCode, rawResponseId, correlationId })
  }
})
