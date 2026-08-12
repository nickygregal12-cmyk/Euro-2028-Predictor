import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALWAYS_FULL_SUITE,
  BASELINE_SPECS,
  JOURNEY_MAP,
  PARKED_EURO_SPECS,
  selectJourneys,
  specsOnDisk,
} from '../../scripts/select-browser-journeys.mjs'

type JourneyEntry = { prefix: string; specs: string[] }
const journeyMap = JOURNEY_MAP as JourneyEntry[]
const baselineSpecs = BASELINE_SPECS as string[]
const parkedEuroSpecs = PARKED_EURO_SPECS as string[]
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
    const decision = selectJourneys([
      'src/features/profile/ProfileCard.tsx',
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
    expect(selectJourneys(['supabase/migrations/20260101000000_thing.sql']).full).toBe(true)
    expect(selectJourneys(['supabase/seed.sql']).full).toBe(true)
    expect(selectJourneys(['config/deployment-contract.json']).full).toBe(true)
  })

  it('runs everything for shared browser fixtures', () => {
    expect(selectJourneys(['e2e/global-setup.ts']).full).toBe(true)
    expect(selectJourneys(['e2e/seed-contract.ts']).full).toBe(true)
    expect(selectJourneys(['e2e/h2h-local.ts']).full).toBe(true)
  })

  it('never selects a Euro-deployment journey against the weekly app', () => {
    for (const spec of parkedEuroSpecs) {
      const decision = selectJourneys([`e2e/${spec}`])
      expect(decision.full).toBe(true)
      expect(decision.reason).toContain('Euro-deployment evidence')
    }
  })
})

describe('a genuinely focused weekly change narrows', () => {
  /*
   * THESE USED TO BE WRITTEN OVER `src/features/profile/`, and cannot be any
   * more. `profile-h2h-surfaces.spec.ts` drives `/tournament/profile` and
   * `/h2h/:rivalId`, which only the Euro deployment serves since `EURO-001`'s
   * route half turned on; it moved to `PARKED_EURO_SPECS` with the flip, and its
   * prefixes are deliberately unmapped so a change there falls through to the
   * full suite rather than selecting a spec this selector no longer collects.
   *
   * The narrowing behaviour is unchanged and is now stated over a weekly prefix
   * that still has a weekly journey.
   */
  it('runs the hub journey for a hub-only change', () => {
    const decision = selectJourneys(['src/features/hub/HubPage.tsx'])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('weekly-navigation.spec.ts')
    expect(decision.specs).not.toContain('bonus-games.spec.ts')
  })

  it('runs a changed active spec itself', () => {
    const decision = selectJourneys(['e2e/weekly-navigation.spec.ts'])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('weekly-navigation.spec.ts')
  })

  it('always includes the weekly browser floor in any subset', () => {
    const decision = selectJourneys(['src/features/hub/HubPage.tsx'])
    expect(decision.full).toBe(false)
    for (const baseline of baselineSpecs) {
      expect(decision.specs).toContain(baseline)
    }
  })

  it('unions journeys when several mapped areas change', () => {
    const decision = selectJourneys([
      'src/features/season/SeasonGameRoutes.tsx',
      'src/features/hub/HubPage.tsx',
    ])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('season-competition-journey.spec.ts')
    expect(decision.specs).toContain('weekly-navigation.spec.ts')
  })

  it('falls through to the full suite for a now-Euro-only prefix', () => {
    // The conservative direction, and the one the map's own note names: an
    // unmapped prefix runs everything rather than nothing.
    expect(selectJourneys(['src/features/profile/ProfileCard.tsx']).full).toBe(true)
    expect(selectJourneys(['src/features/h2h/H2HScreen.tsx']).full).toBe(true)
    expect(selectJourneys(['src/features/league/LeaguePage.tsx']).full).toBe(true)
  })
})

describe('the map cannot rot', () => {
  it('names only active specs that exist', () => {
    const onDisk = new Set(specsOnDisk() as string[])
    const named = [...journeyMap.flatMap((entry) => entry.specs), ...baselineSpecs]
    const missing = named.filter((spec: string) => !onDisk.has(spec))
    const parkedNamed = named.filter((spec: string) => parkedEuroSpecs.includes(spec))

    expect(missing, `selector journeys that do not exist: ${missing.join(', ')}`).toEqual([])
    expect(
      parkedNamed,
      `Euro-deployment journeys must not be current weekly selector targets: ${parkedNamed.join(', ')}`,
    ).toEqual([])
  })

  it('keeps every Euro-deployment spec present for the dedicated workflow', () => {
    const onDisk = new Set(specsOnDisk() as string[])
    expect(parkedEuroSpecs.filter((spec) => !onDisk.has(spec))).toEqual([])
  })

  it('leaves no active spec unreachable from every possible focused change', () => {
    const reachable = new Set([...journeyMap.flatMap((entry) => entry.specs), ...baselineSpecs])
    const separatelyConfiguredSpecs = [
      'auth-recovery.spec.ts',
      'auth-capacity.spec.ts',
      'axe-unauthenticated.spec.ts',
      'visual-gallery.spec.ts',
      ...parkedEuroSpecs,
    ]
    const unreachable = (specsOnDisk() as string[]).filter(
      (spec) => !reachable.has(spec) && !separatelyConfiguredSpecs.includes(spec),
    )

    expect(
      unreachable,
      `active specs not reached by any mapped source area: ${unreachable.join(', ')}`,
    ).toEqual([])
  })

  it('maps only prefixes that exist', () => {
    const stale = journeyMap
      .map((entry) => entry.prefix)
      .filter((prefix) => !existsSync(resolve(process.cwd(), prefix)))

    expect(stale, 'journey map prefixes that no longer exist').toEqual([])
  })
})

describe('the workflow actually uses the selector', () => {
  it('computes journeys and still runs the auth project unnarrowed', () => {
    expect(workflow).toContain('scripts/select-browser-journeys.mjs')
    expect(workflow).toContain('npm run test:e2e:auth')
  })

  it('checks out enough history for the diff to have a merge base', () => {
    const authenticatedJob = workflow.slice(
      workflow.indexOf('authenticated-browser:'),
      workflow.indexOf('deploy-preview-smoke:'),
    )
    expect(authenticatedJob).toMatch(/fetch-depth:\s*0/)
    expect(authenticatedJob).not.toMatch(/git fetch[^\n]*\|\|\s*true/)
  })

  it('treats empty selector output as the full active weekly suite', () => {
    expect(workflow).toMatch(/BROWSER_JOURNEYS/)
    expect(workflow).toMatch(/if \[ -z "\$\{BROWSER_JOURNEYS\}" \]/)
  })
})
