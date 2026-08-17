import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { executeCupSplit, type CupTableRow } from '../../src/domain/season/cupGroupTable'
import { at } from '../support/indexed'

/**
 * Contract 124's split driver, against the three authorities it must not
 * disagree with.
 *
 * THE REDEFINITION DIFF EARNED ITS PLACE BEFORE THIS FILE WAS COMMITTED. The
 * driver had to add a `phase_kind` filter to `cup_final_group_tables`, and the
 * first draft of that migration hand-reconstructed the function's tail from
 * fragments. The reconstruction silently replaced ADR 0014 §5.2's steps 4–5
 * mini head-to-head tie-break with a different rule and changed `row_number()`
 * to `rank()` — a scoring rule change inside a driver contract, which is
 * exactly what this repository's boundaries forbid. Reading the function did
 * not catch it; diffing it did, in one second. So the diff is the guard.
 *
 * THE HALVES. Three places compute the top half: `executeCupSplit` in
 * TypeScript, `select_season_cup_format`'s `topHalfSize`, and the driver. All
 * three take the ceiling, so thirteen becomes seven and six and the larger half
 * is the top one. If they ever disagree, the driver would build halves the
 * format never planned and the launch record would refuse the transition — a
 * competition stuck mid-season with no way forward.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const KNOCKOUTS = '20260729050000_predictor_cup_knockouts.sql'
const FORMAT = '20260804013000_season_cup_rules.sql'
const CONTRACT_124 = '20260806150000_season_cup_split_transition.sql'

const knockoutsSource = migration(KNOCKOUTS)
const formatSource = migration(FORMAT)
const splitSource = migration(CONTRACT_124)

/** One `create or replace function predictor_internal.<name>` statement. */
function definition(source: string, name: string): string {
  const start = source.indexOf(`create or replace function predictor_internal.${name}(`)
  expect(start, `${name} is not defined in this migration`).toBeGreaterThan(-1)

  const rest = source.slice(start)
  const opening = /\bas\s+(\$[a-z_]*\$)/.exec(rest)
  expect(opening, `${name} has no dollar-quoted body`).not.toBeNull()

  const tag = at((opening as RegExpExecArray), 1)
  const bodyStart = (opening as RegExpExecArray).index + (opening as RegExpExecArray)[0].length
  const bodyEnd = rest.indexOf(tag, bodyStart)
  expect(bodyEnd, `${name}'s body is not closed`).toBeGreaterThan(-1)

  return rest.slice(0, bodyEnd + tag.length)
}

describe('the initial-phase table is redefined and nothing else about it moves', () => {
  const original = definition(knockoutsSource, 'cup_final_group_tables')
  const redefined = definition(splitSource, 'cup_final_group_tables')

  /** The only lines contract 124 adds. */
  const ADDED = [
    '-- Contract 124. Without this an entrant holding a split membership as',
    '-- well as their initial one appears twice, and window_totals doubles.',
    "and member.phase_kind = 'initial'",
  ]

  it('finds both definitions', () => {
    expect(original.length).toBeGreaterThan(1000)
    expect(redefined.length).toBeGreaterThan(1000)
  })

  it('is contract 63-era text plus exactly the phase filter', () => {
    let stripped = redefined
    for (const line of ADDED) {
      expect(stripped, `contract 124 no longer adds: ${line}`).toContain(line)
      stripped = stripped.replace(new RegExp(`\\s*${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
    }
    expect(stripped).toBe(original)
  })

  it('keeps the §5.2 mini head-to-head tie-break the first draft deleted', () => {
    // Steps 4–5 of ADR 0014's order: among players whose steps 0–3 key is
    // identical, a mini head-to-head of table points then prediction-point
    // difference. Losing them changes who finishes above whom, which changes
    // which half of the split they land in — permanently.
    expect(redefined).toContain('mini_points')
    expect(redefined).toContain('mini_difference')
    expect(redefined).toMatch(/row_number\(\) over \(/)
    expect(redefined).not.toMatch(/rank\(\) over \(/)
  })

  it('leaves the fixture stage filter alone, which is why results needed no change', () => {
    expect(redefined).toMatch(/fixture\.stage = 'group'/)
  })
})

describe('the halves are computed the same way in all three places', () => {
  const driver = definition(splitSource, 'transition_season_cup_to_split')
  const selector = definition(formatSource, 'select_season_cup_format')

  it('takes the ceiling for the top half in SQL, in both functions', () => {
    expect(driver).toMatch(/ceil\(v_initial\.size::numeric \/ 2\)::integer/)
    expect(selector).toMatch(/ceil\(p_field_size::numeric \/ 2\)::integer/)
  })

  it('gives the larger half to the top in TypeScript, on an odd field', () => {
    // Demonstrated rather than asserted against source: thirteen becomes seven
    // and six, and ADR 0014 § Consequences names exactly that case.
    const rows: CupTableRow[] = Array.from({ length: 13 }, (_, index) => ({
      entryId: `e${index + 1}`,
      position: index + 1,
      played: 12,
      won: 0,
      drawn: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDifference: 0,
      tablePoints: 0,
    }))

    const result = executeCupSplit(rows)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.halves[0].half).toBe('top')
    expect(result.halves[0].rows).toHaveLength(7)
    expect(result.halves[1].rows).toHaveLength(6)
  })

  it('refuses below four in TypeScript, and the driver restates the same floor', () => {
    expect(executeCupSplit([]).ok).toBe(false)
    expect(driver).toMatch(/if v_initial\.size < 4 then/)
  })

  it('refuses when the stored plan and the arithmetic disagree', () => {
    // The field cannot change after Matchday 1, so a mismatch means something
    // moved. Picking either answer would build a half the other authority does
    // not believe in.
    expect(driver).toMatch(/topHalfSize'\)::integer is distinct from v_top_size/)
    expect(driver).toMatch(/bottomHalfSize'\)::integer is distinct from v_bottom_size/)
  })
})

describe('the split follows the plan it was launched with', () => {
  const driver = definition(splitSource, 'transition_season_cup_to_split')

  it('reads the tail from the launch record rather than re-deriving it', () => {
    // `select_season_cup_format` answers "what fits in the rounds that are
    // LEFT". Asking it at split time asks a different question, because the
    // league phase has been played.
    expect(driver).toMatch(/action = 'championship_launched'/)
    expect(driver).toContain("audit.detail->'tail'")
    expect(driver).not.toContain('select_season_cup_format')
  })

  it('refuses a multi-group field, as ADR 0014 requires', () => {
    // "Merging top halves across groups would carry points earned against
    // different opponents, breaking the comparability the design rests on."
    expect(driver).toMatch(/if v_groups > 1 then[\s\S]{0,400}?raise exception/)
  })

  it('waits for the initial phase rather than splitting a table that can move', () => {
    expect(driver).toContain("'initial_phase_incomplete'")
    expect(driver).toMatch(/not predictor_internal\.cup_window_settled\(fixture\.window_id\)/)
  })

  it('is idempotent under an advisory lock, because a scheduled driver retries', () => {
    expect(driver).toContain('pg_advisory_xact_lock')
    expect(driver).toContain("'already_split'")
  })
})

describe('what the split does to entrants', () => {
  const driver = definition(splitSource, 'transition_season_cup_to_split')
  const membership = /insert into public\.bonus_cup_members[\s\S]*?from predictor_internal\.cup_final_group_tables\(p_competition_id\) standing[\s\S]*?;/.exec(
    driver,
  )?.[0]

  it('finds the membership insert', () => {
    expect(membership).toBeDefined()
  })

  it('eliminates nobody — every ranked entrant gets a half', () => {
    // ADR 0014: "A split is the same competition continuing with a narrower
    // field … Nobody is eliminated." A filter here would quietly drop the
    // bottom of the table out of the competition.
    expect(membership).toMatch(/where standing\.group_id = v_initial\.id/)
    expect(membership).not.toMatch(/limit|group_rank <= v_top_size\s*\)?\s*$/m)
    expect(membership).toMatch(
      /case when standing\.group_rank <= v_top_size then v_top_group else v_bottom_group end/,
    )
  })

  it('carries draw numbers rather than reassigning them', () => {
    // The draw number is the guaranteed terminator of the tie-break sequence.
    // Renumbering would silently reorder two otherwise identical entrants.
    expect(membership).toContain('standing.draw_number')
    expect(membership).not.toContain('row_number() over')
  })

  it('continues the competition-wide matchday rather than resetting it', () => {
    // ADR 0025 decision 2: matchday is the competition's own round number.
    expect(driver).toMatch(/v_base_sequence \+ rounds\.round_number/)
    expect(driver).toMatch(
      /select coalesce\(max\(win\.sequence\), 0\)::integer into v_base_sequence/,
    )
  })

  it('appends to the calendar rather than rebuilding it', () => {
    expect(driver).toContain('predictor_internal.generate_season_cup_windows')
    expect(driver).not.toMatch(/delete from public\.bonus_competition_windows/)
  })
})

describe('the group size domain is relaxed for the split and nothing else', () => {
  it('lets a split half hold two, which ADR 0014 requires and the old floor refused', () => {
    // The minimum field is four and four splits two and two, so under
    // `size between 3 and 20` the smallest legal Championship could not split
    // at all. CI found this, not review.
    expect(splitSource).toMatch(/when 'split' then size between 2 and 20/)
  })

  it('keeps the group stage at three, so this is not a blanket relaxation', () => {
    expect(splitSource).toMatch(/else size between 3 and 20/)
    expect(splitSource).not.toMatch(/check \(\s*size between 2 and 20\s*\)/)
  })

  it('re-adds the constraint it drops, under the same name', () => {
    // A drop with no matching add removes a guarantee permanently, and the
    // additive lane reports the drop rather than refusing it.
    expect(splitSource).toMatch(
      /drop constraint bonus_cup_groups_size_allowed[\s\S]{0,200}?add constraint bonus_cup_groups_size_allowed/,
    )
  })
})

describe('the driver stays out of every browser', () => {
  it('is revoked from public and all three roles', () => {
    expect(splitSource).toMatch(
      /revoke all on function predictor_internal\.transition_season_cup_to_split\(uuid\)\s+from public, anon, authenticated, service_role/,
    )
    expect(splitSource).not.toMatch(
      /grant execute on function predictor_internal\.transition_season_cup_to_split/,
    )
  })

  it('adds no browser-reachable function at all', () => {
    expect(splitSource).not.toMatch(/create or replace function public\./)
  })
})
