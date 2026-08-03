import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LMS_PUBLIC_JOINT_WINNER_CAP,
  concludeLmsRound,
  resolveLmsSeasonExhaustion,
} from '../../src/domain/season/lmsRoundResolution'

/**
 * How a Last Man Standing round ends, in both languages.
 *
 * The rule a reimplementation loses first is that a POSTPONEMENT CANNOT WIN. A
 * sole survivor who only survived because their fixture did not play has
 * beaten nobody, so the round continues. Award them the title instead and the
 * competition ends on a match that was never played — and it looks like an
 * ordinary win, because a one-survivor round normally is one.
 *
 * The second is the public joint-winner cap: a public wipeout shares the win
 * only up to three entrants, because a "shared win" between a crowd is not a
 * win. Above the cap everyone re-enters.
 *
 * The TypeScript authority is executed here; the SQL is read. Its behaviour is
 * proven against a real database in `125_lms_round_conclusion.sql`.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const conclusion = /conclude_lms_round\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''
const exhaustion =
  /resolve_lms_season_exhaustion\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''

const PRIVATE_PLAY_ON = { scope: 'private', onWipeout: 'play_on' } as const

describe('the SQL counterparts exist', () => {
  it('finds both bodies', () => {
    expect(conclusion, 'conclude_lms_round body not found').not.toBe('')
    expect(exhaustion, 'resolve_lms_season_exhaustion body not found').not.toBe('')
  })
})

describe('a postponement cannot win', () => {
  it('continues instead of crowning, in TypeScript', () => {
    expect(
      concludeLmsRound(
        [
          { entryId: 'a', alive: true, viaPostponement: true },
          { entryId: 'b', alive: false, viaPostponement: false },
        ],
        PRIVATE_PLAY_ON,
      ),
    ).toEqual({ kind: 'continues_postponement_cannot_win', soleSurvivorEntryId: 'a' })
  })

  it('crowns a sole survivor who actually played', () => {
    expect(
      concludeLmsRound(
        [
          { entryId: 'a', alive: true, viaPostponement: false },
          { entryId: 'b', alive: false, viaPostponement: false },
        ],
        PRIVATE_PLAY_ON,
      ),
    ).toEqual({ kind: 'winner', entryId: 'a' })
  })

  it('tests viaPostponement before returning a winner in SQL', () => {
    // Ordering is the whole rule: a winner returned first would make the
    // postponement branch unreachable, and the output would look normal.
    const soleBranch = conclusion.slice(conclusion.indexOf('v_survivors = 1'))
    const postponement = soleBranch.indexOf('viaPostponement')
    const winner = soleBranch.indexOf("'kind', 'winner'")

    expect(postponement).toBeGreaterThan(-1)
    expect(
      postponement,
      'the winner branch precedes the postponement check, so a survivor who never played would take the title',
    ).toBeLessThan(winner)
    expect(conclusion).toContain('continues_postponement_cannot_win')
  })
})

describe('the wipeout branches are first-class', () => {
  const wipeout = [
    { entryId: 'b', alive: false, viaPostponement: false },
    { entryId: 'a', alive: false, viaPostponement: false },
  ]

  it.each([
    ['play_on', 'wipeout_play_on'],
    ['reset', 'reset_no_winner'],
  ])('private %s concludes as %s', (onWipeout, kind) => {
    expect(
      concludeLmsRound(wipeout, { scope: 'private', onWipeout: onWipeout as 'play_on' | 'reset' }),
    ).toEqual({ kind })
    expect(conclusion).toContain(kind)
  })

  it('private shared_win returns sorted ids', () => {
    expect(concludeLmsRound(wipeout, { scope: 'private', onWipeout: 'shared_win' })).toEqual({
      kind: 'shared_win',
      entryIds: ['a', 'b'],
    })
  })

  it('sorts in SQL too, so the same wipeout always answers the same way', () => {
    expect(conclusion).toMatch(/jsonb_agg\(id order by id\)/)
  })
})

describe('the public joint-winner cap', () => {
  const atCap = Array.from({ length: LMS_PUBLIC_JOINT_WINNER_CAP }, (_, index) => ({
    entryId: `e${index}`,
    alive: false,
    viaPostponement: false,
  }))

  it('shares the win at the cap', () => {
    expect(LMS_PUBLIC_JOINT_WINNER_CAP).toBe(3)
    expect(concludeLmsRound(atCap, { scope: 'public' })).toMatchObject({ kind: 'shared_win' })
  })

  it('restarts above the cap, because a shared win between a crowd is not a win', () => {
    const aboveCap = [
      ...atCap,
      { entryId: 'extra', alive: false, viaPostponement: false },
    ]
    expect(concludeLmsRound(aboveCap, { scope: 'public' })).toEqual({
      kind: 'restart_all_reentered',
    })
  })

  it('uses the same cap in SQL', () => {
    expect(conclusion).toMatch(new RegExp(`v_total <= ${LMS_PUBLIC_JOINT_WINNER_CAP}\\b`))
    expect(conclusion).toContain('restart_all_reentered')
  })
})

describe('a malformed round is refused, not repaired', () => {
  it.each([
    ['an empty round', []],
    ['a duplicate entrant', [
      { entryId: 'a', alive: true, viaPostponement: false },
      { entryId: 'a', alive: false, viaPostponement: false },
    ]],
    ['a blank id', [{ entryId: '  ', alive: true, viaPostponement: false }]],
  ])('%s is refused in TypeScript', (_label, entrants) => {
    expect(concludeLmsRound(entrants as never, PRIVATE_PLAY_ON)).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
  })

  it('refuses the same shapes in SQL rather than deduplicating', () => {
    // Deduplicating would answer a question the caller did not ask: a round
    // sent twice for one entrant is a caller that does not know its own round.
    expect(conclusion).toMatch(/count\(distinct entrant->>'entryId'\)/)
    expect(conclusion).toMatch(/v_distinct <> v_total/)
    expect(conclusion).toMatch(/btrim\(entrant->>'entryId'\), ''\) = ''/)
    expect(conclusion).not.toMatch(/distinct on|dedup/i)
  })
})

describe('season exhaustion returns null rather than inventing a rule', () => {
  it('shares the win only under private play on', () => {
    expect(resolveLmsSeasonExhaustion(['b', 'a'], PRIVATE_PLAY_ON)).toEqual({
      kind: 'shared_win',
      entryIds: ['a', 'b'],
    })
  })

  it.each([
    ['one survivor', ['a'], PRIVATE_PLAY_ON],
    ['private reset', ['a', 'b'], { scope: 'private', onWipeout: 'reset' } as const],
    ['public', ['a', 'b'], { scope: 'public' } as const],
  ])('%s is undecided', (_label, ids, endgame) => {
    expect(resolveLmsSeasonExhaustion(ids, endgame)).toBeNull()
  })

  it('returns null in SQL for every undecided case', () => {
    // A winner here would be a rule ADR 0013 does not record.
    expect(exhaustion).toMatch(/<= 1 then null/)
    expect(exhaustion).toMatch(/else null/)
    expect(exhaustion).toMatch(/'private' and p_endgame_on_wipeout = 'play_on'/)
  })
})

describe('the conclusion stays server-side and pure', () => {
  it('is immutable and revoked from every browser role', () => {
    for (const fn of ['conclude_lms_round', 'resolve_lms_season_exhaustion']) {
      expect(allSql).toMatch(new RegExp(`${fn}[\\s\\S]*?immutable`))
      expect(allSql).toMatch(
        new RegExp(`revoke all on function predictor_internal\\.${fn}[\\s\\S]*?from public, anon, authenticated`),
      )
    }
  })
})
