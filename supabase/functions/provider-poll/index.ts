import {
  decodeProviderPayload,
  ProviderDecodeError,
  type ProviderName,
} from './providerDecoders.ts';

const DECODER_VERSION = 'contract-66-v1';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

type PollRequest = {
  provider: ProviderName;
  path: string;
};

type ProviderConfig = {
  baseUrl: string;
  headers: (secret: string) => Record<string, string>;
  secretName: string;
};

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  sportmonks: {
    baseUrl: 'https://api.sportmonks.com/v3/football',
    secretName: 'SPORTMONKS_API_TOKEN',
    headers: (secret) => ({ Authorization: `Bearer ${secret}` }),
  },
  'api-football': {
    baseUrl: 'https://v3.football.api-sports.io',
    secretName: 'API_FOOTBALL_API_KEY',
    headers: (secret) => ({ 'x-apisports-key': secret }),
  },
  'football-data': {
    baseUrl: 'https://api.football-data.org/v4',
    secretName: 'FOOTBALL_DATA_API_KEY',
    headers: (secret) => ({ 'X-Auth-Token': secret }),
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function environment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required Edge Function secret: ${name}`);
  return value;
}

function authorized(request: Request, serviceRoleKey: string): boolean {
  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${serviceRoleKey}`;
}

function parseRequest(value: unknown): PollRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Request body must be an object.');
  }
  const provider = (value as Record<string, unknown>).provider;
  const path = (value as Record<string, unknown>).path;
  if (provider !== 'sportmonks' && provider !== 'api-football' && provider !== 'football-data') {
    throw new Error('provider must be sportmonks, api-football, or football-data.');
  }
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('..') ||
    path.includes('://') ||
    path.length > 1024
  ) {
    throw new Error('path must be a bounded provider-relative path.');
  }
  return { provider, path };
}

function responseHeaders(response: Response): Record<string, string> {
  const retained = ['content-type', 'content-length', 'date', 'etag', 'last-modified', 'x-ratelimit-remaining'];
  return Object.fromEntries(
    retained.flatMap((name) => {
      const value = response.headers.get(name);
      return value === null ? [] : [[name, value]];
    }),
  );
}

async function rpc<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${functionName} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const serviceRoleKey = environment('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorized(request, serviceRoleKey)) return json(401, { error: 'unauthorized' });

  let poll: PollRequest;
  try {
    poll = parseRequest(await request.json());
  } catch (error) {
    return json(400, { error: 'invalid_request', detail: error instanceof Error ? error.message : String(error) });
  }

  const supabaseUrl = environment('SUPABASE_URL');
  const config = PROVIDERS[poll.provider];
  const providerSecret = environment(config.secretName);
  const providerUrl = new URL(`${config.baseUrl}${poll.path}`);
  const correlationId = crypto.randomUUID();

  let providerResponse: Response;
  try {
    providerResponse = await fetch(providerUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...config.headers(providerSecret),
      },
      redirect: 'error',
    });
  } catch (error) {
    return json(502, {
      error: 'provider_transport_failed',
      detail: error instanceof Error ? error.message : String(error),
      correlationId,
    });
  }

  // Read and archive the exact response text before JSON parsing or provider decoding.
  const rawBody = await providerResponse.text();
  let rawResponseId: string;
  try {
    rawResponseId = await rpc<string>(supabaseUrl, serviceRoleKey, 'archive_provider_response', {
      p_provider: poll.provider,
      p_request_url: providerUrl.toString(),
      p_request_method: 'GET',
      p_response_status: providerResponse.status,
      p_response_headers: responseHeaders(providerResponse),
      p_raw_body: rawBody,
      p_correlation_id: correlationId,
    });
  } catch (error) {
    return json(500, {
      error: 'archive_failed',
      detail: error instanceof Error ? error.message : String(error),
      correlationId,
    });
  }

  if (!providerResponse.ok) {
    await rpc<string>(supabaseUrl, serviceRoleKey, 'record_provider_response_processing', {
      p_raw_response_id: rawResponseId,
      p_decoder_version: DECODER_VERSION,
      p_succeeded: false,
      p_error_code: 'provider_http_error',
      p_error_detail: `Provider returned HTTP ${providerResponse.status}`,
    });
    return json(502, { error: 'provider_http_error', status: providerResponse.status, rawResponseId, correlationId });
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);
    const fixtures = decodeProviderPayload(poll.provider, parsed);
    await rpc<string>(supabaseUrl, serviceRoleKey, 'record_provider_response_processing', {
      p_raw_response_id: rawResponseId,
      p_decoder_version: DECODER_VERSION,
      p_succeeded: true,
      p_decoded_fixture_count: fixtures.length,
      p_normalized_payload: fixtures,
    });
    return json(200, { rawResponseId, correlationId, fixtureCount: fixtures.length, fixtures });
  } catch (error) {
    const code = error instanceof ProviderDecodeError ? 'provider_contract_mismatch' : 'invalid_json';
    await rpc<string>(supabaseUrl, serviceRoleKey, 'record_provider_response_processing', {
      p_raw_response_id: rawResponseId,
      p_decoder_version: DECODER_VERSION,
      p_succeeded: false,
      p_error_code: code,
      p_error_detail: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
    });
    return json(422, { error: code, rawResponseId, correlationId });
  }
});
