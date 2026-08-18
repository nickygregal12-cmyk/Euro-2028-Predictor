import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 195 — the action centre learns about the Championship tie.
 *
 * WHAT THESE GUARDS EXIST FOR is the one decision in this contract that is
 * invisible from the outside: the Penalty Number's deadline is the window's
 * FIRST KICKOFF, and a season Cup window's `locks_at` is that kickoff MINUS the
 * game definition's buffer. An item keyed on `window_id` would be swept away by
 * contract 162's existing re-read while `submit_cup_penalty_number` was still
 * accepting a number, and nothing about the code would look wrong.
 *
 * `243_cup_penalty_number_actions.sql` drives that case for real, against a
 * window that has already locked and a kickoff still ahead. These assertions
 * hold the properties that survive a rewrite.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const testsDirectory = resolve(repositoryRoot, 'supabase/tests')

const CONTRACT_195 = '20260818000000_cup_penalty_number_actions.sql'
const CONTRACT_162 = '20260811130000_action_centre.sql'
const SUITE_195 = '243_cup_penalty_number_actions.sql'

function read(directory: string, file: string): string {
  return readFileSync(resolve(directory, file), 'utf8')
}

const migration = read(migrationsDirectory, CONTRACT_195)
const suite = read(testsDirectory, SUITE_195)

/**
 * The migration with its comment lines removed.
 *
 * The prose explains why `stage <> 'group'` is wrong and quotes it, so an
 * assertion over the whole file would match the explanation and fail against a
 * correct implementation. The migration's own apply-time guard hit exactly that
 * on first run, which is why it is stated here rather than discovered again.
 */
function withoutComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

const code = withoutComments(migration)

/**
 * The generator function's own body.
 *
 * Scoped deliberately: the migration also carries apply-time guards that quote
 * the very strings they forbid — `window_row.locks_at`, `opponent`,
 * `stage <> 'group'` — so an assertion over the whole file matches the guard and
 * fails against a correct implementation.
 */
const generator = withoutComments(
  migration.slice(
    migration.indexOf('as $penalty$'),
    migration.indexOf('$penalty$;') + '$penalty$;'.length,
  ),
)

describe('the deadline is the first kickoff, not the window lock', () => {
  it('derives it through the one authority that combines both competition kinds', () => {
    expect(generator).toContain('predictor_internal.cup_window_first_kickoff(fixture.window_id) as locks_at')
    // `bonus_competition_windows.locks_at` is a different instant. Reading it
    // here would close the item early by the game definition's buffer.
    expect(generator).not.toContain('window_row.locks_at')
  })

  it('carries its own context key, because it answers to its own authority', () => {
    expect(generator).toContain("'cup_window_id', actionable.window_id")
    // Contract 162's sweep resolves `window_id` against the window's lock. An
    // item carrying that key would be judged by the wrong instant.
    expect(read(migrationsDirectory, CONTRACT_162)).toContain(
      "window_row.id = (item.context ->> 'window_id')::uuid",
    )
    expect(generator).not.toContain("'window_id', actionable.window_id")
  })

  it('re-derives the kickoff in the sweep rather than trusting the stored copy', () => {
    // A kickoff moves. `expires_at` is a cache taken when the item was written,
    // which is the defect `211_action_centre.sql` was originally written for.
    expect(code).toContain('predictor_internal.cup_window_first_kickoff(cup_window.id)')
  })

  it('drives that case for real rather than reasoning about it', () => {
    expect(suite).toContain(
      'a locked window does not close a Penalty Number that is still legal to submit',
    )
    // THE ASSERTION ABOUT THE ASSERTION. The fixture must actually have a
    // locked window, or the sweep has nothing to get wrong.
    expect(suite).toContain('the window really has already locked')
    // And the write authority is exercised at that moment, so the two cannot
    // drift apart silently.
    expect(suite).toContain('public.submit_cup_penalty_number')
  })
})

describe('every condition is read from the write authority', () => {
  it('uses contract 102’s stage predicate rather than the shorthand it replaced', () => {
    expect(generator).toContain("fixture.stage in ('playoff', 'knockout')")
    expect(generator).not.toContain("stage <> 'group'")
  })

  it('excludes a settled tie and an unpublished competition', () => {
    expect(generator).toContain('fixture.winner_user_id is null')
    expect(generator).toContain('competition.published')
  })

  it('asks nobody who may not contest the tie', () => {
    expect(generator).toContain('predictor_internal.cup_entrant_eligibility(')
    // Read, not restated. A second eligibility rule would be a second answer.
    expect(generator).not.toContain('game_memberships')
  })

  it('completes from the stored Penalty Number rather than from anything pressed', () => {
    expect(generator).toContain('from public.bonus_cup_penalty_numbers pn')
    expect(generator).toContain('as submitted')
  })
})

describe('it discloses nothing about the opponent', () => {
  it('carries the player’s own lane and no opponent state', () => {
    expect(generator).toContain("'lane', actionable.lane")
    // Contract 193 withholds even WHETHER the opponent has submitted. This must
    // not become the surface that gives it away.
    expect(generator).not.toMatch(/opponent/)
    expect(suite).toContain('the item names no opponent and reports no opponent state')
  })
})

describe('it writes one relation, and it is the inbox', () => {
  it('inserts only action items', () => {
    const inserts = generator.match(/insert into public\.[a-z_]+/g) ?? []
    expect(inserts).toEqual(['insert into public.player_action_items'])
  })

  it('is unreachable from every API role', () => {
    expect(code).toContain(
      'revoke all on function predictor_internal.generate_cup_penalty_number_actions(timestamptz)\n  from public, anon, authenticated, service_role;',
    )
  })

  it('is idempotent, and monotonic on completion', () => {
    expect(generator).toContain('on conflict (user_id, action_key) do update')
    // Editing a Penalty Number before the lock is legal and is not undoing one.
    expect(generator).toContain('completed_at = coalesce(item.completed_at, excluded.completed_at)')
    expect(suite).toContain('and editing it does not reopen the item')
    expect(suite).toContain('a run that changes nothing writes nothing')
  })
})

describe('it joins the attention system it belongs to', () => {
  it('reaches the reminder scheduler without the scheduler being taught the type', () => {
    // `process_reminder_schedule` queues any open item with a `deadline_at`, so
    // a new action type either composes for free or breaks it. Nothing tested
    // that a new type does, until this suite drove it.
    expect(suite).toContain('public.process_reminder_schedule(')
    expect(suite).toContain(
      'a Penalty Number that is due reaches the reminder scheduler without it being taught the type',
    )
  })

  it('carries the first kickoff all the way into the reminder', () => {
    // The buffer defect again, one layer out: a reminder queued against the
    // window lock would be about a deadline that has not arrived.
    expect(suite).toContain('carrying the first kickoff rather than the window lock, all the way through')
  })

  it('withdraws the reminder when the player acts', () => {
    expect(suite).toContain('the scheduler withdraws the pending reminder')
  })
})

describe('the driver and the sweep are patched in place, never restated', () => {
  it('takes both bases from the catalogue', () => {
    expect(code).toContain(
      "pg_get_functiondef(\n    'predictor_internal.invalidate_expired_actions(timestamptz)'::regprocedure\n  )",
    )
    expect(code).toContain(
      "pg_get_functiondef(\n    'public.process_player_action_items()'::regprocedure\n  )",
    )
    // Contract 194's lesson: a function already patched in place has no file
    // holding its current body, so restating one reverts the earlier patch.
    expect(code).not.toContain('CREATE OR REPLACE FUNCTION public.process_player_action_items')
    expect(code).not.toContain(
      'create or replace function predictor_internal.invalidate_expired_actions',
    )
  })

  it('refuses if an anchor has moved, and skips if already applied', () => {
    // A `replace` whose anchor is gone is a silent no-op; a `replace` re-run
    // against its own output appends a second copy. Both are guarded.
    expect(code).toContain('Expected expiry-sweep tail was not found')
    expect(code).toContain('Expected action driver declaration was not found')
    expect(code).toContain("if position('cup_window_id' in v_definition) > 0 then")
    expect(code).toContain(
      "if position('generate_cup_penalty_number_actions' in v_definition) > 0 then",
    )
  })

  it('keeps the sweep running after every generator', () => {
    expect(code).toContain('The expiry sweep must run after every generator')
  })

  it('leaves the authorities the sweep already had', () => {
    expect(code).toContain('The expiry sweep lost an authority it already had')
  })
})
