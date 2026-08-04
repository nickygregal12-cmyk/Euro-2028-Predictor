import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveMatchweekSettlement,
  type SettlementFixture,
} from '../../src/domain/season/matchweekSettlement'

/**
 * What a matchweek card means for scoring, in both languages.
 *
 * WHY THIS SLICE EXISTS, and why it came before the scoring job. Contract 90
 * added the season score store and deliberately did not define when a matchweek
 * has SETTLED. A job that settled on "every fixture has a score" would count a
 * VOID fixture as played, and `standings.ts` shows matches played beside points
 * precisely so that "two players on 84 points from 22 and 23 matchweeks are not
 * tied in meaning". Every points total would be right and every table subtly
 * false — which is the kind of wrong nobody reports as a bug.
 *
 * THE RULE MOST WORTH PROTECTING is the matches-played denominator, and
 * specifically its second half. Void leaves the denominator, which is obvious.
 * A fixture already CARRIED to a known replay leaves it too, which is not: its
 * slot belongs to the replay, and counting both counts one match twice. An
 * implementation that remembered only the void rule passes every test that
 * contains no abandoned fixture.
 *
 * THE FAULT THAT FAILED SILENTLY, and did: three-valued logic in the SQL score
 * predicate. `'{}'::jsonb->'home'` is SQL NULL, `jsonb_typeof(NULL)` is NULL,
 * and NULL inside the caller's `if not ...` does not fire — so a scoreless
 * `completed` fixture settled as scoreable with a null final score, scoring
 * every player on that matchweek against nothing. The first version of the
 * migration had exactly that. It is the same shape as the tournament's
 * `entry_automatic_submission_outcomes` CHECK, which accepts an `invalid`
 * outcome with a null failure message for the same reason.
 *
 * Reading the SQL would never have found it. A DIFFERENTIAL SWEEP did, on seven
 * cases out of 123. Behaviour equivalence now rests on 1723 cases with zero
 * mismatches:
 *
 *   - 123 directed, every state against every malformed score against every
 *     replay shape on a single-fixture card, which is where the refusal ORDER
 *     is decided;
 *   - 900 randomised multi-fixture cards, covering all six refusal reasons;
 *   - 700 WELL-FORMED cards, because the first two rarely reach the accept
 *     path at all — 41 of 900 did — and the denominator, carries and settled
 *     logic all live there. 570 of the 700 exercise a denominator below the
 *     fixture count.
 *
 * Three mutations were run against the SQL and all were killed, but the pair of
 * sweeps is what killed them and neither sweep alone would have:
 *
 *   - denominator counting carried-to-replay: 6 directed, 341 well-formed;
 *   - `settled` ignoring `awaiting_replay`: 4 directed, 79 well-formed;
 *   - the score-on-unplayed refusal deleted: 48 directed, ZERO well-formed —
 *     invisible to the well-formed sweep, because a valid card never carries a
 *     score on an unplayed fixture. That asymmetry is why both exist.
 *
 * The TypeScript authority is executed here; the SQL is read, proven against a
 * real database in `142_matchweek_settlement.sql`.
 */

const migrationsDirectory = resolve(__dirname, '../../supabase/migrations')

function migrationSource(): string {
  const file = readdirSync(migrationsDirectory).find((name) =>
    name.endsWith('_matchweek_settlement_parity.sql'),
  )
  expect(file, 'the matchweek settlement parity migration').toBeTruthy()
  return readFileSync(resolve(migrationsDirectory, file!), 'utf8')
}

/** Comments describe; only code enforces. */
function migrationCode(): string {
  return migrationSource().replace(/--[^\n]*/g, '')
}

const fixture = (
  id: string,
  state: SettlementFixture['state'],
  score: SettlementFixture['score'] = null,
  replayFixtureId: string | null = null,
): SettlementFixture => ({ id, state, score, replayFixtureId })

describe('the matches-played denominator', () => {
  it('drops a void fixture', () => {
    const result = resolveMatchweekSettlement([
      fixture('a', 'completed', { home: 1, away: 0 }),
      fixture('b', 'void'),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.matchesPlayedDenominator).toBe(1)
  })

  it('drops a fixture already carried to a known replay, because the replay holds its slot', () => {
    const result = resolveMatchweekSettlement([
      fixture('a', 'completed', { home: 1, away: 0 }),
      fixture('b', 'abandoned', null, 'r1'),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.matchesPlayedDenominator).toBe(1)
  })

  it('keeps an abandoned fixture whose replay is not known yet', () => {
    // Nothing has taken its slot, so dropping it here would under-count.
    const result = resolveMatchweekSettlement([
      fixture('a', 'completed', { home: 1, away: 0 }),
      fixture('b', 'abandoned'),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.matchesPlayedDenominator).toBe(2)
  })

  it('is enforced in SQL by excluding BOTH dispositions, not just void', () => {
    // The text assertion is weak on its own — the sweep is the real evidence —
    // but it names the trap at the exact line an edit would reintroduce it.
    expect(migrationCode()).toMatch(
      /v_kind not in \('void_no_points',\s*'carried_to_replay'\)/,
    )
  })
})

describe('settlement', () => {
  it('settles a card of completed, void and carried fixtures', () => {
    const result = resolveMatchweekSettlement([
      fixture('a', 'completed', { home: 1, away: 0 }),
      fixture('b', 'void'),
      fixture('c', 'abandoned', { home: 0, away: 0 }, 'r1'),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.settled).toBe(true)
  })

  it('does not settle while a fixture awaits its result', () => {
    const result = resolveMatchweekSettlement([fixture('a', 'scheduled')])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.settled).toBe(false)
  })

  it('does not settle while an abandoned fixture awaits its replay', () => {
    const result = resolveMatchweekSettlement([fixture('a', 'abandoned')])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.settled).toBe(false)
  })

  it('carries the prediction to the replay in full', () => {
    const result = resolveMatchweekSettlement([
      fixture('c', 'abandoned', { home: 2, away: 2 }, 'r1'),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement.predictionCarries).toEqual([
      { fromFixtureId: 'c', toFixtureId: 'r1' },
    ])
  })
})

describe('a contradictory card refuses whole, and the reason is the contract', () => {
  it.each([
    ['a completed fixture with no score', [fixture('a', 'completed')], 'completed_without_result'],
    [
      'a completed fixture with an empty score object',
      [fixture('a', 'completed', {} as never)],
      'completed_without_result',
    ],
    [
      'a score on a void fixture',
      [fixture('a', 'void', { home: 1, away: 0 })],
      'score_on_unplayed_fixture',
    ],
    [
      'a score on a scheduled fixture',
      [fixture('a', 'scheduled', { home: 1, away: 0 })],
      'score_on_unplayed_fixture',
    ],
    [
      'a replay named by a completed fixture',
      [fixture('a', 'completed', { home: 1, away: 0 }, 'r1')],
      'replay_on_non_abandoned_fixture',
    ],
    [
      'a fixture that is its own replay',
      [fixture('a', 'abandoned', null, 'a')],
      'replay_self_reference',
    ],
    [
      'the same fixture twice',
      [fixture('a', 'void'), fixture('a', 'void')],
      'duplicate_fixture',
    ],
    ['a blank fixture id', [fixture('   ', 'void')], 'invalid_input'],
  ])('refuses %s with %s', (_label, fixtures, reason) => {
    const result = resolveMatchweekSettlement(fixtures as SettlementFixture[])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(reason)
  })
})

describe('the SQL score predicate cannot return null', () => {
  it('coalesces, or a null inside the caller’s NOT would make the guard vanish', () => {
    // This is the regression for the defect the sweep found. Without the
    // coalesce, `is_settlement_score('{}')` is NULL, `not NULL` is NULL, and a
    // scoreless completed fixture settles as scoreable against nothing.
    const code = migrationCode()
    const predicate = code.slice(
      code.indexOf('create or replace function predictor_internal.is_settlement_score'),
      code.indexOf('revoke all on function predictor_internal.is_settlement_score'),
    )
    expect(predicate).toMatch(/coalesce\(/)
    expect(predicate).toMatch(/false\s*\)\s*;/)
  })

  it('checks integrality, because JSON has one number type', () => {
    const code = migrationCode()
    expect(code).toMatch(/floor\(/)
  })
})

describe('the SQL stays server-side', () => {
  it('revokes both functions from every browser role', () => {
    const code = migrationCode()
    for (const fn of ['resolve_matchweek_settlement', 'is_settlement_score']) {
      const revoke = new RegExp(
        `revoke all on function predictor_internal\\.${fn}\\([^)]*\\)\\s*from public, anon, authenticated`,
      )
      expect(code, `${fn} revoke`).toMatch(revoke)
    }
  })
})
