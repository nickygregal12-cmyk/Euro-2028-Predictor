import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MARKETING_CLUB_SNAPSHOT,
  illustrativeHome,
  illustrativeMatches,
  realTeam,
  statesAFootballOutcome,
} from '../../../src/vnext/fixtures/marketing/realFootball'
import { MARKETING_PHASES } from '../../../src/vnext/fixtures/marketing/story'
import { workshopTeams } from '../../../src/vnext/fixtures/teams/teams'
import { homeScenarios } from '../../../src/vnext/fixtures/home/scenarios'
import { matchesScenarios } from '../../../src/vnext/fixtures/matches/scenarios'

/**
 * THE PUBLIC PAGE SHOWS REAL CLUBS AND NO REAL FOOTBALL.
 *
 * Two rules, and they pull in opposite directions, which is why both are held
 * here rather than either being trusted to a docblock:
 *
 *   • the identity has to be REAL and has to stay in step with the application's
 *     own catalogue — a marketing snapshot that quietly diverges from
 *     `club_identity_reference` is the second club registry the direction
 *     forbids;
 *
 *   • the football has to be ILLUSTRATIVE. A scoreline, a minute, a form run or
 *     a league position beside a real club's name is a claim about a match that
 *     never happened, and no disclaimer repairs one inside a picture of a
 *     product.
 */

const MIGRATION = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260809060000_club_identity_reference.sql',
)

/**
 * The seeded reference, read out of the migration that creates it.
 *
 * PARSED RATHER THAN RESTATED. Restating the rows here would make this file the
 * third copy, and a test that agrees with itself proves nothing. The migration
 * is the only committed artefact that says what the table holds, so it is what
 * the snapshot is measured against.
 */
function seededReference(): Map<string, { shortCode: string; clubColours: string }> {
  const sql = readFileSync(MIGRATION, 'utf8')
  const rows = new Map<string, { shortCode: string; clubColours: string }>()

  for (const line of sql.split('\n')) {
    const match = line.match(
      /^\s*\('([a-z]+)',\s*'([A-Z]{2,4})',\s*'([^']+)',\s*(?:null|'[^']*')\)[,;]/,
    )
    if (!match?.[1] || !match[2] || !match[3]) continue
    rows.set(match[1], { shortCode: match[2], clubColours: match[3].trim() })
  }

  return rows
}

describe('the marketing club snapshot', () => {
  const seeded = seededReference()

  it('reads the seeded reference at all', () => {
    // The whole guard is worthless if the parse silently matches nothing.
    expect(seeded.size).toBeGreaterThan(40)
    expect(seeded.get('celtic')).toEqual({ shortCode: 'CEL', clubColours: 'Green / White' })
  })

  it.each(MARKETING_CLUB_SNAPSHOT.map((club) => [club.normalisedName, club] as const))(
    '%s matches the application catalogue exactly',
    (normalisedName, club) => {
      const row = seeded.get(normalisedName)

      expect(row, `${normalisedName} is not in club_identity_reference`).toBeDefined()
      expect(row?.shortCode).toBe(club.shortCode)
      expect(row?.clubColours).toBe(club.clubColours)
    },
  )

  it('takes every club’s appearance from the identity authority', () => {
    // Not from the snapshot. The snapshot carries a code and a colour STRING;
    // the hex, the kit pattern and the contrast treatment are all decided by
    // `resolveClubIdentity`, which is what stops this being a second registry.
    const celtic = realTeam(workshopTeams.glenmore)

    expect(celtic.name).toBe('Celtic')
    expect(celtic.abbreviation).toBe('CEL')
    // `clubOverlay` says Celtic is hooped. Nothing in this test tree says so.
    expect(celtic.kitPattern).toBe('hoops')
    expect(celtic.colours.primary).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('leaves an unmapped workshop club alone', () => {
    // Conservative by design: a club with no entry keeps its invented identity
    // rather than borrowing a real name at random.
    const unmapped = { ...workshopTeams.glenmore, id: 'team-not-mapped' }

    expect(realTeam(unmapped).name).toBe(unmapped.name)
  })
})

describe('the preview states no football that did not happen', () => {
  it('empties the zones whose whole content is a result', () => {
    const live = illustrativeHome(homeScenarios.live)

    // A live match with no score and no minute is not a live match, and a
    // settled result with no result is not one either.
    expect(live.liveMatches).toEqual([])
    expect(live.recentResults).toEqual([])
  })

  it('removes the score, the clock and the record from every fixture', () => {
    const home = illustrativeHome(homeScenarios.decision)

    for (const match of home.upcomingMatches) {
      expect(match.score).toBeNull()
      expect(match.clock).toBeNull()
      expect(match.headToHead).toBeNull()
      expect(match.home.form).toEqual([])
      expect(match.away.form).toEqual([])
      expect(match.home.leaguePosition).toBeNull()
      expect(match.away.leaguePosition).toBeNull()
    }
  })

  it('keeps the player’s own prediction, which is the product', () => {
    const home = illustrativeHome(homeScenarios.decision)
    const predicted = home.upcomingMatches.filter((match) => match.prediction !== null)

    expect(predicted.length).toBeGreaterThan(0)
    for (const match of predicted) {
      expect(match.prediction?.score).toBeDefined()
      // Made, never marked: an outcome implies a result nobody may state.
      expect(match.prediction?.outcome).toBeNull()
      expect(match.prediction?.points).toBeNull()
    }
  })

  it('never leaves a fixture row in a state that requires a result', () => {
    const matches = illustrativeMatches(matchesScenarios.singleCompetition)
    const states = matches.days.flatMap((day) => day.matches.map((row) => row.state.kind))

    expect(states.length).toBeGreaterThan(0)
    expect(states.filter((kind) => kind !== 'scheduled' && kind !== 'postponed')).toEqual([])
    // The counts follow the rows, so no tab promises football the list cannot show.
    expect(matches.counts.live).toBe(0)
    expect(matches.counts.finished).toBe(0)
  })

  it('reads a fixture row aloud as a fixture, not as a result', () => {
    const matches = illustrativeMatches(matchesScenarios.singleCompetition)
    const summaries = matches.days.flatMap((day) =>
      day.matches.map((row) => row.accessibleSummary),
    )

    expect(summaries.length).toBeGreaterThan(0)
    for (const summary of summaries) {
      expect(summary, summary).toContain('versus')
      expect(statesAFootballOutcome(summary), summary).toBe(false)
    }
  })
})

describe('every phase the visitor is shown', () => {
  /**
   * THE BACKSTOP, AND THE ONLY ONE THAT SURVIVES A NEW SCENARIO.
   *
   * Each assertion above checks a field somebody chose to scrub. This one walks
   * every string in every phase and refuses the SHAPE of a football claim, so a
   * fixture rewritten upstream cannot smuggle "2–1" or "63 minutes" onto the
   * public page through a field this scrub does not know about.
   *
   * A club's own name is not a claim, and a prediction badge is structured
   * rather than free text, so neither is reachable from here.
   */
  function stringsIn(value: unknown, seen = new Set<unknown>()): string[] {
    if (typeof value === 'string') return [value]
    if (value === null || typeof value !== 'object') return []
    if (seen.has(value)) return []
    seen.add(value)
    return Object.values(value as Record<string, unknown>).flatMap((child) =>
      stringsIn(child, seen),
    )
  }

  it.each(MARKETING_PHASES.map((phase) => [phase.id, phase] as const))(
    '%s states no scoreline and no minute anywhere',
    (id, phase) => {
      const offenders = [
        ...stringsIn(phase.shell),
        ...stringsIn(phase.surface.model),
      ].filter(statesAFootballOutcome)

      expect(offenders, `${id} carries football claims:\n${offenders.join('\n')}`).toEqual([])
    },
  )

  it.each(MARKETING_PHASES.map((phase) => [phase.id, phase] as const))(
    '%s names no invented competition',
    (id, phase) => {
      const all = [...stringsIn(phase.shell), ...stringsIn(phase.surface.model)]

      expect(
        all.filter((text) => text.includes('Caledonian Premiership')),
        `${id} still names the workshop's invented competition`,
      ).toEqual([])
    },
  )
})
