begin;

-- Contract 97: server-only provider response custody and decoder evidence.
-- Committing this migration does not deploy it, call a provider or authorize a
-- hosted write. Raw provider data remains evidence only and cannot update
-- tournament matches, season fixtures, results, locks, scores or standings.

create table predictor_internal.provider_raw_responses (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  request_url text not null,
  request_method text not null default 'GET',
  response_status integer not null,
  response_headers jsonb not null default '{}'::jsonb,
  raw_body text not null,
  raw_body_sha256 text generated always as (
    pg_catalog.encode(extensions.digest(raw_body, 'sha256'), 'hex')
  ) stored,
  fetched_at timestamptz not null default clock_timestamp(),
  correlation_id uuid not null default gen_random_uuid(),
  constraint provider_raw_responses_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),
  constraint provider_raw_responses_request_method_allowed
    check (request_method = 'GET'),
  constraint provider_raw_responses_response_status_range
    check (response_status between 100 and 599),
  constraint provider_raw_responses_url_bound
    check (octet_length(request_url) between 1 and 4096),
  constraint provider_raw_responses_url_has_no_credentials
    check (
      request_url !~* '([?&])(api_token|api_key|apikey|token|key|authorization|x-auth-token|x-apisports-key)='
    ),
  constraint provider_raw_responses_headers_object
    check (
      jsonb_typeof(response_headers) = 'object'
      and pg_column_size(response_headers) <= 65536
      and (
        response_headers - array[
          'content-type',
          'content-length',
          'date',
          'etag',
          'last-modified',
          'x-ratelimit-limit',
          'x-ratelimit-remaining',
          'x-ratelimit-reset'
        ]::text[]
      ) = '{}'::jsonb
    ),
  constraint provider_raw_responses_body_bound
    check (octet_length(raw_body) <= 12582912),
  constraint provider_raw_responses_provider_origin
    check (
      (provider = 'sportmonks'
        and request_url like 'https://api.sportmonks.com/v3/football/%')
      or (provider = 'api-football'
        and request_url like 'https://v3.football.api-sports.io/%')
      or (provider = 'football-data'
        and request_url like 'https://api.football-data.org/v4/%')
    ),
  constraint provider_raw_responses_correlation_key unique (correlation_id)
);

comment on table predictor_internal.provider_raw_responses is
  'Private immutable custody record of the exact text returned by an approved football provider endpoint.';

create index provider_raw_responses_provider_fetched_idx
  on predictor_internal.provider_raw_responses (provider, fetched_at desc, id);

create table predictor_internal.provider_response_processing (
  id uuid primary key default gen_random_uuid(),
  raw_response_id uuid not null
    references predictor_internal.provider_raw_responses(id) on delete restrict,
  decoder_version text not null,
  succeeded boolean not null,
  decoded_fixture_count integer,
  normalized_payload jsonb,
  error_code text,
  error_detail text,
  processed_at timestamptz not null default clock_timestamp(),
  constraint provider_response_processing_decoder_version
    check (char_length(btrim(decoder_version)) between 1 and 120),
  constraint provider_response_processing_count
    check (decoded_fixture_count is null or decoded_fixture_count >= 0),
  constraint provider_response_processing_error_code
    check (error_code is null or char_length(btrim(error_code)) between 1 and 120),
  constraint provider_response_processing_error_detail
    check (error_detail is null or char_length(error_detail) <= 4000),
  constraint provider_response_processing_outcome
    check (
      (
        succeeded
        and decoded_fixture_count is not null
        and normalized_payload is not null
        and jsonb_typeof(normalized_payload) = 'array'
        and decoded_fixture_count = jsonb_array_length(normalized_payload)
        and error_code is null
        and error_detail is null
      )
      or
      (
        not succeeded
        and decoded_fixture_count is null
        and normalized_payload is null
        and error_code is not null
      )
    )
);

comment on table predictor_internal.provider_response_processing is
  'Append-only decoder-attempt evidence. Retries add rows and never rewrite the raw response or an earlier attempt.';

create index provider_response_processing_raw_idx
  on predictor_internal.provider_response_processing (
    raw_response_id,
    processed_at desc,
    id
  );

alter table predictor_internal.provider_raw_responses enable row level security;
alter table predictor_internal.provider_response_processing enable row level security;

revoke all on table predictor_internal.provider_raw_responses
  from public, anon, authenticated, service_role;
revoke all on table predictor_internal.provider_response_processing
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.reject_provider_custody_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

revoke all on function predictor_internal.reject_provider_custody_mutation()
  from public, anon, authenticated, service_role;

create trigger provider_raw_responses_append_only
before update or delete on predictor_internal.provider_raw_responses
for each row execute function predictor_internal.reject_provider_custody_mutation();

create trigger provider_response_processing_append_only
before update or delete on predictor_internal.provider_response_processing
for each row execute function predictor_internal.reject_provider_custody_mutation();

create or replace function public.archive_provider_response(
  p_provider text,
  p_request_url text,
  p_request_method text,
  p_response_status integer,
  p_response_headers jsonb,
  p_raw_body text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into predictor_internal.provider_raw_responses (
    provider,
    request_url,
    request_method,
    response_status,
    response_headers,
    raw_body,
    correlation_id
  ) values (
    p_provider,
    p_request_url,
    upper(p_request_method),
    p_response_status,
    coalesce(p_response_headers, '{}'::jsonb),
    p_raw_body,
    p_correlation_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.record_provider_response_processing(
  p_raw_response_id uuid,
  p_decoder_version text,
  p_succeeded boolean,
  p_decoded_fixture_count integer default null,
  p_normalized_payload jsonb default null,
  p_error_code text default null,
  p_error_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into predictor_internal.provider_response_processing (
    raw_response_id,
    decoder_version,
    succeeded,
    decoded_fixture_count,
    normalized_payload,
    error_code,
    error_detail
  ) values (
    p_raw_response_id,
    btrim(p_decoder_version),
    p_succeeded,
    p_decoded_fixture_count,
    p_normalized_payload,
    nullif(btrim(coalesce(p_error_code, '')), ''),
    left(p_error_detail, 4000)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.archive_provider_response(
  text,text,text,integer,jsonb,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.record_provider_response_processing(
  uuid,text,boolean,integer,jsonb,text,text
) from public, anon, authenticated, service_role;

grant execute on function public.archive_provider_response(
  text,text,text,integer,jsonb,text,uuid
) to service_role;
grant execute on function public.record_provider_response_processing(
  uuid,text,boolean,integer,jsonb,text,text
) to service_role;

commit;
