import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  autoAssignLmsTeam,
  resolveLmsEligibility,
} from '../../src/domain/season/lmsEligibility'

/**
 * Which clubs a Last Man Standing entrant may pick, in both languages.
 *
 * WHY THIS SLICE EXISTS AT ALL. Contract 71 gave `resolve_lms_pick` a SQL
 * counterpart but not eligibility or auto-assignment, so the settlement job
 * could not be written: ADR 0013 requires an entrant who missed a selection to
 * be auto-assigned deterministically, never eliminated, having rejected no-pick
 * elimination as "too punitive across thirty-eight weekly deadlines". A job
 * built without this would eliminate for silence — the one reading the
 * authority ruled out.
 *
 * THE RULE MOST WORTH PROTECTING is the mandatory used-list reset. A player
 * whose used list already covers every club playing once RESETS rather than
 * being eliminated on availability grounds. Availability never eliminates.
 *
 * THE PROPERTY THAT FAILS SILENTLY is club-name collation — see the collation
 * describe block below, and the migration header.
 *
 * The TypeScript authority is executed here; the SQL is read, proven against a
 * real database in `135_lms_eligibility.sql`, and further proven at apply time
 * by the migration's own DO block.
 *
 * Behaviour equivalence was established by a differential sweep over 635 cases
 * — 600 randomised plus directed cases for the reset and the used-list
 * refusal — with zero mismatches on both functions.
 *
 * Eighteen mutations were run and all are now killed, but two survived the
 * first pass and both were failures of THIS suite rather than of the rule:
 *
 *   - deleting the self-play refusal passed, because the ordering assertion
 *     compared `indexOf` results and `-1 < anything` is true. Both positions
 *     are now required to exist before their order is compared;
 *   - deleting the unknown-club check from the fixture loop passed, because
 *     `'unknown_team'` also appears in the used-list loop, so the string was
 *     still there. It is now pinned to the loop over home and away, and proven
 *     behaviourally in pgTAP.
 *
 * The randomised sweep was blind to both, and to the mandatory reset, for the
 * same structural reason each time: the generator could not produce the input
 * that reaches the branch. Sample size never fixes that.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')

const migrationFile = readdirSync(migrationsDirectory).find((file) =>
  file.endsWith('_lms_eligibility_parity.sql'),
)

/** Comment-stripped, so the header's prose cannot satisfy an assertion. */
const migration = (
  migrationFile === undefined
    ? ''
    : readFileSync(resolve(migrationsDirectory, migrationFile), 'utf8')
).replace(/--[^\n]*/g, '')

const team = (teamId: string, name: string) => ({ teamId, name })
const fixture = (fixtureId: string, homeTeamId: string, awayTeamId: string) => ({
  fixtureId,
  homeTeamId,
  awayTeamId,
})

describe('the migration is found, so nothing below is vacuous', () => {
  it('has both function bodies to assert against', () => {
    expect(migrationFile, 'contract 84 migration not found').toBeDefined()
    expect(migration).toMatch(/create or replace function predictor_internal\.resolve_lms_eligibility/)
    expect(migration).toMatch(/create or replace function predictor_internal\.auto_assign_lms_team/)
  })
})

describe('club ordering is code-point, because the wrong one picks a different club', () => {
  /**
   * These two names order differently under C and under ICU en-US. Assertions
   * built from names that sort identically under both would pass against either
   * implementation and prove nothing — which is the trap this suite exists to
   * avoid, not merely to describe.
   */
  const teams = [team('t1', 'ATH MADRID'), team('t2', 'afc wimbledon')]
  const fixtures = [fixture('f1', 't1', 't2')]

  it('puts uppercase before lowercase in TypeScript', () => {
    const result = resolveLmsEligibility({ fixtures, teams, usedTeamIds: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.eligibleTeamIds).toEqual(['t1', 't2'])
  })

  it('auto-assigns the code-point-first club, not the case-folded one', () => {
    // The whole hazard in one assertion. ICU folds case and would return t2,
    // and in Last Man Standing that is a different club surviving the round.
    expect(autoAssignLmsTeam({ fixtures, teams, usedTeamIds: [] })).toBe('t1')
  })

  it('pins collate "C" on the eligible ordering in SQL', () => {
    expect(migration).toMatch(/order by name collate "C", first_seen/)
  })

  it('proves the ordering at apply time, not only in this suite', () => {
    // A later edit dropping the collation leaves valid SQL returning a
    // plausible club. The migration refuses to apply instead — verified by
    // applying an ICU variant to a scratch PostgreSQL 16, which raised.
    expect(migration).toMatch(/auto_assign_lms_team\([\s\S]*?raise exception/)
    expect(migration).toMatch(/the club ordering is not code-point/)
  })

  it('keeps the equal-name tie-break, which stable JS sorting supplies', () => {
    // Two clubs sharing a name keep the order they were first seen in. Without
    // `first_seen` the two languages diverge on duplicate club names.
    const shared = [team('t1', 'Rangers'), team('t2', 'Rangers')]
    const result = resolveLmsEligibility({
      fixtures: [fixture('f1', 't2', 't1')],
      teams: shared,
      usedTeamIds: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // t2 appears first in the fixture, so it is first seen and stays first.
    expect(result.eligibleTeamIds).toEqual(['t2', 't1'])
    expect(migration).toMatch(/first_seen/)
  })
})

describe('availability never eliminates', () => {
  const teams = [team('t1', 'Alpha'), team('t2', 'Beta')]
  const fixtures = [fixture('f1', 't1', 't2')]

  it('resets the used list rather than leaving nobody eligible', () => {
    const result = resolveLmsEligibility({ fixtures, teams, usedTeamIds: ['t1', 't2'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.usedListReset).toBe(true)
    expect(result.eligibleTeamIds).toEqual(['t1', 't2'])
  })

  it('does not reset when something is still available', () => {
    const result = resolveLmsEligibility({ fixtures, teams, usedTeamIds: ['t1'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.usedListReset).toBe(false)
    expect(result.eligibleTeamIds).toEqual(['t2'])
  })

  it('does NOT reset on a round where nobody plays once', () => {
    // Every club plays twice, so `playingOnce` is empty. The reset must not
    // fire: eligibility stays empty and the caller fails closed, rather than a
    // club being handed out that the rule never made eligible.
    const twice = [fixture('f1', 't1', 't2'), fixture('f2', 't1', 't2')]
    const result = resolveLmsEligibility({ fixtures: twice, teams, usedTeamIds: ['t1', 't2'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.usedListReset).toBe(false)
    expect(result.eligibleTeamIds).toEqual([])
    expect(autoAssignLmsTeam({ fixtures: twice, teams, usedTeamIds: ['t1', 't2'] })).toBeNull()

    expect(migration).toMatch(/count\(\*\) from playing_once\) > 0 as fired/)
  })

  it('makes the empty-round guard part of the reset condition in SQL', () => {
    expect(migration).toMatch(/\(select count\(\*\) from unused\) = 0\s*and \(select count\(\*\) from playing_once\) > 0/)
  })
})

describe('a club playing twice is ineligible however fresh the used list', () => {
  it('excludes it and reports it separately', () => {
    const teams = [team('t1', 'Alpha'), team('t2', 'Beta'), team('t3', 'Gamma')]
    const result = resolveLmsEligibility({
      fixtures: [fixture('f1', 't1', 't2'), fixture('f2', 't1', 't3')],
      teams,
      usedTeamIds: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.eligibleTeamIds).toEqual(['t2', 't3'])
    expect(result.doubleFixtureTeamIds).toEqual(['t1'])
  })

  it('orders that list by id, a different key from the eligible list', () => {
    // Conflating the two orderings is the easy mistake: eligible is by NAME,
    // this one is by ID.
    expect(migration).toMatch(/jsonb_agg\(team_id order by team_id collate "C"\) from appear where n > 1/)
  })
})

describe('refusals report the first fault, in caller order', () => {
  const teams = [team('t1', 'Alpha'), team('t2', 'Beta')]

  it.each([
    ['a blank team id', [], [team('  ', 'Alpha')], [], 'invalid_input'],
    ['a blank team name', [], [team('t1', '   ')], [], 'invalid_input'],
    ['a duplicate team id', [], [team('t1', 'Alpha'), team('t1', 'Other')], [], 'invalid_input'],
    ['a blank fixture id', [fixture('  ', 't1', 't2')], teams, [], 'invalid_input'],
    [
      'a duplicate fixture id',
      [fixture('f1', 't1', 't2'), fixture('f1', 't2', 't1')],
      teams,
      [],
      'duplicate_fixture',
    ],
    ['a club against itself', [fixture('f1', 't1', 't1')], teams, [], 'team_against_itself'],
    ['an unknown club in a fixture', [fixture('f1', 't1', 'ghost')], teams, [], 'unknown_team'],
    [
      'an unknown club in the used list',
      [fixture('f1', 't1', 't2')],
      teams,
      ['ghost'],
      'unknown_team',
    ],
  ])('%s refuses', (_label, fixtures, teamList, used, reason) => {
    expect(
      resolveLmsEligibility({
        fixtures: fixtures as never,
        teams: teamList as never,
        usedTeamIds: used as never,
      }),
    ).toEqual({ ok: false, reason })
  })

  it('tests self-play before unknown-team, so the report names the real fault', () => {
    // An unknown club paired with itself is `team_against_itself`, not
    // `unknown_team`. Both are true; the ordering decides which a caller sees,
    // and the two languages must choose the same one.
    expect(
      resolveLmsEligibility({
        fixtures: [fixture('f1', 'ghost', 'ghost')],
        teams,
        usedTeamIds: [],
      }),
    ).toEqual({ ok: false, reason: 'team_against_itself' })

    const body = /resolve_lms_eligibility\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(migration)?.[1] ?? ''
    expect(body).not.toBe('')

    const selfPlay = body.indexOf("'team_against_itself'")
    const unknown = body.indexOf("'unknown_team'")
    // Both must EXIST before their order means anything. Deleting the
    // self-play branch makes indexOf return -1, and `-1 < unknown` is true —
    // so the bare comparison passed against a function that had lost the check
    // entirely. A mutation run is the only reason that was noticed.
    expect(selfPlay, 'the self-play refusal is gone').toBeGreaterThan(-1)
    expect(unknown, 'the unknown-team refusal is gone').toBeGreaterThan(-1)
    expect(selfPlay).toBeLessThan(unknown)
  })

  it('checks unknown clubs inside the fixture loop, not only against the used list', () => {
    // `'unknown_team'` appears TWICE in the function — once per fixture club,
    // once per used-list entry. Deleting the fixture-loop check therefore left
    // the string present, the ordering assertion above satisfied, and a fixture
    // naming a club that does not exist silently accepted. Pinned structurally
    // instead: the refusal must live inside the loop over home and away.
    const fixtureLoop =
      /foreach v_used in array array\[v_home, v_away\] loop([\s\S]*?)end loop;/.exec(migration)?.[1] ?? ''
    expect(fixtureLoop, 'the home/away loop was not found').not.toBe('')
    expect(fixtureLoop).toMatch(/'unknown_team'/)
  })

  it('refuses a non-array input rather than treating it as empty', () => {
    expect(migration).toMatch(/jsonb_typeof\(p_fixtures\) <> 'array'/)
    expect(migration).toMatch(/jsonb_typeof\(p_teams\) <> 'array'/)
    expect(migration).toMatch(/jsonb_typeof\(p_used_team_ids\) <> 'array'/)
  })
})

describe('auto-assignment fails closed rather than inventing a pick', () => {
  it('returns null when the round offers nothing eligible', () => {
    expect(autoAssignLmsTeam({ fixtures: [], teams: [], usedTeamIds: [] })).toBeNull()
  })

  it('returns null when the input refuses', () => {
    expect(
      autoAssignLmsTeam({
        fixtures: [fixture('f1', 't1', 't1')],
        teams: [team('t1', 'Alpha')],
        usedTeamIds: [],
      }),
    ).toBeNull()
  })

  it('carries both failure modes in SQL', () => {
    expect(migration).toMatch(/when \(r->>'ok'\)::boolean is not true then null/)
    expect(migration).toMatch(/when jsonb_array_length\(r->'eligibleTeamIds'\) = 0 then null/)
  })
})

describe('both functions stay server-side and pure', () => {
  it.each(['resolve_lms_eligibility', 'auto_assign_lms_team'])(
    '%s is immutable and revoked from every browser role',
    (fn) => {
      expect(migration).toMatch(new RegExp(`${fn}[\\s\\S]*?immutable`))
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function predictor_internal\\.${fn}\\(jsonb, jsonb, jsonb\\)\\s*from public, anon, authenticated`,
        ),
      )
    },
  )
})
