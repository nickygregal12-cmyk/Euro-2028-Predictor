-- Euro 2028 Predictor — server-side enforcement of the joker rules (scoring §1)
--
-- Follow-up to 20260719130000_add_match_prediction_joker.sql. Migrations are
-- append-only: this does NOT edit the earlier files. The joker column's follow-up
-- migration flagged two rules as inexpressible in column constraints and
-- requiring a server-side function — this is that function. The database is the
-- authority; the client only reflects these rules (jokerPolicy.ts), never
-- enforces them alone.
--
-- Rules enforced (both only when the joker flag is set or being changed — plain
-- score edits pass straight through):
--   1. Kickoff-commitment lock. A joker may only be set or cleared while its
--      match has NOT kicked off. It commits at that match's kickoff and can no
--      longer be moved or removed. kickoff_at null (times unconfirmed pre-draw)
--      counts as not-yet-kicked-off. This is per-match and independent of the
--      opening-match score lock.
--   2. Max five jokers per entry (a cross-row aggregate). One-per-match is
--      already guaranteed by match_predictions' unique (entry_id, match_id).
--
-- Idempotent: create-or-replace + drop-if-exists, so re-running is harmless.

begin;

create or replace function enforce_joker_rules() returns trigger as $$
declare
  ko timestamptz;
  joker_changed boolean;
begin
  joker_changed := (tg_op = 'INSERT' and new.joker)
                or (tg_op = 'UPDATE' and new.joker is distinct from old.joker);

  -- Only the joker flag is governed here; a pure score edit is none of our
  -- business (the score lock is a separate, tournament-wide concern).
  if not joker_changed then
    return new;
  end if;

  -- Rule 1 — kickoff-commitment lock.
  select kickoff_at into ko from matches where id = new.match_id;
  if ko is not null and ko <= now() then
    raise exception 'Joker on match % is locked at kickoff and cannot be changed', new.match_id
      using errcode = 'check_violation';
  end if;

  -- Rule 2 — max five jokers per entry (count the OTHER matches; this row is the
  -- fifth only if fewer than five are already placed elsewhere).
  if new.joker and (
    select count(*) from match_predictions
    where entry_id = new.entry_id and joker = true and match_id <> new.match_id
  ) >= 5 then
    raise exception 'Entry % already has the maximum of 5 jokers', new.entry_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_joker_rules_trg on match_predictions;
create trigger enforce_joker_rules_trg
  before insert or update on match_predictions
  for each row execute function enforce_joker_rules();

commit;
