import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveCompetitionContext,
  type CompetitionMatchData,
  type CompetitionProgressData,
  type CompetitionUserData,
} from '../../../src/domain/competition/context'
import type { CompetitionConfig, TournamentCompetitionConfig } from '../../../src/domain/competition/kinds'

/**
 * Which timezone is allowed to decide what.
 *
 * The Stage C design fixes one contract: a competition season declares one IANA
 * timezone, that zone decides day/matchweek grouping and deadline communication,
 * and a viewer's device zone may affect optional presentation only — never a
 * lock, matchweek or scoring decision.
 *
 * That contract has two halves, and the current code only satisfies one of them:
 *
 *   - locks and match state are timezone-free, comparing UTC instants only, so
 *     no device can move a deadline. Guarded below, because it is an invariant
 *     worth keeping rather than a coincidence worth discovering later;
 *   - day grouping reads `config.competitionTimeZone`. The seam that separates
 *     it from the viewer's zone now exists, but no season row supplies a value
 *     yet, so each surface still falls back to the device zone and two viewers
 *     of the same competition at the same instant can disagree about which
 *     fixtures are "today". Characterised below as measured behaviour.
 *
 * The characterisation is deliberately an assertion about what the code does
 * today, not what it should do. Supplying `competitionTimeZone` is the single
 * change that ends the divergence, and it is gated on the season column that
 * stores the value; these tests exist so that change arrives as a visible,
 * evidenced edit to this file instead of a silent one.
 *
 * Text-based where it guards source shape, execution-based where it records
 * behaviour. Neither half needs a database.
 */

const repositoryRoot = process.cwd()

function sourceOf(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

/* ------------------------------------------------------------------------- */
/* Source-shape guards                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Modules that decide deadlines and match progression. Any timezone awareness
 * here would make a lock depend on where the viewer is standing.
 */
const INSTANT_ONLY_MODULES = [
  'src/domain/competition/lockState.ts',
  'src/domain/competition/matchState.ts',
] as const

/**
 * Every file that reads the device zone. Pinned as a complete set: a new reader
 * is a new place a device can influence a competition decision, and it should
 * have to be added here deliberately.
 */
const DEVICE_TIME_ZONE_READERS = [
  'src/features/home/useHomeData.ts',
  'src/features/matches/MatchCentrePage.tsx',
  'src/features/matches/MatchesPage.tsx',
  'src/features/shared/useTournamentEntryLocked.ts',
] as const

const DEVICE_TIME_ZONE_READ = /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/

describe('timezone authority — source shape', () => {
  it.each(INSTANT_ONLY_MODULES)('%s decides on UTC instants alone', (path) => {
    const source = sourceOf(path)

    // Not a style rule. `resolveLockState` comparing anything zone-derived would
    // let a deadline move with the viewer, which is the one failure mode the
    // Stage C timezone contract exists to prevent.
    expect(source).not.toMatch(/timeZone/i)
    expect(source).not.toMatch(/\bIntl\b/)
  })

  it('reads the device zone in exactly the pinned files', () => {
    const readers = [...INSTANT_ONLY_MODULES, ...DEVICE_TIME_ZONE_READERS]
      .concat('src/domain/competition/context.ts')
      .filter((path) => DEVICE_TIME_ZONE_READ.test(sourceOf(path)))

    // Guards the direction of travel: the domain must never resolve the device
    // zone itself, and the surfaces that do are a closed list.
    expect(readers).toEqual([...DEVICE_TIME_ZONE_READERS])
  })

  it('keeps the domain taking the zone as an input', () => {
    const source = sourceOf('src/domain/competition/context.ts')

    // The domain formats *in* a supplied zone but never asks the environment
    // which zone that is — the property that makes the later season-zone switch
    // a call-site change rather than a domain rewrite.
    expect(source).toMatch(/config\.competitionTimeZone/)
    expect(source).not.toMatch(DEVICE_TIME_ZONE_READ)
  })
})

/* ------------------------------------------------------------------------- */
/* Behaviour characterisation                                                 */
/* ------------------------------------------------------------------------- */

const BASE_CONFIG: TournamentCompetitionConfig = {
  id: 'euro-2028',
  name: 'Euro 2028',
  kind: 'tournament',
  competitionTimeZone: 'UTC',
  bounds: { startsAt: '2028-06-10T00:00:00Z', endsAt: '2028-07-10T00:00:00Z' },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
  lockPolicy: { scope: 'entry', scopeCount: 1, bufferMinutes: 0 },
}

const PROGRESS: CompetitionProgressData = {
  hasStarted: true,
  regularStageComplete: false,
  nextStageReady: false,
  knockoutStarted: false,
  finalConfirmed: false,
  allCompetitionsSettled: false,
  markedComplete: false,
}

const ENTRY: CompetitionUserData['entry'] = {
  exists: true,
  complete: true,
  valid: true,
  submitted: true,
  autoSubmitted: false,
  activeLockScopeId: 'scope-1',
}

const ACTIONS: CompetitionUserData['actions'] = {
  accountOrEntryBlockingError: false,
  hasOutstandingPrediction: false,
  activeLiveMatchIds: [],
  cupTieBreakRequired: false,
  lmsSelectionRequired: false,
  sharedKnockoutPredictionRequired: false,
  matchAwaitingAttention: false,
  leagueInviteAvailable: false,
  urgentWindowMinutes: 120,
}

/**
 * One completed fixture at 11:00Z, observed at 21:00Z on the same UTC day.
 *
 * The pair is chosen to straddle a calendar boundary in one zone and not the
 * other: in `UTC` both instants fall on 10 June, while at `Pacific/Auckland`
 * (UTC+12 in June — southern winter, no DST) the observation has already rolled
 * over to 11 June while the kickoff is still 10 June.
 */
const KICKOFF = '2028-06-10T11:00:00Z'
const OBSERVED_AT = '2028-06-10T21:00:00Z'

function resolveAt(competitionTimeZone: string) {
  const config: CompetitionConfig = { ...BASE_CONFIG, competitionTimeZone }
  const now = new Date(OBSERVED_AT)
  const matches: readonly CompetitionMatchData[] = [
    {
      id: 'match-1',
      lockScopeId: 'scope-1',
      kickoffAt: KICKOFF,
      administrationState: 'scheduled',
      officialState: 'scored',
      corrected: false,
    },
  ]

  return resolveCompetitionContext(
    config,
    {
      progress: PROGRESS,
      lockScopes: [
        {
          id: 'scope-1',
          type: 'entry',
          fixtureData: {
            observedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
            validUntil: new Date(now.getTime() + 12 * 60 * 60_000).toISOString(),
            fixtures: [{ id: 'match-1', kickoffAt: KICKOFF }],
          },
          previouslyLocked: false,
        },
      ],
      matches,
    },
    { feedAvailable: true, matches: [] },
    { entry: ENTRY, competitions: [], actions: ACTIONS },
    now,
  )
}

describe('timezone authority — measured device dependence', () => {
  it('groups the same fixture into different days per zone', () => {
    const utc = resolveAt('UTC')
    const auckland = resolveAt('Pacific/Auckland')

    // Identical season, identical data, identical instant — only the zone the
    // call site happened to supply differs.
    // `completedToday` is the observable slice of the day buckets here: the
    // fixture is scored, so it lands there in whichever zone counts it as today.
    expect(utc.completedToday.map((match) => match.id)).toEqual(['match-1'])
    expect(auckland.completedToday).toEqual([])
  })

  it('reaches a different day state per zone', () => {
    // The user-visible consequence: one viewer is shown the day's result, the
    // other is told there is nothing on. This is what the season zone fixes.
    expect(resolveAt('UTC').dayState).toBe('day_complete')
    expect(resolveAt('Pacific/Auckland').dayState).toBe('no_matches_today')
  })

  it('leaves locks and match state identical across zones', () => {
    const utc = resolveAt('UTC')
    const auckland = resolveAt('Pacific/Auckland')

    // The positive control for the source guards above: the divergence is
    // confined to day grouping. If a later edit made a deadline zone-sensitive,
    // this fails alongside the source-shape assertions rather than instead of
    // them.
    expect(auckland.activeLock).toEqual(utc.activeLock)
    expect(auckland.entryState).toBe(utc.entryState)
    expect(auckland.matches.map((match) => match.state)).toEqual(utc.matches.map((match) => match.state))
    expect(auckland.matches.map((match) => match.lockState)).toEqual(utc.matches.map((match) => match.lockState))
  })

  it('falls back to no grouping when the zone is unusable', () => {
    // `dateKey` swallows an invalid zone and returns null, which empties the
    // day buckets rather than throwing. Pinned so the fail-quiet path stays a
    // decision: a bad season zone must not blank the day silently once the
    // value comes from the database instead of the device.
    const broken = resolveAt('Not/AZone')

    expect(broken.completedToday).toEqual([])
    expect(broken.upcomingToday).toEqual([])
    expect(broken.dayState).toBe('no_matches_today')
  })
})
