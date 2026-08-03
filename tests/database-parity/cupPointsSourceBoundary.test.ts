import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A BEFORE-STATE CONTRACT for the tournament Cup's points source.
 *
 * ADR 0022's 3 August correction directs that `predictor_internal.cup_*` be
 * generalised from tournament scope to competition-season scope, so one
 * implementation serves both, and that the work is sequenced after C1b. C1b
 * has landed and been applied, so that work is now startable — and reading the
 * functions first changes what "rescoping" means.
 *
 * `cup_window_scores` is NOT tournament-scoped by a parameter. Its signature
 * already takes `p_competition_id`; the tournament lives in the body, which
 * reads `public.matches`, `public.match_predictions`,
 * `public.bonus_knockout_predictions` and `entries.tournament_id` directly. A
 * season Cup cannot reach any of those — its fixtures are `season_fixtures`
 * (contract 68) and its predictions `season_predictions` (contract 69).
 *
 * So the function conflates two responsibilities:
 *
 *   1. a POINTS SOURCE — find this member's prediction for this fixture and
 *      score it raw 5/3/0. Tournament-specific;
 *   2. SHARED ARITHMETIC — aggregate per user into points, exacts, corrects,
 *      scoreline error and submitted. Competition-agnostic, and precisely what
 *      ADR 0022 wants to become one implementation.
 *
 * The generalisation is therefore a SPLIT, not a parameter swap: the shared
 * half consumes a neutral per-user-per-fixture raw-points relation, and each
 * competition kind supplies it. That is the same neutral contract ADR 0022
 * requires be preserved, and the one `settleCupTie` already implements by
 * taking fixture points as an input rather than computing them.
 *
 * This file pins the before state so the split cannot quietly change the
 * tournament answer while moving it. It asserts what is true TODAY. When the
 * rescoping lands, these assertions must be updated deliberately and visibly —
 * that is the point of a before-state contract, and it is the pattern PRs
 * #245, #246, #286 and #292 already established here.
 *
 * What this cannot check, stated so the coverage is not overread: it reads SQL
 * text. Behaviour against a real database is proven by
 * `108`–`114_predictor_cup_*.sql`, which stay authoritative for that.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

/** The last definition wins, which is the one the database actually holds. */
function lastBody(name: string): string {
  const pattern = new RegExp(
    `create or replace function predictor_internal\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
    'g',
  )
  const bodies = [...allSql.matchAll(pattern)].map((match) => match[1])
  return bodies.at(-1) ?? ''
}

const windowScores = lastBody('cup_window_scores')
const finalGroupTables = lastBody('cup_final_group_tables')
const bracketOrder = lastBody('cup_bracket_order')

const SEASON_RELATIONS = [
  'season_fixtures',
  'season_predictions',
  'season_matchweek_jokers',
  'season_lms_setups',
  'season_lms_entrant_state',
] as const

describe('the tournament Cup bodies are readable', () => {
  it.each([
    ['cup_window_scores', () => windowScores],
    ['cup_final_group_tables', () => finalGroupTables],
    ['cup_bracket_order', () => bracketOrder],
  ])('%s has a body', (name, body) => {
    expect(body(), `${name} body not found`).not.toBe('')
  })
})

describe('the points source is tournament-coupled today', () => {
  // Each of these is a place the rescoping has to do something about. Naming
  // them individually means a partial job fails here rather than passing with
  // one coupling left behind.
  it.each([
    ['tournament fixtures', /join public\.matches\b/],
    ['tournament group predictions', /public\.match_predictions\b/],
    ['tournament knockout predictions', /public\.bonus_knockout_predictions\b/],
    ['the tournament scope on entries', /entry\.tournament_id\s*=/],
  ])('cup_window_scores reads %s', (_label, pattern) => {
    expect(windowScores).toMatch(pattern)
  })

  it('reaches no season relation, because it cannot', () => {
    // The season tables exist from contract 68 onward. If one appears here
    // without this contract being rewritten, a rescoping happened by accident.
    for (const relation of SEASON_RELATIONS) {
      expect(windowScores, `cup_window_scores now reads ${relation}`).not.toContain(relation)
    }
  })

  it('uses the tournament round vocabulary the season does not share', () => {
    // 'group' rounds and the 90-minute columns are tournament concepts. A
    // league season has matchweeks and no extra time.
    expect(windowScores).toMatch(/round = 'group'/)
    expect(windowScores).toMatch(/home_score_90/)
  })
})

describe('the raw scale is already the neutral contract', () => {
  it('awards 5 for an exact score and 3 for the result', () => {
    // The same 5/3/0 the season Championship settles on. This is why the
    // neutral contract is a real seam and not an aspiration: the two
    // competitions already agree on the value of a fixture.
    expect(windowScores).toMatch(/then 5\b/)
    expect(windowScores).toMatch(/then 3\b/)
    expect(windowScores).toMatch(/else 0\b/)
  })

  it('tests the exact score before the result, so an exact never scores 3', () => {
    // Ordering is the whole rule. Reversed, every exact score silently becomes
    // a correct result, and the totals stay plausible.
    const exact = windowScores.indexOf('then 5')
    const correct = windowScores.indexOf('then 3')
    expect(exact).toBeGreaterThan(-1)
    expect(
      exact,
      'the result branch precedes the exact-score branch, so an exact score would score 3',
    ).toBeLessThan(correct)
  })

  it('scores an unconfirmed fixture as nothing rather than as a miss', () => {
    expect(windowScores).toMatch(/not mp\.confirmed or mp\.predicted_home is null then 0/)
  })

  it('sentinels a missing prediction in the scoreline error rather than treating it as exact', () => {
    // 999 is deliberate: absent predictions must sort last on the tie-break,
    // and a zero error would sort them first — ahead of everyone who played.
    expect(windowScores).toMatch(/predicted_home is null then 999/)
  })
})

describe('the shared half is the part worth generalising', () => {
  it.each(['points', 'exacts', 'corrects', 'scoreline_error', 'submitted'])(
    'aggregates %s per member',
    (column) => {
      expect(windowScores).toContain(column)
    },
  )

  it('groups by the member, so the shared arithmetic is per entrant', () => {
    expect(windowScores).toMatch(/group by mp\.user_id/)
  })

  it('keeps the bracket order free of any competition scope already', () => {
    // `cup_bracket_order(p_size integer)` is pure arithmetic over a bracket
    // size. It needs no rescoping at all, and the plan should not pay for it.
    expect(bracketOrder).not.toMatch(/tournament|competition|season/i)
  })
})

describe('the tournament ordering stays out of the season rules', () => {
  it('normalises across group sizes in the WILDCARD path, not the group table', () => {
    // Correction to contract 74's own migration comment, which said the
    // tournament Cup's ordering uses `table_points / (group_size - 1)`. The
    // substance was right — the tournament does compare across differently
    // sized groups — but the location was not. The normalisation is in the
    // wildcard qualification path (a third-placed side from a group of four
    // against a runner-up from a group of three), while the group table itself
    // orders by the nine keys pinned below. The migration is applied to
    // development and migrations are append-only after hosted application, so
    // the correction is recorded here rather than by editing that file.
    expect(finalGroupTables).not.toMatch(/group_size - 1/)
    expect(allSql).toMatch(/gate\.table_points::numeric \/ \(gate\.group_size - 1\) desc/)
  })

  it('orders the tournament group table by its own keys, in order', () => {
    // The tournament's tie-break, and the counterpart to the season
    // Championship's. Pinned so a rescoping cannot reorder it in passing: each
    // key decides real qualification, and a swapped pair changes who goes
    // through without changing any total on screen.
    const keys = [
      'table_points',
      'window_points',
      'exacts',
      'corrects',
      'mini_points',
      'mini_difference',
      'scoreline_error',
      'draw_number',
    ]
    const positions = keys.map((key) => finalGroupTables.lastIndexOf(`wm.${key}`))
    expect(positions.every((position) => position > -1), `missing one of ${keys.join(', ')}`).toBe(
      true,
    )
    expect(positions, 'the group-table ordering keys are no longer in their pinned order').toEqual(
      [...positions].sort((a, b) => a - b),
    )
  })

  it.each(['settle_season_cup_tie', 'select_season_cup_format', 'resolve_public_cup_launch'])(
    'the tournament tables do not call %s',
    (fn) => {
      expect(finalGroupTables).not.toContain(fn)
      expect(windowScores).not.toContain(fn)
    },
  )
})
