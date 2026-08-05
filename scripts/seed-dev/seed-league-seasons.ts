#!/usr/bin/env -S node --experimental-strip-types
/**
 * Development seed for the two league seasons.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS SOLVES
 * ---------------------------------------------------------------------------
 *
 * `Premier League 2026/27` and `Scottish Premiership 2026/27` have existed as
 * `tournaments` rows since the C1b catalogue migration, and on development both
 * were completely empty: zero teams, zero matchweeks, zero fixtures. Every
 * season authority the repository has built — the Match Predictor card and its
 * locks, matchweek scoring, standings, Last Man Standing eligibility, the
 * Predictor Championship calendar and launch — reads from those three tables.
 * With them empty, all of it is unreachable code. Nothing can be entered,
 * locked, scored, settled or displayed.
 *
 * ---------------------------------------------------------------------------
 * THIS CALENDAR IS SYNTHETIC, AND SAYING SO IS THE POINT
 * ---------------------------------------------------------------------------
 *
 * These are NOT the real 2026/27 fixture lists, and the clubs are NOT the real
 * league members. They cannot be: the real fixture list is exactly what a
 * provider feed supplies, and which clubs are promoted into a 2026/27 season is
 * decided by a 2025/26 campaign this repository has no source for.
 *
 * So the club names are deliberately invented, in the same spirit as the Euro
 * seed's `Team A1`…`Team F4` placeholders — but shaped like club names, so a
 * screen full of them looks like the product rather than like a fixture file.
 * They are readable enough to review a UI with and impossible to mistake for a
 * real league table. Anyone who wants real fixtures needs the provider work,
 * and this seed is not a substitute for it — it is what makes the season
 * surfaces buildable and reviewable while that question is still open.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT GUARANTEES
 * ---------------------------------------------------------------------------
 *
 * A true double round-robin by the circle method: every club meets every other
 * exactly twice, once at home and once away, and plays exactly once per
 * matchweek. That last property is not decoration — `assert_season_fixture_shape`
 * refuses a second fixture for the same club in the same matchweek, so a
 * generator that got it wrong would be rejected by the database rather than
 * quietly producing a broken season.
 *
 * Kickoffs are written as `Europe/London` wall-clock times rather than as UTC
 * instants, so the August-to-May calendar crosses BST into GMT correctly.
 * Getting that wrong would not be cosmetic: matchweek locks derive from the
 * earliest kickoff, so an hour of drift moves when somebody's card shuts.
 *
 * ---------------------------------------------------------------------------
 * SAFETY
 * ---------------------------------------------------------------------------
 *
 * It only prints SQL. It opens no connection and cannot itself write anywhere,
 * so the act of running it is never the act of changing a database.
 *
 * The SQL it prints is idempotent and additive. Each season is wrapped in a
 * guard that does nothing at all if that season already has fixtures, so a
 * re-run cannot double a calendar, and it deletes nothing — there is no path
 * through this file that removes a row.
 *
 *   node --experimental-strip-types scripts/seed-dev/seed-league-seasons.ts > seed.sql
 */

type Season = {
  seasonRow: string
  roundPrefix: string
  clubs: string[]
  /** A Saturday. Matchweek 1 opens on it; each later matchweek is a week on. */
  firstSaturday: string
  /**
   * How many times every club meets every other before any split.
   *
   * Two is the ordinary double round-robin. THREE is the Scottish Premiership,
   * and it is not a variant of the same thing: with an odd number of meetings a
   * pair cannot be balanced, so one club hosts twice and the other once. That
   * asymmetry is the real competition, not a defect to smooth out.
   */
  meetings: number
  /**
   * Matchweeks that exist on the calendar with NO fixtures yet.
   *
   * The Scottish Premiership splits into a top and bottom six after 33 games
   * and plays five more, and who meets whom in those five is decided by the
   * table at the split. They cannot be seeded, and inventing them would be
   * worse than leaving them out: it would put a definite calendar where the
   * competition has an open one.
   *
   * So the rounds are created and left empty. That is a real state, not a gap —
   * `season_matchweek_lock_at` returns null for a matchweek with no fixtures,
   * and contract 109's round resolution already skips a round whose lock cannot
   * be derived. A matchweek nobody can lock is exactly what an undecided
   * post-split round is.
   */
  postSplitRounds: number
  /**
   * Kickoff slots, one per fixture in a matchweek, as [day offset from the
   * Saturday, wall-clock time]. Length must equal clubs.length / 2.
   */
  slots: Array<[number, string]>
}

const SEASONS: Season[] = [
  {
    seasonRow: 'Premier League 2026/27',
    roundPrefix: 'pl',
    firstSaturday: '2026-08-15',
    meetings: 2,
    postSplitRounds: 0,
    clubs: [
      'Ashcombe Town',
      'Barrowfield United',
      'Castleford Rovers',
      'Dunmoor City',
      'Eastcliff Athletic',
      'Fenwick Wanderers',
      'Granthorpe United',
      'Havenbrook City',
      'Ironbridge Town',
      'Kestrel Park Rangers',
      'Lynhaven Albion',
      'Marshgate United',
      'Northbury City',
      'Oakvale Rovers',
      'Pemberton Athletic',
      'Quarrydown Town',
      'Redhollow United',
      'Southmere City',
      'Thornwick Wanderers',
      'Westbourne Albion',
    ],
    slots: [
      [0, '12:30'],
      [0, '15:00'],
      [0, '15:00'],
      [0, '15:00'],
      [0, '15:00'],
      [0, '17:30'],
      [1, '14:00'],
      [1, '16:30'],
      [2, '20:00'],
      [0, '15:00'],
    ],
  },
  {
    // Twelve clubs meeting three times is 33 matchweeks, then the split adds
    // five more for 38 — the same total the twenty-club league reaches by a
    // different route.
    seasonRow: 'Scottish Premiership 2026/27',
    roundPrefix: 'sp',
    firstSaturday: '2026-08-01',
    meetings: 3,
    postSplitRounds: 5,
    clubs: [
      'Auchenmore Thistle',
      'Braemuir Rangers',
      'Craigmont United',
      'Drumlairn Athletic',
      'Eilanmore Rovers',
      'Fintrylaw Academical',
      'Glenmarnock County',
      'Inverdale Thistle',
      'Kilbrannan United',
      'Lochmara Rovers',
      'Muirhead Athletic',
      'Strathallan City',
    ],
    slots: [
      [0, '12:30'],
      [0, '15:00'],
      [0, '15:00'],
      [0, '15:00'],
      [1, '12:00'],
      [1, '15:00'],
    ],
  },
]

/**
 * One half of a round-robin by the circle method.
 *
 * Club 0 is fixed and the rest rotate around it. For n clubs that yields n-1
 * rounds in which every club appears exactly once — which is precisely the
 * property `assert_season_fixture_shape` enforces.
 *
 * The `round % 2` swap alternates which side of the fixed pairing is at home.
 * Without it club 0 would play its entire first meeting at home, which is not a
 * fixture list anybody would recognise.
 */
function singleRoundRobin(clubCount: number): Array<Array<[number, number]>> {
  const rotating = Array.from({ length: clubCount - 1 }, (_, index) => index + 1)
  const rounds: Array<Array<[number, number]>> = []

  for (let round = 0; round < clubCount - 1; round += 1) {
    const pairs: Array<[number, number]> = []
    pairs.push(round % 2 === 0 ? [0, rotating[0]] : [rotating[0], 0])

    for (let step = 1; step < clubCount / 2; step += 1) {
      pairs.push([rotating[step], rotating[rotating.length - step]])
    }
    rounds.push(pairs)
    rotating.unshift(rotating.pop()!)
  }
  return rounds
}

/**
 * `meetings` consecutive round-robins, each reversing the one before.
 *
 * With two meetings that is the familiar home-and-away season and every club
 * hosts every other exactly once. With three it cannot be: the third meeting
 * repeats the first's grounds, so each pair is 2-1 and each club ends on
 * `(n-1) + h` home fixtures, where `h` is its share of the first meeting. That
 * is how a twelve-club league produces 16 or 17 home games in 33 — an
 * unavoidable asymmetry of an odd number of meetings, and the real thing rather
 * than an artefact.
 */
function roundRobin(clubCount: number, meetings: number): Array<Array<[number, number]>> {
  const base = singleRoundRobin(clubCount)
  const schedule: Array<Array<[number, number]>> = []
  for (let meeting = 0; meeting < meetings; meeting += 1) {
    for (const round of base) {
      schedule.push(
        meeting % 2 === 1
          ? round.map(([home, away]) => [away, home] as [number, number])
          : round.map(([home, away]) => [home, away] as [number, number]),
      )
    }
  }
  return schedule
}

// ---------------------------------------------------------------------------
// The emitter
//
// What it prints is ONE self-contained `do` block that computes the schedule in
// SQL, rather than hundreds of literal fixture rows. Two reasons, and the
// second is the important one.
//
// The block is small enough to apply through any client without the payload
// itself becoming a source of error, and it stays small when a season grows.
//
// More importantly, the SQL implements the SAME circle method as `roundRobin`
// above — which is the tested one, held by property assertions and killed
// mutants in `tests/dev/seedLeagueSeasons.test.ts`. The two are compared round
// for round for every configured season. The TypeScript is the oracle; the SQL
// is the artifact.
//
// If the SQL below is ever edited, regenerate both and diff them again. A
// schedule defect is invisible in the output, because a wrong fixture list looks
// exactly like a right one until a table stops adding up in March.
// ---------------------------------------------------------------------------

function sqlArray(values: string[], indent: string): string {
  const quoted = values.map((value) => `'${value.replace(/'/g, "''")}'`)
  const lines: string[] = []
  let current = ''
  for (const [index, item] of quoted.entries()) {
    const piece = index === quoted.length - 1 ? item : `${item},`
    if (current.length + piece.length > 78) {
      lines.push(current)
      current = ''
    }
    current += piece
  }
  if (current !== '') lines.push(current)
  return `array[${lines.join(`\n${indent}`)}]`
}

function seasonTuple(season: Season): string {
  return [
    `      ('${season.seasonRow.replace(/'/g, "''")}', '${season.roundPrefix}', `
      + `date '${season.firstSaturday}', ${season.meetings}, ${season.postSplitRounds},`,
    `       ${sqlArray(season.clubs, '             ')},`,
    `       ${sqlArray(season.slots.map(([day, time]) => `${day} ${time}`), '             ')})`,
  ].join('\n')
}

function seedSql(): string {
  return `do $seed$
declare
  s record;
  v_season uuid;
  v_n integer;
  v_played integer;
  v_rounds integer;
begin
  for s in
    select * from (values
${SEASONS.map(seasonTuple).join(',\n')}
    ) as t(name, prefix, first_saturday, meetings, post_split_rounds, clubs, slots)
  loop
    select id into v_season from public.tournaments
     where name = s.name and kind = 'league_season';
    if v_season is null then
      raise exception 'Season % is not in this database', s.name;
    end if;

    v_n := array_length(s.clubs, 1);
    if v_n % 2 <> 0 then
      raise exception '% has an odd club count', s.name;
    end if;
    if array_length(s.slots, 1) <> v_n / 2 then
      raise exception '% declares % kickoff slots for % fixtures per matchweek',
        s.name, array_length(s.slots, 1), v_n / 2;
    end if;
    if extract(dow from s.first_saturday) <> 6 then
      raise exception '% does not start on a Saturday', s.name;
    end if;

    -- Idempotent and all-or-nothing. A season that already has fixtures is left
    -- exactly as it is rather than topped up: a half-seeded calendar is harder
    -- to reason about than either state, and nothing here deletes a row.
    if exists (select 1 from public.season_fixtures where tournament_id = v_season) then
      raise notice '% already has fixtures; left untouched', s.name;
      continue;
    end if;

    v_played := s.meetings * (v_n - 1);
    v_rounds := v_played + s.post_split_rounds;

    insert into public.teams (tournament_id, name)
    select v_season, club from unnest(s.clubs) as club
    on conflict (tournament_id, name) do nothing;

    -- Every matchweek exists, including the post-split ones whose fixtures are
    -- not yet decidable. They are labelled so an empty round reads as an open
    -- one rather than as a hole.
    insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    select v_season, format('%s-mw%s', s.prefix, n), n, 'league_matchweek',
           case when n > v_played then format('Matchweek %s (post-split)', n)
                else format('Matchweek %s', n) end
    from generate_series(1, v_rounds) as n
    on conflict (tournament_id, round_key) do nothing;

    -- Circle method: club 0 is fixed and the rest rotate around it, which is
    -- what gives every club exactly one fixture per matchweek -- the property
    -- assert_season_fixture_shape enforces. Each meeting reverses the one
    -- before, so an even number of meetings balances the grounds and an odd
    -- number leaves each pair 2-1, which is the Scottish competition as played.
    --
    -- Kickoffs are Europe/London wall-clock, so the August-to-May crossing of
    -- BST into GMT is correct; matchweek locks derive from the earliest kickoff,
    -- so an hour of drift would move when a card shuts.
    insert into public.season_fixtures (
      tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
    )
    select v_season, round.id, home.id, away.id,
           ((s.first_saturday
              + ((plan.mw - 1) * 7 + split_part(s.slots[plan.i + 1], ' ', 1)::integer))
             || ' ' || split_part(s.slots[plan.i + 1], ' ', 2) || ':00 Europe/London')::timestamptz,
           'scheduled'
    from (
      with half as (
        select r, i,
          case when i = 0 then 0
               else ((i - r) % (v_n-1) + (v_n-1)) % (v_n-1) + 1 end as x,
          case when i = 0 then ((0 - r) % (v_n-1) + (v_n-1)) % (v_n-1) + 1
               else ((v_n-1-i - r) % (v_n-1) + (v_n-1)) % (v_n-1) + 1 end as y
        from generate_series(0, v_n - 2) r, generate_series(0, v_n / 2 - 1) i
      ), oriented as (
        select r, i,
          case when i = 0 and r % 2 = 1 then y else x end as h,
          case when i = 0 and r % 2 = 1 then x else y end as a
        from half
      )
      select m * (v_n - 1) + oriented.r + 1 as mw, oriented.i,
             case when m % 2 = 1 then oriented.a else oriented.h end as h,
             case when m % 2 = 1 then oriented.h else oriented.a end as a
      from oriented, generate_series(0, s.meetings - 1) m
    ) plan
    join public.competition_rounds round
      on round.tournament_id = v_season
     and round.round_key = format('%s-mw%s', s.prefix, plan.mw)
    join public.teams home on home.tournament_id = v_season and home.name = s.clubs[plan.h + 1]
    join public.teams away on away.tournament_id = v_season and away.name = s.clubs[plan.a + 1];

    raise notice '% seeded: % clubs, % played matchweeks (+ % post-split), % fixtures',
      s.name, v_n, v_played, s.post_split_rounds, v_played * (v_n / 2);
  end loop;
end;
$seed$;
`
}

function main() {
  process.stdout.write(
    [
      `-- Development seed for the league seasons. GENERATED -- do not hand-edit.`,
      `-- Source: scripts/seed-dev/seed-league-seasons.ts`,
      `--`,
      `-- The clubs and the calendar are INVENTED. They are not the real 2026/27`,
      `-- league members and not the real fixture lists; a real calendar comes from`,
      `-- a provider feed, which is the open Stage D question. This exists so the`,
      `-- season authorities already in the repository have something to run on.`,
      `--`,
      `-- Post-split matchweeks are created WITHOUT fixtures, because who meets whom`,
      `-- after a split is decided by the table at the split.`,
      `--`,
      `-- Idempotent and additive: it deletes nothing, and a season that already has`,
      `-- fixtures is left untouched.`,
      ``,
      seedSql(),
    ].join('\n'),
  )
}

export { roundRobin, singleRoundRobin, seedSql, SEASONS }

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main()
