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

  it('never selects a parked Euro journey against the weekly app', () => {
    for (const spec of parkedEuroSpecs) {
      const decision = selectJourneys([`e2e/${spec}`])
      expect(decision.full).toBe(true)
      expect(decision.reason).toContain('parked Euro evidence')
    }
  })
})

describe('a genuinely focused weekly change narrows', () => {
  it('runs the profile journey for a profile-only change', () => {
    const decision = selectJourneys(['src/features/profile/ProfileCard.tsx'])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('profile-h2h-surfaces.spec.ts')
    expect(decision.specs).not.toContain('bonus-games.spec.ts')
  })

  it('runs the private-play lifecycle for both discovery and organiser changes', () => {
    for (const path of [
      'src/features/hub/GlobalLeaguesPage.tsx',
      'src/features/hub/privatePlayModel.ts',
      'src/features/leagues/OrganiserPanel.tsx',
    ]) {
      const decision = selectJourneys([path])
      expect(decision.full).toBe(false)
      expect(decision.specs).toContain('private-bonus-play-lifecycle.spec.ts')
    }
  })

  it('runs a changed active spec itself', () => {
    const decision = selectJourneys(['e2e/profile-h2h-surfaces.spec.ts'])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('profile-h2h-surfaces.spec.ts')
  })

  it('always includes the weekly browser floor in any subset', () => {
    const decision = selectJourneys(['src/features/profile/ProfileCard.tsx'])
    expect(decision.full).toBe(false)
    for (const baseline of baselineSpecs) {
      expect(decision.specs).toContain(baseline)
    }
  })

  it('unions journeys when several mapped areas change', () => {
    const decision = selectJourneys([
      'src/features/profile/ProfileCard.tsx',
      'src/features/hub/HubPage.tsx',
    ])
    expect(decision.full).toBe(false)
    expect(decision.specs).toContain('profile-h2h-surfaces.spec.ts')
    expect(decision.specs).toContain('weekly-navigation.spec.ts')
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
      `parked Euro journeys must not be current weekly selector targets: ${parkedNamed.join(', ')}`,
    ).toEqual([])
  })

  it('keeps every parked Euro spec present for the recorded return', () => {
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
      // Run under playwright.vnext.config.ts against Storybook. vNext is not
      // on any application route, so no weekly journey can reach either and no
      // source area maps to them — listed here for the same reason the visual
      // gallery is, rather than being given a weekly journey they have not got.
      'vnext-home.spec.ts',
      'vnext-shell.spec.ts',
      'vnext-predictor.spec.ts',
      'vnext-matches.spec.ts',
      'vnext-leagues.spec.ts',
      'vnext-player-profile.spec.ts',
      // Stage 11's Last Man Standing. Same terms again: the deterministic
      // worlds are the review surface, and the connected proof lives at the
      // dev-only `/dev/vnext-lms` harness — which needs a real round, and
      // spends a real club to prove the write.
      'vnext-lms.spec.ts',
      'vnext-ia.spec.ts',
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