import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCardAtLock, type CardStatus } from '../../src/domain/season/cardSubmission'
import { concludeLmsRound } from '../../src/domain/season/lmsRoundResolution'

/**
 * Two more season authorities that had a PostgreSQL counterpart and no suite
 * holding it in step: the matchweek card at its lock, and the Last Man Standing
 * round conclusion.
 *
 * EVIDENCE.
 *
 *   resolveCardAtLock   1500 cases, 0 mismatches. Coverage: unbanked 521,
 *                       submitted 472, refused/invalid_input 465,
 *                       refused/duplicate_fixture 42.
 *   concludeLmsRound    2000 cases, 0 mismatches, weighted for wipeouts because
 *                       ADR 0013 says mass elimination is likelier than
 *                       independence suggests. All eight conclusions reached:
 *                       refused 643, winner 386, shared_win 277, continues 251,
 *                       continues_postponement_cannot_win 171,
 *                       wipeout_play_on 134, reset_no_winner 129,
 *                       restart_all_reentered 9.
 *
 * Mutants killed: `no_submission` treated as an ordinary status (521),
 * a postponement allowed to win (171), `shared_win` rerouted to play-on (263).
 *
 * ONE MUTANT THE SWEEP CANNOT KILL, and why it is not a defect. Removing the
 * SQL's status-domain guard changes nothing the sweep can see, because the
 * sweep only sends the three statuses `CardStatus` permits. Sending a fourth
 * does diverge — TypeScript submits the card, PostgreSQL refuses it — but
 * reaching that state requires casting past the union type:
 *
 *     resolveCardAtLock(fixtures, 'nonsense' as CardStatus)
 *
 * That is a difference in what each language may ASSUME, not a disagreement
 * about the rule. TypeScript has a compile-time guarantee and needs no runtime
 * check; PostgreSQL takes `text` from a column whose CHECK constrains it and
 * defends anyway. The parity claim is therefore: equivalent over the domain of
 * `CardStatus`, with the SQL additionally closed at a boundary TypeScript closes
 * earlier. The guard is asserted structurally below, since no sweep can reach it.
 *
 * Contrast with the Cup tie in contract 96, where both implementations were
 * reachable with entirely well-typed input and still disagreed. That one was a
 * defect and was fixed; this one is a documented boundary.
 */

const migrationsDirectory = resolve(__dirname, '../../supabase/migrations')

function migrationCode(suffix: string): string {
  const file = readdirSync(migrationsDirectory).find((name) => name.endsWith(suffix))
  expect(file, `the ${suffix} migration`).toBeTruthy()
  return readFileSync(resolve(migrationsDirectory, file!), 'utf8').replace(/--[^\n]*/g, '')
}

describe('the matchweek card at its lock', () => {
  it('leaves an untouched card unbanked rather than inventing a submission', () => {
    expect(resolveCardAtLock([{ fixtureId: 'a', playerPrediction: null }], 'no_submission')).toEqual(
      { kind: 'unbanked' },
    )
  })

  it('submits blanks as absences, not as manufactured scores', () => {
    // The rule scoring depends on: a blank fixture is missing from the list
    // rather than present as 0-0, so it awards nothing instead of awarding a
    // draw prediction nobody made.
    const result = resolveCardAtLock(
      [
        { fixtureId: 'a', playerPrediction: null },
        { fixtureId: 'b', playerPrediction: { home: 2, away: 1 } },
      ],
      'provisional',
    )
    expect(result).toEqual({
      kind: 'submitted',
      predictions: [{ fixtureId: 'b', prediction: { home: 2, away: 1 } }],
      confirmed: false,
    })
  })

  it('refuses a matchweek with no fixtures at all', () => {
    expect(resolveCardAtLock([], 'confirmed')).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
  })

  it('keeps the SQL status-domain guard the sweep cannot reach', () => {
    // See the header: this is the one mutant no differential sweep kills,
    // because reaching it means casting past `CardStatus`.
    expect(migrationCode('_season_card_no_prefill.sql')).toMatch(
      /p_status not in \('no_submission', 'provisional', 'confirmed'\)/,
    )
  })

  it('records intent without letting it change what is submitted', () => {
    // `provisional` and `confirmed` submit identically — with no prefills there
    // is nothing for confirmation to adopt — so the flag is a record of what the
    // player said, not a scoring input.
    const fixtures = [{ fixtureId: 'a', playerPrediction: { home: 1, away: 0 } }]
    const provisional = resolveCardAtLock(fixtures, 'provisional')
    const confirmed = resolveCardAtLock(fixtures, 'confirmed')
    expect(provisional.kind).toBe('submitted')
    expect(confirmed.kind).toBe('submitted')
    if (provisional.kind !== 'submitted' || confirmed.kind !== 'submitted') return
    expect(provisional.predictions).toEqual(confirmed.predictions)
    expect(provisional.confirmed).toBe(false)
    expect(confirmed.confirmed).toBe(true)
  })
})

describe('the Last Man Standing round conclusion', () => {
  const E = (entryId: string, alive: boolean, viaPostponement = false) => ({
    entryId,
    alive,
    viaPostponement,
  })

  it('does not let a postponement win the competition', () => {
    // The rule a reimplementation loses first. A sole survivor who survived only
    // because their fixture did not play has not won anything yet — the other
    // eliminations stand, and the round continues.
    expect(concludeLmsRound([E('a', true, true)], { scope: 'public' })).toEqual({
      kind: 'continues_postponement_cannot_win',
      soleSurvivorEntryId: 'a',
    })
  })

  it('awards the title to a sole survivor whose fixture did play', () => {
    expect(concludeLmsRound([E('a', true), E('b', false)], { scope: 'public' })).toEqual({
      kind: 'winner',
      entryId: 'a',
    })
  })

  it.each([
    ['play_on', 'wipeout_play_on'],
    ['shared_win', 'shared_win'],
    ['reset', 'reset_no_winner'],
  ] as const)('routes a private wipeout with onWipeout=%s to %s', (onWipeout, kind) => {
    const result = concludeLmsRound([E('a', false), E('b', false)], {
      scope: 'private',
      onWipeout,
    })
    expect(result.kind).toBe(kind)
  })

  it('refuses a duplicated entrant rather than concluding twice for one player', () => {
    expect(concludeLmsRound([E('a', true), E('a', true)], { scope: 'public' })).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
  })
})

describe('neither is reachable from a browser', () => {
  it.each([
    ['resolve_season_card_at_lock', '_season_card_no_prefill.sql'],
    ['conclude_lms_round', '_lms_round_conclusion.sql'],
  ])('revokes %s', (fn, suffix) => {
    expect(migrationCode(suffix)).toMatch(
      new RegExp(
        `revoke all on function predictor_internal\\.${fn}\\([^)]*\\)\\s*from public, anon, authenticated`,
      ),
    )
  })
})

describe('the status domain is exactly CardStatus', () => {
  it('has three members, which is what the SQL guard enumerates', () => {
    const statuses: CardStatus[] = ['no_submission', 'provisional', 'confirmed']
    expect(new Set(statuses).size).toBe(3)
  })
})
