-- Euro 2028 Predictor — Match Centre data layer (design-system §6)
--
-- Follow-up migration; append-only.
--
-- Two SECURITY DEFINER reads for the per-fixture Match Centre's "what [scope]
-- said" block — the only part that touches OTHER users' predictions. Both mirror
-- the get_rival_entry reveal gate (20260720170000): predictions of others are
-- visible only AFTER lock. Pre-lock they return participation COUNTS only (never
-- picks), so "18 of 20 predicted this match" is safe to show before lock.
--
--   1. get_league_match_picks(league_id, match_id) — the "league scope = names"
--      case. Caller must be a member of the league (co-membership, the
--      get_league_members scope). Post-lock: one row per submitted member with
--      their pick for THIS match (group: score + joker; knockout: their
--      predicted stage for each of the two participants, for the domain to
--      derive "had X ✓ / had Y ✗"). Never returns user ids — names + picks only.
--
--   2. get_match_prediction_distribution(match_id) — the "overall scope = bars"
--      case. The app's first ALL-USERS aggregate: anonymous COUNTS across every
--      submitted entry (group: per scoreline; knockout: a two-team winner split).
--      Post-lock only; never names/ids. Small-N de-anonymisation is accepted for
--      now (everyone is a seed/dev account pre-traffic) — REVISIT before launch
--      (see docs/roadmap.md, alongside the email-verification decision).
--
-- Scoring is deliberately NOT redone here: the functions return raw picks and
-- the TS domain scores them (scoreOneMatch / the same rules as score_events), so
-- there is no second scoring implementation to drift (rule 6).

begin;

-- Knockout stage ordinal (r16=0 … champion=4); a team "goes through" a KO match
-- at round R when its predicted stage ordinal is strictly greater than R's.
create or replace function _stage_ord(p_stage text)
returns int language sql immutable as $$
  select case p_stage
    when 'r16' then 0 when 'qf' then 1 when 'sf' then 2 when 'final' then 3 when 'champion' then 4
    else -1 end;
$$;

-- ---------------------------------------------------------------------------
-- 1. League-scoped per-match picks (names) — post-lock + co-membership gated.
-- ---------------------------------------------------------------------------
create or replace function get_league_match_picks(p_league_id uuid, p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid        uuid := auth.uid();
  v_tournament uuid;
  v_lock       timestamptz;
  v_round      text;
  v_home       uuid;
  v_away       uuid;
  v_locked     boolean;
  v_total      int;
  v_predicted  int;
  v_picks      jsonb := '[]'::jsonb;
begin
  -- Co-membership gate: the caller must belong to this league.
  if v_uid is null or not exists (
    select 1 from league_members where league_id = p_league_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select m.tournament_id, m.round, m.home_team_id, m.away_team_id
    into v_tournament, v_round, v_home, v_away
  from matches m where m.id = p_match_id;
  if v_tournament is null then
    raise exception 'Match not found' using errcode = 'no_data_found';
  end if;

  select lock_at into v_lock from tournaments where id = v_tournament;
  v_locked := v_lock is not null and now() >= v_lock;

  -- Submitted members of this league for this tournament.
  select count(*) into v_total
  from league_members lm
  join entries e on e.user_id = lm.user_id
    and e.tournament_id = v_tournament and e.submitted_at is not null
  where lm.league_id = p_league_id;

  if v_round = 'group' then
    select count(*) into v_predicted
    from league_members lm
    join entries e on e.user_id = lm.user_id
      and e.tournament_id = v_tournament and e.submitted_at is not null
    join match_predictions mp on mp.entry_id = e.id and mp.match_id = p_match_id
    where lm.league_id = p_league_id;

    if v_locked then
      select coalesce(jsonb_agg(jsonb_build_object(
        'display_name', p.display_name,
        'is_you',       (lm.user_id = v_uid),
        'home_score',   mp.home_score,
        'away_score',   mp.away_score,
        'joker',        mp.joker
      ) order by p.display_name), '[]'::jsonb) into v_picks
      from league_members lm
      join entries e on e.user_id = lm.user_id
        and e.tournament_id = v_tournament and e.submitted_at is not null
      join profiles p on p.id = lm.user_id
      join match_predictions mp on mp.entry_id = e.id and mp.match_id = p_match_id
      where lm.league_id = p_league_id;
    end if;

    return jsonb_build_object(
      'kind', 'group', 'locked', v_locked,
      'total_members', v_total, 'predicted_count', v_predicted, 'picks', v_picks);
  else
    -- Knockout: a submitted entry is a full bracket, so "predicted" == submitted.
    v_predicted := v_total;

    if v_locked then
      select coalesce(jsonb_agg(jsonb_build_object(
        'display_name', p.display_name,
        'is_you',       (lm.user_id = v_uid),
        'home_stage',   (select pp.stage from predicted_progression pp
                          where pp.entry_id = e.id and pp.team_id = v_home),
        'away_stage',   (select pp.stage from predicted_progression pp
                          where pp.entry_id = e.id and pp.team_id = v_away)
      ) order by p.display_name), '[]'::jsonb) into v_picks
      from league_members lm
      join entries e on e.user_id = lm.user_id
        and e.tournament_id = v_tournament and e.submitted_at is not null
      join profiles p on p.id = lm.user_id
      where lm.league_id = p_league_id;
    end if;

    return jsonb_build_object(
      'kind', 'knockout', 'locked', v_locked,
      'total_members', v_total, 'predicted_count', v_predicted,
      'home_team_id', v_home, 'away_team_id', v_away, 'picks', v_picks);
  end if;
end;
$$;

revoke all on function get_league_match_picks(uuid, uuid) from public;
grant execute on function get_league_match_picks(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Overall anonymous distribution (bars) — post-lock gated.
-- ---------------------------------------------------------------------------
create or replace function get_match_prediction_distribution(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tournament uuid;
  v_lock       timestamptz;
  v_round      text;
  v_home       uuid;
  v_away       uuid;
  v_locked     boolean;
  v_total      int;
  v_predicted  int;
  v_round_ord  int;
  v_buckets    jsonb := '[]'::jsonb;
  v_home_ct    int := 0;
  v_away_ct    int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select m.tournament_id, m.round, m.home_team_id, m.away_team_id
    into v_tournament, v_round, v_home, v_away
  from matches m where m.id = p_match_id;
  if v_tournament is null then
    raise exception 'Match not found' using errcode = 'no_data_found';
  end if;

  select lock_at into v_lock from tournaments where id = v_tournament;
  v_locked := v_lock is not null and now() >= v_lock;

  select count(*) into v_total
  from entries where tournament_id = v_tournament and submitted_at is not null;

  if v_round = 'group' then
    select count(distinct e.id) into v_predicted
    from entries e
    join match_predictions mp on mp.entry_id = e.id and mp.match_id = p_match_id
    where e.tournament_id = v_tournament and e.submitted_at is not null;

    if v_locked then
      select coalesce(jsonb_agg(jsonb_build_object(
        'home_score', hs, 'away_score', aws, 'count', c) order by c desc, hs, aws), '[]'::jsonb)
      into v_buckets
      from (
        select mp.home_score hs, mp.away_score aws, count(*)::int c
        from entries e
        join match_predictions mp on mp.entry_id = e.id and mp.match_id = p_match_id
        where e.tournament_id = v_tournament and e.submitted_at is not null
        group by mp.home_score, mp.away_score
      ) d;
    end if;

    return jsonb_build_object(
      'kind', 'group', 'locked', v_locked,
      'total_entries', v_total, 'predicted_count', v_predicted, 'buckets', v_buckets);
  else
    v_predicted := v_total;
    v_round_ord := _stage_ord(v_round);

    if v_locked then
      select count(*) into v_home_ct
      from entries e
      where e.tournament_id = v_tournament and e.submitted_at is not null
        and exists (select 1 from predicted_progression pp
                    where pp.entry_id = e.id and pp.team_id = v_home
                      and _stage_ord(pp.stage) > v_round_ord);
      select count(*) into v_away_ct
      from entries e
      where e.tournament_id = v_tournament and e.submitted_at is not null
        and exists (select 1 from predicted_progression pp
                    where pp.entry_id = e.id and pp.team_id = v_away
                      and _stage_ord(pp.stage) > v_round_ord);
    end if;

    return jsonb_build_object(
      'kind', 'knockout', 'locked', v_locked,
      'total_entries', v_total, 'predicted_count', v_predicted,
      'home_team_id', v_home, 'away_team_id', v_away,
      'home_count', v_home_ct, 'away_count', v_away_ct);
  end if;
end;
$$;

revoke all on function get_match_prediction_distribution(uuid) from public;
grant execute on function get_match_prediction_distribution(uuid) to authenticated;

commit;
