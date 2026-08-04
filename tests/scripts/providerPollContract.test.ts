import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const edgeSource = readFileSync('supabase/functions/provider-poll/index.ts', 'utf8')
const migrationSource = readFileSync(
  'supabase/migrations/20260804123000_provider_ingestion_custody.sql',
  'utf8',
)
const supabaseConfig = readFileSync('supabase/config.toml', 'utf8')

describe('provider poll contract', () => {
  it('uses named secret-key authentication before any provider fetch', () => {
    const authorization = edgeSource.indexOf('if (!authorized(request, secretKey))')
    const providerFetch = edgeSource.indexOf('providerResponse = await fetch(target')
    expect(authorization).toBeGreaterThan(-1)
    expect(providerFetch).toBeGreaterThan(authorization)
    expect(edgeSource).toContain("request.headers.get('apikey')")
    expect(edgeSource).toContain("const CALLER_KEY_NAME = 'provider-poll'")
    expect(edgeSource).toContain("Deno.env.get('SUPABASE_SECRET_KEYS')")
    expect(edgeSource).not.toContain("request.headers.get('authorization')")
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
    const statements = migrationSource
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
