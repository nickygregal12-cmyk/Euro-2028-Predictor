-- Euro 2028 Predictor — rank_history capture (per user, per matchday)
--
-- Follow-up migration; append-only.
--
-- Feeds the Phase 3 H2H rank-over-time graph (design-system §6). The graph is
-- NOT built here — this lands the CAPTURE mechanism now, because rank history is
-- "not retrofittable": you cannot reconstruct where a player ranked after
-- matchday 1 from the final totals, so the snapshot must be taken as each
-- matchday completes, starting from the very first scored result.
--
-- Shape (per the §6 report): one row per (user, tournament, matchday). A
-- "matchday" spans the whole competition — group MD1..3 (matches.matchday) plus
-- the four knockout rounds (matches.round) — so a canonical matchday_key +
-- matchday_ord are defined here (matches.matchday alone is group-stage only).
--
-- Capture point: INSIDE recompute_tournament_scores() (redefined below to append
-- one call), which the matches result trigger already runs on every score write.
-- So capture is part of scoring from result #1 — nothing waits for a later
-- trigger point. When a matchday becomes fully scored, capture_rank_history()
-- inserts each submitted entry's rank + total for that matchday, INSERT-ONCE
-- (on conflict do nothing): rank_history is a historical LOG, so a later
-- correction never rewrites an earlier matchday's captured rank.

begin;

-- ---------------------------------------------------------------------------
-- rank_history
-- ---------------------------------------------------------------------------
create table if not exists rank_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  tournament_id uuid not null references tournaments (id) on delete cascade,
  matchday_key  text not null,      -- 'MD1'..'MD3','R16','QF','SF','FINAL'
  matchday_ord  smallint not null,  -- 1..7, the graph's x-axis order
  rank          int not null,       -- standard-competition rank at that point
  total_points  int not null,
  captured_at   timestamptz not null default now(),
  unique (user_id, tournament_id, matchday_key)
);
create index if not exists rank_history_user_idx on rank_history (user_id, tournament_id);
create index if not exists rank_history_tournament_idx on rank_history (tournament_id, matchday_ord);

alter table rank_history enable row level security;

-- Own rows readable; no client writes (only the capture function, definer,
-- writes). The Phase 3 graph reads a rival's history through the reveal path
-- (post-lock + co-membership), same as get_rival_entry — added when the graph is.
drop policy if exists "own rank_history readable" on rank_history;
create policy "own rank_history readable" on rank_history
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- capture_rank_history(): snapshot every matchday that is now fully scored
-- ---------------------------------------------------------------------------
create or replace function capture_rank_history(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from (values
      ('MD1'::text,  1::smallint, 'group'::text, 1::smallint),
      ('MD2',        2,           'group',       2),
      ('MD3',        3,           'group',       3),
      ('R16',        4,           'r16',         null::smallint),
      ('QF',         5,           'qf',          null),
      ('SF',         6,           'sf',          null),
      ('FINAL',      7,           'final',       null)
    ) as t(key, ord, round, md)
  loop
    -- Fully scored = the matchday has matches AND none are unscored.
    if (
      select count(*) > 0 and count(*) = count(*) filter (where m.home_score is not null)
      from matches m
      where m.tournament_id = p_tournament_id
        and m.round = r.round
        and (r.md is null or m.matchday = r.md)
    ) then
      -- Insert-once: first capture of a matchday is its historical rank; a later
      -- correction to any match does not rewrite it (the log stays true to time).
      insert into rank_history
        (user_id, tournament_id, matchday_key, matchday_ord, rank, total_points)
      select ranked.user_id, p_tournament_id, r.key, r.ord, ranked.rnk, ranked.total
      from (
        select e.user_id,
               coalesce(t.total_points, 0) as total,
               rank() over (order by coalesce(t.total_points, 0) desc) as rnk
        from entries e
        left join entry_totals t on t.entry_id = e.id
        where e.tournament_id = p_tournament_id and e.submitted_at is not null
      ) ranked
      on conflict (user_id, tournament_id, matchday_key) do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function capture_rank_history(uuid) from public;
grant execute on function capture_rank_history(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Hook it into the existing scoring pipeline (no new independent pipeline):
-- redefine recompute_tournament_scores to capture right after it rescoress.
-- Body is the applied 20260720130000 definition + the trailing capture call.
-- ---------------------------------------------------------------------------
create or replace function recompute_tournament_scores(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotent: wipe every event for this tournament's entries, then rederive.
  delete from score_events se
  using entries e
  where se.entry_id = e.id and e.tournament_id = p_tournament_id;

  -- §1 Group match points.
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

  -- §2/§3/§4 remain deferred (see 20260720130000).

  -- Snapshot rank history for any matchday that is now fully scored. Runs on
  -- every recompute (i.e. every result), so history capture begins at result #1.
  perform capture_rank_history(p_tournament_id);
end;
$$;

commit;
