import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const edgeSource = readFileSync('supabase/functions/provider-poll/index.ts', 'utf8')
/**
 * The authorisation rule moved out of `index.ts` so it could be executed by a
 * test rather than only read as text — `tests/ingestion/providerPollAuthorization.test.ts`.
 * The assertions below follow it, and the negative ones now span BOTH files:
 * with the rule in two places, checking only `index.ts` would let a future
 * change move a forbidden header read into the sibling and evade the guard.
 */
const authorizationSource = readFileSync(
  'supabase/functions/provider-poll/authorization.ts',
  'utf8',
)
const migrationSource = readFileSync(
  'supabase/migrations/20260804253000_provider_ingestion_custody.sql',
  'utf8',
)
const supabaseConfig = readFileSync('supabase/config.toml', 'utf8')
const aiMigrationSource = readFileSync(
  'supabase/migrations/20260812070000_ai_lab_operational_loop.sql',
  'utf8',
)

describe('provider poll contract', () => {
  it('uses named secret-key authentication before any provider fetch', () => {
    const authorization = edgeSource.indexOf('if (!authorized(request, secretKey))')
    const providerFetch = edgeSource.indexOf('providerResponse = await fetch(fetchTarget')
    expect(authorization).toBeGreaterThan(-1)
    expect(providerFetch).toBeGreaterThan(authorization)
    // The rule itself lives in the sibling module, and `index.ts` must still be
    // the thing that applies it — an extracted rule nothing imports is worse than
    // an inline one, because it reads as covered.
    expect(edgeSource).toContain("import { authorized } from './authorization.ts'")
    expect(authorizationSource).toContain("request.headers.get('apikey')")
    expect(authorizationSource).toContain('export function authorized(')
    // Underscore, and deliberately NOT the function slug: Supabase rejects a
    // hyphen in a secret key name, so a constant that reuses the slug resolves
    // to nothing and the function answers 500 rather than 401. Pinned here
    // because the two strings differ by one character and read the same.
    expect(edgeSource).toContain("const CALLER_KEY_NAME = 'provider_poll'")
    expect(edgeSource).not.toContain("const CALLER_KEY_NAME = 'provider-poll'")
    expect(edgeSource).toContain("Deno.env.get('SUPABASE_SECRET_KEYS')")
    expect(edgeSource).toContain("Deno.env.get('AI_ODDS_POLL')")
    // Neither file may authenticate off the bearer header: `verify_jwt = false`
    // below means anything arriving there is unverified, and the named secret key
    // is the whole of the rule.
    expect(edgeSource).not.toContain("request.headers.get('authorization')")
    expect(authorizationSource).not.toContain("request.headers.get('authorization')")
    expect(supabaseConfig).toContain('[functions.provider-poll]')
    expect(supabaseConfig).toContain('verify_jwt = false')
  })

  it('allows the legacy key only for a declared disposable-local hostname', () => {
    expect(edgeSource).toContain('function localLegacyServiceKey()')
    expect(edgeSource).toContain("'127.0.0.1', 'localhost', 'kong', 'host.docker.internal'")
    expect(edgeSource).toContain('localHosts.has(hostname) ? legacyKey : null')
    expect(edgeSource).toContain('if (localLegacyKey) return localLegacyKey')
    expect(edgeSource).not.toMatch(
      /return requiredEnvironment\('SUPABASE_SERVICE_ROLE_KEY'\)/,
    )
  })

  it('uses provider-specific authentication headers without putting credentials in URLs', () => {
    expect(edgeSource).toContain('headers: (secret) => ({ Authorization: secret })')
    expect(edgeSource).not.toContain('Authorization: `Bearer ${secret}`')
    expect(edgeSource).toContain("headers: (secret) => ({ 'x-apisports-key': secret })")
    expect(edgeSource).toContain("headers: (secret) => ({ 'X-Auth-Token': secret })")
    expect(edgeSource).not.toContain('api_token=')
  })

  it('keeps the paid odds credential in the Edge Function and archives only a sanitized URL', () => {
    expect(edgeSource).toContain(
      "secretNames: ['ODDS_API', 'ODDS_API_KEY', 'THE_ODDS_API_KEY']",
    )
    expect(edgeSource).toContain("queryCredential: 'apiKey'")
    expect(edgeSource).toContain('const archivedTarget = target.toString()')
    expect(edgeSource).toContain('fetchTarget.searchParams.set(config.queryCredential, providerSecret)')
    expect(edgeSource).toContain('p_request_url: archivedTarget')
    expect(edgeSource).not.toContain('p_request_url: fetchTarget')
    expect(aiMigrationSource).toContain("request_url !~* '([?&])(api[_-]?key|apikey|token|authorization)='")
    expect(edgeSource).not.toContain('detail: error instanceof Error ? error.message')
    expect(edgeSource).not.toContain('detail: recordError instanceof Error ? recordError.message')
    expect(edgeSource).toContain('caught provider text must never be')
  })

  it('routes odds into a separate custody path and installs disabled collection', () => {
    expect(edgeSource).toContain("poll.provider === 'the-odds-api'")
    expect(edgeSource).toContain("'record_ai_odds_snapshot'")
    expect(aiMigrationSource).toContain('create table if not exists ai.odds_api_raw_responses')
    expect(aiMigrationSource).toContain('collection_enabled boolean not null default false')
    expect(aiMigrationSource).toContain('public.ai_odds_budget_check(10)')
    expect(aiMigrationSource).toContain('/sports/soccer_england_league2/odds')
    expect(aiMigrationSource).not.toContain("update public.season_fixtures")
  })

  it('rejects credential-shaped query parameters instead of silently rewriting them', () => {
    expect(edgeSource).toContain('const FORBIDDEN_CREDENTIAL_PARAMETERS')
    expect(edgeSource).toContain('FORBIDDEN_CREDENTIAL_PARAMETERS.has(parameter.toLowerCase())')
    expect(edgeSource).toContain(
      "throw new Error('provider credentials must be supplied only through headers')",
    )
    expect(edgeSource).not.toMatch(/searchParams\.delete\s*\(/)
  })

  it('bounds the complete response read before archival, parsing or decoding', () => {
    const boundedRead = edgeSource.indexOf('await readBoundedResponseText(')
    const archive = edgeSource.indexOf("'archive_provider_response'")
    const processingSize = edgeSource.indexOf(
      'if (responseBytes > PROCESSING_MAX_RESPONSE_BYTES)',
    )
    const parse = edgeSource.indexOf('JSON.parse(rawBody)')
    const decode = edgeSource.indexOf('decodeProviderPayload(poll.provider, parsed)')
    expect(boundedRead).toBeGreaterThan(-1)
    expect(archive).toBeGreaterThan(boundedRead)
    expect(processingSize).toBeGreaterThan(archive)
    expect(parse).toBeGreaterThan(processingSize)
    expect(decode).toBeGreaterThan(parse)
    expect(edgeSource).toContain('ARCHIVE_MAX_RESPONSE_BYTES = 12 * 1024 * 1024')
    expect(edgeSource).toContain("reader.cancel('provider response exceeded archive limit')")
    expect(edgeSource).not.toContain('providerResponse.text()')
  })

  it('never accepts an absolute, fragment or parent-traversing provider path', () => {
    expect(edgeSource).toContain("path.startsWith('//')")
    expect(edgeSource).toContain("path.includes('..')")
    expect(edgeSource).toContain("path.includes('://')")
    expect(edgeSource).toContain("path.includes('#')")
    expect(edgeSource).toContain('target.origin !== base.origin')
    expect(edgeSource).toContain("redirect: 'error'")
    expect(edgeSource).toContain('AbortSignal.timeout(20_000)')
  })

  it('keeps raw custody and processing evidence in the unexposed internal schema', () => {
    expect(migrationSource).toContain('-- Contract 97: server-only provider response custody')
    expect(migrationSource).toContain(
      'create table predictor_internal.provider_raw_responses',
    )
    expect(migrationSource).toContain(
      'create table predictor_internal.provider_response_processing',
    )
    expect(migrationSource).not.toContain(
      'create table public.provider_raw_responses',
    )
    expect(migrationSource).toContain('provider_raw_responses_append_only')
    expect(migrationSource).toContain('provider_response_processing_append_only')
    expect(migrationSource).toContain('enable row level security')
    expect(migrationSource).toContain('provider_raw_responses_provider_origin')
    expect(migrationSource).toContain('provider_raw_responses_body_bound')
  })

  it('grants both public custody RPCs only to the service role', () => {
    expect(migrationSource).toContain(
      'grant execute on function public.archive_provider_response',
    )
    expect(migrationSource).toContain(
      'grant execute on function public.record_provider_response_processing',
    )
    expect(migrationSource).not.toMatch(/grant execute[^;]+to (?:anon|authenticated)/i)
    expect(migrationSource).not.toContain('request.jwt.claim.role')
  })

  it('does not create an authority path into fixtures, results or scoring', () => {
    const executableMigrationSource = migrationSource.replace(/--[^\n]*/g, '')
    const statements = executableMigrationSource
      .split(';')
      .map((statement) => statement.toLowerCase())
      .filter((statement) => /\b(insert|update|delete)\b/.test(statement))

    for (const statement of statements) {
      expect(statement).not.toMatch(
        /\b(public\.)?(matches|season_fixtures|match_result_revisions|score_events|entry_totals|rank_history)\b/,
      )
    }
  })
})
