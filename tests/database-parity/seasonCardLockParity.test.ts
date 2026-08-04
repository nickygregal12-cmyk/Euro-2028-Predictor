import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCardAtLock } from '../../src/domain/season/cardSubmission'

/**
 * What happens to a matchweek card when its round locks, in both languages.
 *
 * THE RULE THIS PROTECTS is rolling entry. A player who never engaged a
 * matchweek is UNBANKED — the lock does not invent a submission for them. Get
 * this backwards and every registered player is silently entered into every
 * matchweek with default predictions, manufacturing scores nobody made. The
 * totals would look entirely plausible.
 *
 * THE SECOND RULE is provenance on a confirmed card. A prefilled default the
 * player confirmed is theirs, not an auto-completion, because confirming is the
 * act of adopting the prefills. Confirmed cards therefore always report
 * `autoCompleted: false` even when every value came from a default.
 *
 * The TypeScript authority is executed here; the SQL is read, and proven
 * against a real database in `132_season_card_lock_resolution.sql`.
 *
 * Behaviour equivalence was established by a differential sweep over 216
 * generated cases — every combination of four statuses against seven scoreline
 * shapes for both the default and the player prediction, plus multi-fixture,
 * duplicate, blank-id and refusal-ordering cards. It caught a real defect,
 * recorded in the migration: `is_valid_scoreline` returned NULL rather than
 * false for an object with no `home` key, so `if not <null>` did not fire and
 * an empty object was accepted as a scoreline while TypeScript refused it.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

/**
 * A function body with its `--` comments removed.
 *
 * These bodies explain themselves, and the explanations name the very
 * constructs the assertions look for — the scoreline helper's comment contains
 * the words `coalesce(..., false)`. Asserting against the raw body therefore
 * passes on the prose: removing the real `coalesce` left this suite green, and
 * a mutation run is the only reason that was noticed. This is the third time in
 * this repository a guard has been satisfied by a comment rather than by code.
 */
function withoutComments(body: string): string {
  return body.replace(/--[^\n]*/g, '')
}

const resolution = withoutComments(
  /resolve_season_card_at_lock\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? '',
)
const scoreline = withoutComments(
  /is_valid_scoreline\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? '',
)

const card = (playerPrediction: unknown) => [
  { fixtureId: 'f1', defaultPrediction: { home: 1, away: 1 }, playerPrediction },
]

describe('the SQL counterparts exist', () => {
  it('finds both bodies', () => {
    expect(resolution, 'resolve_season_card_at_lock body not found').not.toBe('')
    expect(scoreline, 'is_valid_scoreline body not found').not.toBe('')
  })
})

describe('a card nobody touched is never submitted', () => {
  it('is unbanked in TypeScript, whatever the fixtures say', () => {
    expect(resolveCardAtLock(card(null) as never, 'no_submission')).toEqual({ kind: 'unbanked' })
    expect(resolveCardAtLock([] as never, 'no_submission')).toEqual({ kind: 'unbanked' })
  })

  it('returns unbanked before validating anything in SQL', () => {
    // Ordering is the rule: a no-submission card with malformed fixtures must
    // still be unbanked, not refused. Validating first would turn an absent
    // player into an error nobody can act on.
    const unbanked = resolution.indexOf("'unbanked'")
    const validation = resolution.indexOf('jsonb_typeof(p_fixtures)')
    expect(unbanked).toBeGreaterThan(-1)
    expect(
      unbanked,
      'fixture validation precedes the unbanked return, so an absent player can be refused',
    ).toBeLessThan(validation)
  })
})

describe('an engaged card completes from defaults', () => {
  it('fills the gaps and says it did', () => {
    expect(resolveCardAtLock(card(null) as never, 'provisional')).toEqual({
      kind: 'submitted',
      predictions: [
        { fixtureId: 'f1', prediction: { home: 1, away: 1 }, provenance: 'default' },
      ],
      autoCompleted: true,
      confirmed: false,
    })
  })

  it('keeps the player value where they gave one', () => {
    expect(resolveCardAtLock(card({ home: 3, away: 0 }) as never, 'provisional')).toMatchObject({
      predictions: [
        { fixtureId: 'f1', prediction: { home: 3, away: 0 }, provenance: 'player' },
      ],
      autoCompleted: false,
    })
  })
})

describe('a confirmed card owns its prefills', () => {
  it('reports player provenance and no auto-completion, even from defaults', () => {
    // The player signed the card off. Telling them the system filled it in
    // would be false, and would flag a card they had personally confirmed.
    expect(resolveCardAtLock(card(null) as never, 'confirmed')).toEqual({
      kind: 'submitted',
      predictions: [
        { fixtureId: 'f1', prediction: { home: 1, away: 1 }, provenance: 'player' },
      ],
      autoCompleted: false,
      confirmed: true,
    })
  })

  it('makes confirmation part of the provenance test in SQL', () => {
    expect(resolution).toMatch(/v_from_default := not v_confirmed/)
  })
})

describe('contradictory cards refuse rather than guess', () => {
  it.each([
    ['an engaged card with no fixtures', [], 'provisional', 'invalid_input'],
    [
      'a blank fixture id',
      [{ fixtureId: '  ', defaultPrediction: { home: 1, away: 1 }, playerPrediction: null }],
      'provisional',
      'invalid_input',
    ],
    [
      'a missing default',
      [{ fixtureId: 'f1', defaultPrediction: null, playerPrediction: null }],
      'provisional',
      'invalid_input',
    ],
    [
      'a default that is not a scoreline',
      [{ fixtureId: 'f1', defaultPrediction: {}, playerPrediction: null }],
      'provisional',
      'invalid_input',
    ],
    [
      'a negative default',
      [{ fixtureId: 'f1', defaultPrediction: { home: -1, away: 0 }, playerPrediction: null }],
      'provisional',
      'invalid_input',
    ],
    [
      'a fractional player prediction',
      [
        {
          fixtureId: 'f1',
          defaultPrediction: { home: 1, away: 1 },
          playerPrediction: { home: 2.5, away: 1 },
        },
      ],
      'provisional',
      'invalid_input',
    ],
    [
      'a duplicated fixture',
      [
        { fixtureId: 'f1', defaultPrediction: { home: 1, away: 1 }, playerPrediction: null },
        { fixtureId: 'f1', defaultPrediction: { home: 1, away: 1 }, playerPrediction: null },
      ],
      'provisional',
      'duplicate_fixture',
    ],
  ])('%s is refused', (_label, fixtures, status, reason) => {
    expect(resolveCardAtLock(fixtures as never, status as never)).toEqual({
      kind: 'refused',
      reason,
    })
  })

  it('checks each fixture fully before the next, so the first fault wins', () => {
    // A malformed default on fixture one and a duplicate on fixture two must
    // report invalid_input. Checking all ids first would report the duplicate
    // and point at the wrong fixture.
    expect(
      resolveCardAtLock(
        [
          { fixtureId: 'f1', defaultPrediction: { home: -1, away: 1 }, playerPrediction: null },
          { fixtureId: 'f1', defaultPrediction: { home: 1, away: 1 }, playerPrediction: null },
        ] as never,
        'provisional',
      ),
    ).toEqual({ kind: 'refused', reason: 'invalid_input' })

    // The SQL loops once per fixture rather than pre-scanning, which is what
    // makes that ordering hold.
    expect(resolution).toMatch(/with ordinality/)
    expect(resolution).toMatch(/order by t\.position/)
  })
})

describe('the scoreline test is two-valued', () => {
  it('coalesces, because a missing key makes the comparison NULL not false', () => {
    // The defect the differential sweep caught: `jsonb_typeof({}->'home')` is
    // NULL, so the conjunction was NULL and `if not <null>` never fired.
    // Without this the empty object is accepted as a scoreline.
    expect(scoreline).toMatch(/select coalesce\(/)
    expect(scoreline).toMatch(/,\s*\n?\s*false\)/)
  })

  it('rejects a fraction rather than truncating it', () => {
    // `jsonb_typeof` calls 2.5 a number, so a type check alone lets it through
    // and the cast then silently truncates. BOTH halves must be checked —
    // asserting one `floor(` passes while the other side truncates silently.
    expect(scoreline).toMatch(/'home'\)::numeric = floor\(/)
    expect(scoreline).toMatch(/'away'\)::numeric = floor\(/)
  })
})

describe('the resolution stays server-side and pure', () => {
  it.each(['resolve_season_card_at_lock', 'is_valid_scoreline'])(
    '%s is immutable and revoked from every browser role',
    (fn) => {
      expect(allSql).toMatch(new RegExp(`${fn}[\\s\\S]*?immutable`))
      expect(allSql).toMatch(
        new RegExp(`revoke all on function predictor_internal\\.${fn}[\\s\\S]*?from public, anon, authenticated`),
      )
    },
  )

  it('refuses an unrecognised status rather than treating it as engaged', () => {
    // A deliberate hardening: `CardStatus` is a union in TypeScript, so this is
    // unreachable there, but SQL has no such guarantee.
    expect(resolution).toMatch(/p_status not in \('no_submission', 'provisional', 'confirmed'\)/)
  })
})
