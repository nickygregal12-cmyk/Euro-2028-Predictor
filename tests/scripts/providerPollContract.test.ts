import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const edgeSource = readFileSync('supabase/functions/provider-poll/index.ts', 'utf8')
const migrationSource = readFileSync(
  'supabase/migrations/20260803173000_provider_ingestion_custody.sql',
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

  it('archives exact response text before size judgment, JSON parsing or decoding', () => {
    const readText = edgeSource.indexOf('const rawBody = await providerResponse.text()')
    const archive = edgeSource.indexOf("'archive_provider_response'")
    const size = edgeSource.indexOf('const responseBytes =')
    const parse = edgeSource.indexOf('JSON.parse(rawBody)')
    const decode = edgeSource.indexOf('decodeProviderPayload(poll.provider, parsed)')
    expect(readText).toBeGreaterThan(-1)
    expect(archive).toBeGreaterThan(readText)
    expect(size).toBeGreaterThan(archive)
    expect(parse).toBeGreaterThan(size)
    expect(decode).toBeGreaterThan(parse)
  })

  it('never accepts an absolute, fragment or parent-traversing provider path', () => {
    expect(edgeSource).toContain("path.startsWith('//')")
    expect(edgeSource).toContain("path.includes('..')")
    expect(edgeSource).toContain("path.includes('://')")
    expect(edgeSource).toContain("path.includes('#')")
    expect(edgeSource).toContain("target.origin !== base.origin")
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
        /\b(public\.)?(matches|match_result_revisions|score_events|entry_totals|rank_history)\b/,
      )
    }
  })
})
