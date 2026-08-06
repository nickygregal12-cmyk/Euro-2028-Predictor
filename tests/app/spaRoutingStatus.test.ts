import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appSource, declaredRoutes, routePaths } from './declaredRoutes'

const repositoryRoot = resolve(import.meta.dirname, '../..')

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const netlifyConfig = readRepositoryFile('netlify.toml')

/**
 * Route paths declared in src/App.tsx, parsed by the shared reader.
 *
 * This file used to carry its own regex, and it required `<Route path=` on one
 * line. `/competitions/:competitionSlug/:seasonSlug` is wrapped across lines,
 * so it was never in this list — and consequently never in the redirect table
 * either. Netlify answered the competition dashboard with the catch-all's 404
 * while the SPA rendered it, which is the exact soft-status inversion this file
 * exists to catch.
 */
const appRoutes = declaredRoutes

type Redirect = { from: string; status: number }

const redirects: Redirect[] = [
  ...netlifyConfig.matchAll(
    /\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/g,
  ),
].map((match) => ({ from: match[1], to: match[2], status: Number(match[3]) }))

const okRoutes = redirects.filter((rule) => rule.status === 200).map((rule) => rule.from)

describe('SPA routing answers a real status per path', () => {
  it('versions the Netlify build command and publish directory', () => {
    expect(netlifyConfig).toMatch(
      /\[build\]\s*\n\s*command = "npm run build"\s*\n\s*publish = "dist"/,
    )
    expect(netlifyConfig.match(/^\s*command\s*=/gm)).toHaveLength(1)
    expect(netlifyConfig.match(/^\s*publish\s*=/gm)).toHaveLength(1)
  })

  it('finds the application routes and the redirect rules', () => {
    expect(appRoutes.length).toBeGreaterThan(20)
    expect(redirects.length).toBe(appRoutes.length + 1)
  })

  it('answers 200 for every real application route', () => {
    expect([...okRoutes].sort()).toEqual([...appRoutes].sort())
  })

  it('answers 404 for unknown paths instead of a soft 200', () => {
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
    expect(netlifyConfig).not.toMatch(/^\s*force\s*=/m)
  })

  it('orders static routes ahead of parameterised siblings', () => {
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
    const smoke = readRepositoryFile('scripts/production-smoke.mjs')

    expect(smoke).toContain("fetchText(notFoundProbe, 404)")
    expect(smoke).toMatch(/expectedStatus = 200/)
    expect(smoke).toMatch(/response\.status !== expectedStatus/)
    const okRouteList = smoke.slice(
      smoke.indexOf('const routes = ['),
      smoke.indexOf(']', smoke.indexOf('const routes = [')),
    )
    expect(okRouteList).not.toContain('not-found-probe')
  })

  it('keeps the dev-only previews out of the production rules', () => {
    const devRoutes = routePaths(appSource).filter((route) => route.startsWith('/dev/'))

    expect(devRoutes.length).toBeGreaterThan(0)
    for (const devRoute of devRoutes) {
      expect(okRoutes).not.toContain(devRoute)
      expect(appSource).toMatch(
        new RegExp(`import\\.meta\\.env\\.DEV[^\\n]*\\n\\s*<Route path="${devRoute}"`),
      )
    }
  })
})
