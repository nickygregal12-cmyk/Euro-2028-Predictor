-- Contract 173: the action centre's settled-matchweek recap.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the trap in the header of
-- `20260811233000_matchweek_settled_actions.sql`. Contract 170's expiry sweep
-- closes any open item whose `context ->> 'round_id'` names a LOCKED round. A
-- settled matchweek's round is locked by definition, so a recap that recorded
-- its round under that key would be generated and then invalidated by the very
-- next sweep — for ever, with both functions behaving exactly as written and
-- the only symptom an empty inbox.
--
-- The migration asserts the key is spelled differently. This suite asserts the
-- BEHAVIOUR: generate a recap for a settled matchweek, run the sweep, and
-- require the item to still be open. A source assertion cannot catch a sweep
-- that grows a third authority; running it can.
--
-- The second is that a recap never becomes an email: it carries no deadline,
-- and contract 163's scheduler selects on `deadline_at is not null`.

begin;

select plan(13);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C173 Settled Recap', 2057, t.competition_id, 'settled-recap', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.sr_season',
  (select id::text from public.tournaments where season_key = 'settled-recap'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('sr-t1')::uuid, current_setting('test.sr_season')::uuid, 'SR Rovers'),
  (md5('sr-t2')::uuid, current_setting('test.sr_season')::uuid, 'SR United');

-- TWO settled matchweeks, one inside the seven-day window and one long past.
-- The old one is the backlog case: a season with thirty-eight settled
-- matchweeks must not post thirty-eight recaps the first time the job runs.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values
  (md5('sr-r1')::uuid, current_setting('test.sr_season')::uuid, 'sr-mw1', 1,
   'league_matchweek', 'Matchweek 1',
   now() - interval '90 days', now() - interval '84 days'),
  (md5('sr-r2')::uuid, current_setting('test.sr_season')::uuid, 'sr-mw2', 2,
   'league_matchweek', 'Matchweek 2',
   now() - interval '10 days', now() - interval '4 days');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values
  (md5('sr-f1')::uuid, current_setting('test.sr_season')::uuid, md5('sr-r1')::uuid,
   md5('sr-t1')::uuid, md5('sr-t2')::uuid, now() - interval '88 days', 'scheduled'),
  (md5('sr-f2')::uuid, current_setting('test.sr_season')::uuid, md5('sr-r2')::uuid,
   md5('sr-t1')::uuid, md5('sr-t2')::uuid, now() - interval '6 days', 'scheduled');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('sr-player')::uuid, 'sr-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
values (md5('sr-player')::uuid, 'Recap Rita', now());

insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.sr_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '120 days');

-- Inserted directly, so the entry trigger resolves the game competition and
-- the membership rather than this file guessing at either.
insert into public.entries (id, user_id, tournament_id)
values (md5('sr-entry')::uuid, md5('sr-player')::uuid, current_setting('test.sr_season')::uuid);

-- The banked totals. These are the ONLY source of the recap's figures: a recap
-- that recomputed anything could disagree with the standings.
insert into public.season_matchweek_scores (
  tournament_id, entry_id, competition_round_id, points, joker_applied,
  fixtures_scored, settled_at)
values
  (current_setting('test.sr_season')::uuid, md5('sr-entry')::uuid, md5('sr-r1')::uuid,
   9, false, 1, now() - interval '80 days'),
  (current_setting('test.sr_season')::uuid, md5('sr-entry')::uuid, md5('sr-r2')::uuid,
   14, true, 1, now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- SELECTION: the recent one only
-- ---------------------------------------------------------------------------

select is(
  (public.process_player_action_items() ->> 'matchweek_settled_actions_written')::integer,
  1,
  'one recap is written — for the matchweek settled two days ago, not the one settled eighty');

select is(
  (select item.context ->> 'ordinal'
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  '2',
  'and it names the matchweek it is about');

select is(
  (select item.context ->> 'points'
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  '14',
  'carrying the banked total rather than a recomputed one');

select is(
  (select item.context ->> 'joker_applied'
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  'true',
  'and whether the Joker was played, which is the fact the recap is worth reading for');

-- ---------------------------------------------------------------------------
-- THE TRAP. This is the assertion the suite exists for.
-- ---------------------------------------------------------------------------

select is(
  (select item.context ->> 'round_id'
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  null,
  'the context does NOT carry round_id — the sweep treats that key as a lock authority');

select is(
  (select item.context ->> 'settled_round_id'
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  md5('sr-r2')::uuid::text,
  'it carries the round under a name of its own');

-- Run the whole driver again, which runs the sweep. The recap's round IS
-- locked — it has been played and settled — so a `round_id` key would close it
-- here.
select is(
  (public.process_player_action_items() ->> 'matchweek_settled_actions_written')::integer,
  0,
  'a second run writes nothing new, because the key is derived from the matchweek');

select is(
  (select item.invalidated_at is null
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  true,
  'AND THE RECAP SURVIVES THE SWEEP, although the matchweek it describes has locked');

-- ---------------------------------------------------------------------------
-- IT NEVER BECOMES AN EMAIL
-- ---------------------------------------------------------------------------

select is(
  (select item.deadline_at
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  null,
  'a recap has no deadline, because there is nothing to do by a time');

select is(
  (select count(*)::integer from public.reminder_deliveries delivery
    where delivery.action_key like 'matchweek_settled:%'),
  0,
  'so contract 163''s scheduler never queues it — that function selects deadline_at is not null');

select is(
  (select item.priority::integer
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  5,
  'and it ranks below everything that must be done');

-- ---------------------------------------------------------------------------
-- EXPIRY IS THE EXISTING SWEEP, NOT A NEW PATH
-- ---------------------------------------------------------------------------

-- Age the matchweek past the window rather than editing the item's expiry
-- directly. Editing `expires_at` alone would prove nothing: the generator still
-- selects a matchweek settled two days ago and would simply write the expiry
-- back, which is the correct behaviour and would make this assertion a test of
-- the test. Seven days on, the generator stops selecting it and the stored
-- expiry is the only thing that can close it — which is the real sequence.
update public.season_matchweek_scores
   set settled_at = now() - interval '8 days'
 where tournament_id = current_setting('test.sr_season')::uuid
   and competition_round_id = md5('sr-r2')::uuid;

update public.player_action_items
   set expires_at = now() - interval '1 day'
 where tournament_id = current_setting('test.sr_season')::uuid
   and action_type = 'matchweek_settled';

select set_config('test.sr_expiry_run',
  public.process_player_action_items()::text, true);

select is(
  (select item.invalidated_at is not null
     from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'),
  true,
  'once its seven days are up the existing expiry sweep closes it, with no new expiry path');

-- ---------------------------------------------------------------------------
-- AND IT DOES NOT COME BACK
-- ---------------------------------------------------------------------------

select set_config('test.sr_later_run',
  public.process_player_action_items()::text, true);

select is(
  (select count(*)::integer from public.player_action_items item
    where item.tournament_id = current_setting('test.sr_season')::uuid
      and item.action_type = 'matchweek_settled'
      and item.invalidated_at is null),
  0,
  'a later run does not resurrect a closed recap, so a cleared inbox stays cleared');

select * from finish();
rollback;
