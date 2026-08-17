import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { computeSeasonStandings } from '../../src/domain/season/standings'
import { at } from '../support/indexed'

/**
 * Contract 128's season league standings, against the authorities it obeys.
 *
 * THE REDEFINITION DIFF IS THE LOAD-BEARING GUARD. `get_league_members` holds
 * the authentication check, the league-membership refusal, the cursor
 * validation, the final-tie-break switch and the whole tournament ranking.
 * Contract 114 once redefined a function from an older migration's text and
 * silently reverted contract 104's work; the diff below asserts that exactly
 * one guard was inserted and nothing else moved.
 *
 * THE SECOND GUARD IS THE SOURCE OF THE POINTS. The defect being fixed is a
 * read taking a season's totals from tournament relations, so the new read is
 * asserted to touch none of them and to take its totals from the one function
 * that owns them.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const TIEBREAKS = '20260729122200_final_standings_tiebreaks.sql'
const CONTRACT_128 = '20260806190000_season_league_standings.sql'

const committedSource = migration(TIEBREAKS)
const source = migration(CONTRACT_128)

function definition(text: string, name: string, schema = 'public'): string {
  const start = text.indexOf(`create or replace function ${schema}.${name}(`)
  expect(start, `${schema}.${name} is not defined here`).toBeGreaterThan(-1)

  const rest = text.slice(start)
  const opening = /\bas\s+(\$[a-z_]*\$)/.exec(rest) as RegExpExecArray
  const tag = at(opening, 1)
  const bodyStart = opening.index + opening[0].length
  const bodyEnd = rest.indexOf(tag, bodyStart)
  expect(bodyEnd).toBeGreaterThan(-1)

  return rest.slice(0, bodyEnd + tag.length)
}

/** Comments stripped, whitespace collapsed. Prose is not the contract. */
function executable(text: string): string {
  return text
    .replaceAll(/--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

describe('exactly one guard was added to the tournament read', () => {
  const original = definition(committedSource, 'get_league_members')
  const redefined = definition(source, 'get_league_members')

  const ADDED = `  if (
    select season.kind from public.tournaments season where season.id = v_tournament
  ) = 'league_season' then
    raise exception
      'This league belongs to a competition season; its standings come from get_season_league_standings'
      using errcode = '23514';
  end if;`

  it('finds both definitions', () => {
    expect(original.length).toBeGreaterThan(7000)
    expect(redefined.length).toBeGreaterThan(7000)
  })

  it('is the committed text with one refusal inserted and nothing else', () => {
    expect(redefined).toContain(ADDED)

    // Remove the inserted block whole — its comment and its guard — and what
    // remains must be the committed function character for character.
    const restored = redefined.replace(
      /\n {2}-- Contract 128\.[\s\S]*?using errcode = '23514';\n {2}end if;\n/,
      '',
    )

    expect(restored).toBe(original)
  })

  it.each([
    ['Not authenticated', 'the authentication check'],
    ['Not a member of this league', 'the league-membership refusal'],
    ['League not found', 'the missing-league refusal'],
    ['Invalid league standings cursor', 'the cursor validation'],
    ['League standings page size must be at least 1', 'the page-size refusal'],
  ])('keeps %s — %s', (message) => {
    expect(definition(source, 'get_league_members')).toContain(message)
  })

  it('keeps the tournament ranking it exists for', () => {
    const redefinedExecutable = executable(definition(source, 'get_league_members'))
    for (const metric of [
      'standing_metrics',
      'exact_scores',
      'correct_outcomes',
      'correct_knockout_teams',
      'correct_champion',
      'total_goals_diff',
    ]) {
      expect(redefinedExecutable).toContain(metric)
    }
  })
})

describe('the season read takes its totals from the season authority', () => {
  const season = executable(definition(source, 'get_season_league_standings'))

  it('reads season_standings and nothing else for points', () => {
    expect(season).toContain('predictor_internal.season_standings(v_tournament)')
  })

  it('touches no tournament scoring relation', () => {
    // The defect being fixed, stated as the guard against its return. Each of
    // these is empty for a competition season, which is exactly why the old
    // read answered zero for everybody without erroring.
    for (const relation of [
      'standing_metrics',
      'score_events',
      'public.matches',
      'match_predictions',
      'result_state',
    ]) {
      expect(season).not.toContain(relation)
    }
  })

  it('recomputes rank inside the league rather than inheriting the season one', () => {
    // A private league is its own table: its leader is its best member, not
    // "47th in the season". Points are the authority's; the position is not.
    expect(season).toContain('rank() over (order by member.points desc)')
    expect(season).not.toContain("(row ->> 'rank')")
  })

  it('uses standard competition ranking, matching the domain authority', () => {
    // rank(), not dense_rank(): equal totals share a rank and the next rank
    // SKIPS. Asserted against the module that defines the rule rather than
    // restated, so a change there fails here.
    const ranked = computeSeasonStandings([
      { entryId: 'a', matchweeks: [{ matchweek: 1, points: 10 }] },
      { entryId: 'b', matchweeks: [{ matchweek: 1, points: 10 }] },
      { entryId: 'c', matchweeks: [{ matchweek: 1, points: 1 }] },
    ])
    expect(ranked?.map((row) => row.rank)).toEqual([1, 1, 3])
    expect(season).not.toContain('dense_rank()')
  })

  it('pairs the total with matchweeks played', () => {
    // ADR 0012: two players on 84 from 22 and 23 matchweeks are not tied in
    // meaning, even though only points decide rank.
    expect(season).toContain("'matchweeksPlayed', row.matchweeks_played")
  })

  it('lists a member who has not entered rather than omitting them', () => {
    expect(season).toContain('left join public.entries entry')
    expect(season).toContain('left join standing on standing.entry_id = entry.id')
  })
})

describe('neither read answers for the other competition kind', () => {
  it('the tournament read refuses a season league', () => {
    expect(definition(source, 'get_league_members')).toContain(
      'its standings come from get_season_league_standings',
    )
  })

  it('the season read refuses a tournament league', () => {
    expect(definition(source, 'get_season_league_standings')).toContain(
      'its standings come from get_league_members',
    )
  })
})

describe('the boundary', () => {
  it('is league membership, driven by the caller rather than by an argument', () => {
    const season = definition(source, 'get_season_league_standings')
    expect(season).toContain('membership.user_id = v_uid')
    expect(season).toContain("raise exception 'Not a member of this league'")
  })

  it('is granted to authenticated and to nobody else', () => {
    expect(source).toMatch(
      /revoke all on function public\.get_season_league_standings\(uuid, integer, text\)\s+from public, anon, authenticated;/,
    )
    expect(source).toMatch(
      /grant execute on function public\.get_season_league_standings\(uuid, integer, text\)\s+to authenticated;/,
    )
    expect(source).not.toMatch(/grant[^;]*get_season_league_standings[^;]*to (anon|service_role)/)
  })

  it('writes nothing', () => {
    const body = executable(source)
    for (const write of ['insert into', 'update public.', 'delete from']) {
      expect(body).not.toContain(write)
    }
  })
})
