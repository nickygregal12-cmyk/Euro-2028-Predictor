import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALLOWED_SENTRY_INGEST_SUFFIXES } from '../../src/services/observability/sentryReporter'

/**
 * Parity between the committed Content-Security-Policy and what the application
 * actually needs to load.
 *
 * `netlify.toml` warns that the allow-list "MUST permit everything the app
 * actually loads, or real functionality breaks", and then lists the origins by
 * hand. Nothing checked it: no test in the repository read the CSP at all.
 *
 * The sharpest case is Sentry. `sentryReporter.ts` carries its own allow-list of
 * accepted DSN ingest hosts, and the CSP `connect-src` carries the same three
 * hosts. Add a region to one side only and the failure is silent — the reporter
 * accepts the DSN, the browser blocks the envelope as a CSP violation, and
 * telemetry simply stops arriving with no application error to notice.
 *
 * `scripts/production-smoke.mjs` already asserts a few hardening directives
 * against the *deployed* headers. This checks the *committed* policy against the
 * application's own requirements, which is a different question and a much
 * earlier failure point.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const netlifyConfig = readFileSync(resolve(repositoryRoot, 'netlify.toml'), 'utf8')

function contentSecurityPolicy(): string {
  const match = netlifyConfig.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)
  if (!match) throw new Error('netlify.toml declares no Content-Security-Policy.')
  return match[1]
}

/** The policy as directive name → source list. */
function directives(): Map<string, string[]> {
  const parsed = new Map<string, string[]>()
  for (const directive of contentSecurityPolicy().split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (name) parsed.set(name, sources)
  }
  return parsed
}

function sources(directive: string): string[] {
  return directives().get(directive) ?? []
}

/** Whether any application source file references a host. */
function referencesHost(host: string): boolean {
  const walk = (directory: string): boolean => {
    for (const entry of readdirSync(directory)) {
      const entryPath = join(directory, entry)
      if (statSync(entryPath).isDirectory()) {
        if (walk(entryPath)) return true
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue
      if (readFileSync(entryPath, 'utf8').includes(host)) return true
    }
    return false
  }
  return walk(resolve(repositoryRoot, 'src'))
}

/** Hosts a source list permits, reduced to a comparable suffix. */
function sentryHostsIn(directive: string): string[] {
  return sources(directive)
    .filter((source) => source.includes('sentry.io'))
    .map((source) => source.replace(/^https:\/\/\*/, ''))
    .sort()
}

describe('Content-Security-Policy parity with application requirements', () => {
  it('declares a policy at all', () => {
    // Guards every assertion below against a silently absent header block.
    expect(contentSecurityPolicy()).toContain('default-src')
    expect(directives().size).toBeGreaterThan(5)
  })

  it('permits exactly the Sentry ingest hosts the reporter accepts', () => {
    // Both directions. A CSP host the reporter rejects is a dead permission; a
    // reporter host the CSP omits blocks envelopes silently.
    expect(sentryHostsIn('connect-src')).toEqual(
      [...ALLOWED_SENTRY_INGEST_SUFFIXES].sort(),
    )
  })

  it('permits Supabase REST and Realtime, which the client needs both of', () => {
    // The project ref comes from the environment at build time, so the policy
    // has to cover it by wildcard rather than by literal host.
    expect(sources('connect-src')).toContain('https://*.supabase.co')
    expect(sources('connect-src')).toContain('wss://*.supabase.co')
  })

  it('permits Turnstile wherever the application references it', () => {
    // Scanned rather than read from a fixed path, so moving or renaming the
    // widget cannot quietly turn this assertion off. Conditional on the
    // application actually loading Turnstile, so the policy can be tightened if
    // that dependency is ever removed.
    expect(referencesHost('challenges.cloudflare.com')).toBe(true)
    // The loader script and the widget iframe are separate directives; missing
    // either one breaks the widget in a different way.
    expect(sources('script-src')).toContain('https://challenges.cloudflare.com')
    expect(sources('frame-src')).toContain('https://challenges.cloudflare.com')
  })

  it('keeps fonts and images self-hosted rather than reaching a CDN', () => {
    // Fonts are bundled woff2 and flags are bundled SVG; an external font or
    // image origin appearing here would mean an unnoticed third-party request on
    // the critical path.
    expect(sources('font-src')).toEqual(["'self'"])
    expect(sources('img-src')).toEqual(["'self'", 'data:'])
  })

  it('never permits eval or a wildcard default source', () => {
    const policy = contentSecurityPolicy()

    expect(policy).not.toContain("'unsafe-eval'")
    expect(sources('default-src')).toEqual(["'self'"])
    expect(sources('object-src')).toEqual(["'none'"])
    expect(sources('frame-ancestors')).toEqual(["'none'"])
  })

  it('lists no origin the application never references', () => {
    // Catches a permission surviving the removal of whatever needed it. Supabase
    // and Sentry are covered above; everything else must appear in src/.
    const externalHosts = [...new Set(
      [...contentSecurityPolicy().matchAll(/https:\/\/([a-z0-9.*-]+)/g)].map(
        (match) => match[1],
      ),
    )].filter(
      (host) => !host.endsWith('supabase.co') && !host.endsWith('sentry.io'),
    )

    expect(externalHosts).toEqual(['challenges.cloudflare.com'])
  })
})
