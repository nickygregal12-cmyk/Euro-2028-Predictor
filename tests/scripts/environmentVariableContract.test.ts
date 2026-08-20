import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

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
        names.add(at(match, 1))
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
    [...body.matchAll(/readonly (VITE_[A-Z0-9_]+)\??:/g)].map((m) => at(m, 1)),
  )
}

/** Every `VITE_*` assigned in the local template. */
function documentedInTemplate(): Set<string> {
  return new Set(
    [...readRepositoryFile('.env.example').matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map(
      (m) => at(m, 1),
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
        (value ?? '').trim(),
        `${name} must stay a placeholder in .env.example`,
      ).not.toMatch(/^(eyJ|sb_|sbp_|https:\/\/[a-z0-9]+@)/)
    }
  })

  /**
   * Hosted builds may switch a route flag on, and the authority for doing it is
   * a record rather than a habit.
   *
   * ============================ WHAT THIS USED TO SAY, AND WHY IT CHANGED ==
   *
   * It used to refuse any `VITE_UI_*` in `[build.environment]` outright, on the
   * grounds that the shared environment is read by PRODUCTION and that "the
   * flag's whole value is that turning it on is a deliberate, separate act from
   * merging". That reasoning is exactly right and it is not withdrawn.
   *
   * What changed is that the deliberate act happened. The Football Hub cutover
   * is authorised in `config/vnext-programme.json`, with the preconditions it
   * was gated on recorded beside it. A rule that could only ever refuse would
   * have had to be DELETED at the moment the programme reached its own goal,
   * and a guard deleted on the one day it matters was never a guard.
   *
   * So it is re-pointed rather than removed: a route flag may appear in the
   * shared build environment only while the cutover is authorised, and the
   * authorisation has to be a value in the programme record — which is a file a
   * reviewer reads, in a commit somebody signed off, rather than one word
   * changed in a build config.
   */
  describe('hosted route-flag exposure', () => {
    const netlify = readRepositoryFile('netlify.toml')
    const programme = JSON.parse(readRepositoryFile('config/vnext-programme.json')) as {
      productionCutoverAuthorized?: boolean
    }
    const buildEnvironment = netlify.slice(
      netlify.indexOf('[build.environment]'),
      netlify.indexOf('[context.') === -1 ? undefined : netlify.indexOf('[context.'),
    )

    it('sets a route flag in the shared environment only while the cutover is authorised', () => {
      const flags = [...buildEnvironment.matchAll(/(VITE_UI_[A-Z_]+)\s*=\s*"([^"]*)"/g)]
      if (flags.length === 0) return

      expect(
        programme.productionCutoverAuthorized,
        'netlify.toml switches route flags on for PRODUCTION, and ' +
          'config/vnext-programme.json does not authorise the cutover. One of the two is ' +
          'wrong, and the build config is not the authority.',
      ).toBe(true)
    })

    it('switches every flag it sets on rather than half-on', () => {
      // A `VITE_UI_*` in the shared environment set to anything but "true" is a
      // line that reads as a switch and behaves as a comment: the flag reader
      // fails closed, so `"false"`, `"1"` or an empty value are all the legacy
      // journey. If a destination is meant to be off, the line is meant to be
      // absent — which is what a reviewer can see.
      for (const [, name, value] of buildEnvironment.matchAll(
        /(VITE_UI_[A-Z_]+)\s*=\s*"([^"]*)"/g,
      )) {
        expect(value, `${name} is set in [build.environment] and is not "true"`).toBe('true')
      }
    })

    it('names every shared flag in the environment contract, so none is invented here', () => {
      // A flag set in the build config that `vite-env.d.ts` and `.env.example`
      // do not declare is a variable nothing reads — an exposure decision that
      // does nothing, which is worse than one that does something.
      for (const [, name] of buildEnvironment.matchAll(/(VITE_UI_[A-Z_]+)\s*=/g)) {
        expect([...declaredInTypes()], `${name} is set in netlify.toml and declared nowhere`).toContain(
          name,
        )
      }
    })

    it('scopes any per-context route flag to the deploy-preview context', () => {
      // The original rule, unchanged, for the contexts BELOW the shared one. A
      // production or branch-deploy block turning a flag on is still an exposure
      // decision arriving as a build-config edit, and the shared environment is
      // now the one reviewable place for it.
      for (const match of netlify.matchAll(/\[context\.([a-z-]+)\.environment\]([\s\S]*?)(?=\n\[|$)/g)) {
        const [, context, body] = match
        if (body === undefined || !/VITE_UI_/.test(body)) continue
        expect(
          context,
          `${context} sets a VITE_UI_* route flag; only deploy-preview may`,
        ).toBe('deploy-preview')
      }
    })
  })
})
