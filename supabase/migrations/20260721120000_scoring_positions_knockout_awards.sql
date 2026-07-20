-- Euro 2028 Predictor — scoring engine completion: §2 positions, §3 knockout, §4 awards
--
-- Follow-up migration; append-only (does NOT edit 20260720130000/140000/180000).
--
-- 20260720130000 scored §1 group-match points in SQL and DEFERRED §2/§3/§4,
-- because they need DERIVED actuals (final group order via UEFA tie-breaks, the
-- resolved bracket, the group-stage goal total, the actual top scorer). This
-- migration lands those three, extending the SAME delete-and-rederive pipeline
-- (recompute_tournament_scores) rather than a parallel one. The values come from
-- docs/scoring-rules.md §2–§4, and the logic mirrors the unit-tested TS domain
-- (calculateScore / resolveGroupTies / calculateGroupTable / sumGroupGoals) — the
-- seed's TS pipeline (scripts/seed-dev/scoreEntries.ts) stays the reference, and
-- SQL === TS on the same source data is the acceptance test.
--
-- Point values (verbatim from scoring-rules.md):
--   §2 group positions: 2 per correct team position, +5 bonus for the full order
--                       (max 13/group).
--   §3 knockout (STACK per team): R16 10, QF 15, SF 20, FINAL 25, CHAMPION 40
--                       (a team correct all the way = 110). Jokers NEVER apply.
--   §4 awards: golden boot 25; group-stage total goals tiered (exact 40, ≤5 30,
--                       ≤10 20, else 0) — the goals number is DERIVED from the 36
--                       predicted scores, never stored.
--
-- Finality gating (so this stays byte-identical to the reference on partial data,
-- incl. the seeded mid-group-stage where §2/§3/§4 all score 0):
--   §2 scores a group only once it is COMPLETE (every group match has a result).
--   §3 scores a team only for stages it actually reached (KO match participation;
--      champion = winner of the final).
--   §4 total-goals scores only once the WHOLE group stage is complete; golden
--      boot only once tournaments.golden_boot_player_id is set.

begin;

-- ---------------------------------------------------------------------------
-- Actual golden boot (the real top scorer) — the missing "actual" for §4.
-- Admin-set on the tournament row; null until the tournament decides it, so
-- golden-boot scoring is dormant (0) until then. references players (added in
-- 20260719160000, an earlier migration, so it exists by the time this applies).
-- ---------------------------------------------------------------------------
alter table tournaments
  add column if not exists golden_boot_player_id uuid references players (id) on delete set null;

-- ===========================================================================
-- §2 helpers — actual final group order via the scoring-rules §6 tie-breaks.
-- Mirrors resolveGroupTies + calculateGroupTable exactly:
--   point buckets → within a point tie: head-to-head points/GD/goals (recursing
--   into still-tied subsets = the 3-way special case) → overall GD/goals →
--   genuinely-unresolvable teams kept in slot order (the "stable input order").
-- ===========================================================================

-- Head-to-head mini-table among a set of teams: counts ONLY the group matches
-- where BOTH teams are in the set (exactly what calculateGroupTable does on a
-- subset). Returns points (3/1/0), goal difference and goals for, per team.
create or replace function _group_h2h_stats(p_group_id uuid, p_team_ids uuid[])
returns table (team_id uuid, pts int, gd int, gf int)
language sql
stable
security definer
set search_path = public
as $$
  with hm as (
    select m.home_team_id ht, m.away_team_id awt, m.home_score hs, m.away_score aw
    from matches m
    where m.group_id = p_group_id
      and m.home_team_id = any(p_team_ids)
      and m.away_team_id = any(p_team_ids)
      and m.home_score is not null and m.away_score is not null
  ),
  perteam as (
    select ht as tid, case when hs > aw then 3 when hs = aw then 1 else 0 end pts, (hs - aw) gd, hs gf from hm
    union all
    select awt,       case when aw > hs then 3 when aw = hs then 1 else 0 end,     (aw - hs),    aw from hm
  )
  select t.tid,
         coalesce(sum(p.pts), 0)::int,
         coalesce(sum(p.gd), 0)::int,
         coalesce(sum(p.gf), 0)::int
  from unnest(p_team_ids) t(tid)
  left join perteam p on p.tid = t.tid
  group by t.tid;
$$;

-- Order a cluster of teams already known to be level on overall points.
-- Recursive (bounded by ≤4 teams/group): head-to-head separates; still-tied
-- subsets recurse (step 4); if head-to-head gives nothing, overall GD then goals;
-- anything still level is left in slot order for the manual step-7 case (which
-- has no automatic answer for an actual result).
create or replace function _resolve_group_cluster(p_group_id uuid, p_team_ids uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result  uuid[] := '{}';
  v_buckets int;
  r         record;
begin
  if coalesce(array_length(p_team_ids, 1), 0) <= 1 then
    return p_team_ids;
  end if;

  -- Steps 1-3: does head-to-head separate the set into >1 distinct (pts,gd,gf)?
  select count(distinct (pts, gd, gf)) into v_buckets
  from _group_h2h_stats(p_group_id, p_team_ids);

  if v_buckets > 1 then
    -- Head-to-head separated them. Recurse each H2H bucket best-first; each is a
    -- strict subset (terminates), and recomputing H2H within it IS step 4.
    for r in
      select array_agg(gt.team_id order by gt.slot) as teams
      from _group_h2h_stats(p_group_id, p_team_ids) h
      join group_teams gt on gt.team_id = h.team_id
      group by h.pts, h.gd, h.gf
      order by h.pts desc, h.gd desc, h.gf desc
    loop
      v_result := v_result || _resolve_group_cluster(p_group_id, r.teams);
    end loop;
    return v_result;
  end if;

  -- Steps 5-6: head-to-head gave nothing → overall goal difference, then goals.
  -- Teams still level after this are unresolvable (step 7); ordering by slot last
  -- keeps them in the stable input order the domain uses for an unresolved block.
  select array_agg(o.team_id order by o.ogd desc, o.ogf desc, o.slot asc) into v_result
  from (
    select gt.team_id, gt.slot,
           sum(case when m.home_team_id = gt.team_id then m.home_score else m.away_score end)
             - sum(case when m.home_team_id = gt.team_id then m.away_score else m.home_score end) as ogd,
           sum(case when m.home_team_id = gt.team_id then m.home_score else m.away_score end) as ogf
    from group_teams gt
    join matches m on m.group_id = p_group_id
      and (m.home_team_id = gt.team_id or m.away_team_id = gt.team_id)
      and m.home_score is not null and m.away_score is not null
    where gt.team_id = any(p_team_ids)
    group by gt.team_id, gt.slot
  ) o;

  return v_result;
end;
$$;

-- The final actual order of a group (1st→4th as a team-id array), or NULL when
-- the group is not yet complete (mirrors the reference only supplying a group's
-- actual order once it is final).
create or replace function _actual_group_order(p_group_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total  int;
  v_played int;
  v_result uuid[] := '{}';
  r        record;
begin
  select count(*),
         count(*) filter (where home_score is not null and away_score is not null)
    into v_total, v_played
  from matches where group_id = p_group_id and round = 'group';

  if coalesce(v_total, 0) = 0 or v_played < v_total then
    return null; -- incomplete group → not scored yet
  end if;

  -- Point buckets, best-first; resolve ties within each.
  for r in
    select array_agg(gt.team_id order by gt.slot) as teams
    from group_teams gt
    join lateral (
      select coalesce(sum(case
               when (m.home_team_id = gt.team_id and m.home_score > m.away_score)
                 or (m.away_team_id = gt.team_id and m.away_score > m.home_score) then 3
               when m.home_score = m.away_score then 1
               else 0 end), 0) as pts
      from matches m
      where m.group_id = p_group_id
        and (m.home_team_id = gt.team_id or m.away_team_id = gt.team_id)
        and m.home_score is not null and m.away_score is not null
    ) ps on true
    where gt.group_id = p_group_id
    group by ps.pts
    order by ps.pts desc
  loop
    v_result := v_result || _resolve_group_cluster(p_group_id, r.teams);
  end loop;

  return v_result;
end;
$$;

-- ===========================================================================
-- recompute_tournament_scores() — redefined to add §2/§3/§4 after §1.
-- Preserves the 20260720130000 §1 block VERBATIM and the 20260720180000
-- capture_rank_history() call at the end (rank history keeps firing).
-- ===========================================================================
create or replace function recompute_tournament_scores(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_complete boolean;
  v_actual_goals   int;
begin
  -- Idempotent: wipe every event for this tournament's entries, then rederive.
  delete from score_events se
  using entries e
  where se.entry_id = e.id and e.tournament_id = p_tournament_id;

  -- -----------------------------------------------------------------------
  -- §1 Group match points (unchanged from 20260720130000).
  -- -----------------------------------------------------------------------
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

  -- -----------------------------------------------------------------------
  -- §2 Group position points — 2 per correct position, +5 for the full order.
  -- Only COMPLETE groups (a null actual order means "not final yet").
  -- -----------------------------------------------------------------------
  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    gp.entry_id,
    'group_positions',
    null,
    null,
    gp.correct * 2 + (case when gp.correct = 4 then 5 else 0 end),
    false,
    format('Group %s · %s', gp.letter,
      case when gp.correct = 4 then 'full order correct'
           else gp.correct || ' in the right place' end),
    1
  from (
    select pgp.entry_id, g.letter,
           count(*) filter (where pgp.team_id = ao.ord[pgp.position]) as correct
    from groups g
    join lateral (select _actual_group_order(g.id) as ord) ao on true
    join predicted_group_positions pgp on pgp.group_id = g.id
    join entries e on e.id = pgp.entry_id and e.tournament_id = p_tournament_id
    where g.tournament_id = p_tournament_id and ao.ord is not null
    group by pgp.entry_id, g.id, g.letter, ao.ord
  ) gp
  where gp.correct > 0;

  -- -----------------------------------------------------------------------
  -- §3 Knockout progression — STACK per team up to min(predicted, actual).
  -- Actual furthest stage = the latest KO round a team is a participant in
  -- (champion = winner of the final). Jokers never apply here.
  -- -----------------------------------------------------------------------
  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    ks.entry_id,
    'knockout',
    null,
    ks.team_id,
    case ks.k when 0 then 10 when 1 then 25 when 2 then 45 when 3 then 70 when 4 then 110 end,
    false,
    format('%s · %s', coalesce(tm.name, 'Team'),
      case ks.k
        when 0 then 'reached the last 16'
        when 1 then 'reached the quarter-finals'
        when 2 then 'reached the semi-finals'
        when 3 then 'reached the final'
        when 4 then 'won the tournament'
      end),
    1
  from (
    select pp.entry_id, pp.team_id,
           least(
             case pp.stage
               when 'r16' then 0 when 'qf' then 1 when 'sf' then 2
               when 'final' then 3 when 'champion' then 4 end,
             act.act_ord
           ) as k
    from predicted_progression pp
    join entries e on e.id = pp.entry_id and e.tournament_id = p_tournament_id
    join (
      select reached.team_id,
             case when champ.team_id is not null then 4 else reached.max_ord end as act_ord
      from (
        select team_id, max(rnd_ord) as max_ord
        from (
          select m.home_team_id as team_id,
                 case m.round when 'r16' then 0 when 'qf' then 1 when 'sf' then 2 when 'final' then 3 end as rnd_ord
          from matches m
          where m.tournament_id = p_tournament_id and m.round in ('r16','qf','sf','final')
            and m.home_team_id is not null
          union all
          select m.away_team_id,
                 case m.round when 'r16' then 0 when 'qf' then 1 when 'sf' then 2 when 'final' then 3 end
          from matches m
          where m.tournament_id = p_tournament_id and m.round in ('r16','qf','sf','final')
            and m.away_team_id is not null
        ) participants
        group by team_id
      ) reached
      left join (
        select case when m.home_score > m.away_score then m.home_team_id
                    when m.away_score > m.home_score then m.away_team_id end as team_id
        from matches m
        where m.tournament_id = p_tournament_id and m.round = 'final'
          and m.home_score is not null and m.away_score is not null
      ) champ on champ.team_id = reached.team_id
    ) act on act.team_id = pp.team_id
  ) ks
  left join teams tm on tm.id = ks.team_id
  where ks.k >= 0;

  -- -----------------------------------------------------------------------
  -- §4a Awards — golden boot (25 when the predicted player is the actual winner).
  -- -----------------------------------------------------------------------
  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    e.id, 'awards', null, null, 25, false,
    format('%s · golden boot', coalesce(pl.name, 'Top scorer')), 1
  from entries e
  join tournaments t on t.id = e.tournament_id
  join bonus_predictions bp on bp.entry_id = e.id
  join players pl on pl.id = bp.golden_boot_player_id
  where e.tournament_id = p_tournament_id
    and t.golden_boot_player_id is not null
    and bp.golden_boot_player_id = t.golden_boot_player_id;

  -- -----------------------------------------------------------------------
  -- §4b Awards — group-stage total goals (tiered). The predicted number is
  -- DERIVED here from the entry's 36 predicted scores (never a stored field);
  -- the actual is the real group-stage total, known only once every group match
  -- has a result.
  -- -----------------------------------------------------------------------
  select bool_and(home_score is not null) into v_group_complete
  from matches where tournament_id = p_tournament_id and round = 'group';

  if coalesce(v_group_complete, false) then
    select sum(home_score + away_score) into v_actual_goals
    from matches where tournament_id = p_tournament_id and round = 'group';

    insert into score_events
      (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
    select g.entry_id, 'awards', null, null, b.pts, false, 'Total goals · ' || b.detail, 1
    from (
      select mp.entry_id, abs(sum(mp.home_score + mp.away_score) - v_actual_goals) as diff
      from match_predictions mp
      join matches m on m.id = mp.match_id
      join entries e on e.id = mp.entry_id
      where m.round = 'group' and e.tournament_id = p_tournament_id
      group by mp.entry_id
    ) g
    cross join lateral (
      select case when g.diff = 0 then 40 when g.diff <= 5 then 30 when g.diff <= 10 then 20 else 0 end as pts,
             case when g.diff = 0 then 'exact group-stage goals' else 'group-stage goals · close' end as detail
    ) b
    where b.pts > 0;
  end if;

  -- Snapshot rank history for any matchday now fully scored (kept from
  -- 20260720180000 — capture must keep firing on every recompute).
  perform capture_rank_history(p_tournament_id);
end;
$$;

-- ===========================================================================
-- Triggers — broaden result recompute + add a golden-boot recompute.
-- ===========================================================================

-- §3 needs a recompute when KO participants are set (a team "reaches" a stage the
-- moment it's a participant), not only when a score is written — so fire on the
-- team-id columns too. trg_recompute_on_result (from 20260720140000, always
-- recomputes) is unchanged; only the column list widens.
drop trigger if exists recompute_scores_on_result on matches;
create trigger recompute_scores_on_result
  after insert or update of home_score, away_score, home_team_id, away_team_id on matches
  for each row execute function trg_recompute_on_result();

-- §4 golden boot: recompute the tournament when its actual top scorer changes.
create or replace function trg_recompute_on_golden_boot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.golden_boot_player_id is not distinct from old.golden_boot_player_id then
    return new;
  end if;
  perform recompute_tournament_scores(new.id);
  return new;
end;
$$;

drop trigger if exists recompute_scores_on_golden_boot on tournaments;
create trigger recompute_scores_on_golden_boot
  after update of golden_boot_player_id on tournaments
  for each row execute function trg_recompute_on_golden_boot();

-- Helper functions are internal to the recompute path (definer); no client access.
revoke all on function _group_h2h_stats(uuid, uuid[]) from public;
revoke all on function _resolve_group_cluster(uuid, uuid[]) from public;
revoke all on function _actual_group_order(uuid) from public;

commit;
