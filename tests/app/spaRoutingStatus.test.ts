import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const appSource = readRepositoryFile('src/App.tsx')
const netlifyConfig = readRepositoryFile('netlify.toml')

/**
 * Route paths declared in src/App.tsx. `/dev/*` previews are excluded because
 * they are `import.meta.env.DEV`-gated and absent from a production build, and
 * the catch-all `*` is the SPA's own not-found route rather than a real path.
 */
const appRoutes = [...appSource.matchAll(/<Route path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path !== '*' && !path.startsWith('/dev/'))

type Redirect = { from: string; status: number }

const redirects: Redirect[] = [
  ...netlifyConfig.matchAll(
    /\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/g,
  ),
].map((match) => ({ from: match[1], to: match[2], status: Number(match[3]) }))

const okRoutes = redirects.filter((rule) => rule.status === 200).map((rule) => rule.from)

describe('SPA routing answers a real status per path', () => {
  it('finds the application routes and the redirect rules', () => {
    // Guards the parsing itself: a silently empty match set would make every
    // assertion below vacuously pass.
    expect(appRoutes.length).toBeGreaterThan(20)
    expect(redirects.length).toBe(appRoutes.length + 1)
  })

  it('answers 200 for every real application route', () => {
    expect([...okRoutes].sort()).toEqual([...appRoutes].sort())
  })

  it('answers 404 for unknown paths instead of a soft 200', () => {
    // SEO-001: the catch-all used to be status 200, so every nonexistent URL
    // presented as a real indexable page.
    const catchAll = redirects.filter((rule) => rule.from === '/*')

    expect(catchAll).toHaveLength(1)
    expect(catchAll[0]?.status).toBe(404)
    expect(redirects.at(-1)?.from).toBe('/*')
  })

  it('rewrites every path to the SPA entry point', () => {
    for (const rule of redirects) {
      expect(rule).toMatchObject({ to: '/index.html' })
    }
  })

  it('never forces a rule over a real file', () => {
    // Netlify serves an existing file before applying a redirect unless the
    // rule sets `force`. Forcing here would shadow /assets/*, /release.json,
    // /robots.txt and /sitemap.xml.
    expect(netlifyConfig).not.toMatch(/^\s*force\s*=/m)
  })

  it('orders static routes ahead of parameterised siblings', () => {
    // Netlify applies the first matching rule, so `/league/:id` placed before
    // `/league/overall` would make the static route unreachable.
    const positionOf = (path: string) => okRoutes.indexOf(path)

    for (const parameterised of okRoutes.filter((path) => path.includes(':'))) {
      const prefix = parameterised.slice(0, parameterised.lastIndexOf('/') + 1)
      const shadowed = okRoutes.filter(
        (path) =>
          path !== parameterised &&
          !path.includes(':') &&
          path.startsWith(prefix) &&
          !path.slice(prefix.length).includes('/'),
      )

      for (const staticSibling of shadowed) {
        expect(
          positionOf(staticSibling),
          `${staticSibling} must be listed before ${parameterised}`,
        ).toBeLessThan(positionOf(parameterised))
      }
    }
  })

  it('makes production smoke assert the hosted 404 rather than tolerate it', () => {
    // The committed config and the hosted behaviour are separate claims. The
    // smoke script previously fetched the not-found probe expecting 200 like
    // every other route, so a regression to a soft 200 would have passed.
    const smoke = readRepositoryFile('scripts/production-smoke.mjs')

    expect(smoke).toContain("fetchText(notFoundProbe, 404)")
    expect(smoke).toMatch(/expectedStatus = 200/)
    expect(smoke).toMatch(/response\.status !== expectedStatus/)
    // The probe must not sit in the list that expects 200.
    const okRouteList = smoke.slice(
      smoke.indexOf('const routes = ['),
      smoke.indexOf(']', smoke.indexOf('const routes = [')),
    )
    expect(okRouteList).not.toContain('not-found-probe')
  })

  it('keeps the dev-only previews out of the production rules', () => {
    const devRoutes = [...appSource.matchAll(/<Route path="(\/dev\/[^"]*)"/g)].map((m) => m[1])

    expect(devRoutes.length).toBeGreaterThan(0)
    for (const devRoute of devRoutes) {
      expect(okRoutes).not.toContain(devRoute)
      // Each one must genuinely be DEV-gated, or excluding it would 404 a
      // route that ships.
      expect(appSource).toMatch(
        new RegExp(`import\\.meta\\.env\\.DEV[^\\n]*\\n\\s*<Route path="${devRoute}"`),
      )
    }
  })
})
