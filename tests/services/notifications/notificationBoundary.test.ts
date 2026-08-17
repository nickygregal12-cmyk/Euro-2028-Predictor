import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Where notification code is allowed to be, and where its secret is not.
 *
 * Three properties, each of which would be easy to break with a single import
 * and impossible to notice afterwards:
 *
 *   NO SECRET IN THE CLIENT  `NOVU_API_KEY` is a full-authority secret. Vite
 *                            inlines any `VITE_`-prefixed variable into the
 *                            browser bundle, so a `VITE_NOVU_*` name anywhere
 *                            would publish the credential to every visitor.
 *
 *   NO PRESENTATION COUPLING vNext, Storybook and the design system must not
 *                            know notifications exist. A story that imports
 *                            this stops being deterministic, and a page that
 *                            does stops rendering when a provider is down.
 *
 *   NO PROVIDER SDK          the adapter uses `fetch`. A provider package in
 *                            package.json would be one import away from the
 *                            measured production bundle.
 */

const repositoryRoot = process.cwd()

function tracked(...patterns: string[]): string[] {
  return execFileSync('git', ['ls-files', ...patterns], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

function read(file: string): string {
  return readFileSync(resolve(repositoryRoot, file), 'utf8')
}

const NOTIFICATION_MODULE = '_shared/notifications'

describe('notification secret containment', () => {
  it('declares no VITE_-prefixed notification variable where one could take effect', () => {
    // Scoped to the places a `VITE_` name actually does something: the tree
    // Vite bundles, and the files a deployment declares environment in.
    //
    // The test tree is deliberately excluded, and the reason is not
    // convenience. `notificationService.test.ts` passes `VITE_NOVU_API_KEY`
    // to the resolver precisely to prove it is IGNORED, and this file names
    // the pattern it searches for. Both are assertions that the variable has
    // no power; neither is ever bundled. Scanning them would make the guard
    // fire on the evidence that the thing it guards against does not happen.
    const offenders = tracked(
      'src/**/*.ts',
      'src/**/*.tsx',
      'index.html',
      'vite.config.ts',
      'vite.analyze.config.ts',
      '.env.example',
      'netlify.toml',
      '.github/workflows/*.yml',
      'config/*.json',
    ).filter((file) => /VITE_(?:NOVU|NOTIFICATIONS)/.test(read(file)))

    expect(offenders).toEqual([])
  })

  it('scans a surface that actually exists', () => {
    // A glob that matches nothing makes the guard above pass vacuously, which
    // is the failure mode of every path-based check.
    const scanned = tracked(
      'src/**/*.ts',
      'index.html',
      'vite.config.ts',
      '.env.example',
      'netlify.toml',
      '.github/workflows/*.yml',
    )
    expect(scanned.length).toBeGreaterThan(20)
    expect(scanned).toContain('.env.example')
  })

  it('keeps .env.example free of a real-looking credential', () => {
    const template = read('.env.example')
    // The template documents the names. It must never carry a value.
    const assignments = template
      .split('\n')
      .filter((line) => /^\s*NOVU_API_KEY\s*=/.test(line))

    for (const line of assignments) {
      expect(line.split('=').slice(1).join('=').trim()).toBe('')
    }
  })

  it('never reads the credential through import.meta.env', () => {
    const offenders = tracked('src/**/*.ts', 'src/**/*.tsx').filter((file) =>
      /import\.meta\.env[^\n]*(?:NOVU|NOTIFICATIONS_DELIVERY)/.test(read(file)),
    )
    expect(offenders).toEqual([])
  })
})

describe('notification presentation boundary', () => {
  it('is not reachable from vNext', () => {
    // src/vnext/AGENTS.md: the presentation lane has no service dependency,
    // and Storybook determinism depends on that staying true.
    const offenders = tracked('src/vnext/**/*.ts', 'src/vnext/**/*.tsx').filter(
      (file) => read(file).includes(NOTIFICATION_MODULE),
    )
    expect(offenders).toEqual([])
  })

  it('is not reachable from Storybook or any story', () => {
    const offenders = [...tracked('.storybook/**/*.ts'), ...tracked('src/**/*.stories.tsx')]
      .filter((file) => read(file).includes(NOTIFICATION_MODULE))
    expect(offenders).toEqual([])
  })

  it('is not reachable from the legacy design system', () => {
    const offenders = tracked('src/design-system/**/*.ts', 'src/design-system/**/*.tsx')
      .filter((file) => read(file).includes(NOTIFICATION_MODULE))
    expect(offenders).toEqual([])
  })

  it('is imported by no React component', () => {
    // Direct provider calls scattered through components is the exact shape
    // the boundary exists to prevent. Emission belongs to whatever owns the
    // domain fact, not to a render.
    const offenders = tracked('src/**/*.tsx').filter((file) =>
      read(file).includes(NOTIFICATION_MODULE),
    )
    expect(offenders).toEqual([])
  })
})

describe('notification provider dependency', () => {
  it('adds no provider SDK to the application dependency graph', () => {
    const manifest = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const declared = Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    })

    expect(declared.filter((name) => name.startsWith('@novu/'))).toEqual([])
    expect(declared).not.toContain('novu')
  })
})
