import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {} from 'vitest/config'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import {
  applyDocumentHead,
  inviteShareCard,
  INVITE_DOCUMENT_PATH,
  robotsTxt,
  sitemapXml,
} from './src/app/site/documentMetadata.js'
import {
  SITE_ICON_FILES,
  faviconSvg,
  siteIconDirectory,
  siteIconMark,
} from './src/app/site/siteIcons.js'
import { sitePublicMetadata } from './src/app/site/sitePublicMetadata.js'
import { resolveSiteVariant } from './src/app/site/siteVariant.js'
import {
  WEB_APP_MANIFEST_PATH,
  webAppManifestJson,
} from './src/app/site/webAppManifest.js'
import {
  SERVICE_WORKER_PATH,
  buildServiceWorker,
  serviceWorkerVersion,
} from './src/app/pwa/buildServiceWorker.js'

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

  // Development only; a production build emits the same set from
  // `generateBundle`. Built once per config so the middleware closes over it.
  const siteFile = siteFileFactory(site)

  return {
    plugins: [
      react(),
      {
        // The document head, sitemap, robots.txt, icons and web app manifest
        // are per-site facts, so they are generated from one authority rather
        // than authored several times. See src/app/site/documentMetadata.ts for
        // why an unconfigured origin emits nothing rather than a default, and
        // src/app/site/siteIcons.ts for why the icons cannot live in public/.
        name: 'euro28-site-metadata',
        transformIndexHtml: {
          order: 'pre' as const,
          handler: (html: string) => applyDocumentHead(html, site),
        },
        // `public/` is copied verbatim into BOTH deployments, so the per-variant
        // files are served from here in development too. Without this the dev
        // server 404s the manifest and every icon, and the install experience
        // would be untestable anywhere but a production build.
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const path = (request.url ?? '').split('?')[0]
            const bytes = siteFile(path)
            if (!bytes) return next()
            response.setHeader('Content-Type', contentTypeOf(path))
            response.end(bytes)
          })
        },
        generateBundle() {
          const sitemap = sitemapXml(site)
          if (sitemap) {
            this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
          }
          this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(site) })
          this.emitFile({
            type: 'asset',
            fileName: WEB_APP_MANIFEST_PATH.slice(1),
            source: webAppManifestJson(site),
          })
          this.emitFile({
            type: 'asset',
            fileName: 'favicon.svg',
            source: faviconSvg(siteIconMark(site.variant), site.productName),
          })
          for (const file of SITE_ICON_FILES) {
            this.emitFile({
              type: 'asset',
              fileName: file,
              source: readFileSync(
                fileURLToPath(
                  new URL(
                    `./${siteIconDirectory(site.variant)}/${file}`,
                    import.meta.url,
                  ),
                ),
              ),
            })
          }
        },
      },
      {
        // ADR 0016 Phase 1's offline shell. AFTER the site-metadata plugin, so
        // the manifest and favicon it precaches have already been emitted.
        //
        // WHAT GOES IN, AND WHY IT IS NOT EVERYTHING. The document, the entry
        // chunk and its static imports, the single stylesheet and the latin
        // font subsets — the bytes a cold start needs before it can render
        // anything at all. Lazily-imported route chunks are NOT precached:
        // there are over a hundred of them, most players open a handful in a
        // week, and an install that downloads the whole application is a worse
        // trade than a route that has to be online the first time it is opened.
        // They are cached on first use instead, by the same worker.
        //
        // The `latin-ext` font subsets are left out for the same reason: they
        // exist for accented names the browser requests only when it meets one,
        // and precaching them adds nearly a hundred kilobytes to every install
        // for glyphs most matchweeks never show.
        name: 'euro28-service-worker',
        // POST, so the single stylesheet exists. Vite's own CSS plugin emits it
        // during `generateBundle`, which means an ordinary plugin can run
        // before the asset it needs to name is in the bundle — and a shell
        // precached without its stylesheet renders unstyled offline.
        enforce: 'post' as const,
        async generateBundle(_options, bundle) {
          const files = Object.values(bundle)
          const entry = files.find(
            (file) => file.type === 'chunk' && file.isEntry,
          )
          const staticGraph = new Set<string>()
          const walk = (fileName: string) => {
            if (staticGraph.has(fileName)) return
            staticGraph.add(fileName)
            const chunk = bundle[fileName]
            if (chunk && chunk.type === 'chunk') chunk.imports.forEach(walk)
          }
          if (entry) walk(entry.fileName)

          const precache = [
            '/index.html',
            ...[...staticGraph].map((fileName) => `/${fileName}`),
            ...files
              .filter(
                (file) =>
                  file.type === 'asset' &&
                  (file.fileName.endsWith('.css') ||
                    (file.fileName.endsWith('.woff2') &&
                      !file.fileName.includes('latin-ext'))),
              )
              .map((file) => `/${file.fileName}`),
            WEB_APP_MANIFEST_PATH,
            '/favicon.svg',
          ].sort()

          this.emitFile({
            type: 'asset',
            fileName: SERVICE_WORKER_PATH.slice(1),
            source: await buildServiceWorker({
              precache,
              version: serviceWorkerVersion(releaseMetadata.commit, precache),
            }),
          })
        },
        // THE INVITE DOCUMENT, BUILT FROM THE BUILT ONE.
        //
        // `/join/:code` is the one address whose social card must differ, and
        // `index.html` cannot carry two heads. So the emitted document is
        // re-headed into a second file, and Netlify rewrites `/join/*` onto it.
        //
        // IT IS DERIVED, NOT AUTHORED. A hand-written second template would
        // need every script and stylesheet tag Vite injected, and the first
        // hash it missed would be an invite page that loads nothing — the exact
        // failure the person following the link cannot report, because to them
        // the site is simply blank. Taking the finished bytes and swapping only
        // the managed block makes the two impossible to drift apart.
        //
        // WHICH HOOK, AND WHY IT READS THE BUNDLE RATHER THAN THE DISK.
        // Measured rather than assumed, because both plausible answers are
        // wrong in different ways:
        //
        //   * at `generateBundle` the bundle holds only `assets/*` — the
        //     document does not exist yet, and an `emitFile` there silently has
        //     nothing to copy;
        //   * at `writeBundle` the document is present BOTH in the bundle and
        //     on disk.
        //
        // So this takes it from the bundle. Reading `dist/index.html` back off
        // the filesystem would work today and would make the build depend on
        // when Vite happens to flush it, which is an internal detail and not a
        // promise. The in-memory asset is the same bytes with no such
        // dependency, and the guard below fails loudly if a future version
        // stops providing it rather than emitting an invite page from nothing.
      },
      {
        // ITS OWN PLUGIN, AND THE NAME IS THE POINT.
        //
        // This used to be a second hook on `euro28-service-worker`, which made
        // it invisible to the one mechanism that keeps app-document concerns
        // out of the component workbench: `.storybook/main.ts` filters the
        // application's plugins BY NAME through `APP_ONLY_VITE_PLUGINS`, and a
        // hook hidden inside another plugin's name cannot be filtered.
        //
        // Storybook builds `iframe.html` and never an `index.html`, so the
        // guard below — correct and load-bearing for the application build —
        // fired on every Storybook build and failed it. The guard is unchanged;
        // what changed is that the workbench no longer inherits it.
        name: 'euro28-invite-document',
        writeBundle(options, bundle) {
          const directory = options.dir
          if (!directory) throw new Error('The build has no output directory to write into.')

          const document = bundle['index.html']
          if (!document || document.type !== 'asset') {
            throw new Error(
              'index.html is not among the written bundle assets, so the invite ' +
                'document cannot be derived from it. An authored copy would drift ' +
                'from the built one on the next hashed asset.',
            )
          }

          writeFileSync(
            resolve(directory, INVITE_DOCUMENT_PATH.slice(1)),
            applyDocumentHead(String(document.source), site, inviteShareCard(site)),
          )
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

/**
 * One of this build's generated per-site files, or null for any other path.
 *
 * Development only. A production build emits these through `generateBundle`;
 * this is the same set answered from memory so `npm run dev`, the Playwright
 * suites and a local install test all see the site they are building rather
 * than a 404.
 */
function siteFileFactory(
  site: ReturnType<typeof sitePublicMetadata>,
): (path: string) => Buffer | string | null {
  return (path: string) => {
    if (path === WEB_APP_MANIFEST_PATH) return webAppManifestJson(site)
    if (path === '/favicon.svg') {
      return faviconSvg(siteIconMark(site.variant), site.productName)
    }
    const file = SITE_ICON_FILES.find((name) => path === `/${name}`)
    if (!file) return null
    return readFileSync(
      fileURLToPath(
        new URL(`./${siteIconDirectory(site.variant)}/${file}`, import.meta.url),
      ),
    )
  }
}

function contentTypeOf(path: string): string {
  if (path.endsWith('.webmanifest')) return 'application/manifest+json'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.ico')) return 'image/x-icon'
  return 'image/png'
}
