import { authorized } from './authorization.ts'
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
const ODDS_DECODER_VERSION = 'contract-185-v1'
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
  provider: ProviderName | 'the-odds-api'
  path: string
}

type ProviderConfig = {
  baseUrl: string
  headers: (secret: string) => Record<string, string>
  secretNames: string[]
  queryCredential?: string
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

const PROVIDERS: Record<PollRequest['provider'], ProviderConfig> = {
  sportmonks: {
    baseUrl: 'https://api.sportmonks.com/v3/football/',
    secretNames: ['SPORTMONKS_API_TOKEN'],
    headers: (secret) => ({ Authorization: secret }),
  },
  'api-football': {
    baseUrl: 'https://v3.football.api-sports.io/',
    secretNames: ['API_FOOTBALL_API_KEY'],
    headers: (secret) => ({ 'x-apisports-key': secret }),
  },
  'football-data': {
    baseUrl: 'https://api.football-data.org/v4/',
    secretNames: ['FOOTBALL_DATA_API_KEY'],
    headers: (secret) => ({ 'X-Auth-Token': secret }),
  },
  'the-odds-api': {
    baseUrl: 'https://api.the-odds-api.com/v4/',
    // ODDS_API is the hosted project name. Keep the scaffold's older aliases
    // so local/dev deployments remain compatible. The value is never returned,
    // archived or logged.
    secretNames: ['ODDS_API', 'ODDS_API_KEY', 'THE_ODDS_API_KEY'],
    headers: () => ({}),
    queryCredential: 'apiKey',
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

function requiredEnvironmentAny(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  throw new Error(`Missing required Edge Function secret: ${names.join(' or ')}`)
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

  // A dedicated Edge Function secret is easier to rotate than the shared JSON
  // map. The database caller must hold the same value in Vault under
  // provider_poll_caller_key; neither value is returned or logged.
  const dedicatedCallerKey = Deno.env.get('AI_ODDS_POLL')
  if (dedicatedCallerKey) return dedicatedCallerKey

  const localLegacyKey = localLegacyServiceKey()
  if (localLegacyKey) return localLegacyKey
  throw new Error(`Missing named Supabase secret key: ${CALLER_KEY_NAME}`)
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
    && provider !== 'the-odds-api'
  ) {
    throw new Error(
      'provider must be sportmonks, api-football, football-data, or the-odds-api',
    )
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
    'x-requests-last',
    'x-requests-remaining',
    'x-requests-used',
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

async function rpcJson(
  supabaseUrl: string,
  secretKey: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: { apikey: secretKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${functionName} failed (${response.status}): ${text.slice(0, 500)}`)
  }
  return text === '' ? null : JSON.parse(text)
}

const ODDS_TEAM_ALIASES: Record<string, string> = {
  'AFC Bournemouth': 'Bournemouth',
  'Brighton and Hove Albion': 'Brighton',
  'Brighton & Hove Albion': 'Brighton',
  'Manchester City': 'Man City',
  'Manchester United': 'Man United',
  'Newcastle United': 'Newcastle',
  'Nottingham Forest': "Nott'm Forest",
  'Tottenham Hotspur': 'Tottenham',
  'Wolverhampton Wanderers': 'Wolves',
  'Heart of Midlothian': 'Hearts',
  'St. Johnstone': 'St Johnstone',
  'St. Mirren': 'St Mirren',
}

function canonicalOddsTeam(name: unknown): string {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Odds event has an invalid team name')
  }
  return ODDS_TEAM_ALIASES[name] ?? name.trim()
}

function parseOddsJson(raw: string): unknown {
  return JSON.parse(raw)
}

function flattenOddsPayload(payload: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(payload)) throw new Error('Odds payload must be an array')
  const rows: Array<Record<string, unknown>> = []
  const bookCodes: Record<string, string> = {
    pinnacle: 'PS', betfair_ex_uk: 'BFE', betfair_ex_eu: 'BFE',
    smarkets: 'SMK', matchbook: 'MTB',
  }
  for (const event of payload) {
    if (typeof event !== 'object' || event === null || Array.isArray(event)) {
      throw new Error('Odds event must be an object')
    }
    const ev = event as Record<string, unknown>
    const eventId = String(ev.id ?? '')
    const commenceTime = String(ev.commence_time ?? '')
    const homeTeam = String(ev.home_team ?? '')
    const awayTeam = String(ev.away_team ?? '')
    if (!eventId || !Number.isFinite(Date.parse(commenceTime))) {
      throw new Error('Odds event is missing an id or commence_time')
    }
    for (const rawBook of Array.isArray(ev.bookmakers) ? ev.bookmakers : []) {
      const book = rawBook as Record<string, unknown>
      const bookmaker = bookCodes[String(book.key ?? '')]
      if (!bookmaker) continue
      for (const rawMarket of Array.isArray(book.markets) ? book.markets : []) {
        const market = rawMarket as Record<string, unknown>
        const marketKey = String(market.key ?? '')
        if (marketKey !== 'h2h' && marketKey !== 'totals') continue
        for (const rawOutcome of Array.isArray(market.outcomes) ? market.outcomes : []) {
          const outcome = rawOutcome as Record<string, unknown>
          const price = Number(outcome.price)
          if (!Number.isFinite(price) || price <= 1) continue
          const name = String(outcome.name ?? '')
          const selection = marketKey === 'h2h'
            ? (name === homeTeam ? 'H' : name === awayTeam ? 'A' : name === 'Draw' ? 'D' : '')
            : name
          if (!selection) continue
          rows.push({
            event_id: eventId,
            sport_key: ev.sport_key,
            commence_time: commenceTime,
            home_team: homeTeam,
            away_team: awayTeam,
            home_canonical: canonicalOddsTeam(homeTeam),
            away_canonical: canonicalOddsTeam(awayTeam),
            bookmaker,
            market: marketKey === 'h2h' ? '1X2' : 'OU',
            line: outcome.point ?? null,
            selection,
            odds: price,
            captured_at: market.last_update ?? book.last_update ?? new Date().toISOString(),
          })
        }
      }
    }
  }
  return rows
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
    console.error('provider-poll configuration failed', error instanceof Error ? error.name : 'unknown')
    return json(500, {
      error: 'function_not_configured',
    })
  }
  if (!authorized(request, secretKey)) return json(401, { error: 'unauthorized' })

  let poll: PollRequest
  try {
    poll = parseRequest(await request.json())
  } catch {
    return json(400, {
      error: 'invalid_request',
    })
  }

  const config = PROVIDERS[poll.provider]
  let supabaseUrl: string
  let providerSecret: string
  try {
    supabaseUrl = requiredEnvironment('SUPABASE_URL')
    providerSecret = requiredEnvironmentAny(config.secretNames)
  } catch (error) {
    console.error('provider-poll provider configuration failed', error instanceof Error ? error.name : 'unknown')
    return json(500, {
      error: 'function_not_configured',
    })
  }

  let target: URL
  try {
    target = providerUrl(config, poll.path)
  } catch {
    return json(400, {
      error: 'invalid_request',
    })
  }
  const archivedTarget = target.toString()
  const fetchTarget = new URL(target)
  if (config.queryCredential) {
    fetchTarget.searchParams.set(config.queryCredential, providerSecret)
  }
  const correlationId = crypto.randomUUID()

  if (poll.provider === 'the-odds-api') {
    const requestedMarkets = target.searchParams.get('markets')?.split(',') ?? ['h2h']
    const estimatedCost = Math.max(1, requestedMarkets.length)
    try {
      const budget = await rpcJson(supabaseUrl, secretKey, 'ai_odds_budget_check', {
        p_estimated_cost: estimatedCost,
      }) as Record<string, unknown>
      if (budget?.allowed !== true) {
        return json(429, { error: 'odds_budget_exceeded', budget })
      }
    } catch (error) {
      console.error('provider-poll odds budget check failed', error instanceof Error ? error.name : 'unknown')
      return json(500, {
        error: 'odds_budget_check_failed',
      })
    }
  }

  let providerResponse: Response
  try {
    providerResponse = await fetch(fetchTarget, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...config.headers(providerSecret),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    // A transport error may include the full request URL. For The Odds API
    // that in-memory URL carries apiKey, so caught provider text must never be
    // returned or logged. correlationId is the only public diagnostic handle.
    return json(502, {
      error: 'provider_transport_failed',
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
    console.error('provider-poll body read failed', error instanceof Error ? error.name : 'unknown')
    return json(502, {
      error: 'provider_body_read_failed',
      correlationId,
    })
  }

  if (poll.provider === 'the-odds-api') {
    let normalized: Array<Record<string, unknown>> = []
    let decodeError: string | null = null
    if (providerResponse.ok) {
      try {
        normalized = flattenOddsPayload(parseOddsJson(rawBody))
      } catch (error) {
        decodeError = error instanceof Error ? error.message : String(error)
      }
    }
    try {
      const stored = await rpcJson(supabaseUrl, secretKey, 'record_ai_odds_snapshot', {
        p_request_url: archivedTarget,
        p_response_status: providerResponse.status,
        p_response_headers: responseHeaders(providerResponse),
        p_raw_body: rawBody,
        p_normalized_payload: normalized,
        p_estimated_cost: Math.max(
          1,
          target.searchParams.get('markets')?.split(',').length ?? 1,
        ),
        p_reported_cost: Number(providerResponse.headers.get('x-requests-last')) || null,
        p_reported_remaining:
          Number(providerResponse.headers.get('x-requests-remaining')) || null,
        p_reported_used: Number(providerResponse.headers.get('x-requests-used')) || null,
        p_decoder_version: ODDS_DECODER_VERSION,
        p_error_detail: decodeError,
      })
      if (!providerResponse.ok) {
        return json(502, {
          error: 'provider_http_error', status: providerResponse.status, stored, correlationId,
        })
      }
      if (decodeError) {
        return json(422, { error: 'provider_contract_mismatch', stored })
      }
      return json(200, { correlationId, rows: normalized.length, stored })
    } catch (error) {
      console.error('provider-poll odds archive failed', error instanceof Error ? error.name : 'unknown')
      return json(500, {
        error: 'odds_archive_failed',
        correlationId,
      })
    }
  }

  let rawResponseId: string
  try {
    rawResponseId = await rpcUuid(supabaseUrl, secretKey, 'archive_provider_response', {
      p_provider: poll.provider,
      p_request_url: archivedTarget,
      p_request_method: 'GET',
      p_response_status: providerResponse.status,
      p_response_headers: responseHeaders(providerResponse),
      p_raw_body: rawBody,
      p_correlation_id: correlationId,
    })
  } catch (error) {
    console.error('provider-poll archive failed', error instanceof Error ? error.name : 'unknown')
    return json(500, {
      error: 'archive_failed',
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
      console.error('provider-poll processing record failed', error instanceof Error ? error.name : 'unknown')
      return json(500, {
        error: 'processing_record_failed',
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
      console.error('provider-poll oversized response record failed', error instanceof Error ? error.name : 'unknown')
      return json(500, {
        error: 'processing_record_failed',
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
      console.error(
        'provider-poll decode failure record failed',
        recordError instanceof Error ? recordError.name : 'unknown',
      )
      return json(500, {
        error: 'processing_record_failed',
        rawResponseId,
        correlationId,
      })
    }
    return json(422, { error: errorCode, rawResponseId, correlationId })
  }
})
