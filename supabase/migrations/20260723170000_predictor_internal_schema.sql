-- Private home for server-side prediction parity helpers.
--
-- This migration deliberately does not expose a resolver yet. The first database
-- parity slice establishes a fail-closed namespace before the TypeScript contract
-- is translated into SQL.

create schema if not exists predictor_internal authorization postgres;

revoke all on schema predictor_internal from public;
revoke all on schema predictor_internal from anon;
revoke all on schema predictor_internal from authenticated;

comment on schema predictor_internal is
  'Private server-side prediction helpers. Never grant direct client-role access.';
