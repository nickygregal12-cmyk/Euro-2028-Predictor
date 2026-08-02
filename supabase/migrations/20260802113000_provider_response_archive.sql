-- Contract 66: server-only provider response custody and processing evidence.
-- No hosted target is changed by committing this migration.

create or replace function predictor_internal.require_service_role()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
begin
  if v_role is distinct from 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function predictor_internal.require_service_role() from public;

create table public.provider_raw_responses (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  request_url text not null,
  request_method text not null default 'GET',
  response_status integer not null,
  response_headers jsonb not null default '{}'::jsonb,
  raw_body text not null,
  raw_body_sha256 text generated always as (encode(digest(convert_to(raw_body, 'UTF8'), 'sha256'), 'hex')) stored,
  fetched_at timestamptz not null default clock_timestamp(),
  correlation_id uuid not null default gen_random_uuid(),
  constraint provider_raw_responses_provider
    check (provider in ('sportmonks', 'api-football', 'football-data')),
  constraint provider_raw_responses_request_method
    check (request_method in ('GET', 'POST')),
  constraint provider_raw_responses_response_status
    check (response_status between 100 and 599),
  constraint provider_raw_responses_request_url
    check (char_length(request_url) between 1 and 2048)
);

comment on table public.provider_raw_responses is
  'Private immutable custody record of exact provider response bodies. Inserted only through archive_provider_response by the service role.';

create table public.provider_response_processing (
  id uuid primary key default gen_random_uuid(),
  raw_response_id uuid not null references public.provider_raw_responses(id) on delete restrict,
  decoder_version text not null,
  succeeded boolean not null,
  decoded_fixture_count integer,
  normalized_payload jsonb,
  error_code text,
  error_detail text,
  processed_at timestamptz not null default clock_timestamp(),
  constraint provider_response_processing_count
    check (decoded_fixture_count is null or decoded_fixture_count >= 0),
  constraint provider_response_processing_outcome
    check (
      (succeeded and decoded_fixture_count is not null and normalized_payload is not null and error_code is null and error_detail is null)
      or
      (not succeeded and decoded_fixture_count is null and normalized_payload is null and error_code is not null)
    )
);

comment on table public.provider_response_processing is
  'Append-only decoder attempt evidence. Failed attempts retain the raw response without mutating its custody record.';

create or replace function predictor_internal.reject_provider_archive_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

revoke all on function predictor_internal.reject_provider_archive_mutation() from public;

create trigger provider_raw_responses_append_only
before update or delete on public.provider_raw_responses
for each row execute function predictor_internal.reject_provider_archive_mutation();

create trigger provider_response_processing_append_only
before update or delete on public.provider_response_processing
for each row execute function predictor_internal.reject_provider_archive_mutation();

alter table public.provider_raw_responses enable row level security;
alter table public.provider_raw_responses force row level security;
alter table public.provider_response_processing enable row level security;
alter table public.provider_response_processing force row level security;

revoke all on table public.provider_raw_responses from public, anon, authenticated;
revoke all on table public.provider_response_processing from public, anon, authenticated;

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
  perform predictor_internal.require_service_role();

  insert into public.provider_raw_responses (
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
  perform predictor_internal.require_service_role();

  insert into public.provider_response_processing (
    raw_response_id,
    decoder_version,
    succeeded,
    decoded_fixture_count,
    normalized_payload,
    error_code,
    error_detail
  ) values (
    p_raw_response_id,
    p_decoder_version,
    p_succeeded,
    p_decoded_fixture_count,
    p_normalized_payload,
    p_error_code,
    p_error_detail
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.archive_provider_response(text,text,text,integer,jsonb,text,uuid) from public, anon, authenticated;
revoke all on function public.record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.archive_provider_response(text,text,text,integer,jsonb,text,uuid) to service_role;
grant execute on function public.record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text) to service_role;
