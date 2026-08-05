import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALWAYS_FULL_SUITE,
  BASELINE_SPECS,
  JOURNEY_MAP,
  selectJourneys,
  specsOnDisk,
} from '../../scripts/select-browser-journeys.mjs'

/**
 * ADR 0024 narrows the browser suite so focused changes run focused journeys.
 *
 * The danger in that is specific: a selector that skips the journey which would
 * have caught a regression still reports green. So these assertions are mostly
 * about the DIRECTION of failure — unrecognised input must widen the run, never
 * narrow it — and about no spec becoming unreachable from every change.
 */

type JourneyEntry = { prefix: string; specs: string[] }
const journeyMap = JOURNEY_MAP as JourneyEntry[]
const baselineSpecs = BASELINE_SPECS as string[]
const alwaysFullSuite = ALWAYS_FULL_SUITE as string[]

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/browser-e2e.yml'),
  'utf8',
)

describe('narrowing is earned, never assumed', () => {
  it('runs everything for an unmapped path', () => {
    expect(selectJourneys(['src/somewhere/new/Thing.tsx']).full).toBe(true)
    expect(selectJourneys(['tooling/whatever.json']).full).toBe(true)
  })

  it('runs everything when one path in an otherwise mapped change is unmapped', () => {
    // The whole point: a single unrecognised file widens the run. A selector
    // that narrowed on the recognised majority would be the silent-skip bug.
    const decision = selectJourneys([
      'src/features/admin/ResultsForm.tsx',
      'src/something-unforeseen/index.ts',
    ])
    expect(decision.full).toBe(true)
  })

  it('runs everything when no change list is available', () => {
    expect(selectJourneys([]).full).toBe(true)
    expect(selectJourneys(undefined as unknown as string[]).full).toBe(true)
  })

  it.each(alwaysFullSuite.map((prefix) => [prefix] as const))(
    'runs everything for %s',
    (prefix: string) => {
      const path = prefix.endsWith('/') ? `${prefix}something.ts` : prefix
      expect(selectJourneys([path]).full).toBe(true)
    },
  )

  it('runs everything for schema and contract changes specifically', () => {
    // Named separately from the table above because these are the two that
    // produced the contract-66 failure: schema moved, fixtures did not.
    expect(selectJourneys(['supabase/migrations/20260101000000_thing.sql']).full).toBe(true)
    expect(selectJourneys(['supabase/seed.sql']).full).toBe(true)
    expect(selectJourneys(['config/deployment-contract.json']).full).toBe(true)
  })

  it('runs everything for the shared browser fixtures every journey depends on', () => {
    expect(selectJourneys(['e2e/global-setup.ts']).full).toBe(true)
    expect(selectJourneys(['e2e/seed-contract.ts']).full).toBe(true)
    expect(selectJourneys(['e2e/h2h-local.ts']).full).toBe(true)
  })
})

describe('a genuinely focused change narrows', () => {
  it('runs the admin journey for an admin-only change', () => {
    const decision = selectJourneys(['src/features/admin/ResultsForm.tsx'])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('admin-results.spec.ts')
    expect(decision.specs).not.toContain('bonus-games.spec.ts')
  })

  it('runs a changed spec itself', () => {
    const decision = selectJourneys(['e2e/locked-state.spec.ts'])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('locked-state.spec.ts')
  })

  it('always includes the accessibility floor in any subset', () => {
    const decision = selectJourneys(['src/features/admin/ResultsForm.tsx'])
    expect(decision.full).toBe(false)
    for (const baseline of baselineSpecs) {
      expect(decision.specs).toContain(baseline)
    }
  })

  it('unions the journeys when several mapped areas change', () => {
    const decision = selectJourneys([
      'src/features/admin/ResultsForm.tsx',
      'src/features/leagues/Table.tsx',
    ])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('admin-results.spec.ts')
    expect(decision.specs).toContain('private-league-invite.spec.ts')
  })
})

describe('the map cannot rot', () => {
  it('names only specs that exist', () => {
    const onDisk = new Set(specsOnDisk() as string[])
    const named = [...journeyMap.flatMap((entry) => entry.specs), ...baselineSpecs]
    const missing = named.filter((spec: string) => !onDisk.has(spec))

    expect(
      missing,
      `these journeys are named by the selector but do not exist, so the change ` +
        `they claim to cover runs nothing: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('leaves no spec unreachable from every possible change', () => {
    // A spec reachable only by editing itself would never run for a source
    // change — present, passing, and guarding nothing.
    const reachable = new Set([...journeyMap.flatMap((entry) => entry.specs), ...baselineSpecs])
    /**
     * Specs that do not run under `playwright.config.ts` at all, so journey
     * selection — which only ever narrows that config — cannot reach them and
     * is not supposed to.
     *
     * The first three run in the auth project, which is never narrowed. The
     * visual suite runs under `playwright.visual.config.ts` from its own
     * dispatch-only workflow, because a screenshot comparison needs baselines
     * rendered on the runner that will compare them; until that bootstrap has
     * happened it must not be reachable from a source change at all.
     */
    const separatelyConfiguredSpecs = [
      'auth-recovery.spec.ts',
      'auth-capacity.spec.ts',
      'axe-unauthenticated.spec.ts',
      'visual-gallery.spec.ts',
    ]
    const unreachable = (specsOnDisk() as string[]).filter(
      (spec) => !reachable.has(spec) && !separatelyConfiguredSpecs.includes(spec),
    )

    expect(
      unreachable,
      `these specs are not reached by any mapped source area, so no focused ` +
        `change runs them: ${unreachable.join(', ')}`,
    ).toEqual([])
  })

  it('maps only prefixes that exist, so a rename cannot silently stop narrowing', () => {
    // A stale prefix does not fail loudly — it just stops matching, and every
    // change under the renamed directory quietly widens to the full suite.
    // That is safe but slow, and slow-forever is how the ADR 0024 problem
    // came back. Failing here keeps the map honest.
    const stale = journeyMap
      .map((entry) => entry.prefix)
      .filter((prefix) => !existsSync(resolve(process.cwd(), prefix)))

    expect(stale, 'journey map prefixes that no longer exist').toEqual([])
  })
})

describe('the workflow actually uses the selector', () => {
  it('computes the journeys and still runs the auth project unnarrowed', () => {
    expect(workflow).toContain('scripts/select-browser-journeys.mjs')
    // The auth journeys are cheap and cover sign-up/recovery, which any change
    // can break; they are never narrowed.
    expect(workflow).toContain('npm run test:e2e:auth')
  })

  it('checks out enough history for the diff to have a merge base', () => {
    // A shallow checkout has no merge base with origin/main, so the diff step
    // fails, the selector fails open, and the narrowing never happens: green,
    // slow, and inert. This was the state of the first run of this feature.
    const authenticatedJob = workflow.slice(
      workflow.indexOf('authenticated-browser:'),
      workflow.indexOf('deploy-preview-smoke:'),
    )
    expect(authenticatedJob).toMatch(/fetch-depth:\s*0/)
    // A `|| true` on the base fetch would restore the same silent failure by
    // letting a failed fetch look like a successful one.
    expect(authenticatedJob).not.toMatch(/git fetch[^\n]*\|\|\s*true/)
  })

  it('treats empty selector output as the full suite', () => {
    // The selector prints nothing to mean "everything". If the workflow passed
    // that straight through as a spec filter, Playwright would run zero specs
    // and report success — the exact silent-skip this design exists to avoid.
    expect(workflow).toMatch(/BROWSER_JOURNEYS/)
    expect(workflow).toMatch(/if \[ -z "\$\{BROWSER_JOURNEYS\}" \]/)
  })
})
