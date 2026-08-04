import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveLockState } from '../../src/domain/competition/lockState'
import { resolveCardAtLock } from '../../src/domain/season/cardSubmission'

/**
 * When a matchweek locks, and what the job does about it.
 *
 * THE LOCK INSTANT IS DERIVED IN BOTH LANGUAGES and stored in neither.
 * `competition_rounds` has no lock column on purpose: the instant is the
 * matchweek's earliest kickoff minus the game's buffer, and a stored copy would
 * drift the moment a fixture is rescheduled — which is exactly the case
 * contract 81's `locks_at` key exists to handle. Two derivations means they can
 * disagree, so this pins them together.
 *
 * FAIL CLOSED IS THE SHARED RULE. A matchweek with no fixtures, or with any
 * unconfirmed kickoff, has no derivable instant. The browser stays locked; the
 * job does not act. Both refuse to guess, and the failure directions agree —
 * nothing is submitted on incomplete data. Get this backwards and the job
 * submits cards against a fixture list that is still being edited.
 *
 * Behaviour was proven against a scratch PostgreSQL 16 running contracts 80,
 * 81 and 82 with real parent rows: nothing due before the instant, both records
 * written at it (inclusive), a second run a no-op, a rescheduled matchweek
 * reprocessed under its new instant with both preserved, and neither a Last Man
 * Standing entry nor a knockout round touched.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')

const schedulerFile = readdirSync(migrationsDirectory).find((file) =>
  file.endsWith('_season_matchweek_scheduler.sql'),
)

/** Comment-stripped, so the header's prose cannot satisfy an assertion. */
const scheduler = (
  schedulerFile === undefined
    ? ''
    : readFileSync(resolve(migrationsDirectory, schedulerFile), 'utf8')
).replace(/--[^\n]*/g, '')

function body(name: string): string {
  return new RegExp(`${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`).exec(scheduler)?.[1] ?? ''
}

const lockAt = body('season_matchweek_lock_at')
const completeCard = body('season_complete_card_fixtures')
const processor = body('process_due_season_matchweek_submissions')

/** The browser's derivation, for a matchweek whose fixtures kick off as given. */
function browserLockAt(kickoffs: readonly (string | null)[], bufferMinutes: number) {
  return resolveLockState(
    {
      id: 'mw',
      type: 'matchweek',
      bufferMinutes,
      previouslyLocked: false,
      fixtureData: {
        observedAt: '2027-01-01T00:00:00.000Z',
        validUntil: '2027-12-31T00:00:00.000Z',
        fixtures: kickoffs.map((kickoffAt, index) => ({ id: `f${index}`, kickoffAt })),
      },
    },
    new Date('2027-01-01T00:00:00.000Z'),
  )
}

describe('the migration is found, so nothing below is vacuous', () => {
  it.each([
    ['season_matchweek_lock_at', () => lockAt],
    ['season_complete_card_fixtures', () => completeCard],
    ['process_due_season_matchweek_submissions', () => processor],
  ])('%s has a body to assert against', (_name, read) => {
    expect(schedulerFile, 'contract 82 migration not found').toBeDefined()
    expect(read()).not.toBe('')
  })
})

describe('the lock instant is the earliest kickoff, less the buffer', () => {
  it('is what the browser derives, so the two cannot drift', () => {
    // 12:30 is earliest, not the 15:00 listed first. Taking the first fixture
    // rather than the minimum would lock a matchweek late, after a game has
    // already kicked off and its result is knowable.
    expect(browserLockAt(['2027-01-02T15:00:00.000Z', '2027-01-02T12:30:00.000Z'], 0).lockAt).toBe(
      '2027-01-02T12:30:00.000Z',
    )
    expect(browserLockAt(['2027-01-02T15:00:00.000Z', '2027-01-02T12:30:00.000Z'], 30).lockAt).toBe(
      '2027-01-02T12:00:00.000Z',
    )

    expect(lockAt).toMatch(/min\(fixture\.kickoff_at\) - make_interval\(mins => p_buffer_minutes\)/)
  })

  it('fails closed on an unconfirmed kickoff, in both languages', () => {
    // `season_fixtures.kickoff_at` is nullable so a scheduled-but-unconfirmed
    // fixture can exist. Treating a null as "no constraint" would derive an
    // instant from the remaining fixtures and lock the matchweek early.
    const browser = browserLockAt(['2027-01-02T15:00:00.000Z', null], 0)
    expect(browser.locked).toBe(true)
    expect(browser.reason).toBe('invalid_fixture_data')

    expect(lockAt).toMatch(/count\(\*\) <> count\(fixture\.kickoff_at\) then null/)
  })

  it('fails closed on an empty matchweek, in both languages', () => {
    const browser = browserLockAt([], 0)
    expect(browser.locked).toBe(true)
    expect(browser.reason).toBe('missing_fixture_data')

    expect(lockAt).toMatch(/count\(\*\) = 0 then null/)
  })

  it('fails closed on a negative buffer, as the browser does', () => {
    expect(browserLockAt(['2027-01-02T15:00:00.000Z'], -1).reason).toBe('invalid_fixture_data')
    expect(lockAt).toMatch(/p_buffer_minutes is null or p_buffer_minutes < 0 then null/)
  })
})

describe('a complete card needs no default, and is not given an invented one', () => {
  const complete = [
    { fixtureId: 'f1', defaultPrediction: { home: 2, away: 1 }, playerPrediction: { home: 2, away: 1 } },
    { fixtureId: 'f2', defaultPrediction: { home: 0, away: 0 }, playerPrediction: { home: 0, away: 0 } },
  ]

  it.each(['provisional', 'confirmed'])(
    'resolves identically under %s whatever default is supplied',
    (status) => {
      // The migration sets `defaultPrediction` to the player's own value. That
      // is only honest if the default is never consulted, which holds exactly
      // when no fixture has a gap — a non-null playerPrediction always wins.
      // Asserted rather than assumed, because if it were false the job would be
      // silently inventing scorelines.
      const absurd = complete.map((fixture) => ({
        ...fixture,
        defaultPrediction: { home: 9, away: 9 },
      }))

      expect(resolveCardAtLock(complete as never, status as never)).toEqual(
        resolveCardAtLock(absurd as never, status as never),
      )
      expect(resolveCardAtLock(complete as never, status as never)).toMatchObject({
        kind: 'submitted',
        autoCompleted: false,
      })
    },
  )

  it('returns null from SQL when any fixture lacks the player value', () => {
    expect(completeCard).toMatch(/v_predicted <> v_total then/)
    expect(completeCard).toMatch(/return null;/)
  })

  it('treats an empty matchweek as incomplete rather than as a complete card', () => {
    // `count(*) = 0` with zero predictions satisfies `v_predicted = v_total`,
    // so without the explicit zero test an empty matchweek would resolve as a
    // complete card and submit nothing as if it were a submission.
    expect(completeCard).toMatch(/v_total = 0 or v_predicted <> v_total/)
  })
})

describe('the job records what it decided, and defers what it cannot', () => {
  it('records a player with no card as unbanked rather than skipping them', () => {
    // Skipping is cheaper and wrong: without a row, "not yet processed" and
    // "processed, unbanked" are indistinguishable, and the first is a bug.
    expect(resolveCardAtLock([] as never, 'no_submission')).toEqual({ kind: 'unbanked' })
    expect(processor).toMatch(/'unbanked'/)
    expect(processor).toMatch(/if v_status is null then/)
  })

  it('writes NO ledger row for a gapped card, so it is picked up later', () => {
    // A recorded outcome would permanently skip that card once the default
    // policy lands (DEC-015). The deferral must not be durable.
    const deferral = /if v_fixtures is null then([\s\S]*?)end if;/.exec(processor)?.[1] ?? ''
    expect(deferral, 'the gap branch was not found').not.toBe('')
    expect(deferral).toMatch(/v_deferred := v_deferred \+ 1;/)
    expect(deferral).not.toMatch(/insert into/)
  })

  it('surfaces the deferral count on every run', () => {
    expect(processor).toMatch(/'deferredMissingDefaultPolicy', v_deferred/)
  })

  it('is idempotent per lock instant, including the instant itself', () => {
    expect(processor).toMatch(/recorded\.locks_at = v_due\.locks_at/)
    expect(processor).toMatch(/continue when exists \(/)
  })

  it('does not act before the instant, and treats the instant as due', () => {
    // `>` not `>=`: the lock is inclusive at its exact instant, matching
    // `resolveLockState`, where `nowMs >= derived` is locked.
    expect(processor).toMatch(/v_due\.locks_at is null or v_due\.locks_at > p_now/)
    expect(
      resolveLockState(
        {
          id: 'mw',
          type: 'matchweek',
          bufferMinutes: 0,
          previouslyLocked: false,
          fixtureData: {
            observedAt: '2027-01-01T00:00:00.000Z',
            validUntil: '2027-12-31T00:00:00.000Z',
            fixtures: [{ id: 'f1', kickoffAt: '2027-01-02T12:30:00.000Z' }],
          },
        },
        new Date('2027-01-02T12:30:00.000Z'),
      ).locked,
    ).toBe(true)
  })
})

describe('the job selects its work by property, never by name', () => {
  it('takes matchweek-scoped games that hold a prediction entry', () => {
    // Naming `main_predictor` would silently exclude any future league game.
    // Last Man Standing is matchweek-scoped but holds no card, and is settled
    // by its own job — `requires_prediction_entry` is what separates them.
    expect(processor).toMatch(/definition\.lock_scope = 'matchweek'/)
    expect(processor).toMatch(/definition\.requires_prediction_entry/)
    expect(processor).not.toMatch(/'main_predictor'/)
  })

  it('takes only league matchweeks, not knockout rounds in the same season', () => {
    expect(processor).toMatch(/round\.kind = 'league_matchweek'/)
  })
})

describe('concurrency and blast radius', () => {
  it('skips rows another run holds rather than waiting on them', () => {
    expect(processor).toMatch(/for update of entry skip locked/)
  })

  it('records a refusal instead of letting one card abort the batch', () => {
    // Without the handler, one contradictory card raises out of the loop and
    // every later player goes unprocessed for that lock.
    expect(processor).toMatch(/when check_violation or foreign_key_violation or data_exception then/)
  })

  it('keeps the two derivations server-side and the job off every browser role', () => {
    for (const fn of ['season_matchweek_lock_at', 'season_complete_card_fixtures']) {
      expect(scheduler).toMatch(
        new RegExp(
          `revoke all on function predictor_internal\\.${fn}[\\s\\S]*?from public, anon, authenticated`,
        ),
      )
    }
    expect(scheduler).toMatch(
      /revoke all on function public\.process_due_season_matchweek_submissions\(timestamptz\)\s*from public, anon, authenticated, service_role/,
    )
    expect(scheduler).toMatch(
      /grant execute on function public\.process_due_season_matchweek_submissions\(timestamptz\)\s*to service_role/,
    )
  })

  it('runs on a schedule, because a lock is an instant and not a window', () => {
    expect(scheduler).toMatch(/cron\.schedule\(\s*'season-process-due-matchweek-submissions',\s*'\* \* \* \* \*'/)
  })
})
