import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The boundary between the Cup's points source and its shared arithmetic.
 *
 * Written at contract 74 as a BEFORE-STATE contract, and updated at contract
 * 75 to its after state. Both halves of that history matter, so both are kept.
 *
 * BEFORE (contract 74). `cup_window_scores` was not tournament-scoped by a
 * parameter — its signature already took `p_competition_id` — but its body read
 * `public.matches`, `public.match_predictions`,
 * `public.bonus_knockout_predictions` and `entries.tournament_id` directly, and
 * branched on the tournament round vocabulary. A season Cup could reach none of
 * it: season fixtures are `season_fixtures` (contract 68) and season
 * predictions are `season_predictions` (contract 69).
 *
 * So the function was doing two jobs — a tournament-specific POINTS SOURCE, and
 * competition-agnostic AGGREGATION into points, exacts, corrects, scoreline
 * error and submitted. Only the second is what ADR 0022's correction wants to
 * become one implementation, which made the generalisation a SPLIT rather than
 * a parameter swap.
 *
 * AFTER (contract 75). The source is `cup_tournament_fixture_points` and the
 * arithmetic stayed in `cup_window_scores`, consuming a neutral
 * per-member-per-fixture relation of derived facts — never scorelines — so a
 * season source returning the same shape is a drop-in. `cup_window_scores`
 * kept its signature, so all sixteen call sites were untouched.
 *
 * This file asserts what is true NOW. When a season source lands, or the
 * remaining `cup_*` functions are rescoped, these assertions must be updated
 * deliberately and visibly — that is what a boundary contract is for, and it is
 * the pattern PRs #245, #246, #286 and #292 established here.
 *
 * What this cannot check, stated so the coverage is not overread: it reads SQL
 * text. Behaviour against a real database is proven by
 * `108`–`114_predictor_cup_*.sql`, which stay authoritative for that and which
 * exercise `cup_window_scores` through the admin RPCs across 54 assertions —
 * unchanged by the split, and therefore its regression evidence.
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
const pointsSource = lastBody('cup_tournament_fixture_points')
const windowSettled = lastBody('cup_window_settled')
const settlementSource = lastBody('cup_tournament_window_unsettled')
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

describe('the tournament coupling lives in the points source', () => {
  // AFTER STATE, contract 75. Every one of these was asserted of
  // `cup_window_scores` when this contract was written; the split moved them
  // into `cup_tournament_fixture_points` and this is the deliberate, visible
  // edit that records it. Naming them individually still means a partial job
  // fails here rather than passing with one coupling left behind.
  it.each([
    ['tournament fixtures', /join public\.matches\b/],
    ['tournament group predictions', /public\.match_predictions\b/],
    ['tournament knockout predictions', /public\.bonus_knockout_predictions\b/],
    ['the tournament scope on entries', /entry\.tournament_id\s*=/],
  ])('cup_tournament_fixture_points reads %s', (_label, pattern) => {
    expect(pointsSource).toMatch(pattern)
  })

  it.each([
    ['tournament fixtures', /join public\.matches\b/],
    ['tournament group predictions', /public\.match_predictions\b/],
    ['tournament knockout predictions', /public\.bonus_knockout_predictions\b/],
    ['the tournament scope on entries', /entry\.tournament_id\s*=/],
  ])('cup_window_scores no longer reads %s', (_label, pattern) => {
    expect(windowScores).not.toMatch(pattern)
  })

  it('reaches no season relation, because the tournament source cannot', () => {
    // The season tables exist from contract 68 onward. A season Cup gets its
    // own source returning the same neutral shape; it does not widen this one.
    for (const relation of SEASON_RELATIONS) {
      expect(pointsSource, `the tournament source now reads ${relation}`).not.toContain(relation)
    }
  })

  it('uses the tournament round vocabulary the season does not share', () => {
    // 'group' rounds and the 90-minute columns are tournament concepts. A
    // league season has matchweeks and no extra time.
    expect(pointsSource).toMatch(/round = 'group'/)
    expect(pointsSource).toMatch(/home_score_90/)
  })

  it('leaves the shared arithmetic consuming the neutral relation only', () => {
    expect(windowScores).toMatch(/cup_tournament_fixture_points\(p_competition_id, p_window_id\)/)
    expect(windowScores).toMatch(/group by source\.user_id/)
    // The seam that makes a season source a drop-in.
    for (const fact of ['points', 'is_exact', 'is_correct', 'scoreline_error', 'has_prediction']) {
      expect(windowScores).toContain(`source.${fact}`)
    }
  })
})

describe('the raw scale is already the neutral contract', () => {
  it('awards 5 for an exact score and 3 for the result', () => {
    // The same 5/3/0 the season Championship settles on. This is why the
    // neutral contract is a real seam and not an aspiration: the two
    // competitions already agree on the value of a fixture.
    expect(pointsSource).toMatch(/then 5\b/)
    expect(pointsSource).toMatch(/then 3\b/)
    expect(pointsSource).toMatch(/else 0\b/)
  })

  it('tests the exact score before the result, so an exact never scores 3', () => {
    // Ordering is the whole rule. Reversed, every exact score silently becomes
    // a correct result, and the totals stay plausible.
    const exact = pointsSource.indexOf('then 5')
    const correct = pointsSource.indexOf('then 3')
    expect(exact).toBeGreaterThan(-1)
    expect(
      exact,
      'the result branch precedes the exact-score branch, so an exact score would score 3',
    ).toBeLessThan(correct)
  })

  it('scores an unconfirmed fixture as nothing rather than as a miss', () => {
    expect(pointsSource).toMatch(/not mp\.confirmed or mp\.predicted_home is null then 0/)
  })

  it('sentinels a missing prediction in the scoreline error rather than treating it as exact', () => {
    // 999 is deliberate: absent predictions must sort last on the tie-break,
    // and a zero error would sort them first — ahead of everyone who played.
    expect(pointsSource).toMatch(/predicted_home is null then 999/)
  })
})

describe('the shared half is the part worth generalising', () => {
  it.each(['points', 'exacts', 'corrects', 'scoreline_error', 'submitted'])(
    'aggregates %s per member',
    (column) => {
      expect(windowScores).toContain(column)
    },
  )

  it('has a body at all after the split', () => {
    expect(pointsSource, 'cup_tournament_fixture_points body not found').not.toBe('')
  })

  it('groups by the member, so the shared arithmetic is per entrant', () => {
    expect(windowScores).toMatch(/group by source\.user_id/)
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
      expect(pointsSource).not.toContain(fn)
    },
  )
})

/**
 * Contract 76 finished the rescoping, and it was smaller than it looked.
 *
 * Tracing the call graph after contract 75 showed that split had CASCADED:
 * `cup_final_group_tables` reaches the tournament only through
 * `cup_window_scores`, so making that neutral made the group table neutral too,
 * with no pass of its own. Of the four functions that remained, three needed
 * nothing and one did.
 */
describe('the shared Cup machinery is free of tournament relations', () => {
  const TOURNAMENT_SHAPED = [
    /public\.matches\b/,
    /match_predictions\b/,
    /bonus_knockout_predictions\b/,
    /tournament_id/,
    /home_score_90/,
    /round = 'group'/,
  ]

  it.each([
    ['cup_window_scores', () => windowScores],
    ['cup_window_settled', () => windowSettled],
    ['cup_final_group_tables', () => finalGroupTables],
    ['cup_bracket_order', () => bracketOrder],
  ])('%s reads nothing tournament-shaped', (name, body) => {
    for (const pattern of TOURNAMENT_SHAPED) {
      expect(body(), `${name} still matches ${pattern}`).not.toMatch(pattern)
    }
  })

  it('keeps the settlement vocabulary in the tournament source', () => {
    // 'confirmed' and 'corrected' are the tournament's administrative result
    // lifecycle. A season answers the same question from
    // `season_fixtures.status = 'played'`. Different vocabularies, one question,
    // which is exactly what belongs behind a seam.
    expect(settlementSource).toMatch(/result_state not in \('confirmed', 'corrected'\)/)
    expect(settlementSource).toMatch(/join public\.matches\b/)
  })

  it('negates the source rather than inverting a condition mid-conjunction', () => {
    // The extracted function reports UNSETTLED so this stays a direct
    // substitution for the `not exists (...)` it replaced. Flipping the
    // polarity inside a four-way conjunction is where a sign error would hide.
    expect(windowSettled).toMatch(/not predictor_internal\.cup_tournament_window_unsettled\(win\.id\)/)
  })

  it('keeps window timing with the shared decision, because it is not a competition rule', () => {
    // A window is settled only once it has locked, only once it has passed any
    // settles_at, and never when it holds no fixtures. Those are properties of
    // the Bonus Games window, not of the tournament or the season.
    expect(windowSettled).toMatch(/win\.locks_at is not null/)
    expect(windowSettled).toMatch(/win\.settles_at is null or now\(\) >= win\.settles_at/)
    expect(windowSettled).toMatch(/exists \(\s*select 1 from public\.bonus_window_fixtures/)
  })
})
