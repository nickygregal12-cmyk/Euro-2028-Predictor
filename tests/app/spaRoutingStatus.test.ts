import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appSource, declaredRoutes, routePaths } from './declaredRoutes'
import { at } from '../support/indexed'

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

// `to` was always captured by the pattern below and never declared, because
// until now every rule pointed at the same document and the field said nothing.
// `/join/:code` makes it load-bearing.
type Redirect = { from: string; to: string; status: number }

const redirects: Redirect[] = [
  ...netlifyConfig.matchAll(
    /\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/g,
  ),
].map((match) => ({ from: at(match, 1), to: at(match, 2), status: Number(at(match, 3)) }))

const okRoutes = redirects.filter((rule) => rule.status === 200).map((rule) => rule.from)

/**
 * Paths that answer 200 but are NOT application routes.
 *
 * `/status` is a static document the build emits, and deliberately not a React
 * route: it has to stay readable on the occasion the application does not boot,
 * which is the only occasion anybody reads it. Listed explicitly so a third such
 * path cannot appear without this line changing.
 */
const staticDocumentRoutes = ['/status']

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
    // + the static documents, + the `/*` catch-all.
    expect(redirects.length).toBe(appRoutes.length + staticDocumentRoutes.length + 1)
  })

  it('answers 200 for every real application route, and for nothing else unnamed', () => {
    expect([...okRoutes].sort()).toEqual([...appRoutes, ...staticDocumentRoutes].sort())
  })

  it('answers 404 for unknown paths instead of a soft 200', () => {
    const catchAll = redirects.filter((rule) => rule.from === '/*')

    expect(catchAll).toHaveLength(1)
    expect(catchAll[0]?.status).toBe(404)
    expect(redirects.at(-1)?.from).toBe('/*')
  })

  it('rewrites every path to a document this build actually emits', () => {
    // NARROWED FROM "everything goes to /index.html", and narrowed rather than
    // deleted. The old form was the right invariant while one document existed;
    // `/join/:code` has its own, because an invite is the one link players paste
    // where a crawler unfurls it and the site's own card is the wrong answer for
    // it. `/status` has its own because it is not the application at all — it is
    // a static record that must stay readable when the application does not boot.
    // What must not happen is a route quietly diverging, so each exception is
    // named rather than allowed by class.
    for (const rule of redirects) {
      expect(['/index.html', '/join.html', '/status.html']).toContain(rule.to)
    }

    // Each divergence is NAMED, never allowed by class. A second document was
    // always going to arrive; what this stops is a third arriving unnoticed.
    const diverging = redirects.filter((rule) => rule.to !== '/index.html')
    expect(diverging.map((rule) => rule.from)).toEqual(['/join/:code', '/status'])
  })

  it('sends the invite route to the invite document, which the build emits', () => {
    // Both halves, because either alone passes while the pair is broken: a
    // redirect to a document Vite does not write is a blank page for everyone
    // who follows an invitation, and it fails in production only.
    const invite = redirects.find((rule) => rule.from === '/join/:code')
    expect(invite?.to).toBe('/join.html')
    expect(invite?.status).toBe(200)

    const viteConfig = readFileSync(resolve(repositoryRoot, 'vite.config.ts'), 'utf8')
    expect(viteConfig).toContain('INVITE_DOCUMENT_PATH')
    expect(viteConfig).toContain('inviteShareCard')
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
