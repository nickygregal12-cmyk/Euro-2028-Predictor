import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 194 — `CUP-004`, eligibility at Championship tie settlement.
 *
 * WHAT THIS SUITE EXISTS FOR is that contract 194 changes a SETTLEMENT
 * authority, which is the most dangerous class of change in this repository.
 * One function decides both the tournament's and the season's knockout ties,
 * and ADR 0022 forbids altering any qualification, seeding, bye,
 * playoff-pairing or Penalty Number rule while rescoping it.
 *
 * THE LESSON THIS SUITE ENCODES. The first draft of contract 194 restated the
 * function from the committed text of contract 149
 * (`20260804263000_cup_neutral_window_match_facts.sql`), the last migration
 * whose FILE holds a full body for it. That text is not the installed
 * definition. Contract 102 (`20260804323000_cup_split_stage_persistence.sql`)
 * had already patched the installed function in place, replacing
 * `fixture.stage <> 'group'` with `fixture.stage in ('playoff', 'knockout')` so
 * a stored `split` fixture cannot enter the knockout settler. Restating the
 * older body silently reverted that, and suite 153 caught it.
 *
 * "Extract programmatically rather than retype" was therefore not enough on its
 * own: a function that has been patched in place has no file holding its
 * current body, so the only honest base is the CATALOGUE. The assertions below
 * hold that as a property of the repository rather than a habit — no migration
 * after contract 102 may restate this function from a file at all.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

const CONTRACT_102 = '20260804323000_cup_split_stage_persistence.sql'
const CONTRACT_149 = '20260804263000_cup_neutral_window_match_facts.sql'
const CONTRACT_194 = '20260817150000_cup_tie_eligibility.sql'
const RESTATEMENT = 'CREATE OR REPLACE FUNCTION public.admin_settle_predictor_cup_round'

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const contract194 = migration(CONTRACT_194)

/** The `do $patch$ ... $patch$;` block that rewrites the settlement authority. */
const patch = (() => {
  const start = contract194.indexOf('do $patch$')
  expect(start).toBeGreaterThan(-1)
  const end = contract194.indexOf('$patch$;', start) + '$patch$;'.length
  return contract194.slice(start, end)
})()

/**
 * The patch with its own explanatory comments removed. Prose is not the
 * contract, and prose that NAMES the rules it leaves alone would otherwise fail
 * an assertion that those rules are untouched.
 */
const patchCode = patch
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

describe('the settlement authority is patched in place, never restated', () => {
  it('takes its base from the catalogue rather than from a migration file', () => {
    expect(patch).toContain(
      "pg_get_functiondef(\n    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure\n  )",
    )
    // The whole point. A restated body cannot carry contract 102's in-place
    // patch, because no file contains it.
    expect(contract194).not.toContain(RESTATEMENT)
  })

  it('holds that as a property of every migration after contract 102', () => {
    // Not a habit, a rule. Any future migration that restates this function
    // from a file reverts contract 102 the same way, and would fail here before
    // it ever reached the pgTAP suite that caught it the first time.
    const offenders = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith('.sql') && file > CONTRACT_102)
      .filter((file) => migration(file).includes(RESTATEMENT))
    expect(offenders).toEqual([])

    // THE ASSERTION ABOUT THE ASSERTION. An empty list must mean "nobody
    // restates it after contract 102", not "the needle never matches anything".
    // Contract 149 is the last migration that legitimately holds a full body.
    expect(migration(CONTRACT_149)).toContain(RESTATEMENT)
    expect(CONTRACT_149 < CONTRACT_102).toBe(true)
  })

  it('refuses if any anchor it edits has moved', () => {
    // Three insertions, three guards. A `replace()` whose anchor is gone is a
    // silent no-op, which is how a patch migration reports success while
    // changing nothing.
    const replacements = patch.match(/v_definition := replace\(/g) ?? []
    const guards = patch.match(/if v_definition = v_original then/g) ?? []
    expect(replacements).toHaveLength(3)
    expect(guards).toHaveLength(3)
  })

  it('asserts contract 102’s split-safety survived the patch', () => {
    // The exact regression the first draft caused, now checked inside the
    // transaction that causes it.
    expect(patch).toContain("position('stage <> ''group''' in v_definition) > 0")
    expect(patch).toContain(
      "position('stage in (''playoff'', ''knockout'')' in v_definition) = 0",
    )
    expect(patch).toContain('lost contract 102 split-safety')
  })

  it('asserts contract 102’s initial-roster pinning survived too', () => {
    expect(patch).toContain("position('member.phase_kind = ''initial''' in v_definition) = 0")
    expect(patch).toContain('lost contract 102 initial-roster pinning')
  })

  it('leaves the existing “neither submitted” rule alone', () => {
    // ADR 0022 forbids altering it, and the tournament shares this function.
    // No SQL the patch inserts assigns it, so the rule below the eligibility
    // branch reaches the catalogue exactly as contract 98 left it.
    expect(patchCode).not.toContain('admin_walkover')
  })
})

describe('the patch is an insertion, not a rewrite', () => {
  it('edits exactly three anchors and demotes one branch', () => {
    // Insertion 1: the declarations.
    expect(patch).toContain("'  v_window public.bonus_competition_windows%rowtype;'")
    // Insertion 2: the whole-window refusal, under the already-settled guard.
    expect(patch).toContain("'This Cup round has already been settled'")
    // Insertion 3: the eligibility branch, demoting the ladder's opening `if`.
    expect(patch).toContain("'    if v_home.submitted and v_away.submitted then'")
    expect(patch).toContain("'    elsif v_home.submitted and v_away.submitted then'")
  })

  it('rewrites no other part of the ladder', () => {
    // Points, extra time and the Penalty Number lanes are never named, so they
    // cannot be edited by this contract.
    expect(patchCode).not.toContain('penalty_number')
    expect(patchCode).not.toContain('scoreline_error')
    expect(patchCode).not.toContain('v_home_penalty')
  })
})

describe('eligibility is asked, and asked first', () => {
  it('consults the membership authority rather than a new flag', () => {
    expect(patch).toContain('predictor_internal.cup_entrant_eligibility(')
    // A second eligibility column on the Cup tables would be a second answer.
    expect(contract194).not.toMatch(/alter table[\s\S]*bonus_cup_members[\s\S]*add column/)
  })

  it('decides eligibility above the submission ladder', () => {
    // If the branch moved below, a disqualified entrant who submitted would win
    // on points again and every other assertion here would still pass. The
    // migration re-checks this on the installed definition; this checks the
    // text that produces it.
    const eligibilityAt = patch.indexOf("'    if v_home_eligible <> v_away_eligible then'")
    const ladderAt = patch.indexOf("'    elsif v_home.submitted and v_away.submitted then'")
    expect(eligibilityAt).toBeGreaterThan(-1)
    expect(ladderAt).toBeGreaterThan(eligibilityAt)
    expect(contract194).toContain(
      "position('v_home_eligible <> v_away_eligible' in v_settle)",
    )
  })
})

describe('nothing is invented, and the reason is recorded', () => {
  it('writes no score, prediction or points row on the walkover path', () => {
    expect(patchCode).not.toMatch(/insert into public\.(season_predictions|bonus_score_events)/)
    expect(patchCode).not.toMatch(/update public\.(season_fixtures|matches)\b/)
  })

  it('records the reason as audit evidence, carrying the stored state', () => {
    expect(patch).toContain('cup_tie_walkover_ineligible')
    expect(patch).toContain("''ineligible_state''")
    expect(patch).toContain("''invented_score'', false")
    expect(patch).toContain("''invented_points'', false")
  })

  it('refuses rather than deciding when neither entrant may contest', () => {
    expect(patch).toContain('needs an explicit decision rather than an automatic winner')
  })
})

describe('it fails towards the status quo', () => {
  it('treats an absent membership row as eligible', () => {
    // A gap in the data must not hand a knockout tie to an opponent.
    expect(contract194).toContain("'eligible')")
    expect(contract194).toContain('absence of')
  })

  it('reads the membership status rather than copying its vocabulary', () => {
    expect(contract194).toContain('public.game_memberships')
    expect(contract194).toContain("when 'active' then 'eligible'")
  })
})
