-- ---------------------------------------------------------------------------
-- Contract 146 — adaptive provider poll cadence, and date windows that move.
--
-- Two defects, measured on hosted Development on 10 August 2026, both of which
-- make the provider poll cost a great deal and deliver nothing.
--
-- FIRST: the cadence is a single number. The live Scottish Premiership target
-- carried `cadence_minutes = 5`, so it polled 288 times a day whether or not a
-- ball was kicked. Measured the same day, the next Scottish fixture was 22
-- August and the next Premier League fixture 21 August — eleven and twelve days
-- out. That is roughly 3,200 requests spent to be told, over and over, that
-- nothing had changed. On the free provider tier that is most of the budget,
-- and it buys nothing a single daily call would not.
--
-- SECOND: the date window is frozen into the stored path. That same target
-- asked for `/fixtures/between/2026-08-08/2026-08-09`, a range already in the
-- past. It could poll for the next month and never see the 22 August fixtures,
-- because the question it asks never moves. The expensive half and the useless
-- half were independent, which is why neither was obvious on its own.
--
-- The fix is one idea applied twice: the poll should describe WHAT it wants,
-- and let dispatch decide WHEN and OVER WHICH DAYS.
--
--   * `cadence_minutes` keeps its name and becomes the IDLE cadence — how often
--     to look when no match is near. One call a day is the intended setting and
--     is now the default for a new target.
--   * `live_cadence_minutes` applies only inside a live window, which opens
--     `live_lead_minutes` before a kickoff and closes `live_tail_minutes`
--     after it, and only while that fixture still has no result.
--   * `{{date:+N}}` in a path resolves at dispatch, in the competition's own
--     timezone, so the window rolls forward on its own.
--
-- The live window closing on "still has no result" is what makes this
-- self-limiting rather than merely cheaper. Contract 135 writes the official
-- result from a measured provider final status; the moment it does, that
-- fixture stops holding the window open. A match that finishes early stops
-- costing requests early, and a matchday with every result in goes quiet
-- without anyone deciding it should.
--
-- WHAT THIS DOES NOT DO. It moves no scoring, lock, settlement, progression or
-- reveal rule, and it writes no fixture, result or status — it only changes how
-- often we ask and which days we ask about. It records no target: the tables
-- stay empty and a poll still does nothing until an operator records one, which
-- is contract 115's boundary and is deliberately unchanged. It grants nothing
-- new to any browser role.
--
-- Cost, stated so it can be checked rather than trusted. With the defaults
-- below and a Saturday whose kickoffs run 11:30 to 19:00, the live window spans
-- about 09:45 hours, which is 58 requests at ten-minute spacing, plus one idle
-- call. A day with no fixtures costs exactly one request. Two league targets
-- therefore cost about 118 requests on a full matchday and 2 on a quiet one,
-- against a free tier measured in hundreds per hour.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The cadence columns.
--
-- Added rather than replaced. `cadence_minutes` already means "how often", is
-- already bounded 5..1440, and every existing row already has a sensible value
-- in it; renaming it would break the dispatcher for the length of a deploy and
-- gain nothing but a tidier name.
-- ---------------------------------------------------------------------------

alter table public.provider_poll_targets
  add column if not exists live_cadence_minutes integer not null default 10,
  add column if not exists live_lead_minutes integer not null default 15,
  add column if not exists live_tail_minutes integer not null default 120;

-- The cheap setting becomes the one you get by not choosing. A target recorded
-- without an opinion now polls once a day rather than failing to insert, and
-- the expensive cadence has to be asked for.
alter table public.provider_poll_targets
  alter column cadence_minutes set default 1440;

comment on column public.provider_poll_targets.cadence_minutes is
  'Idle cadence: how often to poll when no fixture is near. One call a day (1440) is the intended setting.';

comment on column public.provider_poll_targets.live_cadence_minutes is
  'Cadence inside a live window. Never slower than the idle cadence.';

comment on column public.provider_poll_targets.live_lead_minutes is
  'How long before a kickoff the live window opens.';

comment on column public.provider_poll_targets.live_tail_minutes is
  'How long after a kickoff the live window stays open, unless the result arrives first.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'provider_poll_targets_live_cadence_bounded'
  ) then
    alter table public.provider_poll_targets
      add constraint provider_poll_targets_live_cadence_bounded
      check (live_cadence_minutes between 5 and 1440);
  end if;

  -- A live cadence slower than the idle one is not a configuration, it is a
  -- typo: it would poll LESS often precisely when a match is on.
  if not exists (
    select 1 from pg_constraint
     where conname = 'provider_poll_targets_live_at_least_as_often'
  ) then
    alter table public.provider_poll_targets
      add constraint provider_poll_targets_live_at_least_as_often
      check (live_cadence_minutes <= cadence_minutes);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'provider_poll_targets_live_window_bounded'
  ) then
    alter table public.provider_poll_targets
      add constraint provider_poll_targets_live_window_bounded
      check (
        live_lead_minutes between 0 and 720
        and live_tail_minutes between 0 and 1440
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Date placeholders.
--
-- Deliberately the smallest grammar that solves the problem: `{{date:+N}}` and
-- `{{date:-N}}`, plus bare `{{date}}` for today. No format strings, no
-- arithmetic beyond whole days, no expressions. A path is a stored string that
-- becomes an outbound URL, so every additional thing it can say is another
-- thing that has to be proved safe.
--
-- Resolution happens in the competition's own timezone, because "today" for a
-- Scottish Premiership calendar means today in Britain, not today in UTC. At
-- 00:30 UTC in summer those are different days, and asking for the wrong one is
-- exactly the kind of error that shows up once and is never reproduced.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.resolve_provider_poll_path(
  p_path text,
  p_now timestamptz,
  p_timezone text
)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $resolve$
declare
  v_today date;
  v_resolved text := p_path;
  v_match text;
  v_offset integer;
begin
  if p_path is null or p_now is null then
    return p_path;
  end if;

  -- An unknown timezone is a configuration error, but it must not take the poll
  -- down: UTC is wrong by at most a day boundary, and silence is worse.
  begin
    v_today := (p_now at time zone coalesce(p_timezone, 'UTC'))::date;
  exception
    when others then
      v_today := (p_now at time zone 'UTC')::date;
  end;

  v_resolved := pg_catalog.replace(v_resolved, '{{date}}', pg_catalog.to_char(v_today, 'YYYY-MM-DD'));

  for v_match in
    select distinct m[1]
      from pg_catalog.regexp_matches(v_resolved, '\{\{date:([+-][0-9]{1,3})\}\}', 'g') m
  loop
    v_offset := v_match::integer;
    v_resolved := pg_catalog.replace(
      v_resolved,
      '{{date:' || v_match || '}}',
      pg_catalog.to_char(v_today + v_offset, 'YYYY-MM-DD')
    );
  end loop;

  return v_resolved;
end;
$resolve$;

revoke all on function predictor_internal.resolve_provider_poll_path(text, timestamptz, text)
  from public, anon, authenticated, service_role;

-- Any placeholder the resolver does not understand must be refused at write
-- time. Left in the path it would be sent verbatim to the provider, which
-- answers 404 for a URL containing braces — a failure that reads like an outage
-- rather than like the typo it is.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'provider_poll_targets_path_placeholders_known'
  ) then
    alter table public.provider_poll_targets
      add constraint provider_poll_targets_path_placeholders_known
      check (
        pg_catalog.regexp_replace(
          pg_catalog.replace(path, '{{date}}', ''),
          '\{\{date:[+-][0-9]{1,3}\}\}', '', 'g'
        ) not like '%{%'
        and pg_catalog.regexp_replace(
          pg_catalog.replace(path, '{{date}}', ''),
          '\{\{date:[+-][0-9]{1,3}\}\}', '', 'g'
        ) not like '%}%'
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Is a match near enough to matter?
--
-- Reads `season_fixtures` only. It never reads a prediction, an entry or a
-- score event: how often we talk to a provider is not allowed to depend on who
-- is playing our games.
--
-- `home_score is null` is the self-limiting half. Once contract 135 writes the
-- official result from a measured final status, that fixture stops holding the
-- window open, so a finished match stops costing requests without anyone
-- deciding that it should.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.provider_target_is_live(
  p_tournament_id uuid,
  p_now timestamptz,
  p_lead_minutes integer,
  p_tail_minutes integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $live$
  select exists (
    select 1
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.home_score is null
       and p_now >= fixture.kickoff_at - pg_catalog.make_interval(mins => p_lead_minutes)
       and p_now <= fixture.kickoff_at + pg_catalog.make_interval(mins => p_tail_minutes)
  );
$live$;

revoke all on function predictor_internal.provider_target_is_live(uuid, timestamptz, integer, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Which targets are due — now with the effective cadence and a resolved path.
--
-- The return shape is unchanged on purpose, so `dispatch_due_provider_polls`
-- needs no edit at all: it already sends whatever path this hands it. Putting
-- both decisions here keeps them provable without sending anything, which is
-- the property contract 115 separated this function out to get.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.due_provider_poll_targets(
  p_now timestamptz
)
returns table (target_id uuid, provider text, path text)
language sql
stable
security definer
set search_path = ''
as $due$
  select
    target.id,
    target.provider,
    predictor_internal.resolve_provider_poll_path(
      target.path, p_now, tournament.display_timezone
    )
    from public.provider_poll_targets target
    left join public.tournaments tournament
      on tournament.id = target.tournament_id
   where target.enabled
     and p_now is not null
     and (
       target.last_dispatched_at is null
       or target.last_dispatched_at <= p_now - pg_catalog.make_interval(
            mins => case
              when predictor_internal.provider_target_is_live(
                     target.tournament_id, p_now,
                     target.live_lead_minutes, target.live_tail_minutes
                   )
              then target.live_cadence_minutes
              else target.cadence_minutes
            end
          )
     )
   -- Longest-waiting first, so a target added late is not permanently starved
   -- behind one that polls often. The id tiebreak only makes the order
   -- deterministic; it expresses no priority.
   order by target.last_dispatched_at nulls first, target.id;
$due$;

revoke all on function predictor_internal.due_provider_poll_targets(timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_resolved text;
begin
  -- The placeholder grammar resolves, and resolves in the named timezone.
  v_resolved := predictor_internal.resolve_provider_poll_path(
    '/fixtures/between/{{date:+0}}/{{date:+8}}?filters=fixtureLeagues:501',
    timestamptz '2026-08-10T23:30:00Z',
    'Europe/London'
  );
  if v_resolved <> '/fixtures/between/2026-08-11/2026-08-19?filters=fixtureLeagues:501' then
    raise exception 'Date placeholders did not resolve in the competition timezone: %', v_resolved;
  end if;

  -- The same instant in UTC is the previous day, which is the whole reason the
  -- timezone is threaded through rather than assumed.
  v_resolved := predictor_internal.resolve_provider_poll_path(
    '/fixtures/between/{{date}}/{{date}}', timestamptz '2026-08-10T23:30:00Z', 'UTC'
  );
  if v_resolved <> '/fixtures/between/2026-08-10/2026-08-10' then
    raise exception 'UTC resolution is wrong: %', v_resolved;
  end if;

  -- A path with no placeholder is returned untouched, so existing targets keep
  -- working exactly as they did.
  if predictor_internal.resolve_provider_poll_path('/competitions/PL/matches', now(), 'UTC')
     <> '/competitions/PL/matches' then
    raise exception 'A literal path must resolve to itself';
  end if;

  -- Negative offsets, for a window that looks back over recently played days.
  if predictor_internal.resolve_provider_poll_path(
       '/x/{{date:-2}}', timestamptz '2026-08-10T12:00:00Z', 'UTC') <> '/x/2026-08-08' then
    raise exception 'Negative offsets must resolve';
  end if;

  -- The three constraints exist by name. Asserted directly rather than by
  -- attempting an insert: `provider_poll_targets.tournament_id` is NOT NULL, so
  -- a bad-value insert would raise a not-null violation first and the test
  -- would pass without the check constraint ever being consulted.
  for v_resolved in
    select unnest(array[
      'provider_poll_targets_live_cadence_bounded',
      'provider_poll_targets_live_at_least_as_often',
      'provider_poll_targets_live_window_bounded',
      'provider_poll_targets_path_placeholders_known'
    ])
  loop
    if not exists (select 1 from pg_constraint where conname = v_resolved) then
      raise exception 'Missing constraint %', v_resolved;
    end if;
  end loop;

  -- And the placeholder check actually rejects an unknown placeholder while
  -- accepting the known ones, evaluated as the constraint evaluates it.
  if pg_catalog.regexp_replace(
       pg_catalog.replace('/fixtures/{{season}}', '{{date}}', ''),
       '\{\{date:[+-][0-9]{1,3}\}\}', '', 'g') not like '%{%' then
    raise exception 'An unknown placeholder must fail the path check';
  end if;

  if pg_catalog.regexp_replace(
       pg_catalog.replace('/fixtures/between/{{date:+0}}/{{date:+8}}', '{{date}}', ''),
       '\{\{date:[+-][0-9]{1,3}\}\}', '', 'g') like '%{%' then
    raise exception 'A known placeholder must pass the path check';
  end if;

  -- The defaults are the cheap ones. A target recorded without an opinion polls
  -- once a day, which is the behaviour this contract exists to make normal.
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'provider_poll_targets'
         and column_name = 'cadence_minutes') not like '1440%' then
    raise exception 'The idle cadence must default to one call a day';
  end if;
end;
$$;
