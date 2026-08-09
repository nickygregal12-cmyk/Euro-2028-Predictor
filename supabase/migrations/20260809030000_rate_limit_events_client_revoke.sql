-- Contract 134 — `rate_limit_events` holds no browser privilege.
--
-- Additive, idempotent, privileges only. No column, index, policy, function,
-- trigger, threshold or rule moves.
--
-- WHAT WAS WRONG. `20260720210000_rate_limits.sql` creates the table under the
-- comment "No client access at all — only the definer function below
-- reads/writes it", enables row-level security, and then revokes nothing.
-- Supabase's default privileges in `public` grant every ordinary privilege on a
-- newly created table to `anon` and `authenticated`, so measured in both hosted
-- environments both browser roles hold `select`, `insert`, `update`, `delete`,
-- `truncate`, `references` and `trigger` on a table whose own migration says
-- they have nothing. Risk register `DB-005`.
--
-- WHY IT IS NOT AN EXPLOIT TODAY, AND WHY IT STILL MATTERS. Row-level security
-- is enabled with no policy, so a browser role currently sees no row and can
-- mutate none: the table is denied by one control where its design intended
-- two. The failure this closes is the next migration — one that disables RLS
-- while investigating something, or adds a single broad policy — landing on a
-- table that already grants every operation. Every other table in this
-- repository written for server-only access carries this revoke (see
-- `20260803193000_season_fixtures.sql`, `20260805080000_provider_entity_map.sql`
-- and the `predictor_internal` tables); this one was the outlier.
--
-- WHY THE LIMITER IS UNAFFECTED. `enforce_rate_limit` is `security definer`, so
-- it reads and writes the table as its owner rather than as the caller, and the
-- two `before` triggers reach it the same way. `187_rate_limit_events_client_revoke.sql`
-- drives an actual rate-limited write to the ceiling after the revoke rather
-- than reasoning about it.
--
-- WHAT IS DELIBERATELY NOT CHANGED. `service_role` keeps its privileges. It is
-- not a browser role, `DB-005` does not name it, and narrowing the server key's
-- reach across the schema is a separate decision with its own evidence rather
-- than a side effect of this fix.

begin;

revoke all on table public.rate_limit_events from anon, authenticated;

-- `rate_limit_events.id` is this repository's only `generated always as
-- identity` column, so its sequence is the only one Supabase's default sequence
-- privileges reach on a table meant to have no client access. An identity
-- column advances its own sequence through PostgreSQL's internal `nextval`,
-- which performs no ACL check, so this cannot take the insert inside
-- `enforce_rate_limit` away — the pgTAP file proves that by exercising it. The
-- sequence is resolved rather than named because its generated name belongs to
-- PostgreSQL, not to this migration.
do $$
declare
  v_sequence regclass := pg_get_serial_sequence('public.rate_limit_events', 'id');
begin
  if v_sequence is null then
    raise exception
      'rate_limit_events.id no longer owns a sequence; revisit this revoke rather than skipping it';
  end if;

  execute format('revoke all on sequence %s from anon, authenticated', v_sequence);
end;
$$;

commit;
