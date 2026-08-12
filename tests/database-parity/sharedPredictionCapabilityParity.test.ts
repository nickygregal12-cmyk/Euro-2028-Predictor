import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 180 redefines TWO delivered authorities from their committed text:
 *
 *   * `predictor_internal.prepare_entry_game_membership`, the trigger that
 *     resolves which game a season entry belongs to and links its membership;
 *   * `predictor_internal.enter_competition_game`, the membership authority
 *     both public joins call.
 *
 * THIS FILE IS THE DIFF THOSE CLAIMS REFER TO. Contract 124 established the
 * control after a hand-copied tail drifted, and contract 174 re-established it
 * after a substring assertion passed against a body mis-copied in five places —
 * including a column that did not exist and a silently changed limit. Reading a
 * copy does not catch a substituted one.
 *
 * ---------------------------------------------------------------------------
 * WHY SENTINELS RATHER THAN AN ALLOW-LIST OF ADDED LINES
 * ---------------------------------------------------------------------------
 *
 * Contract 174's diff enumerates the lines it expects to be added. That works
 * for one added call and degrades badly for a block: the allow-list grows until
 * it matches `end if;`, `begin` and `) values (`, at which point it would admit
 * an entirely different block built from the same fragments.
 *
 * So contract 180's additions are delimited in the migration by `-- >>> contract
 * 180` / `-- <<< contract 180`, this file DELETES those regions, and then
 * requires what remains to be **character-identical** to the committed text.
 * That is a real diff rather than a description of one: any edit anywhere else
 * in either function fails, including one that only reorders lines.
 *
 * The stakes justify it. `enter_competition_game` holds the authentication
 * check, the availability, completion and registration-window refusals, the
 * disqualification refusal and contract 126's rejoin rule. A dropped line in any
 * of those is a membership rule quietly removed, and no pgTAP suite would fail,
 * because none of them assert a refusal that no longer exists.
 */

const repositoryRoot = process.cwd()
const migrations = resolve(repositoryRoot, 'supabase/migrations')

const CONTRACT_180 = '20260812020000_shared_season_prediction_capability.sql'

function definitionIn(migration: string, pattern: RegExp): string {
  const source = readFileSync(resolve(migrations, migration), 'utf8')
  const match = pattern.exec(source)
  if (!match) throw new Error(`definition not found in ${migration}`)
  return match[0]
}

/** Drop every sentinel-delimited contract 180 region, and every comment line. */
function withoutAdditions(body: string): string[] {
  const kept: string[] = []
  let inside = false
  for (const line of body.split('\n')) {
    if (line.includes('>>> contract 180')) {
      inside = true
      continue
    }
    if (line.includes('<<< contract 180')) {
      inside = false
      continue
    }
    if (inside) continue
    // Comments are stripped from BOTH sides, so a rewritten explanation is not
    // reported as a changed rule. Only executable text is compared.
    if (line.trimStart().startsWith('--')) continue
    if (line.trim().length === 0) continue
    kept.push(line)
  }
  return kept
}

const ENTER =
  /create or replace function predictor_internal\.enter_competition_game[\s\S]*?\n\$enter\$;\n/
const PREPARE =
  /create or replace function predictor_internal\.prepare_entry_game_membership\(\)\nreturns trigger[\s\S]*?\n\$\$;\n/

const committedEnter = definitionIn('20260810190000_private_season_lms.sql', ENTER)
const redefinedEnter = definitionIn(CONTRACT_180, ENTER)

const committedPrepare = definitionIn('20260803070000_c1b_game_catalogue_memberships.sql', PREPARE)
const redefinedPrepare = definitionIn(CONTRACT_180, PREPARE)

describe('contract 180 redefines the membership authority from committed text', () => {
  it('finds both definitions at all', () => {
    // The positive control. A renamed function or a changed dollar-quote tag
    // would otherwise make every assertion below compare nothing to nothing.
    expect(committedEnter).toContain('allow_rejoin')
    expect(redefinedEnter).toContain('allow_rejoin')
    expect(committedEnter.length).toBeGreaterThan(3000)
    expect(redefinedEnter.length).toBeGreaterThan(committedEnter.length)
  })

  it('is character-identical outside the contract 180 blocks', () => {
    expect(withoutAdditions(redefinedEnter)).toEqual(withoutAdditions(committedEnter))
  })

  it('keeps every refusal the committed authority made, named individually', () => {
    // Redundant against the diff above, and kept for the reason contract 174
    // kept its named list: when the diff fails, this says WHICH rule went.
    for (const refusal of [
      "raise exception 'Authentication is required'",
      "raise exception 'Game not found'",
      "raise exception 'This game has finished'",
      "raise exception 'Registration has not opened'",
      "raise exception 'Registration has closed'",
      "raise exception 'You have already entered this game'",
      "raise exception 'A disqualified game entry cannot be rejoined'",
      "raise exception 'This game cannot be rejoined once it has started'",
      'predictor_internal.competition_is_running(v_availability.id)',
    ]) {
      expect(redefinedEnter, `${refusal} is missing from the redefinition`).toContain(refusal)
    }
  })

  it('never writes a membership of the card-owning game', () => {
    // The invariant PPLAY-002 turns on. The card-establishing block inserts
    // into `entries` naming three columns; `game_membership_id` is not one of
    // them, and no `game_memberships` insert appears inside it.
    const block = redefinedEnter.slice(
      redefinedEnter.indexOf('if v_definition.uses_season_prediction_card then'),
      redefinedEnter.indexOf('<<< contract 180', redefinedEnter.lastIndexOf('>>> contract 180')),
    )
    expect(block).not.toContain('insert into public.game_memberships')
    expect(block).not.toContain('game_membership_id')
  })

  it('selects the card-using game by property and never by name', () => {
    const block = redefinedEnter.slice(
      redefinedEnter.indexOf('if v_definition.uses_season_prediction_card then'),
    )
    expect(block).not.toContain('predictor_cup')
    expect(block).not.toContain('main_predictor')
  })
})

describe('contract 180 redefines the entry preparation trigger from committed text', () => {
  it('finds both definitions at all', () => {
    expect(committedPrepare).toContain('Entry must belong to the season Main or Original Predictor')
    expect(redefinedPrepare).toContain(
      'Entry must belong to the season Main or Original Predictor',
    )
  })

  it('is character-identical outside the contract 180 block', () => {
    expect(withoutAdditions(redefinedPrepare)).toEqual(withoutAdditions(committedPrepare))
  })

  it('keeps both refusals and the card-owner resolution', () => {
    for (const preserved of [
      "raise exception 'Entry must belong to the season Main or Original Predictor'",
      "raise exception 'Join or rejoin the game before creating an entry'",
      "when season.kind = 'league_season' then 'main_predictor'",
      "else 'original_predictor'",
      'definition.requires_prediction_entry',
    ]) {
      expect(redefinedPrepare, `${preserved} is missing from the redefinition`).toContain(preserved)
    }
  })

  it('the new branch fabricates no membership', () => {
    // The LAST block, not the first: the first is the declaration this branch
    // needs, which is also sentinel-delimited.
    const start = redefinedPrepare.lastIndexOf('>>> contract 180')
    const block = redefinedPrepare.slice(
      start,
      redefinedPrepare.indexOf('<<< contract 180', start),
    )
    expect(block).toContain('new.game_membership_id := null;')
    expect(block).not.toContain('insert into')
    // League seasons only: the tournament automatic-submission driver selects
    // through an ACTIVE membership on `entry.game_membership_id`, so a null
    // there would drop a tournament entry from it silently.
    expect(block).toContain("season.kind = 'league_season'")
  })
})
