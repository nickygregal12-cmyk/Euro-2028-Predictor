import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/browser-e2e.yml'), 'utf8')
const productionWorkflow = readFileSync(
  resolve(root, '.github/workflows/production-smoke.yml'),
  'utf8',
)
const productionSmoke = readFileSync(resolve(root, 'scripts/production-smoke.mjs'), 'utf8')
const bonusGamesCatalogue = readFileSync(
  resolve(root, 'scripts/bonus-games/publish-catalogue.sql'),
  'utf8',
)
const anonymousBrowserSmoke = readFileSync(
  resolve(root, 'production-smoke/anonymous.spec.ts'),
  'utf8',
)
const globalSetup = readFileSync(resolve(root, 'e2e/global-setup.ts'), 'utf8')
const localFixtures = readFileSync(resolve(root, 'e2e/local-supabase.ts'), 'utf8')
const bonusGamesFixture = readFileSync(
  resolve(root, 'e2e/bonus-games-fixture.sql'),
  'utf8',
)
const bonusGamesSpec = readFileSync(resolve(root, 'e2e/bonus-games.spec.ts'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
}

const forbiddenHostedRefs = [
  'vkfnsqdyhvtwyqkisxhk',
  'iouzoutneyjpugbbtdem',
  'gcfdwobpnanjchcnvdco',
]

const [authenticatedWorkflow, previewWorkflow = ''] = workflow.split(
  '\n  deploy-preview-smoke:',
)
const authenticatedBrowserHarness =
  `${authenticatedWorkflow}\n${globalSetup}\n${localFixtures}\n${bonusGamesFixture}\n${bonusGamesSpec}`

describe('authenticated browser E2E workflow', () => {
  it('uses a disposable local Supabase rebuild and Playwright Chromium', () => {
    expect(authenticatedWorkflow).toContain('supabase start')
    expect(authenticatedWorkflow).toContain('supabase db reset --local')
    expect(authenticatedWorkflow).toContain('supabase stop --no-backup')
    expect(authenticatedWorkflow).toContain('playwright install --with-deps chromium')
    expect(authenticatedWorkflow).toContain('npm run test:e2e')
    expect(authenticatedWorkflow).toContain('playwright-report')
  })

  it('publishes the canonical Bonus Games catalogue only inside disposable browser E2E', () => {
    expect(authenticatedWorkflow).toContain('scripts/bonus-games/publish-catalogue.sql')
    expect(authenticatedWorkflow).toContain('e2e/bonus-games-fixture.sql')
    expect(authenticatedWorkflow).toContain(
      "DB_CONTAINER='supabase_db_euro-2028-predictor-local'",
    )
    expect(authenticatedWorkflow).toContain('--set=ON_ERROR_STOP=1')
    expect(authenticatedWorkflow).toContain(
      'grant select on table public.bonus_competitions to service_role',
    )
    expect(bonusGamesFixture).toContain('It must never run against a hosted DB.')
    expect(bonusGamesFixture).toContain("match.match_ref = 'R16-1'")
  })

  it('keeps one browser lifecycle for every delivered Bonus Game', () => {
    expect(bonusGamesSpec).toContain(
      'KO Predictor registration, scoreline save and standings work end to end',
    )
    expect(bonusGamesSpec).toContain(
      'Last Man Standing registration and first-round pick work end to end',
    )
    expect(bonusGamesSpec).toContain(
      'Predictor Cup registration shares knockout predictions and reaches the draw state',
    )
    for (const route of [
      '/games/knockout',
      '/games/ko-predictor',
      '/games/lms',
      '/games/cup',
    ]) {
      expect(bonusGamesSpec).toContain(route)
    }
  })

  it('keeps the repeatable catalogue SQL parse-safe and shape-checked', () => {
    expect(bonusGamesCatalogue).toContain(
      'v_competitions <> 3 or v_windows <> 14 or v_fixtures <> 102',
    )
    expect(bonusGamesCatalogue).not.toMatch(/public\.bonus_competition_windows\s+window\b/)
    expect(bonusGamesCatalogue).not.toContain('select window.id')
  })

  it('contains no hosted Supabase project reference', () => {
    for (const ref of forbiddenHostedRefs) {
      expect(authenticatedBrowserHarness).not.toContain(ref)
    }
  })

  it('guards admin fixtures to standard HTTP loopback Supabase', () => {
    expect(localFixtures).toContain("parsed.protocol !== 'http:'")
    expect(localFixtures).toContain(
      "['127.0.0.1', 'localhost'].includes(parsed.hostname)",
    )
    expect(localFixtures).toContain("LOCAL_SUPABASE_PORT = '54321'")
    expect(localFixtures).toContain('parsed.port !== LOCAL_SUPABASE_PORT')
  })

  it('pins the Playwright dependency and exposes stable scripts', () => {
    expect(packageJson.devDependencies['@playwright/test']).toBe('1.61.1')
    expect(packageJson.scripts['test:e2e']).toBe('playwright test')
    expect(packageJson.scripts['test:e2e:install']).toBe(
      'playwright install --with-deps chromium',
    )
  })
})

describe('deploy-preview browser smoke workflow', () => {
  it('waits for the exact PR head and refuses a hosted database ahead of the application', () => {
    expect(previewWorkflow).toContain(
      'deploy-preview-${{ github.event.pull_request.number }}--euro28predictor.netlify.app',
    )
    expect(previewWorkflow).toContain(
      'EXPECTED_COMMIT: ${{ github.event.pull_request.head.sha }}',
    )
    expect(previewWorkflow).toContain('EXPECTED_SUPABASE_REF: iouzoutneyjpugbbtdem')
    expect(previewWorkflow).toContain(
      "require('./config/deployment-contract.json').contractVersion",
    )
    expect(previewWorkflow).toContain("release.environment === 'deploy-preview'")
    expect(previewWorkflow).toContain(
      'release.applicationContract === expectedContract',
    )
    expect(previewWorkflow).toContain('release.hostedContract <= expectedContract')
    expect(previewWorkflow).not.toContain(
      'release.hostedContract === expectedContract',
    )
  })

  it('runs database-backed smoke only when the hosted contract is aligned', () => {
    expect(previewWorkflow).toContain('id: preview-release')
    expect(previewWorkflow).toContain("echo 'database_ready=true' >> \"$GITHUB_OUTPUT\"")
    expect(previewWorkflow).toContain("echo 'database_ready=false' >> \"$GITHUB_OUTPUT\"")
    expect(previewWorkflow).toContain(
      "if: steps.preview-release.outputs.database_ready == 'true'",
    )
    expect(previewWorkflow).toContain(
      'Hosted database preview unavailable until the development rollout applies contract',
    )
    expect(previewWorkflow).toContain('EURO28_SMOKE_EXPECTED_CONTRACT=$EXPECTED_CONTRACT')
  })

  it('retains both read-only smoke entry points', () => {
    expect(previewWorkflow).toContain('npm run smoke:production')
    expect(previewWorkflow).toContain('npm run smoke:production:browser')
    expect(packageJson.scripts['smoke:production']).toBe(
      'node scripts/production-smoke.mjs',
    )
    expect(packageJson.scripts['smoke:production:browser']).toBe(
      'playwright test --config=playwright.production.config.ts',
    )
  })
})

describe('target-specific production smoke contracts', () => {
  it('requires an explicit contract in both smoke implementations', () => {
    for (const smokeSource of [productionSmoke, anonymousBrowserSmoke]) {
      expect(smokeSource).toContain('EURO28_SMOKE_EXPECTED_CONTRACT')
      expect(smokeSource).toContain('parseExpectedContract')
      expect(smokeSource).not.toContain('applicationContract: 35')
      expect(smokeSource).not.toContain('hostedContract: 35')
    }
    expect(productionSmoke).not.toContain('const APPLICATION_CONTRACT')
  })

  it('keeps production smoke manual and release-specific at the current contract', () => {
    expect(productionWorkflow).toContain('workflow_dispatch:')
    expect(productionWorkflow).not.toMatch(/^\s+push:/m)
    expect(productionWorkflow).not.toMatch(
      /^\s*EXPECTED_CONTRACT:\s*'?\d+'?\s*$/m,
    )
    expect(productionWorkflow).toContain('Wait for the exact milestone production release')
    expect(productionWorkflow).toContain('expected_commit:')
    expect(productionWorkflow).toContain(
      'EXPECTED_COMMIT: ${{ inputs.expected_commit }}',
    )
    expect(productionWorkflow).toContain(
      'expected_commit must be an exact 40-character Git SHA',
    )
    expect(productionWorkflow).toContain('EURO28_SMOKE_EXPECTED_CONTRACT=$EXPECTED_CONTRACT')
    expect(productionWorkflow).toContain('EURO28_SMOKE_EXPECTED_COMMIT=$EXPECTED_COMMIT')
  })
})
