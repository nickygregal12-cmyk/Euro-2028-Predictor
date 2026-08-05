import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `VITE_*` surface must stay consistent across the three places that describe
 * it: the code that reads it, the type declarations, and the operator-facing
 * documentation.
 *
 * `src/vite-env.d.ts` exists for "typed access to the env vars", but Vite's own
 * `ImportMetaEnv` carries an index signature, so an undeclared variable still
 * compiles — as `any`, silently losing the typing the file is there to provide.
 * `VITE_TURNSTILE_SITE_KEY` and `VITE_TURNSTILE_DEV_TOKEN` were read by the
 * application and absent from the interface for exactly that reason: nothing
 * failed.
 *
 * `.env.example` is required to list every variable the application reads. That
 * was an owner decision: the three `VITE_SENTRY_*` variables were operational
 * detail described only in `docs/ops-sentry.md`, so the template silently was not
 * the complete list its header implies. They now appear in both, and this test
 * requires the template rather than accepting a runbook instead — otherwise the
 * template can quietly go incomplete again, which is the failure it exists to
 * prevent.
 *
 * Operational depth still belongs in `docs/ops-*.md`; the template only has to
 * name the variable and say what it does.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

/** Every `import.meta.env.VITE_*` the application reads. */
function readByApplication(): Set<string> {
  const names = new Set<string>()
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const entryPath = join(directory, entry)
      if (statSync(entryPath).isDirectory()) {
        walk(entryPath)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry) || entry.endsWith('.d.ts')) continue
      for (const match of readFileSync(entryPath, 'utf8').matchAll(
        /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g,
      )) {
        names.add(match[1])
      }
    }
  }
  walk(resolve(repositoryRoot, 'src'))
  return names
}

/** Every `VITE_*` declared on the `ImportMetaEnv` interface. */
function declaredInTypes(): Set<string> {
  const source = readRepositoryFile('src/vite-env.d.ts')
  const body = source.slice(
    source.indexOf('interface ImportMetaEnv'),
    source.indexOf('interface ImportMeta '),
  )
  return new Set(
    [...body.matchAll(/readonly (VITE_[A-Z0-9_]+)\??:/g)].map((m) => m[1]),
  )
}

/** Every `VITE_*` assigned in the local template. */
function documentedInTemplate(): Set<string> {
  return new Set(
    [...readRepositoryFile('.env.example').matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map(
      (m) => m[1],
    ),
  )
}

describe('VITE_* environment variable contract', () => {
  it('finds the variables at all', () => {
    // Without this, a changed access pattern would empty the comparison and make
    // every assertion below pass vacuously.
    expect(readByApplication().size).toBeGreaterThan(5)
    expect(declaredInTypes().size).toBeGreaterThan(5)
  })

  it('types every variable the application reads', () => {
    // Vite's index signature means an undeclared variable compiles as `any`, so
    // only this check keeps `vite-env.d.ts` honest.
    const untyped = [...readByApplication()]
      .filter((name) => !declaredInTypes().has(name))
      .sort()

    expect(untyped).toEqual([])
  })

  it('declares no type for a variable the application never reads', () => {
    // The other direction: a declaration outliving its last reader is stale.
    const unread = [...declaredInTypes()]
      .filter((name) => !readByApplication().has(name))
      .sort()

    expect(unread).toEqual([])
  })

  it('lists every variable the application reads in the local template', () => {
    // `.env.example` says "Copy this file to .env.local and fill in real values",
    // so a variable the app reads and the template omits makes that header a lie.
    const missing = [...readByApplication()]
      .filter((name) => !documentedInTemplate().has(name))
      .sort()

    expect(missing).toEqual([])
  })

  it('names the Sentry variables the template previously omitted', () => {
    // Pinned so they cannot drop back out of the template into docs-only status.
    for (const name of [
      'VITE_SENTRY_ENABLED',
      'VITE_SENTRY_DSN',
      'VITE_SENTRY_VERIFICATION_EVENT',
    ]) {
      expect([...documentedInTemplate()]).toContain(name)
    }
  })

  it('keeps the local template free of variables nothing reads', () => {
    const stale = [...documentedInTemplate()]
      .filter((name) => !readByApplication().has(name))
      .sort()

    expect(stale).toEqual([])
  })

  it('never assigns a real value to a secret-shaped variable in the template', () => {
    // `.env.example` is committed. Placeholders only.
    const template = readRepositoryFile('.env.example')
    for (const match of template.matchAll(
      /^(VITE_[A-Z0-9_]*(?:KEY|TOKEN|PASSWORD|DSN)[A-Z0-9_]*)=(.*)$/gm,
    )) {
      const [, name, value] = match
      expect(
        value.trim(),
        `${name} must stay a placeholder in .env.example`,
      ).not.toMatch(/^(eyJ|sb_|sbp_|https:\/\/[a-z0-9]+@)/)
    }
  })

  /**
   * Hosted builds may switch a route flag on, but only where it was meant to.
   *
   * `netlify.toml` turns the public landing page on for deploy previews, so a
   * reviewer clicking the preview link sees the page under review rather than
   * the redirect it replaces. That convenience is one edit away from becoming
   * an unreviewed production exposure — `[context.deploy-preview.environment]`
   * and `[build.environment]` differ by one word — and the flag's whole value
   * is that turning it on is a deliberate, separate act from merging.
   */
  describe('hosted route-flag exposure', () => {
    const netlify = readRepositoryFile('netlify.toml')

    it('switches the landing page on for deploy previews', () => {
      expect(netlify).toMatch(
        /\[context\.deploy-preview\.environment\][\s\S]*?VITE_UI_PUBLIC_LANDING\s*=\s*"true"/,
      )
    })

    it('never switches a route flag on in the shared build environment', () => {
      // `[build.environment]` applies to production as well as previews, so a
      // route flag set there is on for players — which is exactly the decision
      // the flag exists to keep separate from merging a pull request.
      const buildEnvironment = netlify.slice(
        netlify.indexOf('[build.environment]'),
        netlify.indexOf('[context.'),
      )

      expect(
        buildEnvironment,
        'a VITE_UI_* route flag is set in [build.environment], which production also reads',
      ).not.toMatch(/VITE_UI_/)
    })

    it('scopes every hosted route flag to the deploy-preview context', () => {
      // Any other context — production, branch-deploy — setting a UI route flag
      // is an exposure decision that must not arrive as a build-config edit.
      for (const match of netlify.matchAll(/\[context\.([a-z-]+)\.environment\]([\s\S]*?)(?=\n\[|$)/g)) {
        const [, context, body] = match
        if (!/VITE_UI_/.test(body)) continue
        expect(
          context,
          `${context} sets a VITE_UI_* route flag; only deploy-preview may`,
        ).toBe('deploy-preview')
      }
    })
  })
})
