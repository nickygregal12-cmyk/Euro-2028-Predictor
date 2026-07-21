-- Euro 2028 Predictor — server-side write integrity
--
-- Follow-up migration; append-only (does NOT edit earlier files). Two related
-- guards, both "server enforces, client only reflects":
--
--   PART A — optimistic concurrency on prediction writes.
--     match_predictions / predicted_progression / bonus_predictions are written
--     via direct client upserts under RLS. They were unconditional
--     last-write-wins, so two devices (or any out-of-order arrival the client
--     can't see) could silently clobber each other. This adds a monotonic
--     integer `version` per row: the client echoes the version it last read, a
--     BEFORE UPDATE trigger rejects a write whose version != the stored version
--     with a DISTINCT, non-retryable error (SQLSTATE 'PT409'), and on success
--     increments the version server-side.
--
--   PART B — submit_entry() bracket revalidation (SAFE PARTIAL).
--     Adds structural coherence checks to submission that need no bracket
--     rebuild: no orphan 'r16' progression rows, exactly the 8-row winner-only
--     shape, and every progression team scoped to the entry's tournament. These
--     are STRICT additions — they never reject an entry that passes today. The
--     full identity/tree coherence rebuild (rebuild the R16 draw from the
--     predicted group order + best-thirds and verify every winner is a valid
--     participant of its tie) is a larger, separate revalidation — see
--     docs/build-todo.md. Everything submit_entry() already validated is kept.
--
-- Idempotent (add column if not exists / or replace / drop-if-exists), so a
-- re-run is safe. Composes with the existing joker / lock / rate-limit triggers
-- (all BEFORE INSERT OR UPDATE, errcode 'check_violation'); the version trigger
-- is BEFORE UPDATE and, by alphabetical firing order, runs AFTER the lock trigger
-- so a post-lock write is still rejected by the lock (never masked).

begin;

-- ===========================================================================
-- PART A — optimistic concurrency
-- ===========================================================================

-- Monotonic per-row version. Default 0 so existing rows + fresh INSERTs start at
-- 0. NOT server-forced on INSERT: a BEFORE INSERT trigger that set version := 0
-- would be reflected into `excluded` on an upsert and corrupt the UPDATE path's
-- version check, so insert-version relies on the default + the client sending 0.
-- A client lying about its own insert version only sabotages its own future
-- conflict detection (own-row RLS) — no cross-user impact.
alter table match_predictions     add column if not exists version integer not null default 0;
alter table predicted_progression add column if not exists version integer not null default 0;
alter table bonus_predictions     add column if not exists version integer not null default 0;

-- Shared BEFORE UPDATE trigger: expected-version check + server-side increment.
-- The incoming NEW.version is the version the client last read (echoed through
-- the upsert's SET version = excluded.version). If it disagrees with the stored
-- OLD.version, another write landed since — reject with a distinct SQLSTATE the
-- client can tell apart from lock / joker / rate-limit (all 'check_violation').
-- 'PT409' is a user-defined class (mnemonic: HTTP 409 Conflict); the client
-- treats it as a NON-retryable conflict, not a transient error.
create or replace function enforce_write_version()
returns trigger
language plpgsql
as $$
begin
  if new.version is distinct from old.version then
    raise exception 'prediction version conflict (expected %, stored %)',
      new.version, old.version
      using errcode = 'PT409';
  end if;
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists enforce_version_match_predictions on match_predictions;
create trigger enforce_version_match_predictions
  before update on match_predictions
  for each row execute function enforce_write_version();

drop trigger if exists enforce_version_predicted_progression on predicted_progression;
create trigger enforce_version_predicted_progression
  before update on predicted_progression
  for each row execute function enforce_write_version();

drop trigger if exists enforce_version_bonus_predictions on bonus_predictions;
create trigger enforce_version_bonus_predictions
  before update on bonus_predictions
  for each row execute function enforce_write_version();

-- ===========================================================================
-- PART B — submit_entry() bracket revalidation (safe partial)
--
-- Redefine submit_entry() consistent with how earlier migrations redefine
-- functions. PRESERVES every existing check verbatim (ownership, 36 group
-- predictions, the 1/1/2/4 bracket-bucket counts) and ADDS three structural
-- coherence checks. Nothing else changes; jokers / lock / rate-limit untouched.
-- ===========================================================================
create or replace function submit_entry(p_entry_id uuid) returns timestamptz as $$
declare
  v_user        uuid;
  v_tournament  uuid;
  v_group_total int;
  v_group_done  int;
  v_champion    int;
  v_final       int;
  v_sf          int;
  v_qf          int;
  v_prog_total  int;
  v_r16         int;
  v_foreign     int;
  v_when        timestamptz;
begin
  select user_id, tournament_id into v_user, v_tournament
    from entries where id = p_entry_id;
  if v_user is null or v_user <> (select auth.uid()) then
    raise exception 'Not your entry' using errcode = 'insufficient_privilege';
  end if;

  -- 1. Every group match predicted (a match_predictions row exists only with
  --    both scores, so a row == a complete prediction).
  select count(*) into v_group_total
    from matches m
    join entries e on e.id = p_entry_id
    where m.tournament_id = e.tournament_id and m.round = 'group';
  select count(*) into v_group_done
    from match_predictions mp
    join matches m on m.id = mp.match_id
    where mp.entry_id = p_entry_id and m.round = 'group';
  if v_group_done < v_group_total then
    raise exception 'Group predictions incomplete (% of %)', v_group_done, v_group_total
      using errcode = 'check_violation';
  end if;

  -- 2. Complete bracket: the winner-only progression must have the full shape
  --    (1 champion, 1 other finalist, 2 semi-finalists, 4 quarter-finalists).
  --    A complete bracket is only reachable once the group ties are resolved, so
  --    this also stands in for "no unresolved ties".
  select count(*) filter (where stage = 'champion'),
         count(*) filter (where stage = 'final'),
         count(*) filter (where stage = 'sf'),
         count(*) filter (where stage = 'qf')
    into v_champion, v_final, v_sf, v_qf
    from predicted_progression
    where entry_id = p_entry_id;
  if v_champion <> 1 or v_final <> 1 or v_sf <> 2 or v_qf <> 4 then
    raise exception 'Bracket incomplete — pick all 15 winners'
      using errcode = 'check_violation';
  end if;

  -- 2b. Structural coherence (safe partial — no bracket rebuild needed):
  --   * winner-only mode never stores an 'r16' row (a team reaching only the
  --     R16 won no knockout match), so any 'r16' row is corrupt/orphan;
  --   * the whole progression must be exactly the 8-row winner-only shape
  --     (1+1+2+4) — this rules out surplus rows the bucket counts above allow;
  --   * every progression team must belong to THIS entry's tournament (a row
  --     for a foreign team is impossible in a real bracket and only reachable by
  --     a hand-crafted write, since RLS scopes by entry, not tournament).
  -- The full check — that each winner is a valid participant of its tie given
  -- the entry's predicted R16 draw — is a separate, larger revalidation.
  select count(*), count(*) filter (where stage = 'r16')
    into v_prog_total, v_r16
    from predicted_progression
    where entry_id = p_entry_id;
  if v_r16 > 0 then
    raise exception 'Bracket has invalid round-of-16 rows — re-pick your winners'
      using errcode = 'check_violation';
  end if;
  if v_prog_total <> 8 then
    raise exception 'Bracket has % progression rows, expected 8', v_prog_total
      using errcode = 'check_violation';
  end if;
  select count(*) into v_foreign
    from predicted_progression pp
    where pp.entry_id = p_entry_id
      and not exists (
        select 1 from teams t
        where t.id = pp.team_id and t.tournament_id = v_tournament
      );
  if v_foreign > 0 then
    raise exception 'Bracket contains a team that is not in this tournament'
      using errcode = 'check_violation';
  end if;

  -- Stamp submission (idempotent — re-submitting keeps the first timestamp).
  update entries set submitted_at = coalesce(submitted_at, now())
    where id = p_entry_id
    returning submitted_at into v_when;
  return v_when;
end;
$$ language plpgsql;

revoke all on function submit_entry(uuid) from public;
grant execute on function submit_entry(uuid) to authenticated;

commit;

-- ===========================================================================
-- VERIFICATION QUERIES (run manually in the SQL editor; paste REAL rows/errors).
-- Pick one of your own entries + a match; set :entry / :match / :team first.
-- These are illustrative — adapt ids to live data.
-- ===========================================================================
--
-- (a) VERSION CONFLICT — a stale version is rejected with 'PT409':
--   -- read the current version first:
--   -- select version from match_predictions where id = '<row-id>';   (say it is 4)
--   update match_predictions set home_score = home_score, version = 3  -- stale (≠4)
--     where id = '<row-id>';
--   -- expect: ERROR  'prediction version conflict (expected 3, stored 4)'
--   --         SQLSTATE PT409
--
-- (b) CORRECT VERSION — succeeds and increments:
--   update match_predictions set home_score = home_score, version = 4  -- current
--     where id = '<row-id>';
--   select version from match_predictions where id = '<row-id>';  -- expect 5
--
-- (c) SUBMIT with a CORRUPTED progression row — rejected with the specific error.
--   -- On a complete, valid entry, insert an orphan 'r16' row, then submit:
--   insert into predicted_progression (entry_id, team_id, stage)
--     values ('<entry-id>', '<some-team-id>', 'r16');
--   select submit_entry('<entry-id>');
--   -- expect: ERROR 'Bracket has invalid round-of-16 rows — re-pick your winners'
--   -- (delete that row afterwards to restore the valid entry:
--   --  delete from predicted_progression where entry_id='<entry-id>' and stage='r16';)
--
--   -- Foreign-team variant (team from another tournament):
--   -- update predicted_progression set team_id='<team-from-OTHER-tournament>'
--   --   where entry_id='<entry-id>' and stage='champion';
--   -- select submit_entry('<entry-id>');
--   -- expect: ERROR 'Bracket contains a team that is not in this tournament'
--
-- (d) SUBMIT the VALID set — succeeds:
--   -- With a complete, uncorrupted entry (36 group predictions + the 8-row
--   -- 1/1/2/4 progression, all teams in-tournament):
--   select submit_entry('<entry-id>');
--   -- expect: a timestamptz (submitted_at), no error.
--
-- (e) TRIGGERS COMPOSE — a post-lock write is still rejected by the LOCK trigger
--     (not masked by the version trigger). With the tournament locked
--     (tournaments.lock_at <= now()) and the CORRECT version:
--   update match_predictions set home_score = 9, version = <current>
--     where id = '<row-id>';
--   -- expect: ERROR 'Predictions are locked — the tournament has started'
--   --         (the lock trigger fires before the version trigger by name order)
