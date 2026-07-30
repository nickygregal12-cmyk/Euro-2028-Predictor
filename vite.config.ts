import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type {} from 'vitest/config'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

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

  return {
    plugins: [
      react(),
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
    ],
    define: {
      __EURO28_RELEASE__: JSON.stringify(releaseMetadata),
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
