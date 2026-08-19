import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARKED_EURO_SPECS } from '../../scripts/select-browser-journeys.mjs'
import { at } from '../support/indexed'

const root = resolve(import.meta.dirname, '../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

const defaultConfig = read('playwright.config.ts')
const authConfig = read('playwright.auth.config.ts')
const visualConfig = read('playwright.visual.config.ts')
const euroConfig = read('playwright.euro.config.ts')
const vnextConfig = read('playwright.vnext.config.ts')

const specFiles = readdirSync(resolve(root, 'e2e'))
  .filter((entry) => entry.endsWith('.spec.ts'))
  .sort()
const parkedEuroSpecs = [...(PARKED_EURO_SPECS as string[])].sort()

function specList(config: string, key: 'testMatch' | 'testIgnore'): string[] {
  const body = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(config)?.[1] ?? ''
  return [...body.matchAll(/'([^']+)'/g)].map((match) => at(match, 1))
}

function projectNames(config: string): string[] {
  const body = config.slice(config.indexOf('projects: ['))
  return [...body.matchAll(/name:\s*'([^']+)'/g)].map((match) => at(match, 1))
}

const authMatch = specList(authConfig, 'testMatch')
const visualMatch = specList(visualConfig, 'testMatch')
const euroMatch = specList(euroConfig, 'testMatch')
const vnextMatch = specList(vnextConfig, 'testMatch')
const defaultIgnore = specList(defaultConfig, 'testIgnore')

const defaultProjects = projectNames(defaultConfig)
const authProjects = projectNames(authConfig)
const euroProjects = projectNames(euroConfig)
const vnextProjects = projectNames(vnextConfig)

const authSpecs = specFiles.filter((spec) => authMatch.includes(spec))
const visualSpecs = specFiles.filter((spec) => visualMatch.includes(spec))
const euroSpecs = specFiles.filter((spec) => euroMatch.includes(spec))
const vnextSpecs = specFiles.filter((spec) => vnextMatch.includes(spec))
const defaultSpecs = specFiles.filter((spec) => !defaultIgnore.includes(spec))

function projectGates(source: string): string[] {
  return [...source.matchAll(/project\.name\s*!==\s*'([^']+)'/g)].map((match) => at(match, 1))
}

const gatesBySpec = new Map(
  specFiles.map((spec) => [spec, projectGates(read(`e2e/${spec}`))] as const),
)

describe('browser E2E project gating', () => {
  it('parses the active configs', () => {
    expect(specFiles.length).toBeGreaterThan(15)
    expect(authMatch.length).toBeGreaterThan(0)
    expect(defaultIgnore.length).toBeGreaterThan(0)
    expect(defaultProjects).toEqual([
      'desktop-chromium',
      'mobile-chromium',
      'smoke-firefox',
      'smoke-webkit',
    ])
    expect(authProjects).toEqual(['auth-desktop-chromium', 'auth-mobile-chromium'])
    expect(euroMatch.length).toBeGreaterThan(0)
  })

  it('runs only the canonical weekly navigation floor outside Chromium', () => {
    expect(defaultConfig.match(/testMatch:\s*\['weekly-navigation\.spec\.ts'\]/g)).toHaveLength(2)
    expect(defaultConfig).toContain("use: { ...devices['Desktop Firefox'] }")
    expect(defaultConfig).toContain("use: { ...devices['Desktop Safari'] }")
  })

  it('gives every parked Euro journey exactly one home', () => {
    // Parked used to mean "runs nowhere", which was honest while there was no
    // Euro-variant harness and is the state `EURO-001` records as blocking the
    // route half of its own requirement. It now means "runs under the Euro
    // config and no weekly one". A spec dropped from either list is a journey
    // that silently stops being evidence of anything.
    expect(
      [...euroMatch].sort(),
      'playwright.euro.config.ts must collect exactly the parked Euro set',
    ).toEqual(parkedEuroSpecs)
    expect(
      parkedEuroSpecs.filter((spec) => !euroSpecs.includes(spec)),
      'parked Euro journeys named by no config on disk',
    ).toEqual([])
  })

  it('declares the project names the parked specs actually gate on', () => {
    /**
     * THE TRAP THIS EXISTS FOR. Eleven of the fourteen parked specs open with
     * `test.skip(testInfo.project.name !== 'desktop-chromium', ...)`, and
     * `admin-results.spec.ts` gates on `'mobile-chromium'` too. Naming the Euro
     * config's projects `euro-desktop-chromium`/`euro-mobile-chromium` — the
     * obvious spelling, and the one that reads better in a report — makes every
     * one of those gates true, so all fourteen SKIP and the suite reports green
     * having run nothing.
     *
     * Derived from the specs' own gates rather than from a copy of the config's
     * list, so a spec that grows a new gate tomorrow is checked against what the
     * config declares instead of against what this test remembers.
     */
    const gated = [
      ...new Set(parkedEuroSpecs.flatMap((spec) => gatesBySpec.get(spec) ?? [])),
    ].sort()

    expect(gated.length, 'the parked specs carry no project gates to check').toBeGreaterThan(0)
    expect(
      gated.filter((gate) => !euroProjects.includes(gate)),
      `playwright.euro.config.ts declares ${euroProjects.join(', ')}, so these ` +
        `parked-spec gates would skip every test: ${gated.join(', ')}`,
    ).toEqual([])
  })

  it('builds the Euro product rather than failing closed to the Hub', () => {
    // `resolveSiteVariant` fails closed to 'hub' on anything unrecognised, which
    // is right everywhere else and silent here: an unset variable builds the Hub,
    // the tournament routes are absent for a second unrelated reason, and the
    // failure reads as broken journeys rather than as the wrong product.
    expect(euroConfig).toContain('VITE_SITE_VARIANT=euro')
  })

  it('runs every active spec under exactly one config', () => {
    const active = specFiles.filter((spec) => !parkedEuroSpecs.includes(spec))
    const orphaned = active.filter(
      (spec) =>
        !authSpecs.includes(spec) &&
        !defaultSpecs.includes(spec) &&
        !visualSpecs.includes(spec) &&
        !vnextSpecs.includes(spec),
    )
    expect(orphaned, `active specs collected by no Playwright config: ${orphaned.join(', ')}`).toEqual([])

    const doubled = [...authSpecs, ...visualSpecs, ...vnextSpecs].filter((spec) =>
      defaultSpecs.includes(spec),
    )
    expect(doubled, `active specs collected by two configs: ${doubled.join(', ')}`).toEqual([])
  })

  it('gives the vNext workshop suite a Storybook server rather than the app', () => {
    // The default config boots `npm run dev`, which contains no vNext code at
    // all: vNext is deliberately unreachable from `src/main.tsx`. A spec that
    // drifted into the weekly config would open the wrong product and pass by
    // finding nothing.
    expect(vnextMatch).toEqual([
      'vnext-home.spec.ts',
      'vnext-shell.spec.ts',
      // Stage 7's Match Predictor, on the same terms: Storybook is its review
      // surface, and the weekly config must ignore it for the same reason.
      'vnext-predictor.spec.ts',
      // Stage 8's Matches and Match Centre. Same terms again: the deterministic
      // worlds are the review surface, and the connected proof lives at the
      // dev-only `/dev/vnext-matches` harness rather than in a browser suite
      // that would then need a database to pass.
      'vnext-matches.spec.ts',
      // Stage 9's Leagues. Same terms again: the deterministic worlds are the
      // review surface, and the connected proof lives at the dev-only
      // `/dev/vnext-leagues` harness rather than in a browser suite that would
      // then need a database with real private leagues in it to pass.
      'vnext-leagues.spec.ts',
      // Stage 10's player profile. Same terms again, and the connected proof
      // lives at the dev-only `/dev/vnext-player` harness — which would need a
      // database holding two players who share a private league to pass.
      'vnext-player-profile.spec.ts',
      // Stage 11's Last Man Standing. Same terms again: the deterministic
      // worlds are the review surface, and the connected proof lives at the
      // dev-only `/dev/vnext-lms` harness — which needs a real round, and
      // spends a real club to prove the write.
      'vnext-lms.spec.ts',
      // Stage 12's Predictor Championship. Same terms again — and here the
      // browser carries the stage's own predicate: a bracket that "works on
      // phone and desktop without becoming unreadable" is a claim about
      // rendered geometry, so the suite measures round rows and columns rather
      // than class names.
      'vnext-championship.spec.ts',
      // Stage 7.5's three information-architecture concepts. Same terms again,
      // and the lab adds no dev route at all: it runs on deterministic fixtures,
      // so Storybook is not merely its review surface but its only one.
      'vnext-ia.spec.ts',
    ])
    expect(vnextProjects).toEqual(['vnext-workshop-chromium'])
    expect(vnextConfig).toContain('npm run storybook')
    for (const spec of vnextMatch) {
      expect(
        defaultIgnore,
        'the weekly config must explicitly ignore every Storybook-served spec',
      ).toContain(spec)
    }
  })

  it('parks only the explicit Euro return set and collects none of it in the weekly configs', () => {
    expect(parkedEuroSpecs.length).toBeGreaterThan(5)
    expect(parkedEuroSpecs.filter((spec) => !specFiles.includes(spec))).toEqual([])
    expect(
      parkedEuroSpecs.filter(
        (spec) =>
          defaultSpecs.includes(spec) ||
          authSpecs.includes(spec) ||
          visualSpecs.includes(spec) ||
          vnextSpecs.includes(spec),
      ),
    ).toEqual([])
    expect(
      parkedEuroSpecs.filter((spec) => !defaultIgnore.includes(spec)),
      'every parked Euro journey must be explicitly ignored by the weekly config',
    ).toEqual([])
    expect(defaultConfig).toContain('euro-2028-baseline')
  })

  it('keeps ignore and match lists free of names that no longer exist', () => {
    const stale = [...authMatch, ...euroMatch, ...vnextMatch, ...defaultIgnore].filter(
      (spec) => !specFiles.includes(spec),
    )
    expect(stale, 'config entries naming specs that are not on disk').toEqual([])
  })

  it('gates every spec on a project its owning config declares', () => {
    const wrong: string[] = []

    for (const [spec, gates] of gatesBySpec) {
      // Parked specs are no longer skipped here. They have an owning config now,
      // so "gates on a project its config declares" is a question with an answer
      // for them too — and it is the question that decides whether the Euro
      // suite runs anything at all.
      const parked = parkedEuroSpecs.includes(spec)
      const owner = parked
        ? { projects: euroProjects, config: 'playwright.euro.config.ts' }
        : authSpecs.includes(spec)
          ? { projects: authProjects, config: 'playwright.auth.config.ts' }
          : vnextSpecs.includes(spec)
            ? { projects: vnextProjects, config: 'playwright.vnext.config.ts' }
            : { projects: defaultProjects, config: 'playwright.config.ts' }
      const { projects: declared, config } = owner

      for (const gate of gates) {
        if (!declared.includes(gate)) {
          wrong.push(`${spec} skips unless project is '${gate}', which ${config} does not declare`)
        }
      }
    }

    expect(wrong, `project gates that can skip everywhere:\n${wrong.join('\n')}`).toEqual([])
  })

  it('gives every project gate a stated reason', () => {
    const unexplained: string[] = []

    for (const spec of specFiles) {
      const source = read(`e2e/${spec}`)
      for (const call of source.matchAll(/test\.skip\(\s*testInfo\.project\.name[^)]*\)/g)) {
        const reason = /,\s*'([^']*)'/.exec(call[0])?.[1] ?? ''
        if (reason.length < 20) unexplained.push(`${spec}: ${call[0].slice(0, 60)}`)
      }
    }

    expect(unexplained, 'project gates without a reason for narrowing').toEqual([])
  })

  it('detects a broken gate when one is present', () => {
    expect(
      projectGates("test.skip(testInfo.project.name !== 'no-such-project', 'why')"),
    ).toEqual(['no-such-project'])
    expect(projectGates('const key = testInfo.project.name')).toEqual([])
  })
})
