import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCardAtLock } from '../../src/domain/season/cardSubmission'

/**
 * What happens to a matchweek card when its round locks, in both languages.
 *
 * THE FIRST RULE is that the card is NOT PRE-FILLED. A fixture the player left
 * blank is submitted as no prediction and scores nothing. ADR 0012 originally
 * required a "sensible default" on every fixture and auto-completion at lock;
 * contract 82 withdrew both, because a player must not benefit from not filling
 * something in. A default that can score is a free entry into every fixture a
 * player ignored, and the benefit is largest for the least engaged player.
 *
 * THE SECOND RULE is rolling entry. A player who never engaged a matchweek is
 * UNBANKED — the lock does not invent a submission for them. Get this backwards
 * and every registered player is silently entered into every matchweek,
 * manufacturing scores nobody made. Absence and an empty card stay different
 * facts.
 *
 * A CARD WITH BLANKS IS NOT A REFUSAL. It is the ordinary case. Refusing it
 * would make silence an error somebody has to resolve, when the rule is simply
 * that silence scores nothing.
 *
 * The TypeScript authority is executed here; the SQL is read, and proven
 * against a real database in `132_season_card_lock_resolution.sql`.
 *
 * Behaviour equivalence was re-established after the rule change by a
 * differential sweep over 738 generated cases — three statuses against nine
 * scoreline shapes in each of two fixture slots, across three fixture-id
 * shapes, plus empty, single-fixture and duplicate cards. Zero mismatches, and
 * the sweep is not vacuous: restoring the withdrawn prefill in SQL alone
 * produced 16 mismatches immediately.
 *
 * (The first run of that sweep reported 86 mismatches that were not real. The
 * comparator sorted only top-level keys, so every nested {away,home} against
 * {home,away} counted as a difference.)
 *
 * The earlier 216-case sweep, before the rule change, caught a real defect
 * recorded in contract 80's migration: `is_valid_scoreline` returned NULL
 * rather than false for an object with no `home` key, so `if not <null>` did
 * not fire and an empty object was accepted as a scoreline. That helper is
 * unchanged and still decides whether a value the player gave is a scoreline.
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


const scoreline = withoutComments(
  /is_valid_scoreline\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? '',
)

/**
 * Contract 82 redefines the resolver, so the LAST definition in migration order
 * is the live one. Matching the first would pin the withdrawn rule and pass
 * while the database did something else entirely.
 */
const resolutionBodies = [
  ...allSql.matchAll(
    // Anchored on the DEFINITION. A looser pattern also matched contract 82's
    // apply-time DO block, which merely calls the function — and `at(-1)` then
    // asserted against the proof instead of the implementation.
    /create or replace function predictor_internal\.resolve_season_card_at_lock\([\s\S]*?\$\$([\s\S]*?)\$\$;/g,
  ),
].map((match) => withoutComments(match[1]))

const card = (playerPrediction: unknown) => [{ fixtureId: 'f1', playerPrediction }]

const resolution = resolutionBodies.at(-1) ?? ''

describe('the SQL counterparts exist', () => {
  it('finds both bodies, and more than one resolver', () => {
    expect(resolution, 'resolve_season_card_at_lock body not found').not.toBe('')
    expect(scoreline, 'is_valid_scoreline body not found').not.toBe('')
    // Contract 80 defined it and contract 82 redefined it. If this ever drops
    // back to one, the redefinition has been lost and every assertion below is
    // silently checking the withdrawn rule.
    expect(resolutionBodies.length).toBeGreaterThan(1)
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

describe('a blank fixture scores nothing, and is not filled in', () => {
  it('submits no prediction for it at all', () => {
    // Not a zero, not a default — absent. Scoring awards points for what is in
    // this list, so a fixture that is not here cannot earn anything.
    expect(resolveCardAtLock(card(null) as never, 'provisional')).toEqual({
      kind: 'submitted',
      predictions: [],
      confirmed: false,
    })
  })

  it('keeps the player value where they gave one, and only there', () => {
    expect(
      resolveCardAtLock(
        [
          { fixtureId: 'f1', playerPrediction: { home: 3, away: 0 } },
          { fixtureId: 'f2', playerPrediction: null },
        ] as never,
        'provisional',
      ),
    ).toEqual({
      kind: 'submitted',
      predictions: [{ fixtureId: 'f1', prediction: { home: 3, away: 0 } }],
      confirmed: false,
    })
  })

  it('is not a refusal — silence is expected, not an error', () => {
    expect(resolveCardAtLock(card(null) as never, 'provisional').kind).toBe('submitted')
    expect(resolveCardAtLock(card(null) as never, 'confirmed').kind).toBe('submitted')
  })

  it('skips the blank in SQL rather than substituting for it', () => {
    expect(resolution).toMatch(/jsonb_typeof\(v_player\) = 'null' then\s*continue;/)
  })

  it('never reads defaultPrediction anywhere', () => {
    // The whole withdrawal in one assertion. Comments are stripped, so this
    // cannot be satisfied by the migration explaining that it does not.
    expect(resolution).not.toMatch(/defaultPrediction/)
  })

  it('emits neither provenance nor autoCompleted', () => {
    // Both could now only take one value, and a field with one possible value
    // is a field somebody will eventually believe has two.
    expect(resolution).not.toMatch(/provenance/)
    expect(resolution).not.toMatch(/autoCompleted/)
    expect(resolveCardAtLock(card({ home: 1, away: 1 }) as never, 'provisional')).not.toHaveProperty(
      'autoCompleted',
    )
  })
})

describe('confirmation records intent, and changes no scoring', () => {
  it('submits exactly the same predictions either way', () => {
    const fixtures = [
      { fixtureId: 'f1', playerPrediction: { home: 2, away: 1 } },
      { fixtureId: 'f2', playerPrediction: null },
    ]
    const provisional = resolveCardAtLock(fixtures as never, 'provisional')
    const confirmed = resolveCardAtLock(fixtures as never, 'confirmed')

    expect(confirmed).toEqual({ ...provisional, confirmed: true })
  })

  it('still reports which it was', () => {
    expect(resolveCardAtLock(card({ home: 1, away: 1 }) as never, 'confirmed')).toMatchObject({
      confirmed: true,
    })
    expect(resolution).toMatch(/'confirmed', p_status = 'confirmed'/)
  })
})

describe('contradictory cards refuse rather than guess', () => {
  it.each([
    ['an engaged card with no fixtures', [], 'provisional', 'invalid_input'],
    [
      'a blank fixture id',
      [{ fixtureId: '  ', playerPrediction: null }],
      'provisional',
      'invalid_input',
    ],
    [
      'a player value that is not a scoreline',
      [{ fixtureId: 'f1', playerPrediction: {} }],
      'provisional',
      'invalid_input',
    ],
    [
      'a negative player value',
      [{ fixtureId: 'f1', playerPrediction: { home: -1, away: 0 } }],
      'provisional',
      'invalid_input',
    ],
    [
      'a fractional player prediction',
      [{ fixtureId: 'f1', playerPrediction: { home: 2.5, away: 1 } }],
      'provisional',
      'invalid_input',
    ],
    [
      'a duplicated fixture',
      [
        { fixtureId: 'f1', playerPrediction: null },
        { fixtureId: 'f1', playerPrediction: null },
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
    // A malformed value on fixture one and a duplicate on fixture two must
    // report invalid_input. Checking all ids first would report the duplicate
    // and point at the wrong fixture.
    expect(
      resolveCardAtLock(
        [
          { fixtureId: 'f1', playerPrediction: { home: -1, away: 1 } },
          { fixtureId: 'f1', playerPrediction: { home: 1, away: 1 } },
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
    // The defect the earlier sweep caught: `jsonb_typeof({}->\'home\')` is NULL,
    // so the conjunction was NULL and `if not <null>` never fired. Without this
    // the empty object is accepted as a scoreline.
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
    // unreachable there and the differential sweep cannot cover it.
    expect(resolution).toMatch(/p_status not in \('no_submission', 'provisional', 'confirmed'\)/)
  })
})
