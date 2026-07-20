-- Euro 2028 Predictor — reveal-after-lock endpoint (another player's entry)
--
-- Follow-up migration; append-only.
--
-- The FIRST path in the app that returns ANOTHER user's predictions. It powers
-- H2H (and, later, viewing other players' profiles). The reveal rule
-- (competition-structure §6.3): another player's picks are visible only AFTER
-- entries lock, and only to someone who shares a league with them.
--
-- get_rival_entry() is the server-side gate — security definer, so it can read
-- across users, but it refuses unless BOTH hold:
--   1. now() >= tournaments.lock_at   (post-lock; else the picks are secret)
--   2. the caller and the rival share at least one league  (co-membership,
--      the same scope as get_league_members)
-- These checks run in the function, not the client — the UI hiding the H2H
-- button pre-lock is cosmetic; this is the real guard (defense in depth). It
-- returns only what H2H needs (name, total, group-match picks, knockout
-- progression) — never the rival's user id or anything cross-user beyond it.
--
-- Idempotent (create or replace).

begin;

create or replace function get_rival_entry(p_rival_id uuid, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid   uuid := auth.uid();
  v_lock  timestamptz;
  v_entry uuid;
  v_out   jsonb;
begin
  -- (1) Post-lock gate. Null lock_at is treated as "not yet locked" → refuse.
  select lock_at into v_lock from tournaments where id = p_tournament_id;
  if v_lock is null or now() < v_lock then
    raise exception 'Other players'' predictions are hidden until entries lock'
      using errcode = 'insufficient_privilege';
  end if;

  -- (2) Co-membership gate: caller and rival must share at least one league.
  if v_uid is null or not exists (
    select 1
    from league_members a
    join league_members b on b.league_id = a.league_id
    where a.user_id = v_uid and b.user_id = p_rival_id
  ) then
    raise exception 'You can only compare with players in your leagues'
      using errcode = 'insufficient_privilege';
  end if;

  -- The rival's submitted entry for this tournament.
  select id into v_entry
  from entries
  where user_id = p_rival_id and tournament_id = p_tournament_id and submitted_at is not null;
  if v_entry is null then
    raise exception 'That player has not submitted an entry' using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'display_name', (select display_name from profiles where id = p_rival_id),
    'total_points', coalesce((select total_points from entry_totals where entry_id = v_entry), 0),
    'group_matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', mp.match_id,
        'home_score', mp.home_score,
        'away_score', mp.away_score,
        'joker', mp.joker))
      from match_predictions mp where mp.entry_id = v_entry), '[]'::jsonb),
    'progression', coalesce((
      select jsonb_agg(jsonb_build_object('team_id', pp.team_id, 'stage', pp.stage))
      from predicted_progression pp where pp.entry_id = v_entry), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function get_rival_entry(uuid, uuid) from public;
grant execute on function get_rival_entry(uuid, uuid) to authenticated;

commit;
