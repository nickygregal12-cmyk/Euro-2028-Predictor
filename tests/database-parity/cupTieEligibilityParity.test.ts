import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 194 — `CUP-004`, eligibility at Championship tie settlement.
 *
 * WHAT THIS SUITE EXISTS FOR is that contract 194 redefines a SETTLEMENT
 * authority, which is the most dangerous class of change in this repository.
 * One function decides both the tournament's and the season's knockout ties,
 * and ADR 0022 forbids altering any qualification, seeding, bye,
 * playoff-pairing or Penalty Number rule while rescoping it.
 *
 * So the central assertion is a ROUND TRIP, not a substring check: reversing
 * the three insertions must reproduce contract 98's committed text byte for
 * byte. That is the method contract 187 established, and it is the only way to
 * be sure a 289-line function was extended rather than quietly rewritten.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

const CONTRACT_98 = '20260804263000_cup_neutral_window_match_facts.sql'
const CONTRACT_194 = '20260817150000_cup_tie_eligibility.sql'

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

/** The settlement function's exact text, from whichever migration defines it. */
function settlementFunction(source: string): string {
  const start = source.indexOf(
    'CREATE OR REPLACE FUNCTION public.admin_settle_predictor_cup_round',
  )
  expect(start).toBeGreaterThan(-1)
  const tag = '$function$'
  const first = source.indexOf(tag, start) + tag.length
  const end = source.indexOf(tag, first) + tag.length
  return source.slice(start, end)
}

const committed = settlementFunction(migration(CONTRACT_98))
const redefined = settlementFunction(migration(CONTRACT_194))

describe('the settlement authority was extended, not rewritten', () => {
  it('reproduces contract 98’s text exactly once the insertions are reversed', () => {
    let reversed = redefined

    // Insertion 1 — the three declarations.
    reversed = reversed.replace(
      `
  -- Contract 194 / \`CUP-004\`.
  v_home_eligible boolean;
  v_away_eligible boolean;
  v_blocked text;`,
      '',
    )

    // Insertion 2 — the whole-window refusal.
    // One leading newline, not two: the anchor above already ends with its own,
    // and consuming that as well removes a blank line the original had. The
    // round trip caught exactly that on the first attempt, which is the point
    // of diffing rather than substring-checking.
    const refusalStart = reversed.indexOf(
      '\n  -- Contract 194 / `CUP-004`. ADR 0028 section 8:',
    )
    const refusalEnd = reversed.indexOf(
      "using errcode = '55000';\n  end if;\n",
      refusalStart,
    )
    expect(refusalStart).toBeGreaterThan(-1)
    expect(refusalEnd).toBeGreaterThan(refusalStart)
    reversed =
      reversed.slice(0, refusalStart) +
      reversed.slice(refusalEnd + "using errcode = '55000';\n  end if;\n".length)

    // Insertion 3 — the eligibility branch, which also demoted the ladder's
    // opening `if` to an `elsif`.
    const branchStart = reversed.indexOf(
      '    -- Contract 194 / `CUP-004`. Eligibility is decided BEFORE',
    )
    const branchEnd = reversed.indexOf(
      '    elsif v_home.submitted and v_away.submitted then',
    )
    expect(branchStart).toBeGreaterThan(-1)
    expect(branchEnd).toBeGreaterThan(branchStart)
    reversed =
      reversed.slice(0, branchStart) +
      '    if v_home.submitted and v_away.submitted then' +
      reversed.slice(
        branchEnd + '    elsif v_home.submitted and v_away.submitted then'.length,
      )

    // THE ASSERTION. Anything else that moved shows up here as a diff.
    expect(reversed).toBe(committed)
  })

  it('leaves the existing “neither submitted” rule in place', () => {
    // ADR 0022 forbids altering it, and the tournament shares this function.
    expect(committed).toContain("v_decided := 'admin_walkover'")
    expect(redefined).toContain("v_decided := 'admin_walkover'")
  })
})

describe('eligibility is asked, and asked first', () => {
  it('consults the membership authority rather than a new flag', () => {
    expect(redefined).toContain('predictor_internal.cup_entrant_eligibility(')
    // A second eligibility column on the Cup tables would be a second answer.
    expect(redefined).not.toMatch(/alter table[\s\S]*bonus_cup_members[\s\S]*add column/)
  })

  it('decides eligibility above the submission ladder', () => {
    // If the branch moved below, a disqualified entrant who submitted would win
    // on points again and every other assertion here would still pass.
    const eligibilityAt = redefined.indexOf('v_home_eligible <> v_away_eligible')
    const ladderAt = redefined.indexOf('v_home.submitted and v_away.submitted')
    expect(eligibilityAt).toBeGreaterThan(-1)
    expect(ladderAt).toBeGreaterThan(eligibilityAt)
  })
})

describe('nothing is invented, and the reason is recorded', () => {
  it('writes no score, prediction or points row on the walkover path', () => {
    expect(redefined).not.toMatch(/insert into public\.(season_predictions|bonus_score_events)/)
    expect(redefined).not.toMatch(/update public\.(season_fixtures|matches)\b/)
  })

  it('records the reason as audit evidence, carrying the stored state', () => {
    expect(redefined).toContain('cup_tie_walkover_ineligible')
    expect(redefined).toContain("'ineligible_state'")
    expect(redefined).toContain("'invented_score', false")
    expect(redefined).toContain("'invented_points', false")
  })

  it('refuses rather than deciding when neither entrant may contest', () => {
    expect(redefined).toContain(
      'needs an explicit decision rather than an automatic winner',
    )
  })
})

describe('it fails towards the status quo', () => {
  it('treats an absent membership row as eligible', () => {
    // A gap in the data must not hand a knockout tie to an opponent.
    const eligibility = migration(CONTRACT_194)
    expect(eligibility).toContain("'eligible')")
    expect(eligibility).toContain('absence of')
  })

  it('reads the membership status rather than copying its vocabulary', () => {
    const eligibility = migration(CONTRACT_194)
    expect(eligibility).toContain('public.game_memberships')
    expect(eligibility).toContain("when 'active' then 'eligible'")
  })
})
