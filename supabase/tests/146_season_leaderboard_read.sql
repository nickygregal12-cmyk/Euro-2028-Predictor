-- Contract 95: the bounded season leaderboard read.
--
-- The first season surface anything outside the database can reach, so this
-- file is mostly about the BOUNDARY rather than the arithmetic. The ranking is
-- contract 94's and is proven by a 600-season differential sweep and by
-- `145_season_standings.sql`; repeating it here would test the same code twice
-- and the access rules not at all.
--
-- THE RULE MOST WORTH PROTECTING is who may read a season's table. The
-- tournament leaderboard lets any authenticated user read any tournament's,
-- which is defensible for the one competition everybody is in. Seasons run side
-- by side — Premier League and Scottish Premiership already do — and a player
-- in one has no relationship with the players in the other, so copying that
-- grant would publish display names across unrelated leagues. A leak here would
-- not raise, would not log, and would look exactly like a working leaderboard.
--
-- The second is that `rank` and `points` come from contract 94 unchanged. The
-- read re-sorts TIES by display name, because entry-id order is meaningless to
-- a human, and that divergence is deliberate — but if it ever reached the rank
-- values it would be a silent scoring bug wearing presentation's clothes.

begin;
select plan(17);

-- ---------------------------------------------------------------------------
-- One season, three members and one outsider in a different season.
-- ---------------------------------------------------------------------------

create temporary table read_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
       (select id from public.tournaments where kind = 'league_season' order by name desc limit 1) as other_season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'LR' || n, 699 + n, 'league_matchweek', 'Leaderboard probe ' || n
from read_probe, generate_series(1, 2) n;

select set_config('test.c95_season', (select season_id::text from read_probe), true);
select set_config('test.c95_other', (select other_season_id::text from read_probe), true);
select set_config('test.c95_mw' || n,
  (select r.id::text from public.competition_rounds r join read_probe p on p.season_id = r.tournament_id
    where r.round_key = 'LR' || n), true)
from generate_series(1, 2) n;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('c95-' || n)::uuid, 'c95-' || n || '@example.test',
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 4) n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name)
select md5('c95-' || n)::uuid, 'Placeholder ' || n
from generate_series(1, 4) n
on conflict (id) do update set display_name = excluded.display_name;

insert into public.entries (tournament_id, user_id)
select season_id, md5('c95-' || n)::uuid from read_probe, generate_series(1, 3) n;
insert into public.entries (tournament_id, user_id)
select other_season_id, md5('c95-4')::uuid from read_probe;

select set_config('test.c95_entry' || n,
  (select e.id::text from public.entries e join read_probe p on p.season_id = e.tournament_id
    where e.user_id = md5('c95-' || n)::uuid), true)
from generate_series(1, 3) n;

-- The tied pair's names are assigned AGAINST their `md5(entry_id)` order, on
-- purpose. The read's final separator for identical names is that md5, so a
-- version that sorted by it before the name would produce the same answer about
-- half the time if names were assigned arbitrarily — and the mutant that does
-- exactly that survived a first draft of this file on that coin toss. Naming
-- the larger-md5 player 'Adam Blake' makes alphabetical order and md5 order
-- opposites, so only a read that consults the NAME first can pass.
update public.profiles set display_name = 'Adam Blake'
 where id = (select entry.user_id from public.entries entry
              where entry.id in (current_setting('test.c95_entry1')::uuid,
                                 current_setting('test.c95_entry2')::uuid)
              order by md5(entry.id::text) desc limit 1);
update public.profiles set display_name = 'Zoe Ainsworth'
 where id = (select entry.user_id from public.entries entry
              where entry.id in (current_setting('test.c95_entry1')::uuid,
                                 current_setting('test.c95_entry2')::uuid)
              order by md5(entry.id::text) asc limit 1);
update public.profiles set display_name = 'Mia Carter' where id = md5('c95-3')::uuid;
update public.profiles set display_name = 'Outsider' where id = md5('c95-4')::uuid;

select set_config('test.c95_adam',
  (select entry.id::text from public.entries entry
    where entry.id in (current_setting('test.c95_entry1')::uuid, current_setting('test.c95_entry2')::uuid)
    order by md5(entry.id::text) desc limit 1), true);
select set_config('test.c95_zoe',
  (select entry.id::text from public.entries entry
    where entry.id in (current_setting('test.c95_entry1')::uuid, current_setting('test.c95_entry2')::uuid)
    order by md5(entry.id::text) asc limit 1), true);

-- Adam and Zoe TIE on 12; Mia is on 20. Adam reaches 12 over two matchweeks and
-- Zoe over one, which is the ADR 0012 pairing. Rank is 1 (Mia), 2 (tied pair),
-- and the pair must come back Adam-then-Zoe by NAME rather than by md5.
insert into public.season_matchweek_scores (
  tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored)
values
  (current_setting('test.c95_season')::uuid, current_setting('test.c95_entry3')::uuid,
   current_setting('test.c95_mw1')::uuid, 20, false, 5),
  (current_setting('test.c95_season')::uuid, current_setting('test.c95_zoe')::uuid,
   current_setting('test.c95_mw1')::uuid, 12, false, 5),
  (current_setting('test.c95_season')::uuid, current_setting('test.c95_adam')::uuid,
   current_setting('test.c95_mw1')::uuid, 7, false, 5),
  (current_setting('test.c95_season')::uuid, current_setting('test.c95_adam')::uuid,
   current_setting('test.c95_mw2')::uuid, 5, false, 5);

-- ---------------------------------------------------------------------------
-- The boundary, before anything else.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.get_season_leaderboard(current_setting('test.c95_season')::uuid) $$,
  '42501',
  'Authentication is required',
  'an unauthenticated caller is refused — auth.uid() is null and nothing is read'
);

select set_config('request.jwt.claim.sub', md5('c95-4')::text, true);

select throws_ok(
  $$ select public.get_season_leaderboard(current_setting('test.c95_season')::uuid) $$,
  '42501',
  'This season is not yours to read',
  'and a player from ANOTHER season is refused — seasons run side by side, so their members are not co-members'
);

select is(
  (select count(*)::text from public.entries e
    where e.tournament_id = current_setting('test.c95_other')::uuid
      and e.user_id = md5('c95-4')::uuid),
  '1',
  'that outsider really is a registered player in a different season, so the refusal is the boundary rather than a missing account'
);

select throws_ok(
  $$ select public.get_season_leaderboard(
       '00000000-0000-4000-8000-000000000000'::uuid) $$,
  '22023',
  'Season is required',
  'a tournament or an unknown id is refused before membership is even considered'
);

-- ---------------------------------------------------------------------------
-- A member reads it.
-- ---------------------------------------------------------------------------

-- Sign in as Zoe, whichever of the two she turned out to be.
select set_config('request.jwt.claim.sub',
  (select entry.user_id::text from public.entries entry
    where entry.id = current_setting('test.c95_zoe')::uuid), true);
select set_config('test.c95_page',
  public.get_season_leaderboard(current_setting('test.c95_season')::uuid)::text, true);

select is(
  (current_setting('test.c95_page')::jsonb)->>'totalCount',
  '3',
  'a member sees every player in their season'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->0->>'displayName',
  'Mia Carter',
  'ranked by points, highest first'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->0->>'rank',
  '1',
  'and the rank comes from contract 94 unchanged'
);

-- Contract 94 would order the tied pair by entry id; this read orders them by
-- display name, and the names were assigned against the md5 order above so that
-- only a name-first sort can produce this answer.
select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->1->>'displayName',
  'Adam Blake',
  'a tie is broken by display name for display, not by the entry-id order the parity function uses'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->1->>'tied',
  'true',
  'and the row says it is tied, so equal ranks are explicable rather than looking like a numbering bug'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->1->>'rank',
  (current_setting('test.c95_page')::jsonb)->'rows'->2->>'rank',
  'the two tied players share a rank — the display re-sort must never reach the rank values'
);

-- The two tied players are on 12 points from TWO and ONE matchweeks. This is
-- the pairing ADR 0012 exists for, arriving intact at the surface: equal
-- points, unequal games played, and the read says so rather than showing two
-- identical-looking rows.
select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->1->>'matchweeksPlayed',
  '2',
  'matches played is carried through — the higher-named tied player took two matchweeks to reach 12'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->2->>'matchweeksPlayed',
  '1',
  'and the other reached the same 12 in one, which points alone would hide'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'rows'->1->>'points',
  (current_setting('test.c95_page')::jsonb)->'rows'->2->>'points',
  'on identical points, so the difference is games played and nothing else'
);

select is(
  (current_setting('test.c95_page')::jsonb)->'you'->>'displayName',
  'Zoe Ainsworth',
  'the caller''s own row is returned whatever page they asked for, so a player ranked 60th does not have to page to find themselves'
);

-- ---------------------------------------------------------------------------
-- Bounding.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_leaderboard(current_setting('test.c95_season')::uuid, 2)::jsonb)->>'hasMore',
  'true',
  'a page smaller than the season reports that there is more'
);

select is(
  (select jsonb_array_length(
     (public.get_season_leaderboard(
        current_setting('test.c95_season')::uuid, 2,
        (public.get_season_leaderboard(current_setting('test.c95_season')::uuid, 2)::jsonb)->>'nextCursor'
      )::jsonb)->'rows')::text),
  '1',
  'and its cursor returns the remainder exactly once — no repeat, no skip'
);

select throws_ok(
  $$ select public.get_season_leaderboard(
       current_setting('test.c95_season')::uuid, 50, 'not-a-cursor') $$,
  '22023',
  'Invalid leaderboard cursor',
  'a malformed cursor is refused rather than silently treated as page one'
);

select * from finish();
rollback;
