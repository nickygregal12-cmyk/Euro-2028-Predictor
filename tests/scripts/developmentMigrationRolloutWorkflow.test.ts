import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The guarded development lane takes its boundary as INPUT rather than being
 * pinned to one contract, which is what makes it reusable and what makes it
 * worth testing.
 *
 * A pinned lane cannot apply the wrong migration: the pin is the safety. Take
 * the pin out and that safety has to be rebuilt out of checks, and a check is
 * only as good as the thing stopping somebody deleting it. These assertions are
 * that thing. They read the workflow rather than trusting its name — the same
 * discipline the fast-lane test applies, and for the same reason.
 */

const root = process.cwd()
const workflow = readFileSync(
  resolve(root, '.github/workflows/development-migration-rollout.yml'),
  'utf8',
)
const checker = readFileSync(
  resolve(root, 'scripts/check-migration-additive.mjs'),
  'utf8',
)
const fastLane = readFileSync(
  resolve(root, '.github/workflows/development-fast-lane-rollout.yml'),
  'utf8',
)

const DEVELOPMENT_REF = 'iouzoutneyjpugbbtdem'
const PRODUCTION_REF = 'vkfnsqdyhvtwyqkisxhk'

describe('the guarded lane cannot reach production', () => {
  it('refuses the production project ref by name', () => {
    expect(workflow).toContain(`FORBIDDEN_PRODUCTION_REF: ${PRODUCTION_REF}`)
    expect(workflow).toContain('Production has no general lane')
  })

  it('accepts only the development project ref', () => {
    expect(workflow).toContain(`EXPECTED_PROJECT_REF: ${DEVELOPMENT_REF}`)
    expect(workflow).toMatch(/only development project .* is permitted/)
  })

  it('checks the secret itself resolves to development, not just the typed input', () => {
    // The dispatcher types a ref; the SECRET is what the push actually uses.
    // A correct input with a misconfigured secret would otherwise write to
    // whatever the secret happens to name.
    expect(workflow).toContain('the development secret resolves to the production project')
    expect(workflow).toContain('the development secret names neither known project')
  })
})

describe('the lane is dispatch-only and runs from main alone', () => {
  it('has no automatic trigger of any kind', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s+push:/m)
    expect(workflow).not.toMatch(/^\s+pull_request:/m)
    expect(workflow).not.toMatch(/^\s+schedule:/m)
  })

  it('requires exact origin/main and a clean checkout', () => {
    expect(workflow).toContain("[ \"${GITHUB_REF}\" = 'refs/heads/main' ]")
    expect(workflow).toContain('checked-out HEAD is not exact origin/main')
    expect(workflow).toContain('checkout is not clean')
  })
})

describe('the boundary is named, not guessed', () => {
  it('takes the target as a filename rather than a contract number', () => {
    expect(workflow).toContain('target_migration:')
    // A number is one keystroke from a different boundary; a filename is not.
    expect(workflow).toContain('Exact filename of the LAST migration to apply')
  })

  it('refuses a target that is not in the tree exactly once', () => {
    expect(workflow).toContain('expected exactly 1')
  })

  it('refuses a target at or below the stated source, so the lane only moves forward', () => {
    expect(workflow).toContain('which is not above the stated source')
    expect(workflow).toContain('It never rolls back and never re-applies')
  })

  it('proves the live source against the database instead of believing the input', () => {
    expect(workflow).toContain('Prove the live source is exactly the stated contract')
    expect(workflow).toContain('not the stated ${SOURCE_ROW}')
  })

  it('holds back everything above the boundary before the dry run', () => {
    expect(workflow).toContain('Hold back anything above the boundary, then dry run')
    expect(workflow).toContain('later-migrations')
  })

  it('requires the dry run to equal the resolved batch exactly', () => {
    // The dry run is what the CLI will actually push. If it disagrees with the
    // batch we resolved, the disagreement is the finding.
    expect(workflow).toContain('the dry run is not exactly the resolved batch')
    expect(workflow).toMatch(/diff -u .*expected\.txt.*pending\.txt/)
  })
})

describe('a destructive batch cannot be applied without noticing', () => {
  it('runs the additive checker as a report rather than skipping it', () => {
    expect(workflow).toContain('scripts/check-migration-additive.mjs')
    expect(workflow).toContain('This batch is DESTRUCTIVE. The checker said:')
  })

  it('demands an acknowledgement that quotes the target filename back', () => {
    expect(workflow).toContain('ACKNOWLEDGE-DESTRUCTIVE-${INPUT_TARGET_MIGRATION}')
    expect(workflow).toContain('a destructive batch needs an explicit acknowledgement')
  })

  it('says why retyping the filename is the point', () => {
    // If this ever becomes a generic yes/no it stops being a reading step, and
    // the lane loses the only thing that replaced the pin.
    expect(workflow).toContain('A generic confirmation is a box')
  })
})

describe('the lane does not claim its own success', () => {
  it('applies but refuses to verify itself', () => {
    expect(workflow).toContain('It does NOT verify them')
    expect(workflow).toContain('a job')
    expect(workflow).toContain('reporting on its own write is not independent evidence')
  })

  it('sends the reader to a separate query before the machine record moves', () => {
    expect(workflow).toContain('config/development-hosted-contract.json')
    expect(workflow).toContain('not from this summary')
  })
})

describe('the refusal points somewhere runnable', () => {
  it('sends destructive migrations to this lane rather than the spent one-shot', () => {
    // The bug this whole lane exists to close: the checker named
    // `stage-c1-development-rollout.yml`, a one-shot pinned to contract 65 that
    // refuses everything else. The refusal looked like an answer, which is why
    // nobody noticed the door was bricked up.
    expect(checker).toContain('development-migration-rollout.yml')
    expect(checker).not.toMatch(/Use stage-c1-development-rollout\.yml/)
    expect(fastLane).toContain('development-migration-rollout.yml')
  })

  it('keeps the fast lane as the default for additive work', () => {
    // The guarded lane is the exception, not a replacement. If it ever became
    // the ordinary path, every additive migration would start paying for
    // ceremony ADR 0024 deliberately removed.
    expect(workflow).toContain('It could also have taken the fast lane')
  })
})
