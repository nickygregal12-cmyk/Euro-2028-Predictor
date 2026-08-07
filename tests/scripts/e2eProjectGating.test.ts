import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARKED_EURO_SPECS } from '../../scripts/select-browser-journeys.mjs'

const root = resolve(import.meta.dirname, '../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

const defaultConfig = read('playwright.config.ts')
const authConfig = read('playwright.auth.config.ts')
const visualConfig = read('playwright.visual.config.ts')

const specFiles = readdirSync(resolve(root, 'e2e'))
  .filter((entry) => entry.endsWith('.spec.ts'))
  .sort()
const parkedEuroSpecs = [...(PARKED_EURO_SPECS as string[])].sort()

function specList(config: string, key: 'testMatch' | 'testIgnore'): string[] {
  const body = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(config)?.[1] ?? ''
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1])
}

function projectNames(config: string): string[] {
  const body = config.slice(config.indexOf('projects: ['))
  return [...body.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1])
}

const authMatch = specList(authConfig, 'testMatch')
const visualMatch = specList(visualConfig, 'testMatch')
const defaultIgnore = specList(defaultConfig, 'testIgnore')

const defaultProjects = projectNames(defaultConfig)
const authProjects = projectNames(authConfig)

const authSpecs = specFiles.filter((spec) => authMatch.includes(spec))
const visualSpecs = specFiles.filter((spec) => visualMatch.includes(spec))
const defaultSpecs = specFiles.filter((spec) => !defaultIgnore.includes(spec))

function projectGates(source: string): string[] {
  return [...source.matchAll(/project\.name\s*!==\s*'([^']+)'/g)].map((match) => match[1])
}

const gatesBySpec = new Map(
  specFiles.map((spec) => [spec, projectGates(read(`e2e/${spec}`))] as const),
)

describe('browser E2E project gating', () => {
  it('parses the active configs', () => {
    expect(specFiles.length).toBeGreaterThan(15)
    expect(authMatch.length).toBeGreaterThan(0)
    expect(defaultIgnore.length).toBeGreaterThan(0)
    expect(defaultProjects).toEqual(['desktop-chromium', 'mobile-chromium'])
    expect(authProjects).toEqual(['auth-desktop-chromium', 'auth-mobile-chromium'])
  })

  it('runs every active spec under exactly one config', () => {
    const active = specFiles.filter((spec) => !parkedEuroSpecs.includes(spec))
    const orphaned = active.filter(
      (spec) =>
        !authSpecs.includes(spec) && !defaultSpecs.includes(spec) && !visualSpecs.includes(spec),
    )
    expect(orphaned, `active specs collected by no Playwright config: ${orphaned.join(', ')}`).toEqual([])

    const doubled = [...authSpecs, ...visualSpecs].filter((spec) => defaultSpecs.includes(spec))
    expect(doubled, `active specs collected by two configs: ${doubled.join(', ')}`).toEqual([])
  })

  it('parks only the explicit Euro return set and collects none of it in the weekly configs', () => {
    expect(parkedEuroSpecs.length).toBeGreaterThan(5)
    expect(parkedEuroSpecs.filter((spec) => !specFiles.includes(spec))).toEqual([])
    expect(
      parkedEuroSpecs.filter(
        (spec) => defaultSpecs.includes(spec) || authSpecs.includes(spec) || visualSpecs.includes(spec),
      ),
    ).toEqual([])
    expect(
      parkedEuroSpecs.filter((spec) => !defaultIgnore.includes(spec)),
      'every parked Euro journey must be explicitly ignored by the weekly config',
    ).toEqual([])
    expect(defaultConfig).toContain('euro-2028-baseline')
  })

  it('keeps ignore and match lists free of names that no longer exist', () => {
    const stale = [...authMatch, ...defaultIgnore].filter((spec) => !specFiles.includes(spec))
    expect(stale, 'config entries naming specs that are not on disk').toEqual([])
  })

  it('gates every active spec on a project its owning config declares', () => {
    const wrong: string[] = []

    for (const [spec, gates] of gatesBySpec) {
      if (parkedEuroSpecs.includes(spec)) continue
      const declared = authSpecs.includes(spec) ? authProjects : defaultProjects
      const config = authSpecs.includes(spec) ? 'playwright.auth.config.ts' : 'playwright.config.ts'

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
