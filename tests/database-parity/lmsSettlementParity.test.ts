import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveLmsPick } from '../../src/domain/season/lmsRoundResolution'

/**
 * Turning a Last Man Standing result into survival.
 *
 * SURVIVAL IS DERIVED, NOT SPENT, and that is the decision this file exists to
 * hold. Settling each round incrementally — read the lives, spend one, write
 * back — cannot survive a correction: restating a 1-0 as 0-1 four rounds later
 * would leave an entrant eliminated by a defeat that no longer exists, and the
 * life is already gone. Reversal logic would have to be correct in every order.
 *
 * So `season_lms_entrant_state` is a PROJECTION and `replay_lms_entrant` folds
 * the whole season from round one every time. Re-running is idempotent by
 * construction rather than by a ledger, and a corrected result simply produces
 * a different answer. Nothing wrote that table before contract 85, so this is
 * an established reading rather than a retrofit.
 *
 * NEVER ELIMINATE ON ABSENT INFORMATION. Only `status = 'played'` with both
 * scores present is a result; scheduled, postponed, abandoned and void all
 * survive and consume nothing. An abandoned fixture's partial score does not
 * stand (ADR 0012), so being 2-0 up when it was abandoned is not a win.
 *
 * The per-round rule already has parity from contract 71 and is executed here.
 * The fold itself has no TypeScript counterpart — it is the job's own
 * orchestration — so it is read here and proven against a real database in
 * `136_lms_settlement.sql`.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')

const migrationFile = readdirSync(migrationsDirectory).find((file) =>
  file.endsWith('_lms_settlement.sql'),
)

/** Comment-stripped, so the header's prose cannot satisfy an assertion. */
const migration = (
  migrationFile === undefined
    ? ''
    : readFileSync(resolve(migrationsDirectory, migrationFile), 'utf8')
).replace(/--[^\n]*/g, '')

const outcomeRule =
  /lms_outcome_from_fixture\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(migration)?.[1] ?? ''
const replay = /replay_lms_entrant\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(migration)?.[1] ?? ''

describe('the migration is found, so nothing below is vacuous', () => {
  it('has both bodies to assert against', () => {
    expect(migrationFile, 'contract 85 migration not found').toBeDefined()
    expect(outcomeRule).not.toBe('')
    expect(replay).not.toBe('')
  })
})

describe('only a standing result can eliminate', () => {
  it('treats every non-played status as a postponement', () => {
    // One condition covering scheduled, postponed, abandoned and void. Listing
    // them individually would let a new status default to elimination, which is
    // the failure direction that ends someone's season on absent information.
    expect(outcomeRule).toMatch(/p_status is distinct from 'played' then 'postponed'/)
  })

  it('treats a played fixture with no score as no result either', () => {
    expect(outcomeRule).toMatch(/p_home_score is null or p_away_score is null then 'postponed'/)
  })

  it('settles both non-result guards before interpreting any scoreline', () => {
    // An abandoned fixture carries a partial score, and ADR 0012 says it never
    // stands, so the status guard must precede the draw/won/lost arithmetic.
    //
    // What does NOT matter is the order of the two guards relative to each
    // other: swapping them was mutation-tested and produced identical output
    // across all nine status/score combinations, because both return
    // 'postponed'. That is an equivalent mutant, not a gap — recorded so nobody
    // later "fixes" this test to pin an order that carries no meaning.
    const interpretation = outcomeRule.indexOf('p_home_score = p_away_score')
    expect(interpretation).toBeGreaterThan(-1)
    for (const guard of [
      "p_status is distinct from 'played'",
      'p_home_score is null or p_away_score is null',
    ]) {
      expect(outcomeRule.indexOf(guard), `${guard} is gone`).toBeGreaterThan(-1)
      expect(outcomeRule.indexOf(guard)).toBeLessThan(interpretation)
    }
  })

  it('decides the winner by comparing the scoreline to which club was picked', () => {
    expect(outcomeRule).toMatch(/\(p_home_score > p_away_score\) = p_picked_home then 'won'/)
  })
})

describe('a postponement consumes nothing, which contract 71 already decides', () => {
  it.each([
    ['postponed', { lives: 0, saves: 0 }],
    ['won', { lives: 0, saves: 0 }],
  ])('%s leaves both allowances untouched', (outcome, allowances) => {
    expect(
      resolveLmsPick({
        outcome: outcome as never,
        drawsRule: 'eliminate',
        livesRemaining: allowances.lives,
        savesRemaining: allowances.saves,
      }),
    ).toMatchObject({ alive: true, livesRemaining: 0, savesRemaining: 0 })
  })
})

describe('the replay stops at elimination and never revives', () => {
  it('returns immediately rather than continuing the fold', () => {
    // Without the early return a later win would overwrite the eliminated
    // state, and a player knocked out in round two would finish the season
    // alive.
    expect(replay).toMatch(/if not \(v_step->>'alive'\)::boolean then[\s\S]*?return jsonb_build_object\(\s*'alive', false/)
  })

  it('replays in window order, which decides when the allowances are spent', () => {
    expect(replay).toMatch(/with ordinality/)
    expect(replay).toMatch(/order by t\.position/)
  })

  it('refuses a round with no recorded outcome rather than assuming one', () => {
    // Assuming survival hands out a free round; assuming defeat eliminates on
    // missing data. Neither is a reading of the rule.
    expect(replay).toMatch(/jsonb_typeof\(v_outcome\) = 'null' then\s*return jsonb_build_object\('refused'/)
  })

  it('propagates a refusal from the per-round rule instead of swallowing it', () => {
    expect(replay).toMatch(/if v_step \? 'refused' then/)
  })
})

describe('the design is stated where it will be read', () => {
  it('does not build the job, and does not claim to', () => {
    // This contract adds no job and writes no row. An earlier draft of the
    // header claimed the job "takes a transaction-scoped advisory lock" — code
    // that did not exist. The claim is now a requirement on the next contract.
    expect(migration).not.toMatch(/create or replace function public\./)
    expect(migration).not.toMatch(/insert into public\./)
    expect(migration).not.toMatch(/update public\./)
  })

  it('keeps every function off the browser roles', () => {
    for (const fn of [
      'lms_outcome_from_fixture',
      'season_lms_pick_outcome',
      'replay_lms_entrant',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function predictor_internal\\.${fn}\\([^)]*\\)\\s*from public, anon, authenticated`),
      )
    }
  })
})
