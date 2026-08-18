import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 197 — one chronological calendar across the player's competitions.
 *
 * WHAT THIS SUITE EXISTS FOR is the drift risk. A second fixture read means two
 * projections of the same match, and if they diverge a player sees two versions
 * of it. `245_my_football_calendar.sql` guards that behaviourally — it runs both
 * reads over the same window and requires identical objects — and these
 * assertions hold the properties that survive a rewrite, plus the ones the
 * differential cannot see: scope, bounds, and what is deliberately absent.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const testsDirectory = resolve(repositoryRoot, 'supabase/tests')

const CONTRACT_111 = '20260809090000_season_fixtures_read.sql'
const CONTRACT_197 = '20260818020000_my_football_calendar.sql'
const SUITE_197 = '245_my_football_calendar.sql'

function read(directory: string, file: string): string {
  return readFileSync(resolve(directory, file), 'utf8')
}

function withoutComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

const migration = read(migrationsDirectory, CONTRACT_197)
const seasonRead = withoutComments(read(migrationsDirectory, CONTRACT_111))
const suite = read(testsDirectory, SUITE_197)

/**
 * The calendar function's own body. Scoped deliberately: the migration's
 * apply-time guards quote the strings they check for, so an assertion over the
 * whole file matches the guard rather than the code.
 */
const calendar = withoutComments(
  migration.slice(
    migration.indexOf('as $calendar$'),
    migration.indexOf('$calendar$;') + '$calendar$;'.length,
  ),
)

describe('the fixture card is contract 111’s, and that is measured', () => {
  it('runs both reads and requires identical objects rather than comparing them by eye', () => {
    expect(suite).toContain('public.get_season_fixtures(')
    expect(suite).toContain('public.get_my_football_calendar(')
    // Substring without the apostrophes: the SQL doubles them, so matching the
    // whole sentence would compare against escaped text.
    expect(suite).toContain('fixture cards are IDENTICAL to the season read')
  })

  it('proves the differential is not vacuous', () => {
    // THE ASSERTION ABOUT THE ASSERTION. A comparison over an empty array
    // passes against any implementation.
    expect(suite).toContain('the season really did return more than one card to compare')
  })

  it('keeps the round a label rather than the grouping key', () => {
    // Contract 111's decision, and the owner's amendment: a fixture moved to
    // November still says "Matchweek 5" and still sorts into November.
    for (const source of [seasonRead, calendar]) {
      expect(source).toContain("'round', jsonb_build_object(")
      expect(source).toContain("'ordinal', round.ordinal,")
    }
  })

  it('keeps what settled and what a provider says in different fields', () => {
    for (const source of [seasonRead, calendar]) {
      expect(source).toContain("'result', case when fixture.status = 'played'")
      expect(source).toContain("'live', case when live.season_fixture_id is not null")
    }
  })

  it('does not rewrite the season read to share the code', () => {
    // The season fixture surface's hot read is left alone on purpose. The
    // differential gives the same protection against drift without operating
    // on it, and a refactor justified only by tidiness is not this contract's.
    expect(migration).not.toContain('get_season_fixtures(uuid, timestamptz, timestamptz)\n)')
    expect(migration).not.toContain('create or replace function public.get_season_fixtures')
  })
})

describe('scope is the caller’s own competitions', () => {
  it('takes the seasons from the entries authority every season read already uses', () => {
    expect(calendar).toContain('mine_entry.user_id = v_uid')
    expect(calendar).toContain('from public.entries entry')
    expect(suite).toContain('holds nothing from a season the caller did not enter')
  })

  it('excludes the tournament shape, as the season read refuses it', () => {
    expect(calendar).toContain("season.kind = 'league_season'")
    expect(seasonRead).toContain("v_season.kind <> 'league_season'")
  })

  it('requires authentication and grants execute to nobody else', () => {
    expect(calendar).toContain("raise exception 'Authentication is required'")
    expect(migration).toContain(
      'revoke all on function public.get_my_football_calendar(timestamptz, timestamptz)\n  from public, anon, service_role;',
    )
    expect(migration).toContain(
      'grant execute on function public.get_my_football_calendar(timestamptz, timestamptz)\n  to authenticated;',
    )
  })
})

describe('it is bounded exactly as the read it copies', () => {
  it('carries contract 111’s window, span and page limits', () => {
    for (const source of [seasonRead, calendar]) {
      expect(source).toContain("interval '7 days'")
      expect(source).toContain("interval '14 days'")
      expect(source).toContain("interval '120 days'")
      expect(source).toContain('limit 500')
    }
  })

  it('states the expected message slot explicitly on every throws_ok', () => {
    // pgTAP's THREE-argument `throws_ok` takes the expected MESSAGE, not the
    // description. Passing the description compiles, runs, and fails in CI
    // against a correct implementation -- which it did here. Every call in this
    // suite uses the four-argument form with a null message.
    const threeArg = suite.match(/throws_ok\(\s*\$\$[^$]*\$\$,\s*'[^']+',\s*'/g) ?? []
    expect(threeArg).toEqual([])
  })

  it('refuses an inverted or oversized window rather than returning empty', () => {
    expect(calendar).toContain("raise exception 'The window must end after it starts'")
    expect(calendar).toContain('A fixture window may not exceed 120 days')
    expect(suite).toContain('a window that ends before it starts is refused rather than returned empty')
  })

  it('re-checks that the season read still holds the bounds it copied', () => {
    // If contract 111's limits ever move, this contract's copy becomes a second
    // answer to "how much football may a window contain". The migration refuses
    // at apply time rather than letting the two drift apart quietly.
    expect(migration).toContain(
      'The season fixture read no longer carries the bounds this one copied',
    )
  })
})

describe('it is chronological across competitions, which is the whole point', () => {
  it('orders by kickoff with unscheduled fixtures last', () => {
    expect(calendar).toContain("coalesce(fixture.kickoff_at, 'infinity'::timestamptz)")
    expect(calendar).toContain("order by sort_kickoff, entry->>'id'")
  })

  it('proves interleaving with a fixture timed between another season’s two', () => {
    // Concatenating the seasons would put it last. A calendar puts it second.
    expect(suite).toContain(
      'fixtures INTERLEAVE by kickoff across competitions rather than grouping by one',
    )
  })

  it('names each competition once rather than repeating it per fixture', () => {
    expect(calendar).toContain("'competitions', v_competitions")
    expect(calendar).toContain("'competition_id', fixture.tournament_id")
  })
})

describe('it is a fixture read and nothing else', () => {
  it('cannot write, enforced by the engine', () => {
    expect(migration).toContain('The calendar read must be stable, so that it cannot write')
    expect(calendar).not.toMatch(/\b(insert into|update|delete from) public\./)
  })

  it('carries no prediction, score, standing or other player', () => {
    expect(calendar).not.toMatch(/season_predictions|season_matchweek_scores|season_standings/)
    expect(calendar).not.toContain('display_name')
  })

  it('is not the Match Centre, which stays addressable on its own read', () => {
    expect(calendar).not.toContain('get_season_fixture(')
  })
})
