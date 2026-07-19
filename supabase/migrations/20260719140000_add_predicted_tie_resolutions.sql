-- Euro 2028 Predictor — manual tie-resolutions (scoring-rules §6 step 7,
-- tournament-structure §6).
--
-- Follow-up to 20260719120000_init_v0_1.sql. Migrations are append-only — this
-- adds a new table, it does not edit the applied initial migration.
--
-- When the automatic tie-break criteria can't separate a set of teams (a fully
-- level group block, or third-placed teams level on every predictable
-- criterion), the app asks the user to choose the order. That choice is stored
-- here, per entry, keyed by the SET of tied teams so it survives re-ordering of
-- how the tie happens to be listed. If the user later changes their scores and a
-- different set of teams ends up tied, the old row simply stops matching any
-- current tie (its team set no longer occurs) and is ignored by the domain
-- layer — no stale ordering can leak into a result.
--
-- `scope` records where the tie arose ('group' | 'third') for readability; the
-- (entry, tie_key) uniqueness is what actually enforces one ordering per tie.
-- `ordered_team_ids` is the user's chosen finishing order (best first) and is a
-- permutation of the tied set; the domain layer re-validates that on read.
--
-- Idempotent (if not exists) so re-running is harmless.

create table if not exists predicted_tie_resolutions (
  id               uuid primary key default gen_random_uuid(),
  entry_id         uuid not null references entries (id) on delete cascade,
  scope            text not null check (scope in ('group', 'third')),
  tie_key          text not null,   -- canonical sorted-join of the tied team ids
  ordered_team_ids uuid[] not null, -- chosen order (permutation of the tied set)
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (entry_id, tie_key)
);
create index if not exists predicted_tie_resolutions_entry_idx
  on predicted_tie_resolutions (entry_id);

alter table predicted_tie_resolutions enable row level security;

-- Own rows only, via the parent entry — same pattern as the other prediction
-- tables in the initial migration.
create policy "own predicted_tie_resolutions" on predicted_tie_resolutions
  for all to authenticated
  using (exists (
    select 1 from entries e
    where e.id = predicted_tie_resolutions.entry_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from entries e
    where e.id = predicted_tie_resolutions.entry_id and e.user_id = (select auth.uid())
  ));
