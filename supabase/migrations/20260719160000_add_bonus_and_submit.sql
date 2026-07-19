-- Euro 2028 Predictor — bonus predictions (golden boot) + protected submission
--
-- Follow-up to the init migration; append-only (does not edit earlier files).
-- Adds:
--   * players            — tournament squad members, seeded EMPTY until squads
--                          are confirmed post-draw. The golden-boot picker reads
--                          this, so it shows an honest empty state for now.
--   * bonus_predictions  — one row per entry. Golden boot is a NULLABLE player
--                          reference. The group-stage total-goals bonus is never
--                          stored — it is derived from the entry's 36 predicted
--                          scores at scoring time (scoring-rules §4).
--   * submit_entry()     — the protected submit operation. Validates completeness
--                          server-side (never trusting the client) and stamps
--                          submitted_at. Submission does NOT freeze the entry:
--                          predictions stay editable until the real lock, and the
--                          entry stays submitted.
--
-- Idempotent (if not exists / or replace / drop-if-exists), so re-running is safe.

begin;

create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name          text not null,
  team_id       uuid references teams (id) on delete set null, -- null until squads mapped
  created_at    timestamptz not null default now()
);
create index if not exists players_tournament_idx on players (tournament_id);
create index if not exists players_team_idx on players (team_id);

create table if not exists bonus_predictions (
  id                    uuid primary key default gen_random_uuid(),
  entry_id              uuid not null references entries (id) on delete cascade,
  golden_boot_player_id uuid references players (id) on delete set null,
  updated_at            timestamptz not null default now(),
  unique (entry_id)
);
create index if not exists bonus_predictions_entry_idx on bonus_predictions (entry_id);

alter table players           enable row level security;
alter table bonus_predictions enable row level security;

-- players: reference data — readable to any authenticated user (like teams).
drop policy if exists "players readable" on players;
create policy "players readable" on players
  for select to authenticated using (true);

-- bonus_predictions: own rows only, via the parent entry.
drop policy if exists "own bonus_predictions" on bonus_predictions;
create policy "own bonus_predictions" on bonus_predictions
  for all to authenticated
  using (exists (
    select 1 from entries e
    where e.id = bonus_predictions.entry_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from entries e
    where e.id = bonus_predictions.entry_id and e.user_id = (select auth.uid())
  ));

-- The submit operation. Invoker-rights (runs under the caller's RLS), so the
-- completeness counts see only the caller's own predictions; ownership is also
-- checked explicitly. Raises a descriptive error when the entry isn't ready.
create or replace function submit_entry(p_entry_id uuid) returns timestamptz as $$
declare
  v_user        uuid;
  v_group_total int;
  v_group_done  int;
  v_champion    int;
  v_final       int;
  v_sf          int;
  v_qf          int;
  v_when        timestamptz;
begin
  select user_id into v_user from entries where id = p_entry_id;
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
