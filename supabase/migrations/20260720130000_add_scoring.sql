-- Euro 2028 Predictor — scoring engine (score_events + recompute + triggers)
--
-- Follow-up migration; append-only.
--
-- Persists scoring so the leaderboard shows real totals. Design:
--
--   * score_events — one row per scored contribution, matching the canonical
--     ScoreEvent shape (src/domain/tournament/scoreEvents.ts): entry, category,
--     the match/team it refers to, points (joker already applied), the joker
--     flag, a plain-language explanation, and a calculation_version. Own-entry
--     read RLS; NO client write policies — only the recompute function writes.
--
--   * entry_totals — a VIEW summing score_events per entry. A view (not a stored
--     column) is deliberate: the total is a pure aggregate of score_events, so a
--     view makes "total === sum of events" true by construction, with zero
--     staleness and no second thing to keep in sync (rule 5/6 — one source of
--     truth, always recalculable). Leaderboard reads are a few dozen rows, so
--     recompute-on-read is free at this scale.
--
--   * recompute_tournament_scores() — the scoring engine. DELETES an entry's
--     events and RE-DERIVES them from source data (predictions + results +
--     jokers), so a full recompute is deterministic and idempotent and a
--     corrected result can never double-count (delete-and-rederive, never
--     increment). Runs as a trigger when a match result is entered/corrected.
--
-- ---------------------------------------------------------------------------
-- Engine scope & the "one source of truth" boundary (rule 6)
-- ---------------------------------------------------------------------------
-- This function is a plpgsql, not an edge function, ON PURPOSE: it runs
-- synchronously inside the same transaction as the result write, so entering a
-- result via SQL cascades to fresh scores with no external infrastructure
-- (no pg_net, no deployed function, no webhook) — exactly the trigger-point the
-- brief asks for, and free-tier friendly.
--
-- It scores §1 group-match points in SQL because that is a direct per-row
-- comparison of a prediction against the match's own result — a tiny, stable
-- rule (5/3/0, doubled by a joker) with no risk of drifting from the domain.
--
-- It deliberately does NOT re-implement §2 group positions, §3 knockout, or §4
-- awards in SQL. Those need DERIVED actuals — the final group order (UEFA
-- head-to-head tie-breaks + manual resolution), the resolved bracket (R16
-- allocation + advancement), the actual golden boot, the full-tournament goal
-- total — which are the already-unit-tested TS domain (calculateScore +
-- calculateGroupTable/resolveGroupTies/resolveRoundOf16/advanceBracket).
-- Re-coding that in plpgsql would create a second implementation of the rules
-- and inevitably drift (rule 6). When knockout results exist, those categories
-- get wired by INVOKING that TS domain (an edge function), not re-writing it.
--
-- Consequence for correctness TODAY: with no group complete and no knockout
-- result, §2–§4 score 0 for every entry, so this §1-only recompute is byte-for-
-- byte identical to the full TS pipeline on all current data (the seeded fake
-- mid-tournament included). That equality is the acceptance test.

begin;

-- ---------------------------------------------------------------------------
-- score_events
-- ---------------------------------------------------------------------------
create table if not exists score_events (
  id                   uuid primary key default gen_random_uuid(),
  entry_id             uuid not null references entries (id) on delete cascade,
  category             text not null check (category in
                         ('group_matches', 'group_positions', 'knockout', 'awards')),
  -- The match this event scores (group_matches); null for non-match categories.
  match_id             uuid references matches (id) on delete cascade,
  -- The badge team for the row's flag (home team for a group match, the team for
  -- a knockout event); null when there's no single team.
  team_id              uuid references teams (id) on delete set null,
  points               int not null,
  joker                boolean not null default false,
  explanation          text not null,
  calculation_version  int not null default 1,
  created_at           timestamptz not null default now()
);
create index if not exists score_events_entry_idx on score_events (entry_id);
create index if not exists score_events_match_idx on score_events (match_id);

alter table score_events enable row level security;

-- Own entry only. No insert/update/delete policies → writes go solely through
-- the recompute function (security definer). Totals reach other users only via
-- the leaderboard functions, which are also security definer.
drop policy if exists "own score_events readable" on score_events;
create policy "own score_events readable" on score_events
  for select to authenticated
  using (exists (
    select 1 from entries e
    where e.id = score_events.entry_id and e.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- entry_totals — per-entry point total (pure aggregate of score_events)
-- ---------------------------------------------------------------------------
create or replace view entry_totals as
  select e.id as entry_id,
         coalesce(sum(se.points), 0)::int as total_points
  from entries e
  left join score_events se on se.entry_id = e.id
  group by e.id;

-- The view is read only by the security-definer functions below; keep it off the
-- client roles so it can't be used to read totals outside the leaderboard path.
revoke all on entry_totals from anon, authenticated;

-- ---------------------------------------------------------------------------
-- recompute_tournament_scores(): delete-and-rederive all events for a tournament
-- ---------------------------------------------------------------------------
create or replace function recompute_tournament_scores(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotent: wipe every event for this tournament's entries, then rederive.
  -- A full recompute always produces identical output; a corrected result never
  -- double-counts because nothing is incremented.
  delete from score_events se
  using entries e
  where se.entry_id = e.id and e.tournament_id = p_tournament_id;

  -- §1 Group match points. For every prediction whose match has a result:
  --   exact score  → 5, correct outcome → 3, wrong → 0; a joker doubles it.
  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    scored.entry_id,
    'group_matches',
    scored.match_id,
    scored.home_team_id,
    scored.base * (case when scored.joker then 2 else 1 end),
    scored.joker,
    format(
      '%s %s–%s %s · %s',
      coalesce(scored.home_name, 'Home'),
      scored.act_home, scored.act_away,
      coalesce(scored.away_name, 'Away'),
      scored.kind_text
    ),
    1
  from (
    select
      mp.entry_id,
      m.id            as match_id,
      m.home_team_id,
      m.home_score    as act_home,
      m.away_score    as act_away,
      mp.joker,
      ht.name         as home_name,
      at.name         as away_name,
      case
        when mp.home_score = m.home_score and mp.away_score = m.away_score then 5
        when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 3
        else 0
      end as base,
      case
        when mp.home_score = m.home_score and mp.away_score = m.away_score then 'exact score'
        when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 'correct result'
        else 'wrong'
      end as kind_text
    from match_predictions mp
    join entries e on e.id = mp.entry_id
    join matches m on m.id = mp.match_id
    left join teams ht on ht.id = m.home_team_id
    left join teams at on at.id = m.away_team_id
    where e.tournament_id = p_tournament_id
      and m.round = 'group'
      and m.home_score is not null
      and m.away_score is not null
  ) scored;

  -- §2 group positions, §3 knockout, §4 awards: deferred to the TS-domain
  -- invocation path (see the header). They contribute 0 on all current data, so
  -- omitting them keeps this recompute identical to the full pipeline today.
end;
$$;

-- Full-rebuild helper (every tournament) — handy for a from-scratch recompute.
create or replace function recompute_all_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in select id from tournaments loop
    perform recompute_tournament_scores(t.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: recompute when a match result is entered / corrected / cleared
-- ---------------------------------------------------------------------------
create or replace function trg_recompute_on_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when a score actually changed (avoid recomputing on unrelated updates).
  if tg_op = 'UPDATE'
     and new.home_score is not distinct from old.home_score
     and new.away_score is not distinct from old.away_score then
    return new;
  end if;
  perform recompute_tournament_scores(new.tournament_id);
  return new;
end;
$$;

drop trigger if exists recompute_scores_on_result on matches;
create trigger recompute_scores_on_result
  after insert or update of home_score, away_score on matches
  for each row execute function trg_recompute_on_result();

-- ---------------------------------------------------------------------------
-- Leaderboard + league totals now read real numbers from entry_totals
-- ---------------------------------------------------------------------------
create or replace function get_leaderboard(p_tournament_id uuid)
returns table (display_name text, total_points int, is_you boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.display_name,
         coalesce(t.total_points, 0) as total_points,
         (e.user_id = auth.uid()) as is_you
  from entries e
  join profiles p on p.id = e.user_id
  left join entry_totals t on t.entry_id = e.id
  where e.tournament_id = p_tournament_id
    and e.submitted_at is not null
  order by p.display_name;
$$;

create or replace function get_league_members(p_league_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  total_points    int,
  is_you          boolean,
  is_owner        boolean,
  has_entry       boolean,
  predicted_count int,
  joined_at       timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tournament uuid;
begin
  if not exists (
    select 1 from league_members m
    where m.league_id = p_league_id and m.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select l.tournament_id into v_tournament from leagues l where l.id = p_league_id;

  return query
    select m.user_id,
           p.display_name,
           coalesce(t.total_points, 0) as total_points,
           (m.user_id = auth.uid()) as is_you,
           (m.role = 'owner') as is_owner,
           (e.submitted_at is not null) as has_entry,
           coalesce(
             (select count(*)::int from match_predictions mp where mp.entry_id = e.id),
             0
           ) as predicted_count,
           m.joined_at
    from league_members m
    join profiles p on p.id = m.user_id
    left join entries e on e.user_id = m.user_id and e.tournament_id = v_tournament
    left join entry_totals t on t.entry_id = e.id
    where m.league_id = p_league_id
    order by p.display_name;
end;
$$;

-- Grants (definer functions; execute for authenticated).
revoke all on function recompute_tournament_scores(uuid) from public;
revoke all on function recompute_all_scores() from public;
-- Recompute is server-side only (trigger + manual admin/SQL); not client-callable.

commit;
