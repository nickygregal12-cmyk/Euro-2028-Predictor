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
const shippingE2eEnv = readFileSync(resolve(root, '.env.e2e'), 'utf8')
const shippingVNextSpec = readFileSync(resolve(root, 'e2e/shipping-vnext.spec.ts'), 'utf8')
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
    expect(authenticatedWorkflow).toContain('uses: ./.github/actions/start-local-supabase')
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

  it('runs the normal authenticated suite with the shipping Football Hub vNext route switches', () => {
    expect(packageJson.scripts['test:e2e']).toBe(
      'node --env-file=.env.e2e node_modules/@playwright/test/cli.js test',
    )
    expect(shippingE2eEnv).toContain('VITE_SITE_VARIANT=hub')
    for (const name of [
      'HOME',
      'MATCHES',
      'GAMES',
      'LEAGUES',
      'PLAYER_PROFILE',
      'DISCOVERY',
      'ACCOUNT',
      'LMS',
      'CHAMPIONSHIP',
      'PREDICTOR',
    ]) {
      expect(shippingE2eEnv).toContain(`VITE_UI_FOOTBALL_HUB_${name}=true`)
    }
    expect(shippingVNextSpec).toContain('[data-vnext-shell]')
    expect(shippingVNextSpec).toContain('legacy application shell')
  })

  it('pins the Playwright dependency and exposes stable scripts', () => {
    expect(packageJson.devDependencies['@playwright/test']).toBe('1.62.1')
    expect(packageJson.scripts['test:e2e:install']).toBe(
      'playwright install --with-deps chromium',
    )
  })
})

describe('protected Netlify deploy-preview workflow', () => {
  it('runs only for pull requests that target main', () => {
    expect(previewWorkflow).toContain(
      "if: github.event_name == 'pull_request' && github.base_ref == 'main'",
    )
  })

  it('waits for Netlify success on the exact PR head', () => {
    expect(workflow).toContain('statuses: read')
    expect(previewWorkflow).toContain(
      'deploy-preview-${{ github.event.pull_request.number }}--euro28predictor.netlify.app',
    )
    expect(previewWorkflow).toContain(
      'EXPECTED_COMMIT: ${{ github.event.pull_request.head.sha }}',
    )
    expect(previewWorkflow).toContain(
      'STATUS_CONTEXT: netlify/euro28predictor/deploy-preview',
    )
    expect(previewWorkflow).toContain('commits/$EXPECTED_COMMIT/status')
    expect(previewWorkflow).toContain("status?.state ?? 'missing'")
    expect(previewWorkflow).toContain(
      'Netlify did not certify a successful deploy preview for the exact PR head',
    )
  })

  it('fails if release metadata becomes publicly readable', () => {
    expect(previewWorkflow).toContain('Verify protected release identity is not public')
    expect(previewWorkflow).toContain('$PREVIEW_ORIGIN/release.json')
    expect(previewWorkflow).toContain(
      'protected deploy-preview release.json is publicly readable',
    )
    expect(previewWorkflow).toContain('200|301|302|303|307|308|401|403')
    expect(previewWorkflow).toContain(
      'HTTP 200 response was neither release metadata nor a recognisable login page',
    )
  })

  it('does not pretend a team-login session is available to CI', () => {
    expect(previewWorkflow).toContain(
      'Netlify team-login protection has no supported non-interactive site session',
    )
    expect(previewWorkflow).toContain(
      'Authenticated browser behaviour remains covered by the disposable local-Supabase job',
    )
    expect(previewWorkflow).not.toContain('npm run smoke:production')
    expect(previewWorkflow).not.toContain('npm run smoke:production:browser')
  })
})

describe('target-specific production smoke contracts', () => {
  it('retains both read-only production smoke entry points', () => {
    expect(packageJson.scripts['smoke:production']).toBe(
      'node scripts/production-smoke.mjs',
    )
    expect(packageJson.scripts['smoke:production:browser']).toBe(
      'playwright test --config=playwright.production.config.ts',
    )
  })

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
