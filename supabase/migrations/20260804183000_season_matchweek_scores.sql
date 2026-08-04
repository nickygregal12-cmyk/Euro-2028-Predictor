-- Contract 90: where a season Main Predictor score is kept.
--
-- The season has had scoring RULES since contract 70 — `season_fixture_points`
-- and `season_matchweek_points` — and nowhere to put an answer.
-- `season_matchweek_points` is referenced by no other migration: it is a
-- function nothing calls. So a player can predict a matchweek, have their card
-- submitted at the lock by contract 83, and see results confirmed, and not one
-- point is computed or stored. There is no season leaderboard, and there cannot
-- be one until something writes a total down.
--
-- This is the same shape of gap that made season Last Man Standing selection
-- impossible for twenty-odd contracts: authorities land, nothing drives them,
-- and the roadmap's "Main Predictor scoring has a PostgreSQL counterpart" is
-- true of the pure functions while hiding that no caller exists.
--
-- This contract adds the STORE only. The job that fills it is next, and needs
-- one thing this table deliberately does not decide — see the last section.
--
-- ---------------------------------------------------------------------------
-- WHY A SEPARATE STORE AND NOT `score_events`
-- ---------------------------------------------------------------------------
--
-- ADRs 0011 and 0015 keep competition entries, scoring and standings separate,
-- and no combined cross-competition scoring path is permitted. That decides it
-- on authority. The shapes also differ enough that sharing would be a lie:
-- `score_events` carries `category`, `match_id` and `team_id` because the
-- tournament scores group matches, group positions, knockouts and awards
-- against `matches` and `teams`. A season matchweek has none of those
-- dimensions. It has a matchweek and a Joker.
--
-- ---------------------------------------------------------------------------
-- WHY MATCHWEEK GRANULARITY AND NOT PER FIXTURE
-- ---------------------------------------------------------------------------
--
-- The tournament stores one row per scoring event. The obvious move is to
-- mirror it. The consumer says otherwise: `src/domain/season/standings.ts`
-- takes `SettledMatchweekTotal { matchweek, points }` and states that totals
-- arrive "already settled (and already Joker-doubled)". Every derived view it
-- offers — matchweek winners, rolling form, monthly tables,
-- points-per-matchweek-played — computes from those totals and nothing finer.
--
-- A per-fixture breakdown is re-derivable at any time from the predictions and
-- the results through `season_fixture_points`, which is how a player-facing
-- explanation should be built: derived on read, so it cannot disagree with the
-- stored total. Storing it as well would be a second copy of the same truth,
-- roughly ten times the rows, and one more thing to keep in step.
--
-- ---------------------------------------------------------------------------
-- A ROW MEANS A MATCHWEEK HAS SETTLED
-- ---------------------------------------------------------------------------
--
-- `standings.ts` counts matchweeks played as the number of settled totals, and
-- is explicit about why that number matters: "two players on 84 points from 22
-- and 23 matchweeks are not tied in meaning". So a row must not exist for a
-- matchweek that has not settled. A writer that inserted a zero for every
-- future matchweek would leave every player showing a full season played, and
-- the games-in-hand reading the authority insists on would be destroyed while
-- every points total stayed correct.
--
-- Absence is therefore meaningful here, which is unusual enough to say once:
-- no row is not zero points, it is no matchweek.
--
-- ---------------------------------------------------------------------------
-- THE JOKER INVARIANT, WHICH IS A RULE AND NOT A FORMATTING CHOICE
-- ---------------------------------------------------------------------------
--
-- `points` is the SETTLED figure, after any Joker, because that is what the
-- consumer is documented to receive. ADR 0012's Joker doubles a matchweek, and
-- doubling an integer always produces an even one — so a Joker matchweek whose
-- stored total is odd is arithmetically impossible and means the writer applied
-- the Joker wrongly. The CHECK below says so.
--
-- It is deliberately tied to the doubling rule rather than left implicit: if a
-- future authority makes the Joker something other than a doubling, this
-- constraint fails loudly and forces the change to be made on purpose.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS TABLE DOES NOT DECIDE, AND WHAT THAT MEANS FOR THE NEXT CONTRACT
-- ---------------------------------------------------------------------------
--
-- It does not define when a matchweek has settled. That is
-- `src/domain/season/matchweekSettlement.ts`, which distinguishes abandoned
-- (partial score does not stand) from void (leaves the matches-played
-- denominator) from moved-away, and it has NO SQL counterpart yet. The table
-- records `settled_at` and trusts its writer.
--
-- So the scoring job cannot be written correctly before that parity exists: a
-- job that settles on "every fixture has a score" would count a void fixture as
-- played and mis-state the denominator the standings authority depends on.
-- Settlement parity comes first, then the job.
--
-- There is deliberately no `calculation_version`. The tournament has one, but
-- this projection is fully re-derived on every run, so a stale row cannot
-- survive to be detected — the column would always equal itself, which is the
-- dead-control pattern contract 87 caught by mutation testing.

begin;

create table public.season_matchweek_scores (
  tournament_id uuid not null,
  entry_id uuid not null,
  competition_round_id uuid not null,

  -- The settled total, after any Joker. See the header.
  points integer not null,

  joker_applied boolean not null default false,

  -- How many fixtures contributed. Distinguishes "nothing played" from
  -- "played and scored nothing", which a bare zero cannot.
  fixtures_scored smallint not null,

  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One settled total per entry per matchweek.
  primary key (entry_id, competition_round_id),

  -- Composite keys, so an entry and a round cannot be paired across seasons.
  -- The plain single-column form would let one season's entry hold a score in
  -- another season's matchweek, which ADR 0011's separation forbids and which
  -- no amount of application care would reliably prevent.
  constraint season_matchweek_scores_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_scores_round_fkey
    foreign key (tournament_id, competition_round_id)
    references public.competition_rounds(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_scores_points_non_negative
    check (points >= 0),

  constraint season_matchweek_scores_fixtures_non_negative
    check (fixtures_scored >= 0),

  -- ADR 0012's Joker doubles the matchweek, and a doubled integer is even.
  constraint season_matchweek_scores_joker_doubles
    check (not joker_applied or points % 2 = 0),

  -- Points cannot come from nowhere. A total above zero with no contributing
  -- fixture is the signature of a writer scoring a matchweek that had no
  -- results, and it would inflate a leaderboard silently.
  constraint season_matchweek_scores_points_need_fixtures
    check (fixtures_scored > 0 or points = 0)
);

comment on table public.season_matchweek_scores is
  'Settled season Main Predictor totals, one row per entry per matchweek. A '
  'PROJECTION re-derived from predictions and results, never a ledger. The '
  'presence of a row means the matchweek has settled: absence is not zero '
  'points, it is no matchweek, and `standings.ts` counts rows as matchweeks '
  'played.';

comment on column public.season_matchweek_scores.points is
  'The settled total AFTER any Joker doubling, which is what '
  'src/domain/season/standings.ts is documented to receive.';

-- Matchweek-wide reads — the leaderboard, matchweek winners, monthly tables —
-- all filter by round. The entry side is already served by the primary key.
create index season_matchweek_scores_round_idx
  on public.season_matchweek_scores (tournament_id, competition_round_id);

alter table public.season_matchweek_scores enable row level security;

-- Unreachable from the browser, like every other season table. Totals will
-- reach a player through a bounded server read, not through direct selection,
-- so that one player cannot enumerate another's season.
revoke all on table public.season_matchweek_scores from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The shape a foreign key cannot express.
--
-- The composite keys bind an entry and a round to one competition. They cannot
-- say that the competition is a LEAGUE SEASON and the round is a MATCHWEEK — a
-- tournament's knockout round would satisfy both keys perfectly. Mirrors
-- `assert_season_fixture_shape`, which guards the same boundary for fixtures.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_season_matchweek_score_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_round_kind text;
begin
  select kind into v_kind
    from public.tournaments
   where id = new.tournament_id;

  if v_kind is distinct from 'league_season' then
    raise exception 'Season matchweek scores belong to a league season, not a % competition',
      coalesce(v_kind, 'missing')
      using errcode = '23514';
  end if;

  select kind into v_round_kind
    from public.competition_rounds
   where id = new.competition_round_id;

  if v_round_kind is distinct from 'league_matchweek' then
    raise exception 'Season matchweek scores attach to a league matchweek, not a % round',
      coalesce(v_round_kind, 'missing')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_season_matchweek_score_shape()
  from public, anon, authenticated;

create trigger assert_season_matchweek_score_shape
before insert or update on public.season_matchweek_scores
for each row
execute function predictor_internal.assert_season_matchweek_score_shape();

-- ---------------------------------------------------------------------------
-- Prove at apply time that the Joker invariant bites.
--
-- The two CHECKs above are the only things in this contract that encode a rule
-- rather than a relationship, and a CHECK that is satisfied by everything is
-- worse than none — it reads as protection. A Joker matchweek with an odd total
-- is arithmetically impossible, so it must be refused.
-- ---------------------------------------------------------------------------

do $$
declare
  v_refused boolean := false;
begin
  create temporary table season_matchweek_scores_invariant_probe (
    points integer not null,
    joker_applied boolean not null,
    fixtures_scored smallint not null,
    constraint probe_joker_doubles check (not joker_applied or points % 2 = 0),
    constraint probe_points_need_fixtures check (fixtures_scored > 0 or points = 0)
  ) on commit drop;

  begin
    insert into season_matchweek_scores_invariant_probe values (7, true, 3);
  exception when check_violation then
    v_refused := true;
  end;

  if not v_refused then
    raise exception
      'an odd total on a Joker matchweek was accepted; the doubling rule is not enforced';
  end if;

  v_refused := false;
  begin
    insert into season_matchweek_scores_invariant_probe values (5, false, 0);
  exception when check_violation then
    v_refused := true;
  end;

  if not v_refused then
    raise exception
      'points were accepted with no contributing fixture; a leaderboard could be inflated silently';
  end if;

  -- And the legitimate shapes are accepted, or the constraints are simply a
  -- wall rather than a rule.
  insert into season_matchweek_scores_invariant_probe values (14, true, 4);
  insert into season_matchweek_scores_invariant_probe values (7, false, 3);
  insert into season_matchweek_scores_invariant_probe values (0, false, 0);
end;
$$;

commit;
