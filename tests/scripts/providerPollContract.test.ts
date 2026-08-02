import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/provider-poll/index.ts', 'utf8');
const migrationSource = readFileSync(
  'supabase/migrations/20260802113000_provider_response_archive.sql',
  'utf8',
);

describe('provider poll contract', () => {
  it('rejects requests before any provider fetch unless the service-role bearer matches', () => {
    const authorization = edgeSource.indexOf("if (!authorized(request, serviceRoleKey))");
    const providerFetch = edgeSource.indexOf('providerResponse = await fetch(providerUrl');
    expect(authorization).toBeGreaterThan(-1);
    expect(providerFetch).toBeGreaterThan(authorization);
    expect(edgeSource).toContain("return json(401, { error: 'unauthorized' })");
  });

  it('archives the exact text before JSON parsing or provider decoding', () => {
    const readText = edgeSource.indexOf('const rawBody = await providerResponse.text()');
    const archive = edgeSource.indexOf("'archive_provider_response'");
    const parse = edgeSource.indexOf('JSON.parse(rawBody)');
    const decode = edgeSource.indexOf('decodeProviderPayload(poll.provider, parsed)');
    expect(readText).toBeGreaterThan(-1);
    expect(archive).toBeGreaterThan(readText);
    expect(parse).toBeGreaterThan(archive);
    expect(decode).toBeGreaterThan(parse);
  });

  it('never accepts an absolute or parent-traversing provider path', () => {
    expect(edgeSource).toContain("path.startsWith('//')");
    expect(edgeSource).toContain("path.includes('..')");
    expect(edgeSource).toContain("path.includes('://')");
    expect(edgeSource).toContain("redirect: 'error'");
  });

  it('keeps raw custody and processing evidence append-only and browser-private', () => {
    expect(migrationSource).toContain('provider_raw_responses_append_only');
    expect(migrationSource).toContain('provider_response_processing_append_only');
    expect(migrationSource).toContain('force row level security');
    expect(migrationSource).toContain(
      'revoke all on table public.provider_raw_responses from public, anon, authenticated',
    );
    expect(migrationSource).toContain(
      'revoke all on table public.provider_response_processing from public, anon, authenticated',
    );
  });

  it('grants both write RPCs only to the service role', () => {
    expect(migrationSource).toContain('perform predictor_internal.require_service_role()');
    expect(migrationSource).toContain(
      'grant execute on function public.archive_provider_response',
    );
    expect(migrationSource).toContain(
      'grant execute on function public.record_provider_response_processing',
    );
    expect(migrationSource).not.toMatch(/grant execute[^;]+to (?:anon|authenticated)/i);
  });
});
