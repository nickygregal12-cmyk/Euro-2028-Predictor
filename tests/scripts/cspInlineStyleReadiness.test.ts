import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `SEC-002` — measuring the removal of `style-src 'unsafe-inline'` instead of
 * guessing at it.
 *
 * WHERE THIS STANDS, PLAINLY. The ENFORCED policy still permits inline styles.
 * Nothing here claims otherwise, and the risk register row stays open. What
 * changed is that the tightened policy is now SERVED, in report-only mode,
 * beside the enforced one — so real traffic answers the question that a
 * repository search cannot.
 *
 * WHY A SEARCH CANNOT ANSWER IT. Two of the three things that would need the
 * exemption are invisible to `grep`. React's `style={{…}}` prop and Framer
 * Motion's animations both write through the CSSOM (`node.style.setProperty`),
 * which CSP does not govern at all — so the hundreds of `style={{` sites in
 * this repository are irrelevant to the directive, which is the opposite of
 * what the count suggests. And Cloudflare Turnstile is a third-party script
 * that injects into the host document; whether it needs the exemption is a
 * property of somebody else's minified bundle, not of this codebase.
 *
 * MEASURED 20 AUGUST 2026, on a production build served with
 * `style-src 'self'`: zero `style-src` violations across `/`, `/auth/login`,
 * `/auth/signup`, `/auth/reset`, `/about` and the 404 route; the stylesheet
 * applied (`body` background resolved to the `--n-1` token rather than the user
 * agent default); and a CSSOM write still took effect under the same policy,
 * which is the React and Framer Motion case proved rather than reasoned about.
 * **Turnstile was NOT exercised** — `challenges.cloudflare.com` is unreachable
 * from the environment that measurement ran in, so the widget never loaded.
 * That is the one remaining unknown and it is why the tightening is report-only
 * rather than enforced.
 *
 * WHAT THIS FILE GUARDS. That the pair of policies stays interpretable, that
 * the report-only one is actually stricter, that what it finds is collected,
 * and that the application does not acquire the very thing being measured out
 * of while the measurement is running.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const netlifyConfig = readFileSync(resolve(repositoryRoot, 'netlify.toml'), 'utf8')

function policy(header: 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only') {
  // Anchored to the start of the assignment so the enforced header's pattern
  // cannot match the report-only line, which contains it as a prefix.
  const match = netlifyConfig.match(
    new RegExp(`(?:^|\\n)\\s*${header}\\s*=\\s*"([^"]+)"`),
  )
  if (!match?.[1]) throw new Error(`netlify.toml declares no ${header}.`)
  return match[1]
}

function directives(source: string): Map<string, string> {
  const parsed = new Map<string, string>()
  for (const directive of source.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (name) parsed.set(name, sources.join(' '))
  }
  return parsed
}

const enforced = directives(policy('Content-Security-Policy'))
const reportOnly = directives(policy('Content-Security-Policy-Report-Only'))

/**
 * The differences between the two policies that are deliberate.
 *
 * `style-src` and `style-src-attr` ARE the experiment.
 * `upgrade-insecure-requests` is dropped because browsers ignore it in a
 * report-only policy and warn about it in the console — a warning on every page
 * load would be a worse outcome than the directive's absence from a policy that
 * enforces nothing.
 */
const INTENDED_DIFFERENCES = new Set([
  'style-src',
  'style-src-attr',
  'upgrade-insecure-requests',
])

describe('the report-only policy says exactly one thing', () => {
  it('is served beside the enforced policy', () => {
    expect(enforced.size).toBeGreaterThan(5)
    expect(reportOnly.size).toBeGreaterThan(5)
  })

  it('differs from the enforced policy only where the experiment is', () => {
    // A report-only policy that also differed in, say, `connect-src` would
    // produce violations nobody could attribute, and the measurement would mean
    // nothing.
    const names = new Set([...enforced.keys(), ...reportOnly.keys()])
    const differing = [...names].filter(
      (name) => enforced.get(name) !== reportOnly.get(name),
    )
    expect(differing.sort()).toEqual([...INTENDED_DIFFERENCES].sort())
  })

  it('is actually stricter about inline styles, in both forms', () => {
    expect(reportOnly.get('style-src')).toBe("'self'")
    expect(reportOnly.get('style-src')).not.toContain('unsafe-inline')
    // Attributes as well as elements. `style-src-attr` is the half that matters
    // most for injection, and it falls back to `style-src` when absent — so
    // naming it is belt rather than braces, and says the intent out loud.
    expect(reportOnly.get('style-src-attr')).toBe("'none'")
  })

  it('does not ask for a content sample', () => {
    // `report-sample` attaches the first characters of the offending content,
    // and nothing guarantees inline content is free of something a player
    // typed. The directive alone answers the question being asked.
    expect(policy('Content-Security-Policy-Report-Only')).not.toContain('report-sample')
  })

  it('states honestly that the enforced policy is unchanged', () => {
    // The value of this whole exercise is that it does NOT claim to have closed
    // `SEC-002`. If somebody tightens the enforced policy, they must do it
    // deliberately and update the register — not have this file quietly agree.
    expect(enforced.get('style-src')).toBe("'self' 'unsafe-inline'")
  })
})

describe('what the report-only policy finds is collected', () => {
  const observability = readFileSync(
    resolve(repositoryRoot, 'src/services/observability/clientObservability.ts'),
    'utf8',
  )

  it('routes violations into the observability the application already has', () => {
    // Not a second stack and not a second endpoint: a report-only policy nobody
    // reads is a header with no reader.
    expect(observability).toContain('installCspViolationCapture')
    expect(observability).toContain("'csp-violation'")
    expect(observability).toContain("document.addEventListener('securitypolicyviolation'")
  })

  it('is installed by the capture the entry point already calls', () => {
    const capture = observability.slice(
      observability.indexOf('export function installGlobalErrorCapture'),
    )
    expect(capture).toContain('installCspViolationCapture()')
  })

  it('reports only what the report-only policy raised', () => {
    // An ENFORCED block is a real failure and is reported by whatever broke.
    // Reporting it here as well would double-count it and would make the
    // measurement look worse than it is.
    expect(observability).toContain("event.disposition !== 'report'")
  })

  it('sends no sample, matching the policy that asks for none', () => {
    const capture = observability.slice(
      observability.indexOf('export function installCspViolationCapture'),
    )
    expect(capture).not.toContain('event.sample')
  })
})

describe('the application stays ready for the tightened policy', () => {
  /**
   * The ways application code could acquire a genuine need for
   * `'unsafe-inline'`. React's `style` prop is deliberately absent from this
   * list: it writes through the CSSOM and CSP does not govern it.
   */
  const WOULD_NEED_THE_EXEMPTION = [
    { pattern: /createElement\(\s*['"`]style['"`]/, what: "creating a <style> element" },
    { pattern: /setAttribute\(\s*['"`]style['"`]/, what: 'setting a style attribute' },
    { pattern: /dangerouslySetInnerHTML/, what: 'injecting markup that may carry styles' },
    { pattern: /\.innerHTML\s*=/, what: 'injecting markup that may carry styles' },
    { pattern: /insertRule\(/, what: 'inserting a rule into a stylesheet' },
    { pattern: /adoptedStyleSheets/, what: 'adopting a constructed stylesheet' },
  ] as const

  function sourceFiles(directory: string): string[] {
    const found: string[] = []
    for (const entry of readdirSync(directory)) {
      const entryPath = join(directory, entry)
      if (statSync(entryPath).isDirectory()) {
        found.push(...sourceFiles(entryPath))
      } else if (/\.(ts|tsx)$/.test(entry)) {
        found.push(entryPath)
      }
    }
    return found
  }

  it('writes no styles in a way the tightened policy would block', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(resolve(repositoryRoot, 'src'))) {
      const source = readFileSync(file, 'utf8')
      for (const { pattern, what } of WOULD_NEED_THE_EXEMPTION) {
        if (pattern.test(source)) {
          offenders.push(`${file.replace(`${repositoryRoot}/`, '')}: ${what}`)
        }
      }
    }

    expect(
      offenders,
      'these would need `style-src \'unsafe-inline\'`, which SEC-002 is trying ' +
        `to remove:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
