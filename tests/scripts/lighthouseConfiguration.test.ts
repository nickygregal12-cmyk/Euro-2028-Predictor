import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Lighthouse configuration, against the reasons it is shaped this way.
 *
 * THE DEFECT THIS EXISTS FOR is a measurement pointed at the wrong thing. The
 * deploy preview reported a performance score of 20 on two consecutive pull
 * requests that changed no runtime code whatsoever, while the same bundle
 * scores 89–95 when built and served locally. A configuration that collected
 * from a preview URL would keep reporting infrastructure as product quality,
 * and every reader would go looking for a regression in code that had not
 * changed. So the collect step must build and serve the application itself,
 * which is what makes a score attributable to a commit — and that property is
 * asserted here rather than left to a comment nobody re-reads.
 *
 * The assertion levels are the other half. Three runs per route damp shared
 * runner noise; the committed floors sit below the measured minimum and now
 * block regressions. Accessibility remains exact at 100.
 *
 * `docs/quality/lighthouse-baseline.md` records the scores and the reasoning.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

const config = JSON.parse(readFileSync(resolve(repositoryRoot, 'lighthouserc.json'), 'utf8')) as {
  ci: {
    collect: {
      startServerCommand?: string
      url: string[]
      staticDistDir?: string
      numberOfRuns?: number
    }
    assert: { assertions: Record<string, unknown> }
  }
}

const manifest = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
) as { scripts: Record<string, string>; devDependencies: Record<string, string> }
const ciWorkflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/ci.yml'),
  'utf8',
)

const { collect, assert: assertions } = config.ci

function level(audit: string): string {
  const value = assertions.assertions[audit]
  return Array.isArray(value) ? String(value[0]) : String(value)
}

describe('the Lighthouse configuration measures this repository', () => {
  it('is runnable through a named script', () => {
    expect(manifest.scripts['check:lighthouse']).toBeDefined()
    expect(manifest.devDependencies['@lhci/cli']).toBeDefined()
  })

  it('installs and identifies the Chromium binary before CI audits', () => {
    expect(ciWorkflow).toContain('npx playwright install --with-deps chromium')
    expect(ciWorkflow).toContain('CHROME_PATH=')
    expect(ciWorkflow.indexOf('CHROME_PATH=')).toBeLessThan(
      ciWorkflow.indexOf('npm run check:lighthouse'),
    )
  })

  /**
   * The script has to build, and it has to build with configuration present.
   *
   * `check:lighthouse` was `lhci autorun` alone, and on a clean checkout that
   * did not work: the application throws `Missing Supabase configuration` at
   * module load, Vite inlines those variables at BUILD time so they cannot be
   * supplied to an existing `dist`, and the audit died on a bare `NO_FCP`.
   * The command in the quality documentation was unrunnable by anyone without
   * a `.env.local` — including, had it been promoted as it stood, CI.
   */
  describe('the audit runs on a build that renders', () => {
    const runner = readFileSync(resolve(repositoryRoot, 'scripts/run-lighthouse.mjs'), 'utf8')

    it('builds before auditing, because the configuration is inlined at build time', () => {
      expect(manifest.scripts['check:lighthouse']).toContain('scripts/run-lighthouse.mjs')
      expect(runner).toMatch(/\['run', 'build'\]/)
      expect(runner.indexOf("'build'")).toBeLessThan(runner.indexOf("'lhci'"))
    })

    it('fills in Supabase configuration only when the caller supplied none', () => {
      // Vite gives shell variables precedence over `.env` files, so overriding
      // unconditionally would audit a different configuration than the one the
      // developer is working on and silently report it as theirs.
      expect(runner).toMatch(/if \(environment\[name\]\) continue/)
    })

    it('points the placeholder at a host that can never resolve', () => {
      // RFC 2606 reserves `.invalid`. If an audited route ever starts
      // depending on the network, it must fail here rather than quietly
      // measure somebody's live project.
      const url = runner.match(/VITE_SUPABASE_URL: '([^']+)'/)?.[1]
      expect(url, 'the runner declares no placeholder Supabase URL').toBeDefined()
      expect(url).toMatch(/\.invalid$/)
    })

    it('does not re-guard the blank page Lighthouse already refuses to score', () => {
      // Measured: a build with the variables removed aborts with NO_FCP and
      // `lhci autorun` exits 1, writing no report. An assertion on top of that
      // would be guarding a failure that cannot reach it.
      expect(runner).toMatch(/NO_FCP/)
      expect(runner).not.toMatch(/dom-size/)
    })
  })

  it('audits a locally served build rather than a deployed URL', () => {
    // The whole point. A remote host in this list means the numbers describe
    // someone else's infrastructure on the day they were taken.
    expect(collect.startServerCommand, 'nothing serves the build under audit').toBeDefined()
    for (const url of collect.url) {
      expect(url, `${url} is not local`).toMatch(/^http:\/\/localhost/)
    }
  })

  it('audits routes a production build can actually serve unauthenticated', () => {
    // Everything else redirects to the authenticated shell, so auditing it
    // would score a redirect and call it a page.
    expect(collect.url.length).toBeGreaterThan(0)
    for (const url of collect.url) {
      expect(url, `${url} is not an unauthenticated route`).toMatch(/\/auth\//)
    }
  })

  it('repeats every route enough to absorb a noisy runner', () => {
    expect(collect.numberOfRuns).toBe(3)
  })

  it('blocks on accessibility at the standard the rest of the repository holds', () => {
    const accessibility = assertions.assertions['categories:accessibility'] as [
      string,
      { minScore: number },
    ]
    expect(accessibility[0]).toBe('error')
    expect(accessibility[1].minScore).toBe(1)
  })

  it('blocks measured performance and best-practice regressions', () => {
    expect(level('categories:performance')).toBe('error')
    expect(level('categories:best-practices')).toBe('error')
  })

  it('keeps the harness-caused console error visible without blocking on it', () => {
    // The audited build carries placeholder credentials and no reachable
    // backend, so the signup page logs one failed request every run. Blocking
    // would fail the check for a property of the harness; switching it off
    // would hide a second, real error if one ever appeared.
    expect(level('errors-in-console')).toBe('warn')
  })

  it('publishes the baseline the run produced', () => {
    const baseline = readFileSync(resolve(repositoryRoot, 'docs/quality/lighthouse-baseline.md'), 'utf8')
    for (const route of collect.url) {
      const path = new URL(route).pathname
      expect(baseline, `${path} has no recorded baseline`).toContain(path)
    }
  })
})
