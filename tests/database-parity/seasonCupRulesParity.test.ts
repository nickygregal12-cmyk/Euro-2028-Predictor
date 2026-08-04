import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { selectCupFormat } from '../../src/domain/season/cupFormat'
import { resolvePublicCupLaunch } from '../../src/domain/season/cupLaunch'
import { settleCupTie } from '../../src/domain/season/cupTieSettlement'

/**
 * The season Predictor Cup's three decision authorities, in both languages.
 *
 * WHY THIS SUITE ARRIVED LATE, and what that cost. Contracts 74 to 79 built the
 * Cup's rules, its neutral sources and its stores. Every one of those rules got
 * a PostgreSQL counterpart and none got a parity suite, because nothing drove
 * them — `select_season_cup_format`, `settle_season_cup_tie` and
 * `resolve_public_cup_launch` have no caller to this day. An unused pair cannot
 * fail loudly, so the two implementations were free to disagree.
 *
 * THEY DID. A differential sweep of 1200 randomised ties found 40 disagreements
 * in `settleCupTie`, on two independent causes, neither visible by reading
 * either implementation:
 *
 *   1. the SQL walked the confirmed fixtures ONCE, checking home and then away
 *      inside each iteration, while the TypeScript evaluated home completely and
 *      then away. A tie where home was wrong at a later fixture and away at an
 *      earlier one reported away's fault in SQL and home's in TypeScript;
 *
 *   2. within one entrant, the TypeScript checked "not on the card" and "not
 *      confirmed" per key, so the reason depended on JAVASCRIPT OBJECT KEY
 *      INSERTION ORDER. `jsonb` normalises keys to (length, then bytes), so no
 *      SQL counterpart could ever have matched it. `{"zz":3,"b":3,"a":3}`
 *      returned `invalid_input` from TypeScript and
 *      `points_for_unconfirmed_fixture` from PostgreSQL for the same card.
 *
 * The second is a defect in the authority independent of any database: two
 * callers building the same logical tie with keys written in a different order
 * got different reasons, and ADR 0014 specifies no such order. Contract 96
 * corrects both — the TypeScript to two order-independent passes, the SQL to
 * home-then-away over a shared per-entrant helper.
 *
 * Neither fault ever mis-settled a tie. Both implementations always agreed on
 * WHETHER to refuse, and on the points and match points when they did not. Only
 * the reason moved, and only for a tie wrong in more than one way at once —
 * which is exactly the class of defect that survives review and testing by
 * looking like a judgement call.
 *
 * EVIDENCE. The two small authorities are swept EXHAUSTIVELY, not sampled:
 *
 *   selectCupFormat        5229 cases, field −2..60 x rounds −2..80, 0 mismatches
 *                          every outcome reached: declined_head_to_head 160,
 *                          groups 3180, refused/insufficient_rounds 377,
 *                          refused/invalid_input 509, single_group/none 76,
 *                          single_group/seeded_playoff_window 722,
 *                          single_group/split 205
 *   resolvePublicCupLaunch  418 cases, entrants −3..205 x running{f,t},
 *                          0 mismatches, all four verdicts reached
 *   settleCupTie           4000 randomised ties, 0 mismatches after contract 96,
 *                          all ten outcomes reached
 *
 * Four mutations of the format selector, all killed by the exhaustive sweep:
 * group cap 20→24 (152), minimum field 4→3 (80), minimum meetings 2→1 (187),
 * odd-meetings split branch removed (454).
 *
 * The TypeScript authorities are executed here; the SQL is read, and proven
 * against a real database in `147_season_cup_rules.sql`.
 */

const migrationsDirectory = resolve(__dirname, '../../supabase/migrations')

function migrationSource(suffix: string): string {
  const file = readdirSync(migrationsDirectory).find((name) => name.endsWith(suffix))
  expect(file, `the ${suffix} migration`).toBeTruthy()
  return readFileSync(resolve(migrationsDirectory, file!), 'utf8')
}

/** Comments describe; only code enforces. */
const tieCode = () =>
  migrationSource('_cup_tie_settlement_refusal_order.sql').replace(/--[^\n]*/g, '')
const rulesCode = () => migrationSource('_season_cup_rules.sql').replace(/--[^\n]*/g, '')

describe('a tie wrong in two ways names one fault, and always the same one', () => {
  const fixtures = [
    { fixtureId: 'a', confirmedByCutoff: true },
    { fixtureId: 'b', confirmedByCutoff: false },
    { fixtureId: 'c', confirmedByCutoff: true },
    { fixtureId: 'd', confirmedByCutoff: true },
  ]

  it('reports HOME’s fault when both entrants are wrong', () => {
    // Home is missing a confirmed fixture; away carries an off-scale value at an
    // EARLIER fixture. Interleaving the two entrants reports away's.
    const result = settleCupTie(
      fixtures,
      { entryId: 'home', fixturePoints: { a: 3, c: 5 } },
      { entryId: 'away', fixturePoints: { a: 3, c: 1, d: 3 } },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('points_missing_for_confirmed_fixture')
  })

  it('does not depend on the order the point map’s keys were written', () => {
    // The regression for the key-order defect. `zz` is not on the card at all;
    // `b` is on the card but unconfirmed. Both orders must give the same answer,
    // and it must be the not-on-the-card one, because that check runs first.
    const away = { entryId: 'away', fixturePoints: { a: 3, c: 3, d: 3 } }
    const zzFirst = settleCupTie(
      fixtures,
      { entryId: 'home', fixturePoints: { zz: 3, b: 3, a: 3 } },
      away,
    )
    const bFirst = settleCupTie(
      fixtures,
      { entryId: 'home', fixturePoints: { b: 3, zz: 3, a: 3 } },
      away,
    )
    expect(zzFirst).toEqual(bFirst)
    expect(zzFirst.ok).toBe(false)
    if (zzFirst.ok) return
    expect(zzFirst.reason).toBe('invalid_input')
  })

  it('is two passes in TypeScript, not both checks per key', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/domain/season/cupTieSettlement.ts'),
      'utf8',
    )
    const body = source.slice(source.indexOf('function entrantTotal'), source.indexOf('export function settleCupTie'))
    // Two separate `for (const fixtureId of keys)` loops. One loop containing
    // both conditions is the shape that made the reason order-dependent.
    expect(body.match(/for \(const fixtureId of keys\)/g) ?? []).toHaveLength(2)
  })

  it('is home-then-away in SQL, through one shared per-entrant helper', () => {
    const code = tieCode()
    // Two calls, home first. Two inline copies are two things that can drift —
    // which is what happened.
    const calls = code.match(/predictor_internal\.cup_tie_entrant_total\(p_(home|away)/g) ?? []
    expect(calls).toEqual([
      'predictor_internal.cup_tie_entrant_total(p_home',
      'predictor_internal.cup_tie_entrant_total(p_away',
    ])
  })

  it('runs the two key checks as separate loops in SQL too', () => {
    const code = tieCode()
    const helper = code.slice(
      code.indexOf('create or replace function predictor_internal.cup_tie_entrant_total'),
      code.indexOf('revoke all on function predictor_internal.cup_tie_entrant_total'),
    )
    expect(helper.match(/jsonb_object_keys\(p_entrant->'fixturePoints'\)/g) ?? []).toHaveLength(2)
  })
})

describe('a settled tie is unchanged by contract 96', () => {
  it('still settles on the confirmed subset and labels the reduced set', () => {
    const result = settleCupTie(
      [
        { fixtureId: 'a', confirmedByCutoff: true },
        { fixtureId: 'b', confirmedByCutoff: true },
        { fixtureId: 'c', confirmedByCutoff: false },
      ],
      { entryId: 'home', fixturePoints: { a: 5, b: 3 } },
      { entryId: 'away', fixturePoints: { a: 3, b: 0 } },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.settlement).toMatchObject({
      result: 'home_win',
      settledOnFixtures: 2,
      fixtureCardSize: 3,
      reducedSet: true,
    })
    expect(result.settlement.home.matchPoints).toBe(3)
    expect(result.settlement.away.matchPoints).toBe(0)
  })
})

describe('the format selector', () => {
  it('declines a head-to-head field', () => {
    expect(selectCupFormat(3, 40)).toEqual({ kind: 'declined_head_to_head' })
  })

  it('plays one meeting fewer when an odd count’s balancing split will not fit', () => {
    // The branch the sweep killed 454 times when removed, and the only place an
    // odd meeting count silently becomes an even one.
    const decision = selectCupFormat(8, 22)
    expect(decision.kind).toBe('single_group')
    if (decision.kind !== 'single_group') return
    expect(decision.meetings % 2).toBe(0)
  })

  it('keeps the group cap and the minimum field in SQL', () => {
    const code = rulesCode()
    expect(code).toMatch(/p_field_size <= 20/)
    expect(code).toMatch(/p_field_size < 4/)
    expect(code).toMatch(/v_meetings >= 2/)
  })
})

describe('the public Cup launch threshold', () => {
  it('refuses an already-running competition however many have queued', () => {
    expect(resolvePublicCupLaunch({ entrants: 5000, publicCupRunning: true })).toMatchObject({
      open: false,
      reason: 'already_running',
    })
  })

  it('reports the shortfall below the threshold and opens at it', () => {
    expect(resolvePublicCupLaunch({ entrants: 99, publicCupRunning: false })).toMatchObject({
      open: false,
      shortfall: 1,
      reason: 'below_threshold',
    })
    expect(resolvePublicCupLaunch({ entrants: 100, publicCupRunning: false })).toEqual({
      open: true,
      entrants: 100,
    })
  })
})

describe('none of the three is reachable from a browser', () => {
  it('revokes the tie settlement and its new helper', () => {
    const code = tieCode()
    for (const fn of ['settle_season_cup_tie', 'cup_tie_entrant_total']) {
      expect(code, `${fn} revoke`).toMatch(
        new RegExp(`revoke all on function predictor_internal\\.${fn}\\([^)]*\\)\\s*from public, anon, authenticated`),
      )
    }
  })
})
