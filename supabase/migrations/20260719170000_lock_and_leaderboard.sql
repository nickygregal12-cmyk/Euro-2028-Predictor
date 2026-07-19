-- Euro 2028 Predictor — server-authoritative entry lock + overall leaderboard
--
-- Follow-up to the init migration; append-only (does not edit earlier files).
--
-- 1. Entry lock. The whole entry locks at the tournament's opening kickoff. The
--    lock time lives in tournament DATA (tournaments.lock_at) — never a client
--    clock — and is overridable for dev by editing that row. Once now() >=
--    lock_at, BEFORE triggers reject:
--      * new/changed match-prediction SCORES (a joker-only change still passes,
--        because jokers have their own per-match kickoff-commitment lock — see
--        20260719150000_enforce_joker_rules.sql);
--      * tie-resolution, progression and golden-boot writes (insert/update/delete).
--    Enforcement is server-side; the client only reflects the lock.
--
-- 2. get_leaderboard(): a security-definer function so the overall standings can
--    read every submitted entry's display name + total without loosening the
--    profiles/entries RLS. It exposes only display_name, total (0 until scoring
--    lands) and whether the row is the caller's — never other users' ids.
--
-- Idempotent (if not exists / or replace / drop-if-exists).

begin;

alter table tournaments add column if not exists lock_at timestamptz;
-- Default the lock to the tournament's start (dev can override this row's
-- lock_at to a past/future instant to exercise locked states).
update tournaments set lock_at = starts_on::timestamptz
  where lock_at is null and starts_on is not null;

-- --- Lock enforcement -------------------------------------------------------

-- match_predictions: block score changes after lock; let joker-only edits pass.
create or replace function enforce_entry_lock_scores() returns trigger as $$
declare
  v_lock timestamptz;
begin
  select t.lock_at into v_lock
    from entries e join tournaments t on t.id = e.tournament_id
    where e.id = new.entry_id;
  if v_lock is not null and now() >= v_lock then
    if tg_op = 'INSERT'
       or new.home_score is distinct from old.home_score
       or new.away_score is distinct from old.away_score then
      raise exception 'Predictions are locked — the tournament has started'
        using errcode = 'check_violation';
    end if;
    -- joker-only change falls through (its own kickoff lock still applies)
  end if;
  return new;
end;
$$ language plpgsql;

-- Generic lock for the write-once-then-frozen prediction tables (tie
-- resolutions, progression, golden boot). Blocks insert/update/delete at lock.
create or replace function enforce_entry_lock_generic() returns trigger as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_lock  timestamptz;
begin
  select t.lock_at into v_lock
    from entries e join tournaments t on t.id = e.tournament_id
    where e.id = v_entry;
  if v_lock is not null and now() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists enforce_lock_scores on match_predictions;
create trigger enforce_lock_scores
  before insert or update on match_predictions
  for each row execute function enforce_entry_lock_scores();

drop trigger if exists enforce_lock_tie_resolutions on predicted_tie_resolutions;
create trigger enforce_lock_tie_resolutions
  before insert or update or delete on predicted_tie_resolutions
  for each row execute function enforce_entry_lock_generic();

drop trigger if exists enforce_lock_progression on predicted_progression;
create trigger enforce_lock_progression
  before insert or update or delete on predicted_progression
  for each row execute function enforce_entry_lock_generic();

drop trigger if exists enforce_lock_bonus on bonus_predictions;
create trigger enforce_lock_bonus
  before insert or update or delete on bonus_predictions
  for each row execute function enforce_entry_lock_generic();

-- --- Overall leaderboard ----------------------------------------------------

-- Reads across all users' submitted entries. Security-definer so it can see
-- other rows without RLS being loosened; exposes only the minimum. total_points
-- is 0 until scoring lands (no score_events table yet).
create or replace function get_leaderboard(p_tournament_id uuid)
returns table (display_name text, total_points int, is_you boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.display_name,
         0::int as total_points,
         (e.user_id = auth.uid()) as is_you
  from entries e
  join profiles p on p.id = e.user_id
  where e.tournament_id = p_tournament_id
    and e.submitted_at is not null
  order by p.display_name;
$$;

revoke all on function get_leaderboard(uuid) from public;
grant execute on function get_leaderboard(uuid) to authenticated;

commit;
