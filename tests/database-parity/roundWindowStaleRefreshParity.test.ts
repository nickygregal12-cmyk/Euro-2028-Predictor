import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveFixtureReassignment } from '../../src/domain/season/fixtureReassignment'

/**
 * Contract 123's refresh, against the three things it has to stay in step with.
 *
 * THE REDEFINITION. Contract 123 redefines contract 117's importer to call the
 * refresh, and contract 118 established the method for that: "redefined from
 * contract 104's text with only its fixtures subquery changed, verified by diff
 * rather than by reading". Reading a four-hundred-line function and concluding
 * nothing else moved is exactly the check that feels done and is not — the
 * refusals, the fail-closed payload guard and the deliberate absence of
 * `competition_round_id` all live in that body, and any of them could be lost
 * in a copy without a single test noticing. So the two texts are held against
 * each other here: strip contract 123's additions and what remains must be
 * contract 117's function, character for character.
 *
 * THE CONFLICT PATH. The whole contract is a decision about what happens when a
 * proposed window overlaps another round's, and the decision is only worth
 * anything if the refused path writes nothing. `175_round_window_stale_refresh.sql`
 * proves the behaviour against a real database; these assertions pin the SHAPE
 * that produces it, because a refactor that reordered the update above the
 * overlap test would still pass a suite that only checked return values on the
 * cases it happened to try.
 *
 * THE INCLUSIVITY. `resolveFixtureReassignment` is the domain authority for
 * what "falls in a round's window" means and it is inclusive at both ends.
 * Contract 113's disjointness trigger matched it deliberately — "windows that
 * merely touch overlap, and are refused" — and this refresh has to test overlap
 * the same way, or a fixture landing exactly on a neighbour's boundary would be
 * applied here and refused by the trigger, which is the one shape that turns a
 * queued conflict back into a failed import.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const CONTRACT_117 = '20260805130000_provider_fixture_revision_import.sql'
const CONTRACT_123 = '20260806140000_round_window_stale_refresh.sql'

const importerSource = migration(CONTRACT_117)
const refreshSource = migration(CONTRACT_123)

/**
 * One `create or replace function predictor_internal.<name>` statement, from
 * the `create` to the closing dollar tag.
 *
 * The tag is read from the text rather than assumed, because this repository
 * names them after the function (`$import$`, `$refresh$`) and a hardcoded
 * `$$` would silently match the wrong thing.
 */
function definition(source: string, name: string): string {
  const start = source.indexOf(`create or replace function predictor_internal.${name}(`)
  expect(start, `${name} is not defined in this migration`).toBeGreaterThan(-1)

  const rest = source.slice(start)
  const opening = /\bas\s+(\$[a-z_]*\$)/.exec(rest)
  expect(opening, `${name} has no dollar-quoted body`).not.toBeNull()

  const tag = (opening as RegExpExecArray)[1]
  const bodyStart = (opening as RegExpExecArray).index + (opening as RegExpExecArray)[0].length
  const bodyEnd = rest.indexOf(tag, bodyStart)
  expect(bodyEnd, `${name}'s body is not closed`).toBeGreaterThan(-1)

  return rest.slice(0, bodyEnd + tag.length)
}

/**
 * Comments out, whitespace flattened.
 *
 * The comparison below is about executable text. Contract 123 adds prose to the
 * importer explaining why it now calls the refresh, and a diff that failed on
 * an added comment would be a diff people stop running.
 */
function executable(sql: string): string {
  return sql
    .replaceAll(/^[ \t]*--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

/** The four things contract 123 adds to contract 117's importer, and nothing else. */
const ADDITIONS = [
  'v_touched_rounds uuid[] := array[]::uuid[]; v_windows jsonb := null;',
  `if not (v_row.round_id = any (v_touched_rounds)) then
     v_touched_rounds := v_touched_rounds || v_row.round_id;
   end if;`,
  `if v_revised > 0 then
     v_windows := predictor_internal.refresh_round_play_windows(
       p_tournament_id, v_touched_rounds, p_now);
   end if;`,
  ", 'windows', v_windows",
].map(executable)

describe('contract 123 redefines contract 117 and changes only what it says it changes', () => {
  it('finds both definitions, so nothing below passes vacuously', () => {
    expect(executable(definition(importerSource, 'import_provider_fixture_revisions')).length)
      .toBeGreaterThan(1000)
    expect(executable(definition(refreshSource, 'import_provider_fixture_revisions')).length)
      .toBeGreaterThan(1000)
  })

  it('leaves contract 117 exactly as it was once the additions are removed', () => {
    const original = executable(definition(importerSource, 'import_provider_fixture_revisions'))
    let redefined = executable(definition(refreshSource, 'import_provider_fixture_revisions'))

    for (const addition of ADDITIONS) {
      expect(redefined, `contract 123 no longer adds: ${addition}`).toContain(addition)
      redefined = redefined.replace(addition, '')
    }

    // Removing a statement leaves the spacing around it doubled up; the
    // comparison is about tokens, not about how they were spaced.
    expect(redefined.replaceAll(/\s+/g, ' ').trim()).toBe(original)
  })

  it('still never writes competition_round_id, which is the owner amendment', () => {
    // ADR 0020's amendment of 5 August 2026: a rescheduled fixture stays in the
    // matchweek it was scheduled in. Refreshing that matchweek's window is not
    // a licence to move the fixture out of it.
    const redefined = definition(refreshSource, 'import_provider_fixture_revisions')
    expect(redefined).not.toMatch(/set\s+competition_round_id/i)
    expect(redefined).toMatch(/update public\.season_fixtures\s+set kickoff_at = v_row\.kickoff/)
  })

  it('refreshes only the rounds it moved, and only when it moved one', () => {
    const redefined = executable(definition(refreshSource, 'import_provider_fixture_revisions'))
    // Recomputing the whole season would rewrite windows no payload mentioned,
    // and could queue a conflict on a round this import never touched.
    expect(redefined).toContain('if v_revised > 0 then')
    expect(redefined).toContain('p_tournament_id, v_touched_rounds, p_now')
    expect(redefined).not.toContain('derive_round_play_windows')
  })
})

describe('the refused path writes nothing', () => {
  const refresh = definition(refreshSource, 'refresh_round_play_windows')
  const conflictBranch = /if found then([\s\S]*?)continue;/.exec(refresh)?.[1] ?? ''

  it('finds the conflict branch', () => {
    expect(conflictBranch.length).toBeGreaterThan(100)
  })

  it('queues a row and leaves competition_rounds alone', () => {
    // THE assertion of this contract, in shape rather than behaviour: between
    // detecting the overlap and moving on, the only write is to the queue.
    expect(conflictBranch).toContain(
      'insert into predictor_internal.round_window_refresh_conflicts',
    )
    expect(conflictBranch).not.toMatch(/update public\.competition_rounds/)
  })

  it('records the window it kept, the window it proposed, and the round that blocked it', () => {
    // A queue row that says only "there was a conflict" cannot be acted on.
    for (const column of [
      'retained_opens_at',
      'retained_closes_at',
      'proposed_opens_at',
      'proposed_closes_at',
      'blocking_round_id',
      'blocking_opens_at',
      'blocking_closes_at',
    ]) {
      expect(conflictBranch).toContain(column)
    }
  })

  it('never raises, because the ingestion path is what depends on it', () => {
    // Contract 122's objection, made structural: an overlapping window must not
    // be able to roll back a provider import. The two raises this function does
    // hold are argument validation, before any round is looked at.
    const loop = refresh.slice(refresh.indexOf('for v_round in'))
    expect(loop).not.toMatch(/raise\s+exception/i)
  })

  it('does not clear every window first, the way the whole-season deriver does', () => {
    // Contract 113 clears and rebuilds, which is right for a first derivation
    // and destroys the stored fact this contract exists to preserve. The only
    // clear here is the one for a round with no scheduled kickoff left.
    const clears = [...refresh.matchAll(/set window_opens_at = null/g)]
    expect(clears).toHaveLength(1)
    expect(refresh).toMatch(/if v_round\.first_kickoff is null then\s+update public\.competition_rounds/)
  })

  it('re-proposing an unresolved conflict queues nothing new', () => {
    // Contract 115 polls hourly. Without the partial unique index and the
    // `on conflict do nothing`, an unresolved conflict adds an identical row
    // every hour until the queue is unreadable.
    expect(refreshSource).toMatch(
      /create unique index round_window_refresh_conflicts_open_proposal_idx[\s\S]*?\(competition_round_id, proposed_opens_at, proposed_closes_at\)[\s\S]*?where reviewed_at is null/,
    )
    expect(conflictBranch).toContain('on conflict do nothing')
  })

  it('keeps the queue out of every browser and service role', () => {
    expect(refreshSource).toMatch(
      /revoke all on table predictor_internal\.round_window_refresh_conflicts\s+from anon, authenticated, service_role/,
    )
    expect(refreshSource).toMatch(
      /revoke all on function predictor_internal\.refresh_round_play_windows\(uuid, uuid\[\], timestamptz\)\s+from public, anon, authenticated, service_role/,
    )
    expect(refreshSource).not.toMatch(/grant execute on function predictor_internal\.refresh_round_play_windows/)
  })
})

describe('overlap is tested the way the domain authority tests containment', () => {
  const refresh = definition(refreshSource, 'refresh_round_play_windows')
  const disjointness = migration('20260805090000_round_play_windows.sql')

  it('treats windows that merely touch as overlapping, as the trigger does', () => {
    // Both ends inclusive. A half-open reading (`<` on one side) would let the
    // refresh apply a window the trigger is about to refuse, turning a queued
    // conflict back into the failed import contract 122 warned about.
    expect(refresh).toMatch(
      /other\.window_opens_at <= v_round\.last_kickoff\s+and other\.window_closes_at >= v_round\.first_kickoff/,
    )
    expect(disjointness).toMatch(
      /other\.window_opens_at <= new\.window_closes_at\s+and other\.window_closes_at >= new\.window_opens_at/,
    )
  })

  it('matches resolveFixtureReassignment, where a boundary instant is inside the round', () => {
    // The TypeScript authority: `newKickoff >= starts && newKickoff <= ends`.
    // Demonstrated rather than asserted against source, so a change to the rule
    // fails here even if the expression is rewritten.
    const onTheBoundary = resolveFixtureReassignment({
      fixture: { id: 'f', roundId: 'r1', kickoffAt: null, completed: false },
      newKickoffAt: '2030-09-14T14:00:00.000Z',
      rounds: [
        { id: 'r1', windowStartsAt: '2030-09-07T14:00:00.000Z', windowEndsAt: '2030-09-14T14:00:00.000Z' },
      ],
      reason: 'rescheduled',
      evidenceRef: 'parity',
      decidedAt: '2030-09-02T09:00:00.000Z',
    })
    expect(onTheBoundary.kind).toBe('kickoff_revision')

    // And two rounds sharing that instant are the ambiguity contract 113 makes
    // unreachable from stored data — which is only true while the refresh
    // refuses to store it.
    const shared = resolveFixtureReassignment({
      fixture: { id: 'f', roundId: 'r1', kickoffAt: null, completed: false },
      newKickoffAt: '2030-09-14T14:00:00.000Z',
      rounds: [
        { id: 'r1', windowStartsAt: '2030-09-07T14:00:00.000Z', windowEndsAt: '2030-09-14T14:00:00.000Z' },
        { id: 'r2', windowStartsAt: '2030-09-14T14:00:00.000Z', windowEndsAt: '2030-09-14T14:00:00.000Z' },
      ],
      reason: 'rescheduled',
      evidenceRef: 'parity',
      decidedAt: '2030-09-02T09:00:00.000Z',
    })
    expect(shared).toEqual({ kind: 'refused', reason: 'ambiguous_destination_round' })
  })
})

/**
 * The refresh is only as fresh as the writers that call it.
 *
 * Contract 122 established by measurement that exactly one function moves a
 * season kickoff. That is the load-bearing fact under this whole contract: if a
 * second one appears and does not refresh, the window goes stale again and
 * nothing anywhere says so. This is where that gets noticed.
 */
describe('only the importer moves a season kickoff', () => {
  const KICKOFF_WRITE = /update\s+public\.season_fixtures\b[\s\S]{0,400}?\bset\b[\s\S]{0,200}?\bkickoff_at\s*=/gi

  const writers = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .flatMap((file) => {
      const source = migration(file).replaceAll(/^[ \t]*--.*$/gm, '')
      return [...source.matchAll(KICKOFF_WRITE)].map((match) => ({
        file,
        // The enclosing routine, which is what has to carry the refresh call.
        routine:
          [...source.slice(0, match.index).matchAll(/create\s+(?:or\s+replace\s+)?function\s+[a-z_]+\.([a-z_]+)\s*\(/gi)]
            .at(-1)?.[1] ?? '(statement level)',
      }))
    })

  it('finds the write it is scanning for', () => {
    // If the regex stops matching, the assertion below passes on an empty list.
    expect(writers.length).toBeGreaterThan(0)
  })

  it('is written by import_provider_fixture_revisions and nothing else', () => {
    const others = writers.filter((writer) => writer.routine !== 'import_provider_fixture_revisions')
    expect(
      others.map((writer) => `${writer.file}: ${writer.routine}`),
      'a second writer moves a season kickoff without refreshing the round window it belongs to',
    ).toEqual([])
  })
})
