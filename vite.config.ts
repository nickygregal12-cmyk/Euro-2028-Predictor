import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type {} from 'vitest/config'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import {
  applyDocumentHead,
  robotsTxt,
  sitemapXml,
} from './src/app/site/documentMetadata.js'
import { sitePublicMetadata } from './src/app/site/sitePublicMetadata.js'
import { resolveSiteVariant } from './src/app/site/siteVariant.js'

interface DeploymentContract {
  readonly contractVersion: number
}

interface ReleaseMetadata {
  readonly environment: string
  readonly commit: string
  readonly deployId: string
  readonly applicationContract: number
  readonly hostedContract: number | null
  readonly supabaseProjectRef: string | null
}

const contractPath = fileURLToPath(
  new URL('./config/deployment-contract.json', import.meta.url),
)
const deploymentContract = JSON.parse(
  readFileSync(contractPath, 'utf8'),
) as DeploymentContract

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Build-time fail-closed check (docs/auth-plan.md §1): a production build must
  // never carry the dev auto-login flag. This refuses the build outright and
  // complements the runtime guard in src/services/supabase/autoLoginPolicy.ts.
  if (command === 'build' && env.VITE_DEV_AUTOLOGIN === 'true') {
    throw new Error(
      'Refusing to build: VITE_DEV_AUTOLOGIN=true. The dev auto-login shim ' +
        'must never ship in a production build (see docs/auth-plan.md).',
    )
  }

  const releaseMetadata = createReleaseMetadata(env, command)
  const sentrySourceMapsEnabled =
    command === 'build' &&
    readEnvironmentValue(env, 'SENTRY_SOURCEMAPS_ENABLED') === 'true'
  const sentrySourceMapPlugins = sentrySourceMapsEnabled
    ? [
        sentryVitePlugin({
          authToken: requireBuildEnvironmentValue(env, 'SENTRY_AUTH_TOKEN'),
          org: requireBuildEnvironmentValue(env, 'SENTRY_ORG'),
          project: requireBuildEnvironmentValue(env, 'SENTRY_PROJECT'),
          release: {
            // This must match src/services/observability/sentryReporter.ts.
            // A differently named upload succeeds but never de-minifies the
            // browser events, which is a particularly expensive false green.
            name: `euro28@${releaseMetadata.commit}`,
          },
          sourcemaps: {
            assets: './dist/**',
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
          // Build tooling need not emit its own usage telemetry in order to
          // upload application debugging artifacts.
          telemetry: false,
        }),
      ]
    : []

  // ADR 0026's two deployments, resolved once per build. Fails closed to the
  // Hub: an unset or misspelled variable must never build the Euro site, which
  // `EURO-001` requires stay invisible until an owner publishes it.
  const site = sitePublicMetadata(
    resolveSiteVariant(readEnvironmentValue(env, 'VITE_SITE_VARIANT')),
    {
      publicOrigin: readEnvironmentValue(env, 'VITE_PUBLIC_SITE_ORIGIN'),
      siblingOrigin: readEnvironmentValue(env, 'VITE_SIBLING_SITE_ORIGIN'),
    },
  )

  return {
    plugins: [
      react(),
      {
        // The document head, sitemap and robots.txt are per-site facts, so
        // they are generated from one authority rather than authored three
        // times. See src/app/site/documentMetadata.ts for why an unconfigured
        // origin emits nothing rather than a default.
        name: 'euro28-site-metadata',
        transformIndexHtml: {
          order: 'pre' as const,
          handler: (html: string) => applyDocumentHead(html, site),
        },
        generateBundle() {
          const sitemap = sitemapXml(site)
          if (sitemap) {
            this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
          }
          this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(site) })
        },
      },
      {
        name: 'euro28-release-metadata',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'release.json',
            source: `${JSON.stringify(releaseMetadata, null, 2)}\n`,
          })
        },
      },
      // Last, as required by Sentry's bundler integration. Ordinary and local
      // builds omit the plugin entirely; possessing a token is not consent to
      // upload without the explicit SENTRY_SOURCEMAPS_ENABLED switch.
      ...sentrySourceMapPlugins,
    ],
    define: {
      __EURO28_RELEASE__: JSON.stringify(releaseMetadata),
    },
    build: {
      // A trusted upload build produces hidden maps and the plugin deletes
      // them after upload, so Netlify never serves source files publicly.
      // All other builds produce no source maps at all.
      sourcemap: sentrySourceMapsEnabled ? 'hidden' : false,
      // ONE STYLESHEET, BECAUSE SPLITTING IT COST MORE THAN IT SAVED.
      //
      // Vite splits CSS per lazy chunk by default, which is the right instinct
      // for a large application and the wrong one here. Measured at contract
      // 125: 39 chunks, 177.9 KB raw, **44.2 KB gzipped** — and the identical
      // bytes concatenated into one file gzip to **29.2 KB**. Fifteen
      // kilobytes, a third of the CSS budget, was per-file compression loss
      // rather than content.
      //
      // The mechanism is gzip's sliding dictionary: it has to see repetition
      // before it can encode it, so a small file never gets going. Chunks of
      // 2 KB raw and over compressed at ratio 0.23; chunks under 2 KB managed
      // only 0.41, and eighteen of the thirty-nine were under 2 KB.
      // `ConflictBanner.css` was the reductio — 86 bytes raw, **95 bytes
      // gzipped**, larger compressed than not.
      //
      // WHAT THIS COSTS, STATED PLAINLY. Every visitor now downloads every
      // route's styles rather than just the ones they open, so first paint
      // waits on ~29 KB instead of ~12. That is the trade accepted here, and
      // it is only defensible at this size: the conventional threshold for
      // splitting CSS to earn its keep is around 50 KB, and the whole
      // application's styles are well under it. Revisit if that stops being
      // true — the fix would be to split deliberately along a measured
      // boundary rather than to let the bundler split per route again.
      //
      // Nothing about how styles are authored changes. CSS Modules still scope
      // per component; only the number of files the browser fetches does.
      cssCodeSplit: false,
    },
    // Honour a PORT assigned by the environment (e.g. the preview harness) so
    // the dev server binds where callers expect it; falls back to Vite's default
    // for a plain `npm run dev`.
    server: process.env.PORT
      ? { port: Number(process.env.PORT), strictPort: true }
      : undefined,
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      // CI invokes deterministic small shards in separate processes. Keep each
      // shard serial as a second memory bound; local runs retain normal parallel
      // worker selection for faster feedback.
      maxWorkers: process.env.CI ? 1 : undefined,
      fileParallelism: process.env.CI ? false : undefined,
      // Playwright owns the real-browser suite. Keeping it out of Vitest prevents
      // either runner from interpreting the other runner's test API.
      exclude: [...configDefaults.exclude, 'e2e/**', 'production-smoke/**'],
      // ACQ-R20. Thresholds are enforced for `src/domain/**` only, and only by
      // the dedicated `test:coverage:domain` script. CI runs the main suite one
      // file per process for memory isolation, where a coverage threshold would
      // be evaluated per file and fail on every one of them. The domain tier is
      // also where a threshold means most: it is pure logic with no rendering,
      // so a drop is a real gap rather than an untested component.
      // Scoped to what `tests/domain` alone achieves, not what the whole suite
      // reaches. The full suite covers `src/domain` to 97.6% lines because
      // feature and service tests exercise it incidentally; domain tests alone
      // reach 94.7%. Enforcing the narrower figure is the stronger contract —
      // it asserts the pure logic carries its own tests rather than being
      // covered by accident from a component render.
      //
      // Measured 30 July 2026 from `tests/domain`: statements 92.2%, branches
      // 85.7%, functions 96.6%, lines 94.7%. Thresholds sit below those as a
      // ratchet against regression, not as a target.
      coverage: {
        provider: 'v8',
        include: ['src/domain/**'],
        thresholds: {
          statements: 90,
          branches: 83,
          functions: 95,
          lines: 92,
        },
      },
    },
  }
})

function createReleaseMetadata(
  env: Record<string, string>,
  command: 'build' | 'serve',
): ReleaseMetadata {
  const hostedContractValue = readEnvironmentValue(
    env,
    'EURO28_DEPLOYED_DB_CONTRACT',
  )
  const hostedContract = /^\d+$/.test(hostedContractValue)
    ? Number(hostedContractValue)
    : null

  return {
    environment:
      readEnvironmentValue(env, 'CONTEXT') ||
      (command === 'serve' ? 'dev' : 'local'),
    commit:
      readEnvironmentValue(env, 'COMMIT_REF') ||
      readEnvironmentValue(env, 'GITHUB_SHA') ||
      'local',
    deployId: readEnvironmentValue(env, 'DEPLOY_ID') || 'local',
    applicationContract: deploymentContract.contractVersion,
    hostedContract,
    supabaseProjectRef: projectRefFromUrl(
      readEnvironmentValue(env, 'VITE_SUPABASE_URL'),
    ),
  }
}

function readEnvironmentValue(
  env: Record<string, string>,
  name: string,
): string {
  return (process.env[name] ?? env[name] ?? '').trim()
}

function requireBuildEnvironmentValue(
  env: Record<string, string>,
  name: 'SENTRY_AUTH_TOKEN' | 'SENTRY_ORG' | 'SENTRY_PROJECT',
): string {
  const value = readEnvironmentValue(env, name)
  if (!value) {
    throw new Error(
      `SENTRY_SOURCEMAPS_ENABLED=true requires the build-only ${name} value.`,
    )
  }
  return value
}

function projectRefFromUrl(value: string): string | null {
  if (!value) return null

  try {
    const hostname = new URL(value).hostname
    const suffix = '.supabase.co'
    return hostname.endsWith(suffix)
      ? hostname.slice(0, -suffix.length)
      : null
  } catch {
    return null
  }
}
