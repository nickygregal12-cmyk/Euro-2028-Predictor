import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 196 — a player is told what happened to them in a game.
 *
 * WHAT THIS SUITE EXISTS FOR is that the contract does two things, and the
 * second is only possible because of the first.
 *
 * `bonus_competition_entrants.updated_at` was maintained by the Last Man
 * Standing and disqualification paths and NOT by the two Championship
 * authorities, so the column that dates an entrant's outcome was right for some
 * rows and stale for others — and nothing reading it could tell which. That is
 * why this generator was not writable before: WHEN a consequence happened has
 * to come from somewhere, and adding a second event relation beside a column
 * that already exists would be the duplicate authority this repository keeps
 * refusing to create.
 *
 * `244_game_consequence_actions.sql` settles a real tie through the real driver
 * and compares the stored instant against the settlement, and reverses an
 * outcome and watches the sweep close its recap. Both were mutation-tested.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const testsDirectory = resolve(repositoryRoot, 'supabase/tests')

const CONTRACT_196 = '20260818010000_game_consequence_actions.sql'
const SUITE_196 = '244_game_consequence_actions.sql'
const RESTATEMENTS = [
  'CREATE OR REPLACE FUNCTION public.admin_settle_predictor_cup_round',
  'CREATE OR REPLACE FUNCTION public.admin_finalise_predictor_cup_groups',
  'CREATE OR REPLACE FUNCTION public.process_player_action_items',
]

function read(directory: string, file: string): string {
  return readFileSync(resolve(directory, file), 'utf8')
}

function withoutComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

const migration = read(migrationsDirectory, CONTRACT_196)
const suite = read(testsDirectory, SUITE_196)
const code = withoutComments(migration)

/**
 * The generator's own body. Scoped deliberately: the migration's apply-time
 * guards quote the states the generator must NOT tell, so an assertion over the
 * whole file matches the guard rather than the code.
 */
const generator = withoutComments(
  migration.slice(
    migration.indexOf('as $consequence$'),
    migration.indexOf('$consequence$;') + '$consequence$;'.length,
  ),
)

describe('the repair dates an outcome without changing one', () => {
  it('patches both Championship authorities in place, never restating them', () => {
    // Both have been rewritten in place before — contract 102 made them
    // split-safe and contract 194 added the eligibility branch — and neither of
    // those lives in a migration file.
    for (const restatement of RESTATEMENTS) {
      expect(migration).not.toContain(restatement)
    }
    expect(code).toContain(
      "pg_get_functiondef(\n    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure\n  )",
    )
    expect(code).toContain(
      "pg_get_functiondef(\n    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure\n  )",
    )
  })

  it('adds a timestamp and nothing else to the writes it touches', () => {
    // The only edits are `, updated_at = now()` appended to `set` clauses. No
    // outcome value changes and no row is selected differently.
    expect(code).toContain("'      set outcome = ''eliminated'', updated_at = now()'")
    expect(code).toContain("'      set outcome = ''champion'', updated_at = now()'")
    expect(code).toContain("'      then ''eliminated'' else ''qualified'' end, updated_at = now()'")
  })

  it('guards each write separately, so a partial revert cannot double one', () => {
    // A single guard covering both settlement writes would, if one were
    // reverted alone, re-apply the other and produce
    // `updated_at = now(), updated_at = now()`. Found by mutation.
    const guards = code.match(/if position\('set outcome = ''(eliminated|champion)'', updated_at = now\(\)' in v_definition\) = 0 then/g) ?? []
    expect(guards).toHaveLength(2)
  })

  it('asserts the two rules those functions carry survived', () => {
    expect(code).toContain('lost contract 102 split-safety')
    expect(code).toContain('lost contract 194 eligibility')
    expect(code).toContain('lost contract 102 initial-roster pinning')
  })

  it('proves the repair by counting, the same way the defect was counted', () => {
    // The apply-time guard re-runs the header's measurement and refuses if any
    // outcome write is still undated, so the finding and its repair cannot
    // drift apart.
    expect(code).toContain("regexp_matches(\n      pg_get_functiondef(p.oid), 'set outcome[^;]*', 'g')")
    expect(code).toContain('outcome write(s) still do not date themselves')
  })

  it('measures it through the real settlement driver too', () => {
    expect(suite).toContain('public.admin_settle_predictor_cup_round')
    expect(suite).toContain('the elimination DATES ITSELF')
    // THE ASSERTION ABOUT THE ASSERTION. Rows inserted seconds earlier already
    // carry a fresh `updated_at`, so the fixture back-dates them first —
    // otherwise the date assertion passes against an unrepaired driver.
    expect(suite).toContain("set updated_at = now() - interval '30 days'")
  })
})

describe('what counts as a consequence', () => {
  it('tells the three outcomes that are news', () => {
    expect(generator).toContain("entrant.outcome in ('eliminated', 'champion', 'qualified')")
  })

  it('never tells the two that are not', () => {
    // `active` is the starting state. `survived` is written for every surviving
    // entrant of every Last Man Standing round, so telling it would post an
    // item per player per week.
    expect(generator).not.toContain("'survived'")
    expect(generator).not.toContain("'active'")
  })

  it('reads why from the membership authority rather than storing it twice', () => {
    expect(generator).toContain("membership.status = 'disqualified'")
    expect(suite).toContain('a removed entrant is told they were removed')
  })

  it('bounds the backlog by the same window it expires on', () => {
    expect(generator).toContain("entrant.updated_at > p_now - interval '7 days'")
    expect(generator).toContain("recent.occurred_at + interval '7 days'")
    expect(suite).toContain('a consequence older than the window is not posted')
  })
})

describe('it is news, not a deadline', () => {
  it('carries the lowest priority and no deadline', () => {
    expect(generator).toContain('         5,')
    expect(suite).toContain('with no deadline, which is what keeps it out of the reminder scheduler')
  })

  it('never resurrects an item the player or the sweep has closed', () => {
    expect(generator).toContain('where item.invalidated_at is null')
    expect(generator).toContain('and item.completed_at is null')
  })
})

describe('the sweep learns that an outcome can be reversed', () => {
  it('closes a recap whose stored outcome no longer matches the entrant', () => {
    expect(code).toContain("item.action_type = ''game_consequence''")
    expect(code).toContain("entrant.outcome = item.context ->> ''outcome''")
    expect(suite).toContain(
      'a rescore that reverses an elimination closes the recap that said otherwise',
    )
    // And not before it is reversed, which is the other half.
    expect(suite).toContain('a live consequence is not closed while it is still true')
  })

  it('keeps every authority the sweep already had', () => {
    expect(code).toContain('The expiry sweep lost an authority it already had')
    expect(code).toContain("position('cup_window_id' in v_definition) = 0")
  })

  it('is safe to re-apply, like contract 195’s patches', () => {
    expect(code).toContain("if position('game_consequence' in v_definition) > 0 then")
    expect(code).toContain(
      "if position('generate_game_consequence_actions' in v_definition) > 0 then",
    )
  })
})

describe('the generator writes one relation, and it is the inbox', () => {
  it('is not a second writer of the outcome it reports', () => {
    const inserts = generator.match(/insert into public\.[a-z_]+/g) ?? []
    expect(inserts).toEqual(['insert into public.player_action_items'])
    expect(generator).not.toMatch(/update public\.bonus_competition_entrants/)
  })

  it('is unreachable from every API role', () => {
    expect(code).toContain(
      'revoke all on function predictor_internal.generate_game_consequence_actions(timestamptz)\n  from public, anon, authenticated, service_role;',
    )
  })

  it('tells a player only about themselves', () => {
    // No other entrant's identity, placing or state is in the payload.
    expect(generator).not.toMatch(/opponent|other_user|rival/)
  })
})
