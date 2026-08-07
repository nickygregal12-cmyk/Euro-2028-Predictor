import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 126's rejoin gate, against the authority it enforces.
 *
 * THIS CONTRACT NARROWS WHEN A REFUSAL APPLIES, NEVER WHICH GAMES REFUSE, and
 * that distinction is the whole review. `game_definitions.allow_rejoin` is
 * untouched — `last_man_standing` is still the only game with it false. What
 * changes is that the flag is read together with whether the competition is
 * RUNNING, which is ADR 0020's own word for the state the rejection describes.
 *
 * THE REDEFINITION DIFF IS THE LOAD-BEARING GUARD. `join_competition_game` also
 * holds the authentication check, the availability and registration-window
 * refusals, the duplicate-entry refusal, the disqualification refusal and the
 * membership write. Contract 114 once redefined a function from an older
 * migration's text and silently reverted contract 104's work; the diff below
 * asserts that exactly one branch moved.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const CATALOGUE = '20260803070000_c1b_game_catalogue_memberships.sql'
const CONTRACT_126 = '20260806170000_rejoin_before_start.sql'

const catalogueSource = migration(CATALOGUE)
const source = migration(CONTRACT_126)

function definition(text: string, name: string, schema = 'public'): string {
  const start = text.indexOf(`create or replace function ${schema}.${name}(`)
  expect(start, `${schema}.${name} is not defined here`).toBeGreaterThan(-1)

  const rest = text.slice(start)
  const opening = /\bas\s+(\$[a-z_]*\$)/.exec(rest)
  const tag = (opening as RegExpExecArray)[1]
  const bodyStart = (opening as RegExpExecArray).index + (opening as RegExpExecArray)[0].length
  const bodyEnd = rest.indexOf(tag, bodyStart)
  expect(bodyEnd).toBeGreaterThan(-1)

  return rest.slice(0, bodyEnd + tag.length)
}

describe('exactly one branch of join_competition_game moved', () => {
  const original = definition(catalogueSource, 'join_competition_game')
  const redefined = definition(source, 'join_competition_game')

  const REMOVED = `    if not v_definition.allow_rejoin then
      raise exception 'This game cannot be rejoined after leaving'`

  const ADDED = `    if not v_definition.allow_rejoin
       and predictor_internal.competition_is_running(v_availability.id)
    then
      raise exception 'This game cannot be rejoined once it has started'`

  it('finds both definitions', () => {
    expect(original.length).toBeGreaterThan(1500)
    expect(redefined.length).toBeGreaterThan(1500)
  })

  it('is the committed text with the rejoin branch replaced and nothing else', () => {
    expect(original).toContain(REMOVED)
    expect(redefined).toContain(ADDED)

    // Put the original branch back, strip contract 126's explanatory comment,
    // and what remains must be the committed function character for character.
    const restored = redefined
      .replace(ADDED, REMOVED)
      .replace(/\n *-- Contract 126\.[\s\S]*?before the first round locks nobody has burned anything\./, '')

    expect(restored).toBe(original)
  })

  it.each([
    ['Authentication is required', 'the authentication check'],
    ['Game not found', 'the availability refusal'],
    ['This game has finished', 'the completion refusal'],
    ['Registration has not opened', 'the registration-open refusal'],
    ['Registration has closed', 'the registration-closed refusal'],
    ['You have already entered this game', 'the duplicate-entry refusal'],
    ['A disqualified game entry cannot be rejoined', 'the disqualification refusal'],
  ])('keeps %s — %s', (message) => {
    expect(definition(source, 'join_competition_game')).toContain(message)
  })
})

describe('running means the first round has locked', () => {
  const running = definition(source, 'competition_is_running', 'predictor_internal')

  it('reads a lock instant that has passed', () => {
    // ADR 0013: "The field is fixed once the first round locks." The same
    // instant the game's other rules already turn on — managed entrants lock
    // there with no late entry, and setup options become immutable there.
    expect(running).toMatch(/win\.locks_at is not null/)
    expect(running).toMatch(/win\.locks_at <= now\(\)/)
  })

  it('does not treat a merely scheduled round as running', () => {
    // A calendar published weeks ahead has fixed no field, and a window with no
    // lock instant has fixed even less.
    expect(running).not.toMatch(/opens_at/)
    expect(running).not.toMatch(/win\.locks_at is null/)
  })

  it('does not make one player’s pick close entry for everybody', () => {
    // First pick saved would make the boundary depend on another entrant's
    // behaviour, which no authority says.
    for (const relation of [
      'season_lms_selections',
      'bonus_lms_selections',
      'season_predictions',
      'bonus_score_events',
    ]) {
      expect(running).not.toContain(relation)
    }
  })

  it('stays out of every browser and service role', () => {
    expect(source).toMatch(
      /revoke all on function predictor_internal\.competition_is_running\(uuid\)\s+from public, anon, authenticated, service_role/,
    )
    expect(source).not.toMatch(/grant execute on function predictor_internal\.competition_is_running/)
  })
})

describe('which games refuse is unchanged', () => {
  it('alters no game definition', () => {
    // The blast radius is one game only because `last_man_standing` is the only
    // row with allow_rejoin false. Changing that column here would widen or
    // narrow the rule for games this contract never examined.
    const executable = source.replaceAll(/^[ \t]*--.*$/gm, '')
    expect(executable).not.toMatch(/update public\.game_definitions/)
    expect(executable).not.toMatch(/insert into public\.game_definitions/)
    expect(executable).not.toMatch(/allow_rejoin\s*=\s*(true|false)/)
  })

  it('reads the flag rather than replacing it', () => {
    expect(definition(source, 'join_competition_game')).toContain(
      'if not v_definition.allow_rejoin',
    )
  })
})
