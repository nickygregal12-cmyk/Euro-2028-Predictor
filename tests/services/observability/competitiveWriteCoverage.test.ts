import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `C1` — every competitive write is observable, and stays that way.
 *
 * THE FAILURE THIS EXISTS TO PREVENT IS A QUIET ONE. Before 20 August 2026,
 * `reportClientError` was called from exactly two places in the application,
 * both in the entry point, so every caught failure in every feature was
 * invisible. That was not a decision anybody made; it is what happens when
 * reporting is something each call site has to remember. A test is the only
 * thing that makes it something each call site has to REMOVE.
 *
 * WHAT IS COVERED, AND WHY THESE. A write is on this list when its failure
 * changes what a player has in a competition: a prediction, a Joker, a spent
 * Last Man Standing club, a join, a league, a Championship that launched. The
 * reads are deliberately absent — a read that fails shows an error state the
 * player can retry, and reporting all of them would bury the writes.
 *
 * IT CHECKS THE MODULE, NOT THE LINE. Naming an exact call would break on any
 * refactor and teach the next person to delete the test. What it asserts is
 * that each write has a NAMED reporting home and that home reports — weak
 * enough to survive a rewrite, strong enough to catch a new write that forgot.
 */

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const services = resolve(repositoryRoot, 'src/services/supabase')

function modulesCalling(rpc: string): string[] {
  const pattern = new RegExp(`rpc\\(\\s*['"\`]${rpc}['"\`]`)
  return readdirSync(services)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    // The generated types name every RPC and call none of them.
    .filter((entry) => entry !== 'database.types.ts')
    .filter((entry) => pattern.test(readFileSync(join(services, entry), 'utf8')))
}

/**
 * Every competitive write, and WHERE its failure is reported.
 *
 * THE INDIRECTION IS THE DESIGN, NOT AN OVERSIGHT. The Match Predictor's three
 * writes all travel through `createSaveController`, which retries with backoff
 * and reports only when a key stops trying. Reporting from the gateway module
 * instead would fire once per attempt and turn a player on a train into an
 * incident. So the gateway is correctly silent and the controller's consumer is
 * where the report is made — and this table says so, rather than leaving the
 * next reader to conclude the gateway was forgotten.
 *
 * Adding an RPC here without a reporting home fails this test, which is the
 * intended direction: the list is the requirement and the code follows it.
 */
const COMPETITIVE_WRITES = [
  {
    rpc: 'save_season_prediction',
    reportedBy: 'src/features/season/useSeasonMatchPredictor.ts',
    why: 'through createSaveController, on terminal failure only',
  },
  {
    rpc: 'set_season_matchweek_joker',
    reportedBy: 'src/features/season/useSeasonMatchPredictor.ts',
    why: 'the same controller, under the joker key',
  },
  {
    rpc: 'confirm_season_matchweek_card',
    reportedBy: 'src/features/season/useSeasonMatchPredictor.ts',
    why: 'the same controller, under the card key',
  },
  {
    rpc: 'save_season_predictions_batch',
    reportedBy: 'src/services/supabase/seasonPredictionBatch.ts',
    why: 'INNOV-020 reconciliation, which has no controller behind it',
  },
  {
    rpc: 'save_lms_selection',
    reportedBy: 'src/services/supabase/seasonLms.ts',
    why: 'the season gateway; the tournament one is parked, see below',
  },
  {
    rpc: 'join_league',
    reportedBy: 'src/services/supabase/leagues.ts',
    why: 'at the write itself',
  },
  {
    rpc: 'join_private_competition',
    reportedBy: 'src/services/supabase/inviteCodes.ts',
    why: 'at the write itself',
  },
  {
    rpc: 'create_league',
    reportedBy: 'src/services/supabase/leagues.ts',
    why: 'at the write itself',
  },
  {
    rpc: 'create_private_season_cup',
    reportedBy: 'src/services/supabase/privateCompetitions.ts',
    why: 'at the write itself',
  },
  {
    rpc: 'launch_private_season_cup',
    reportedBy: 'src/services/supabase/privateCompetitions.ts',
    why: 'at the write itself, and it is the irreversible one',
  },
] as const

/**
 * Modules that call a competitive write and deliberately do not report.
 *
 * `lms.ts` is the TOURNAMENT Last Man Standing gateway. Euro 2028 is parked
 * until the tournament return window, and wiring observability into a surface
 * nobody can reach would be reporting on nothing. Recorded rather than silently
 * excluded, so it is picked up when the tournament comes back.
 */
const PARKED = ['lms.ts'] as const

/**
 * Modules that call a competitive write and delegate the report upwards.
 *
 * `seasonMatchPredictor.ts` is the gateway `createSaveController` drives. It
 * throws, the controller retries, and the controller's consumer reports when a
 * key gives up. Reporting here as well would fire once per ATTEMPT and bury the
 * signal under a bad train journey.
 */
const DELEGATES = ['seasonMatchPredictor.ts'] as const

describe('every competitive write reports its own failure', () => {
  it.each(COMPETITIVE_WRITES)('$rpc is reported by $reportedBy', ({ rpc, reportedBy }) => {
    const callers = modulesCalling(rpc)
    expect(
      callers,
      `no module under src/services/supabase calls ${rpc}. Either it moved, or ` +
        'this list names a write that no longer exists — both are worth knowing.',
    ).not.toEqual([])

    const reporter = readFileSync(resolve(repositoryRoot, reportedBy), 'utf8')
    expect(
      reporter.includes('reportOperationFailure'),
      `${reportedBy} is named as where ${rpc}'s failure is reported, and it ` +
        'does not report. A competitive write that fails silently is one ' +
        'nobody finds out about until a player says their predictions are gone.',
    ).toBe(true)
  })

  it('leaves no unaccounted caller of a competitive write', () => {
    // The half that catches a NEW module rather than a new RPC: something that
    // calls one of these writes, is not the named reporter, and is not parked.
    const accounted = new Set<string>([
      ...COMPETITIVE_WRITES.map(({ reportedBy }) => reportedBy.split('/').pop()!),
      ...PARKED,
      ...DELEGATES,
    ])
    const unaccounted = new Set<string>()
    for (const { rpc } of COMPETITIVE_WRITES) {
      for (const caller of modulesCalling(rpc)) {
        const source = readFileSync(join(services, caller), 'utf8')
        if (!accounted.has(caller) && !source.includes('reportOperationFailure')) {
          unaccounted.add(`${caller} (${rpc})`)
        }
      }
    }

    expect(
      [...unaccounted],
      'these call a competitive write, do not report, and are not named as ' +
        'reported elsewhere or as parked',
    ).toEqual([])
  })
})

describe('what a report may carry', () => {
  const reporter = readFileSync(
    resolve(repositoryRoot, 'src/services/observability/operationFailure.ts'),
    'utf8',
  )

  it('has no field for anything a player typed or was given', () => {
    // The pressure over time is always to add "just one more field" to make an
    // issue easier to debug, and the fields that would help most are the
    // scoreline and the league name. The type is where that is refused, so the
    // type is what this reads.
    const context = reporter.slice(
      reporter.indexOf('export type SafeOperationContext'),
      reporter.indexOf('export function reportOperationFailure'),
    )
    for (const forbidden of [
      'name',
      'code?:',
      'score',
      'prediction',
      'email',
      'displayName',
      'inviteCode',
      'accountId',
      'userId',
    ]) {
      expect(
        context.includes(forbidden),
        `SafeOperationContext gained a "${forbidden}" field. Everything in it ` +
          'reaches telemetry.',
      ).toBe(false)
    }
  })

  it('constrains the server code to the shape a code has', () => {
    // A caller passing `error.message` here because it looked like the useful
    // field is the realistic leak, and a database message can quote the row
    // that caused it.
    expect(reporter).toContain('function sanitiseCode')
    expect(reporter).toMatch(/\/\^\[A-Za-z0-9_.-\]\+\$\//)
  })
})
