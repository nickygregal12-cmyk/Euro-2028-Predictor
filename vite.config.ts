/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
      // Playwright owns the real-browser suite. Keeping it out of Vitest prevents
      // either runner from interpreting the other runner's test API.
      exclude: [...configDefaults.exclude, 'e2e/**', 'production-smoke/**'],
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
