import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 193 — `CUP-003`, the season Championship bracket read.
 *
 * WHAT THESE GUARDS EXIST FOR is that this read sits next to the one genuine
 * secret in the Championship. A Penalty Number is a sealed bid: the whole
 * mechanism fails if an opponent can see it, and a payload carrying an extra
 * integer looks exactly like one that does not.
 *
 * The behavioural proof is `241_season_cup_bracket_read.sql`, which seeds a
 * live semi-final where BOTH players have submitted and asserts against the
 * whole serialised payload. These assertions hold the structural properties
 * that survive a rewrite.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const testsDirectory = resolve(repositoryRoot, 'supabase/tests')

const CONTRACT_193 = '20260817140000_season_cup_bracket_read.sql'
/**
 * CONTRACT 205 REPLACES THE FUNCTION, so it — not 193 — is what a database
 * actually installs. Every structural assertion below therefore reads the
 * LATEST definition; a guard pointed at a superseded migration is a guard that
 * cannot fail, and would have gone on passing while the installed object
 * drifted underneath it.
 *
 * 193 is still read, for one assertion that is about 205 rather than about the
 * read: that the correction changed the seed lookup and nothing else.
 */
const CONTRACT_205 = '20260819100000_cup_bracket_seed_initial_phase.sql'
const SUITE_193 = '241_season_cup_bracket_read.sql'

function read(directory: string, file: string): string {
  return readFileSync(resolve(directory, file), 'utf8')
}

/** Comments stripped, whitespace collapsed. Prose is not the contract. */
function executable(text: string): string {
  return text
    .replaceAll(/--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const body = executable(read(migrationsDirectory, CONTRACT_205))
const supersededBody = executable(read(migrationsDirectory, CONTRACT_193))

/**
 * The function definition WITHOUT the in-transaction guard block, for the same
 * reason contracts 191 and 192 needed one: the guard quotes the strings it
 * forbids, so a search over the whole file matches the guard and fails against
 * a correct implementation.
 */
const definition = body.slice(0, body.indexOf('do $$ declare v_read'))
const supersededDefinition = supersededBody.slice(
  0,
  supersededBody.indexOf('do $$ declare v_read'),
)

const suite = read(testsDirectory, SUITE_193)

describe('the opponent’s Penalty Number is unreachable by construction', () => {
  it('reaches the Penalty Number table exactly once', () => {
    // Two reaches is how "show whether they have locked in" gets written, and
    // the second one is where the value comes with it.
    const reaches = definition.match(/bonus_cup_penalty_numbers/g) ?? []
    expect(reaches).toHaveLength(1)
  })

  it('reads it only for the caller', () => {
    expect(definition).toContain('pn.user_id = v_uid')
    // No predicate naming the opponent may appear against that table.
    expect(definition).not.toMatch(/bonus_cup_penalty_numbers[^;]*opponent_id/)
  })

  it('exposes no key describing the opponent’s submission', () => {
    expect(definition).not.toContain('opponent_submitted')
    expect(definition).not.toContain('their_penalty')
    expect(definition).not.toContain('opponent_value')
  })

  it('is proved behaviourally against the whole payload, not one field', () => {
    expect(suite).toContain('appears NOWHERE in the payload')
    // The naive `%84%` matches hexadecimal inside a UUID and fails against a
    // correct implementation. That was measured, not guessed.
    expect(suite).toContain("not like '%: 84%'")
    expect(suite).not.toContain("not like '%84%'")
  })
})

describe('no second bracket authority is created', () => {
  it('reads the structural facts rather than deriving them', () => {
    expect(definition).toContain('fixture.round_size')
    expect(definition).toContain('fixture.bracket_slot')
    expect(definition).toContain('fixture.stage')
  })

  it('recomputes no seat order, round count or pairing', () => {
    // ADR 0014 § 7.2's arithmetic belongs to the qualification driver.
    expect(definition).not.toContain('cup_bracket_order')
    expect(definition).not.toMatch(/\blog\(|\bpower\(|\bceil\(/)
  })

  it('takes the format from the launch record rather than inferring it', () => {
    // Contract 186 stores it because a `single_group` competition finishes with
    // contract 124's split and never brackets. Counting groups would be an
    // inference from data the split is allowed to change.
    expect(definition).toContain('bonus_cup_launches')
    expect(definition).toContain('produces_knockout')
  })

  it('takes the lock from the competition-neutral authority', () => {
    // Contract 98 built the combiner precisely because the original joined
    // `bonus_window_fixtures` to `matches` and refused every season submission.
    expect(definition).toContain('cup_window_first_kickoff')
    expect(definition).not.toContain('bonus_window_fixtures')
    expect(definition).not.toContain('join public.matches')
  })
})

describe('the boundary is contract 133’s, reused', () => {
  it('gates on entry', () => {
    expect(definition).toContain('bonus_competition_entrants')
  })

  it('answers a non-entrant exactly as it answers an unknown id', () => {
    // A private UUID must not become an existence oracle. Both paths return the
    // same object, which the suite asserts by value.
    const returns = definition.match(/'entered', false/g) ?? []
    expect(returns.length).toBeGreaterThanOrEqual(2)
    expect(suite).toContain('exactly as an unknown id is')
  })

  it('accepts no caller-supplied instant', () => {
    expect(definition).not.toMatch(/p_\w+ timestamp/)
  })
})

describe('nothing here writes', () => {
  it('contains no insert, update or delete', () => {
    expect(definition).not.toMatch(/\b(insert into|update|delete from)\s+public\./)
  })

  it('leaves the Penalty Number write authority alone', () => {
    // `submit_cup_penalty_number` was already season-capable through contract
    // 98. Redefining it here would be a rule change dressed as a read.
    expect(definition).not.toContain('submit_cup_penalty_number')
  })
})

/**
 * CONTRACT 205 — the read survives a split.
 *
 * Contract 102 keyed `bonus_cup_members` `(competition_id, user_id,
 * phase_kind)` so one entrant may hold both an `initial` and a `split` row, and
 * contract 124's split transition inserts the second without deleting the
 * first. A scalar subquery filtered by competition and user alone therefore
 * matched two rows once a competition split, and raised — failing the WHOLE
 * read rather than one field.
 *
 * The behavioural proof is in `241_season_cup_bracket_read.sql`, which seeds an
 * entrant holding both memberships. These hold the structural property.
 */
describe('the seed lookup names the phase it means', () => {
  it('pins the caller’s seed to their initial membership', () => {
    expect(definition).toContain("member.phase_kind = 'initial'")
  })

  it('leaves no unqualified single-row read of the membership table', () => {
    // `select member.seed ... user_id = v_uid` with nothing after it is the
    // defect's exact shape. The two sibling lookups are an aggregate and an
    // `exists`, neither of which can raise on multiple rows.
    expect(definition).not.toMatch(
      /select member\.seed from public\.bonus_cup_members member where member\.competition_id = p_competition_id and member\.user_id = v_uid\)/,
    )
  })

  it('is guarded inside the migration, so a restated body cannot drop it', () => {
    const guard = body.slice(body.indexOf('do $$ declare v_read'))
    expect(guard).toContain('The seed lookup must be pinned to the initial membership')
  })

  it('changes the seed lookup and nothing else about the read', () => {
    // Every other structural property carried across verbatim. If 205 had
    // rewritten more than the one lookup, these would diverge.
    for (const property of [
      'pn.user_id = v_uid',
      'cup_window_first_kickoff',
      'bonus_competition_entrants',
      'bonus_cup_launches',
      'fixture.bracket_slot',
    ]) {
      expect(definition).toContain(property)
      expect(supersededDefinition).toContain(property)
    }
    // And the correction is genuinely absent from the definition it replaces.
    expect(supersededDefinition).not.toContain("member.phase_kind = 'initial'")
  })
})
