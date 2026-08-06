import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Which browser journeys actually execute, and under which Playwright project.
 *
 * Two mechanisms decide that, and both are plain string literals that nothing
 * validates:
 *
 * 1. The spec/config partition. `playwright.config.ts` lists `testIgnore` and
 *    `playwright.auth.config.ts` lists `testMatch`, by filename, by hand. They
 *    are meant to be exact complements over `e2e/*.spec.ts`. Add a spec to the
 *    ignore list and forget the match list and it runs under **no** config —
 *    committed, present, and never executed. CI stays green because a suite
 *    that never collects a spec cannot fail on it.
 *
 * 2. The per-project gates. Thirteen specs narrow themselves with
 *    `test.skip(testInfo.project.name !== 'desktop-chromium', ...)` so a
 *    stateful journey runs once rather than once per viewport. The literal must
 *    name a project the *owning* config declares — and the two configs have
 *    disjoint project names (`desktop-chromium` vs `auth-desktop-chromium`).
 *    Rename a project, or move a spec between configs, and the condition is
 *    true everywhere: the test skips in every project and reports green.
 *
 * Both failures are silent and both hit the journeys that matter most — the
 * locked-state rejection, the bracket snapshot conflict, the entry-creation
 * race, the private-league lifecycle, the administrator results flow. Those are
 * the tests that would notice a real regression, and they are precisely the
 * ones sitting behind a hand-typed string.
 *
 * `authRecoveryE2E.test.ts` checks the partition for the three signed-out specs
 * it names. This generalises it: the rule holds for every spec on disk, so a
 * new one cannot slip through by not being on anybody's list.
 */

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

/** Filenames inside a `testMatch: [...]` or `testIgnore: [...]` array literal. */
function specList(config: string, key: 'testMatch' | 'testIgnore'): string[] {
  const body = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(config)?.[1] ?? ''
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1])
}

/** Project names declared in a config's `projects: [...]`. */
function projectNames(config: string): string[] {
  const body = config.slice(config.indexOf('projects: ['))
  return [...body.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1])
}

const authMatch = specList(authConfig, 'testMatch')
const visualMatch = specList(visualConfig, 'testMatch')
const defaultIgnore = specList(defaultConfig, 'testIgnore')

const defaultProjects = projectNames(defaultConfig)
const authProjects = projectNames(authConfig)

/** The specs each config actually collects, derived rather than restated. */
const authSpecs = specFiles.filter((spec) => authMatch.includes(spec))
const visualSpecs = specFiles.filter((spec) => visualMatch.includes(spec))
const defaultSpecs = specFiles.filter((spec) => !defaultIgnore.includes(spec))

/**
 * Every `test.skip(testInfo.project.name !== '<project>')` gate, per spec.
 *
 * Only the comparison form is collected. `admin-results.spec.ts` and three
 * others also pass `testInfo.project.name` through as a value — a fixture key
 * or a retry suffix — which decides nothing about whether a test runs.
 */
function projectGates(source: string): string[] {
  return [...source.matchAll(/project\.name\s*!==\s*'([^']+)'/g)].map((match) => match[1])
}

const gatesBySpec = new Map(
  specFiles.map((spec) => [spec, projectGates(read(`e2e/${spec}`))] as const),
)

describe('browser E2E project gating', () => {
  it('parses both configs, so nothing below compares empty sets', () => {
    // Without this a reformatted config — a trailing comma on its own line, a
    // renamed key — would empty every list and turn each assertion into a
    // comparison of two empty arrays.
    expect(specFiles.length).toBeGreaterThan(15)
    expect(authMatch.length).toBeGreaterThan(0)
    expect(defaultIgnore.length).toBeGreaterThan(0)
    expect(defaultProjects).toEqual(['desktop-chromium', 'mobile-chromium'])
    expect(authProjects).toEqual(['auth-desktop-chromium', 'auth-mobile-chromium'])
  })

  it('runs every spec on disk under exactly one config', () => {
    const orphaned = specFiles.filter(
      (spec) =>
        !authSpecs.includes(spec) && !defaultSpecs.includes(spec) && !visualSpecs.includes(spec),
    )

    expect(
      orphaned,
      `these specs exist in e2e/ but no Playwright config collects them — they are ` +
        `ignored by playwright.config.ts and absent from the auth and visual ` +
        `configs' testMatch, so they never run and never fail: ${orphaned.join(', ')}`,
    ).toEqual([])

    const doubled = [...authSpecs, ...visualSpecs].filter((spec) => defaultSpecs.includes(spec))

    expect(
      doubled,
      `these specs run under both configs — the signed-out harness and the ` +
        `auto-logged-in one — which means one of the two runs them against the ` +
        `wrong session state: ${doubled.join(', ')}`,
    ).toEqual([])
  })

  it('keeps the ignore and match lists free of names that no longer exist', () => {
    // A stale entry is not harmless: it makes the two lists look like
    // complements while the spec it names has been renamed or deleted, so the
    // next reader trusts a partition that no longer covers what it claims to.
    const stale = [...authMatch, ...defaultIgnore].filter((spec) => !specFiles.includes(spec))

    expect(stale, 'config entries naming specs that are not on disk').toEqual([])
  })

  it('gates every spec on a project its own config declares', () => {
    // This is also the reachability check. A separate "at least one declared
    // project can run this spec" assertion was written and then deleted: with
    // every gate declared and the gate list non-empty, some declared project is
    // always named, so it could never fail on its own. An assertion that cannot
    // fail independently is the shape this file exists to catch, and shipping
    // one here would have been the joke telling itself.
    const wrong: string[] = []

    for (const [spec, gates] of gatesBySpec) {
      const declared = authSpecs.includes(spec) ? authProjects : defaultProjects
      const config = authSpecs.includes(spec) ? 'playwright.auth.config.ts' : 'playwright.config.ts'

      for (const gate of gates) {
        if (!declared.includes(gate)) {
          wrong.push(`${spec} skips unless project is '${gate}', which ${config} does not declare`)
        }
      }
    }

    expect(
      wrong,
      `a gate naming a project that does not exist is true in every project, so ` +
        `the test skips everywhere and the run still reports green:\n${wrong.join('\n')}`,
    ).toEqual([])
  })

  it('gives every project gate a stated reason', () => {
    // `test.skip(condition)` with no message is valid Playwright and produces a
    // skipped test with no explanation in the report, which is how a temporary
    // narrowing becomes permanent.
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
    // The parser's own positive control. Every assertion above passes when
    // `projectGates` returns nothing, which is exactly what a changed idiom
    // would cause — so prove it still recognises the shape it looks for.
    expect(
      projectGates("test.skip(testInfo.project.name !== 'no-such-project', 'why')"),
    ).toEqual(['no-such-project'])
    expect(projectGates('const key = testInfo.project.name')).toEqual([])
  })
})
