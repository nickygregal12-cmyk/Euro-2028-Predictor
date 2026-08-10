-- Contract 124: the Predictor Championship split actually happens.
--
-- THE ASSERTIONS THAT MATTER ARE THE TWO NOBODY HAS BEEN ABLE TO MAKE BEFORE.
--
-- First, that a split-phase row exists at all. Contracts 102, 105 and 120
-- persist, derive and read a phase that nothing has ever created, so
-- `cup_split_group_tables` has never returned a row and `get_season_cup_phase`'s
-- split branch has never been reachable from any state this database could get
-- into. This suite drives a real competition into that state.
--
-- Second, that the SMALLER HALF FINISHES EARLIER. ADR 0014 § Consequences
-- records "the smaller half finishes its round-robin earlier" as a behaviour
-- that needs stating rather than discovering mid-season. The field below is
-- five, deliberately: it splits three and two, the top half's round-robin
-- occupies three rounds and the bottom half's occupies one, so the bottom half
-- has no fixture in the competition's last two matchdays. A four-entrant field
-- would have split evenly and proved nothing about it.
--
-- Self-contained: its own season, its own clubs, its own users.

begin;

select plan(36);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('predictor_internal.transition_season_cup_to_split(uuid)') is not null,
  'the split driver exists');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name = 'transition_season_cup_to_split'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may split a Championship');

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'predictor_internal'
     and proc.proname = 'transition_season_cup_to_split'
     and proc.prosecdef and proc.proconfig @> array['search_path=""']),
  1,
  'and it is security definer with a pinned search path');

-- ---------------------------------------------------------------------------
-- Setup: a fifteen-matchweek season and a five-entrant private Championship.
--
-- Fifteen and five are chosen against `select_season_cup_format`, not by feel:
-- meetings = 15 / (5 - 1) = 3, which is ODD and therefore takes a split; the
-- league phase is 3 x 4 = 12 rounds; the halves are ceil(5/2) = 3 and 2; and a
-- three-player round-robin occupies three rounds because an odd half carries a
-- bye. 12 + 3 = 15 fits exactly, which is what makes the format return a split
-- tail rather than stepping down to two meetings.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C124 Split Probe', 2030, t.competition_id, 'scs-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.scs_season',
  (select id::text from public.tournaments where season_key = 'scs-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.scs_season')::uuid, 'Split Rovers'),
  (current_setting('test.scs_season')::uuid, 'Split United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.scs_season')::uuid, format('scs-mw%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 15) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select round.tournament_id, round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Split Rovers'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Split United'),
  now() + (round.ordinal * interval '7 days'), 'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.scs_season')::uuid
  and round.kind = 'league_matchweek';

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('scs-user-' || n)::uuid, format('scs-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('scs-user-' || n)::uuid, format('Scs Player %s', n), now()
from generate_series(1, 5) as n;

-- Contract 152 requires a private competition to carry a name, an owner and an
-- invite code. The split transition under test reads none of them.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at,
  name, owner_id, invite_code
) values (
  md5('scs-cup')::uuid, current_setting('test.scs_season')::uuid,
  'predictor_cup', true, 'active', true, 'private', now() - interval '2 days',
  'SCS Split Cup', md5('scs-user-1')::uuid, 'SCSCUP'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('scs-cup')::uuid, md5('scs-user-' || n)::uuid, now() - interval '1 day'
from generate_series(1, 5) as n;

-- ---------------------------------------------------------------------------
-- What refuses, and what is merely not yet.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select predictor_internal.transition_season_cup_to_split(%L::uuid)',
         md5('scs-missing')::uuid),
  '23503', null,
  'an unknown competition is refused rather than silently splitting nothing');

-- A Last Man Standing competition in the SAME probe season, so this does not
-- depend on what a seed happened to publish elsewhere.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at,
  name, owner_id, invite_code
) values (
  md5('scs-lms')::uuid, current_setting('test.scs_season')::uuid,
  'last_man_standing', true, 'active', false, 'private', now() - interval '2 days',
  'SCS Wrong Game', md5('scs-user-1')::uuid, 'SCSLMS'
);

select throws_ok(
  format('select predictor_internal.transition_season_cup_to_split(%L::uuid)',
         md5('scs-lms')::uuid),
  '23514', null,
  'only a Predictor Championship splits');

select is(
  predictor_internal.transition_season_cup_to_split(md5('scs-cup')::uuid)->>'outcome',
  'not_launched',
  'a Championship with no groups yet is not an error, it is one that has not started');

-- ---------------------------------------------------------------------------
-- Launch the league phase.
-- ---------------------------------------------------------------------------

select set_config('test.scs_launch',
  predictor_internal.launch_season_cup(md5('scs-cup')::uuid)::text, true);

select is(
  current_setting('test.scs_launch')::jsonb->>'outcome', 'launched',
  'the Championship launches');

select is(
  current_setting('test.scs_launch')::jsonb->'tail',
  jsonb_build_object('kind', 'split', 'topHalfSize', 3, 'bottomHalfSize', 2, 'splitRounds', 3),
  'and its recorded plan is a split into three and two over three rounds — the '
  'stored fact the transition reads rather than re-deriving');

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('scs-cup')::uuid),
  12,
  'the league phase occupies twelve windows');

-- An unsettled league phase is an ordinary state. THE SPLIT MUST NOT HAPPEN
-- HERE: a half assigned from a table that can still move is permanent, and
-- nothing downstream reopens a phase.
select is(
  predictor_internal.transition_season_cup_to_split(md5('scs-cup')::uuid)->>'outcome',
  'initial_phase_incomplete',
  'a league phase still in flight defers the split rather than taking it early');

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = md5('scs-cup')::uuid and phase_kind = 'split'),
  0,
  'and no split group was created on that path');

-- ---------------------------------------------------------------------------
-- Play the league phase out.
-- ---------------------------------------------------------------------------

-- The kickoffs move into the past as well as the statuses changing, because
-- that is what "played" means and because contract 110's calendar chooses the
-- split's rounds by their DERIVED lock instant. Leaving twelve played
-- matchweeks with future kickoffs would offer them to the split again.
update public.season_fixtures
   set status = 'played', home_score = 1::smallint, away_score = 0::smallint,
       kickoff_at = now() - interval '30 days'
 where id in (
   select link.season_fixture_id
     from public.season_cup_window_fixtures link
     join public.bonus_competition_windows win on win.id = link.window_id
    where win.competition_id = md5('scs-cup')::uuid);

update public.bonus_competition_windows
   set opens_at = now() - interval '30 days',
       locks_at = now() - interval '20 days'
 where competition_id = md5('scs-cup')::uuid;

select is(
  (select count(*)::integer from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('scs-cup')::uuid
      and fixture.stage = 'group'
      and not predictor_internal.cup_window_settled(fixture.window_id)),
  0,
  'every league fixture now sits in a settled window');

-- ---------------------------------------------------------------------------
-- THE SPLIT.
-- ---------------------------------------------------------------------------

select set_config('test.scs_split',
  predictor_internal.transition_season_cup_to_split(md5('scs-cup')::uuid)::text, true);

select is(
  current_setting('test.scs_split')::jsonb->>'outcome', 'split',
  'the transition runs');

select is(
  jsonb_build_object(
    'top', current_setting('test.scs_split')::jsonb->'topHalfSize',
    'bottom', current_setting('test.scs_split')::jsonb->'bottomHalfSize',
    'rounds', current_setting('test.scs_split')::jsonb->'splitRounds',
    'firstMatchday', current_setting('test.scs_split')::jsonb->'firstSplitMatchday'),
  jsonb_build_object('top', 3, 'bottom', 2, 'rounds', 3, 'firstMatchday', 13),
  'five splits three and two, and the competition''s round numbering CONTINUES '
  'at thirteen rather than restarting — matchday is the competition''s number, '
  'not the group''s');

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = md5('scs-cup')::uuid and phase_kind = 'split'),
  2,
  'exactly two split groups exist, which is the row nothing in this repository '
  'had ever written');

select is(
  (select count(*)::integer from public.bonus_cup_groups child
     join public.bonus_cup_groups parent on parent.id = child.parent_group_id
    where child.competition_id = md5('scs-cup')::uuid
      and child.phase_kind = 'split'
      and parent.phase_kind = 'initial'),
  2,
  'and both point at the one initial group they came from');

select is(
  (select array_agg(size order by size desc)::text
     from public.bonus_cup_groups
    where competition_id = md5('scs-cup')::uuid and phase_kind = 'split'),
  '{3,2}',
  'the LARGER half is the top one, as executeCupSplit and the format selector '
  'both compute it');

-- ---------------------------------------------------------------------------
-- Who went where, and what they kept.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('scs-cup')::uuid and phase_kind = 'split'),
  5,
  'every entrant holds a split membership — nobody is eliminated by a split');

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('scs-cup')::uuid and phase_kind = 'initial'),
  5,
  'and their initial membership is still there, permanent, beside it');

select is(
  (select array_agg(standing.group_rank order by standing.group_rank)::text
     from predictor_internal.cup_final_group_tables(md5('scs-cup')::uuid) standing
     join public.bonus_cup_members member
       on member.competition_id = md5('scs-cup')::uuid
      and member.user_id = standing.user_id
      and member.phase_kind = 'split'
     join public.bonus_cup_groups grp on grp.id = member.group_id
    where grp.size = 3),
  '{1,2,3}',
  'the top half is ranks one to three of the final initial table');

select is(
  (select array_agg(standing.group_rank order by standing.group_rank)::text
     from predictor_internal.cup_final_group_tables(md5('scs-cup')::uuid) standing
     join public.bonus_cup_members member
       on member.competition_id = md5('scs-cup')::uuid
      and member.user_id = standing.user_id
      and member.phase_kind = 'split'
     join public.bonus_cup_groups grp on grp.id = member.group_id
    where grp.size = 2),
  '{4,5}',
  'and the bottom half is ranks four and five');

select is(
  (select count(*)::integer
     from public.bonus_cup_members initial_row
     join public.bonus_cup_members split_row
       on split_row.competition_id = initial_row.competition_id
      and split_row.user_id = initial_row.user_id
      and split_row.phase_kind = 'split'
      and split_row.draw_number = initial_row.draw_number
    where initial_row.competition_id = md5('scs-cup')::uuid
      and initial_row.phase_kind = 'initial'),
  5,
  'draw numbers are CARRIED rather than reassigned — they terminate the '
  'tie-break sequence, and renumbering would quietly reorder identical entrants');

-- ---------------------------------------------------------------------------
-- The calendar, and the smaller half finishing early.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('scs-cup')::uuid),
  15,
  'three more windows were appended rather than the calendar being rebuilt');

select is(
  (select array_agg(distinct matchday order by matchday)::text
     from public.bonus_cup_fixtures
    where competition_id = md5('scs-cup')::uuid and stage = 'split'),
  '{13,14,15}',
  'the split is played over matchdays thirteen to fifteen');

select is(
  (select count(*)::integer from public.bonus_cup_fixtures fixture
     join public.bonus_cup_groups grp on grp.id = fixture.group_id
    where fixture.competition_id = md5('scs-cup')::uuid
      and fixture.stage = 'split' and grp.size = 3),
  3,
  'the three-player top half plays three rounds, because an odd half carries a bye');

select is(
  (select count(*)::integer from public.bonus_cup_fixtures fixture
     join public.bonus_cup_groups grp on grp.id = fixture.group_id
    where fixture.competition_id = md5('scs-cup')::uuid
      and fixture.stage = 'split' and grp.size = 2),
  1,
  'the two-player bottom half plays one');

-- THE stated behaviour from ADR 0014 § Consequences, asserted rather than
-- discovered mid-season.
select is(
  (select array_agg(distinct fixture.matchday order by fixture.matchday)::text
     from public.bonus_cup_fixtures fixture
     join public.bonus_cup_groups grp on grp.id = fixture.group_id
    where fixture.competition_id = md5('scs-cup')::uuid
      and fixture.stage = 'split' and grp.size = 2),
  '{13}',
  'so the SMALLER HALF FINISHES EARLIER — it has no fixture in matchdays '
  'fourteen or fifteen, and both halves still share one competition-wide '
  'round numbering');

-- ---------------------------------------------------------------------------
-- What the split made reachable, and what it must not have broken.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from predictor_internal.cup_split_group_tables(md5('scs-cup')::uuid)),
  5,
  'contract 105''s continuing table returns rows for the first time, which is '
  'what makes contract 120''s split branch reachable from a browser');

select is(
  (select count(*)::integer
     from predictor_internal.cup_final_group_tables(md5('scs-cup')::uuid) standing
     join public.bonus_cup_groups grp on grp.id = standing.group_id
    where grp.phase_kind = 'initial'),
  5,
  'the initial table still holds exactly five rows now that split memberships '
  'exist beside them');

select is(
  (select array_agg(standing.group_rank order by standing.group_rank)::text
     from predictor_internal.cup_final_group_tables(md5('scs-cup')::uuid) standing
     join public.bonus_cup_groups grp on grp.id = standing.group_id
    where grp.phase_kind = 'initial'),
  '{1,2,3,4,5}',
  'and still ranks them one to five — without the phase filter this contract '
  'added, every split entrant''s window totals would have been summed twice');

-- ---------------------------------------------------------------------------
-- Idempotence. A scheduled driver retries by design.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.transition_season_cup_to_split(md5('scs-cup')::uuid)->>'outcome',
  'already_split',
  'a second run reports the split it found rather than taking it again');

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = md5('scs-cup')::uuid and phase_kind = 'split'),
  2,
  'and creates no third group');

select is(
  (select count(*)::integer from public.bonus_cup_fixtures
    where competition_id = md5('scs-cup')::uuid and stage = 'split'),
  4,
  'nor a second set of fixtures under predictions already made against them');

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('scs-cup')::uuid),
  15,
  'nor three more windows');

select is(
  (select count(*)::integer from public.bonus_competition_audit
    where competition_id = md5('scs-cup')::uuid and action = 'championship_split'),
  1,
  'and the split is recorded once, with the plan it executed');

-- The widening this contract made is bounded by phase. Without this a later
-- reader could take "split halves may be two" as "groups may be two", which is
-- not what ADR 0014 says and not what was changed.
select throws_ok(
  format($q$insert into public.bonus_cup_groups (competition_id, ordinal, size, phase_kind)
            values (%L::uuid, 90, 2, 'initial')$q$, md5('scs-cup')),
  '23514', null,
  'a two-player GROUP STAGE is still refused — only a split half may hold two');

select * from finish();
rollback;
