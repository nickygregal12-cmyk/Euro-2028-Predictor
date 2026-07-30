import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Stage C must replace the current tournament-wide write boundary with derived,
 * monotonic round/matchweek locks plus an inclusive per-fixture guard. This
 * characterisation binds the approved safeguards to the live domain resolver,
 * trigger surface and existing database/browser rejection evidence before any
 * migration is written.
 *
 * It deliberately does not implement lock events, rounds or account deletion.
 * Issue #272 remains independent and blocking for the identity-erasure path.
 */

const repositoryRoot = process.cwd()

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const stageCDesign = source('docs/architecture/stage-c-competition-season-schema.md')
const triggerInventory = source('docs/architecture/stage-c-trigger-bindings.md')
const lockStateSource = source('src/domain/competition/lockState.ts')
const lockStateTests = source('tests/domain/competition/lockState.test.ts')
const entryBoundaryTests = source('supabase/tests/030_entry_boundary_integrity.sql')
const bracketTests = source('supabase/tests/070_atomic_bracket_persistence.sql')
const knockoutStoreTests = source('supabase/tests/105_shared_knockout_prediction_store.sql')
const accountControlTests = source('supabase/tests/111_account_entry_controls.sql')
const lockedBrowserTests = source('e2e/locked-state.spec.ts')

function currentLockTriggerBindings(): string[] {
  const section = triggerInventory
    .split('## Current effective bindings')[1]
    ?.split('## Change rules')[0]
  expect(section, 'current trigger binding inventory section').toBeTruthy()

  const bindings: string[] = []
  const rowPattern =
    /^\|\s*`([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)`\s*\|\s*`([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)`\s*\|/gm

  for (const match of section!.matchAll(rowPattern)) {
    if (
      match[2] === 'public.enforce_entry_lock_generic' ||
      match[2] === 'public.enforce_entry_lock_scores'
    ) {
      bindings.push(`${match[1]} -> ${match[2]}`)
    }
  }

  return bindings.sort()
}

describe('Stage C lock/write authority before-state', () => {
  it('keeps the approved fixture-derived, monotonic and per-match safeguards explicit', () => {
    expect(stageCDesign).toContain(
      '| `CS-005` | Round deadlines derive from current fixture kickoffs; no round stores an authoritative planned lock timestamp. |',
    )
    expect(stageCDesign).toContain(
      '| `CS-006` | A locked scope never reopens after rescheduling or stale data. |',
    )
    expect(stageCDesign).toContain(
      '| `CS-007` | A per-fixture server guard rejects every prediction submitted at or after kickoff. |',
    )
    expect(stageCDesign).toContain(
      'Unique: `(tournament_id, round_key)` and `(tournament_id, ordinal)`. There is no `lock_at` column.',
    )
  })

  it('pins the live domain resolver to inclusive, monotonic and fail-closed semantics', () => {
    expect(lockStateSource).toContain(
      "export type LockScopeKind = 'entry' | 'round' | 'matchweek' | 'match'",
    )
    expect(lockStateSource).toContain(
      "if (scope.previouslyLocked) return locked('already_locked')",
    )
    expect(lockStateSource).toContain(
      "if (nowMs >= matchKickoff) return locked('match_kickoff_reached', lockAt)",
    )
    expect(lockStateSource).toContain(
      "if (nowMs >= derived) return locked('scope_lock_reached', lockAt)",
    )
    expect(lockStateSource).toContain("return locked('missing_fixture_data')")
    expect(lockStateSource).toContain("return locked('stale_fixture_data')")
    expect(lockStateSource).toContain("return locked('invalid_fixture_data')")

    expect(lockStateTests).toContain(
      'keeps a scope locked after its first fixture is postponed to a later date',
    )
    expect(lockStateTests).toContain(
      'enforces the per-match guard when the parent round still reads open',
    )
    expect(lockStateTests).toContain('fails closed when fixture data is missing')
    expect(lockStateTests).toContain('fails closed when fixture data is malformed')
    expect(lockStateTests).toContain('fails closed when fixture data is stale')
    expect(lockStateTests).toContain("['entry', 'round', 'matchweek', 'match']")
  })

  it('pins every current trigger-backed Original Predictor lock boundary', () => {
    expect(currentLockTriggerBindings()).toEqual([
      'bonus_predictions.enforce_lock_bonus -> public.enforce_entry_lock_generic',
      'match_predictions.enforce_lock_match_prediction_delete -> public.enforce_entry_lock_generic',
      'match_predictions.enforce_lock_scores -> public.enforce_entry_lock_scores',
      'predicted_group_positions.enforce_lock_group_positions -> public.enforce_entry_lock_generic',
      'predicted_progression.enforce_lock_progression -> public.enforce_entry_lock_generic',
      'predicted_tie_resolutions.enforce_lock_tie_resolutions -> public.enforce_entry_lock_generic',
    ])
  })

  it('retains the current database rejection evidence that Stage C must generalise', () => {
    expect(entryBoundaryTests).toContain(
      'a submitted entry remains editable before the tournament lock',
    )
    expect(entryBoundaryTests).toContain(
      'a match prediction cannot be deleted after tournament lock',
    )
    expect(entryBoundaryTests).toContain(
      'manual submission is rejected at or after tournament lock',
    )

    expect(bracketTests).toContain(
      'the atomic bracket replacement is rejected after tournament lock',
    )
    expect(bracketTests).toContain(
      'the post-lock rejection leaves the complete bracket snapshot unchanged',
    )

    expect(knockoutStoreTests).toContain(
      'an unscheduled kickoff fails closed rather than accepting an unlockable prediction',
    )
    expect(knockoutStoreTests).toContain(
      'the per-kickoff lock refuses a save once the match has kicked off',
    )
    expect(knockoutStoreTests).toContain(
      'the per-kickoff lock refuses a deletion once the match has kicked off',
    )

    expect(accountControlTests).toContain('the clear refuses once predictions are locked')
  })

  it('keeps stale pre-lock clients dependent on the authoritative server boundary', () => {
    expect(lockedBrowserTests).toContain(
      'server rejects every prediction write after lock while saved picks remain readable',
    )
    expect(lockedBrowserTests).toContain("postTo(response, '/rest/v1/match_predictions')")
    expect(lockedBrowserTests).toContain(
      "postTo(response, '/rest/v1/rpc/delete_match_prediction')",
    )
    expect(lockedBrowserTests).toContain(
      "postTo(response, '/rest/v1/rpc/replace_predicted_progression')",
    )
    expect(lockedBrowserTests).toContain("postTo(response, '/rest/v1/bonus_predictions')")
    expect(lockedBrowserTests).toContain("postTo(response, '/rest/v1/rpc/submit_entry')")
  })
})
