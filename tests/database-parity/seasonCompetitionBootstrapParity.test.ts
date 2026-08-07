import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { publicLmsSetup } from '../../src/domain/season/lmsPresets'

/**
 * Contract 127's bootstrap, against the authorities it is supposed to obey.
 *
 * THE LOAD-BEARING GUARD IS THE DERIVATION DIFF. There are now two Last Man
 * Standing calendar generators — contract 109's for a restarted successor and
 * this one for a first instance — and they must derive a round's lock the same
 * way. If they drift, two competitions in the same season lock the same
 * matchweek at different instants, and nothing in either pgTAP suite would
 * notice because each suite only ever exercises its own generator. So the
 * shared body is compared character for character after normalising the one
 * thing that legitimately differs: what the calendar starts after.
 *
 * THE SECOND GUARD IS THE SETUP VALUES. The public setup written by the
 * migration is ADR 0022's Classic under the public endgame, and
 * `publicLmsSetup()` is where those values come from. Asserting the SQL against
 * the domain authority is what stops the two from being edited apart.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const CONTRACT_109 = '20260805050000_lms_successor_window_scheduler.sql'
const CONTRACT_111 = '20260805070000_season_cup_launch.sql'
const CONTRACT_127 = '20260806180000_season_competition_bootstrap.sql'

const successorSource = migration(CONTRACT_109)
const source = migration(CONTRACT_127)

/** Comments stripped, whitespace collapsed. Prose is not the contract. */
function executable(text: string): string {
  return text
    .replaceAll(/--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from)
  expect(start, `"${from}" is not present`).toBeGreaterThan(-1)
  const end = text.indexOf(to, start)
  expect(end, `"${to}" does not follow it`).toBeGreaterThan(-1)
  return text.slice(start, end + to.length)
}

describe('both calendars derive a round the same way', () => {
  const successorBlock = between(successorSource, 'with scheduled as (', 'returning id, sequence')
  const firstBlock = between(source, 'with scheduled as (', 'returning id, sequence')

  it('finds both blocks at all', () => {
    expect(successorBlock.length).toBeGreaterThan(600)
    expect(firstBlock.length).toBeGreaterThan(600)
  })

  it('differs only in what the calendar starts after', () => {
    // The successor starts after its predecessor completed; a first instance
    // starts after the boundary its caller supplied. Everything else — the
    // lock derivation, the eligibility filter, the ordering, the sequence
    // numbering and the open-when-the-previous-locked chaining — is the same
    // rule and must be the same text.
    const normalisedSuccessor = executable(successorBlock).replaceAll(
      'v_predecessor_completed_at',
      'p_after',
    )

    expect(executable(firstBlock)).toBe(normalisedSuccessor)
  })

  it('orders by the derived lock rather than by the league round number', () => {
    // Contract 109's reason, restated because it now governs two functions:
    // where the two disagree the fixture list has been rescheduled, and the
    // round that locks next is the round a player picks for next.
    expect(executable(firstBlock)).toContain(
      'order by scheduled.locks_at, scheduled.ordinal',
    )
  })
})

describe('the two generators partition the cases rather than sharing one', () => {
  it('refuses a successor here', () => {
    expect(source).toMatch(
      /if v_competition\.predecessor_competition_id is not null then\s+raise exception/,
    )
  })

  it('and still refuses a first instance there', () => {
    expect(successorSource).toMatch(
      /if v_competition\.predecessor_competition_id is null then\s+raise exception/,
    )
  })

  it('does not redefine the successor scheduler', () => {
    // Widening contract 109 to cover a first instance is the other way this
    // could have been built, and it would have made one function responsible
    // for two boundaries with no way to tell which it was using.
    expect(source).not.toContain('function predictor_internal.generate_lms_successor_windows')
  })
})

describe('the public setup comes from the domain authority', () => {
  const setup = publicLmsSetup()

  it('is Classic under the public endgame', () => {
    // Read from the module rather than restated, so a change to ADR 0022's
    // pinning fails here instead of silently disagreeing with the migration.
    expect(setup).toEqual({
      lives: 0,
      saves: 0,
      drawsRule: 'eliminate',
      endgame: { scope: 'public' },
    })
  })

  it('is what the migration writes', () => {
    const insert = between(
      source,
      'insert into public.season_lms_setups (',
      "'public', null);",
    )

    expect(executable(insert)).toBe(
      'insert into public.season_lms_setups ( competition_id, lives, saves, draws_rule, ' +
        `endgame_scope, endgame_on_wipeout ) values (p_competition_id, ${setup.lives}, ` +
        `${setup.saves}, '${setup.drawsRule}', '${setup.endgame.scope}', null);`,
    )
  })

  it('writes it for a public competition only', () => {
    expect(source).toMatch(
      /if v_competition\.visibility_kind <> 'public' then[\s\S]{0,200}private_setup_not_chosen/,
    )
  })
})

describe('the gate is its own', () => {
  it('is not result administration', () => {
    // A `results` administrator corrects scorelines. Opening a competition
    // fixes a draw and a calendar that can never be redrawn, which is a
    // different trust and gets a different capability.
    expect(source).toContain("v_capabilities ? 'competitions'")
    // Executable text only. The header names the other gate to say why this
    // one exists, and a scan of the raw source would trip on the explanation.
    expect(executable(source)).not.toContain('require_result_admin')
  })

  it('admits super_admin, which is how the owner reaches it', () => {
    expect(source).toMatch(/v_metadata ->> 'admin_role' = 'super_admin'/)
  })

  it('is the only thing the entry point does before delegating', () => {
    const entry = between(
      source,
      'create or replace function public.admin_open_season_competition(',
      '$admin$;',
    )

    expect(executable(entry)).toContain(
      'begin perform predictor_internal.require_competition_admin(); ' +
        'return predictor_internal.open_season_competition(p_competition_id, now()); end;',
    )
  })
})

describe('what the bootstrap deliberately is not', () => {
  it('schedules no job', () => {
    // The decision recorded in the header: opening is an operator action,
    // because `launch_season_cup` fixes the format at whatever field size it
    // finds and a cron tick would be choosing the competition's shape.
    expect(executable(source)).not.toContain('cron.schedule')
    expect(executable(source)).not.toContain('cron.job')
  })

  it('creates exactly one window writer', () => {
    const inserts = executable(source).match(/insert into public\.bonus_competition_windows/g) ?? []
    expect(inserts).toHaveLength(1)
  })

  it('creates no window for Main Predictor', () => {
    const branch = between(
      source,
      "if v_competition.game_key = 'main_predictor' then",
      "'playableRounds', v_playable);",
    )

    expect(branch).not.toContain('insert into')
    expect(branch).toContain("'outcome', 'no_windows_required'")
  })

  it('delegates the Championship rather than restating its rules', () => {
    const branch = between(
      source,
      "if v_competition.game_key = 'predictor_cup' then",
      "'\"predictor_cup\"'::jsonb, true);",
    )

    expect(branch).toContain('predictor_internal.launch_season_cup(p_competition_id)')
    // The thresholds, the format selector and the draw all stay in contract
    // 111. A second copy of the hundred-entrant rule here is the failure this
    // guards against.
    for (const restated of ['resolve_public_cup_launch', 'select_season_cup_format', '100']) {
      expect(branch).not.toContain(restated)
    }
  })

  it('settles nothing', () => {
    // Opening creates a calendar and a draw. Results still arrive through the
    // protected confirmation gate and the existing rederivation jobs do the
    // rest — nothing here scores, settles or completes.
    for (const authority of [
      'settle_season_lms_competition',
      'process_due_season_matchweek_scores',
      'recompute_tournament_scores',
      'season_matchweek_scores',
      'completed_at =',
    ]) {
      expect(executable(source)).not.toContain(authority)
    }
  })
})

describe('the Championship launch driver finally has a caller', () => {
  it('had none before this contract', () => {
    // The measurement contract 111 recorded about the authorities beneath it,
    // now true of contract 111 itself. This is the same "an authority with no
    // caller" shape as contracts 116, 118, 120, 122 and 124.
    const launchSource = migration(CONTRACT_111)
    expect(launchSource).toContain('function predictor_internal.launch_season_cup')
    expect(source).toContain('predictor_internal.launch_season_cup(p_competition_id)')
  })
})
