from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + "\n", encoding="utf-8")


subprocess.run(
    ["npm", "install", "--save-dev", "--save-exact", "@playwright/test@1.61.1"],
    cwd=ROOT,
    check=True,
)

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["scripts"]["test:e2e"] = "playwright test"
package["scripts"]["test:e2e:install"] = "playwright install --with-deps chromium"
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

ignore_path = ROOT / ".gitignore"
ignore = ignore_path.read_text(encoding="utf-8")
block = "\n# Playwright browser-test output\nplaywright-report/\ntest-results/\n"
if "playwright-report/" not in ignore:
    ignore_path.write_text(ignore.rstrip() + block, encoding="utf-8")

write(
    "playwright.config.ts",
    r'''import { defineConfig, devices } from '@playwright/test'

const port = 4173
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
})''',
)

write(
    "e2e/global-setup.ts",
    r'''import { createClient } from '@supabase/supabase-js'

const DEFAULT_EMAIL = 'e2e@euro28.local'
const DEFAULT_PASSWORD = 'E2e-local-only-2028!'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Browser E2E requires ${name}.`)
  return value
}

export default async function globalSetup() {
  const url = required('E2E_SUPABASE_URL')
  const serviceRoleKey = required('E2E_SUPABASE_SERVICE_ROLE_KEY')
  const email = process.env.E2E_USER_EMAIL?.trim() || DEFAULT_EMAIL
  const password = process.env.E2E_USER_PASSWORD || DEFAULT_PASSWORD

  const parsed = new URL(url)
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error(
      `Browser E2E refuses non-local Supabase host ${parsed.hostname}.`,
    )
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find((user) => user.email === email)
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) throw error
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Local E2E user creation returned no user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: 'E2E Tester',
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError
}''',
)

write(
    "e2e/authenticated-browser.spec.ts",
    r'''import { expect, test } from '@playwright/test'

async function expectAuthenticatedPath(page: import('@playwright/test').Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

test('authenticated user reaches core routes', async ({ page }) => {
  await page.goto('/')
  await expectAuthenticatedPath(page, '/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  await page.goto('/predict')
  await expectAuthenticatedPath(page, '/predict')
  await expect(page.getByRole('heading', { name: 'Predict' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Groups A–F/ })).toBeVisible()

  await page.goto('/matches')
  await expectAuthenticatedPath(page, '/matches')
  await expect(page.getByRole('button', { name: 'By group' })).toBeVisible()

  await page.goto('/profile')
  await expectAuthenticatedPath(page, '/profile')
  await expect(page.getByText('E2E Tester', { exact: true })).toBeVisible()
})

test('group score persists, clears, and stays cleared after reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The mutation journey runs once; route smoke covers both viewports.',
  )

  await page.goto('/predict/groups/A')
  await expectAuthenticatedPath(page, '/predict/groups/A')
  await expect(page.getByText('Group A', { exact: true }).first()).toBeVisible()

  const home = page.getByLabel('Team A1 score').first()
  const away = page.getByLabel('Team A2 score').first()
  await expect(home).toBeVisible()
  await expect(away).toBeVisible()

  await home.fill('2')
  await away.fill('1')
  await expect(page.getByText('Saving…').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Saved').first()).toBeVisible({ timeout: 10_000 })

  await page.reload()
  await expect(home).toHaveValue('2')
  await expect(away).toHaveValue('1')

  await home.fill('')
  await away.fill('')
  await expect(page.getByText('Saving…').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Saved').first()).toBeVisible({ timeout: 10_000 })

  await page.reload()
  await expect(home).toHaveValue('')
  await expect(away).toHaveValue('')
})''',
)

write(
    ".github/workflows/browser-e2e.yml",
    r'''name: Browser E2E

on:
  pull_request:
    paths:
      - '.github/workflows/browser-e2e.yml'
      - 'e2e/**'
      - 'playwright.config.ts'
      - 'package.json'
      - 'package-lock.json'
      - 'src/**'
      - 'supabase/**'
      - 'tests/scripts/browserE2EWorkflow.test.ts'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  authenticated-browser:
    runs-on: ubuntu-latest
    timeout-minutes: 35

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22.22.2
          cache: npm

      - uses: supabase/setup-cli@v2
        with:
          version: 2.84.2
          github-token: ${{ github.token }}

      - name: Install application dependencies
        run: npm ci

      - name: Install Chromium and system dependencies
        run: npx playwright install --with-deps chromium

      - name: Start disposable local Supabase
        run: supabase start

      - name: Rebuild from committed migrations and seed
        run: supabase db reset --local

      - name: Export local-only browser environment
        shell: bash
        run: |
          set -euo pipefail
          supabase status -o env > /tmp/supabase.env
          # shellcheck disable=SC1091
          source /tmp/supabase.env
          : "${API_URL:?Supabase API_URL missing}"
          : "${ANON_KEY:?Supabase ANON_KEY missing}"
          : "${SERVICE_ROLE_KEY:?Supabase SERVICE_ROLE_KEY missing}"
          {
            echo "E2E_SUPABASE_URL=$API_URL"
            echo "E2E_SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
            echo 'E2E_USER_EMAIL=e2e@euro28.local'
            echo 'E2E_USER_PASSWORD=E2e-local-only-2028!'
            echo "VITE_SUPABASE_URL=$API_URL"
            echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY"
            echo 'VITE_DEV_AUTOLOGIN=true'
            echo 'VITE_DEV_USER_EMAIL=e2e@euro28.local'
            echo 'VITE_DEV_USER_PASSWORD=E2e-local-only-2028!'
          } >> "$GITHUB_ENV"

      - name: Run authenticated browser tests
        run: npm run test:e2e

      - name: Upload Playwright diagnostics
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          if-no-files-found: ignore
          retention-days: 7

      - name: Stop and delete disposable local data
        if: always()
        run: supabase stop --no-backup''',
)

write(
    "tests/scripts/browserE2EWorkflow.test.ts",
    r'''import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/browser-e2e.yml'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
}

const forbiddenHostedRefs = [
  'vkfnsqdyhvtwyqkisxhk',
  'iouzoutneyjpugbbtdem',
  'gcfdwobpnanjchcnvdco',
]

describe('authenticated browser E2E workflow', () => {
  it('uses a disposable local Supabase rebuild and Playwright Chromium', () => {
    expect(workflow).toContain('supabase start')
    expect(workflow).toContain('supabase db reset --local')
    expect(workflow).toContain('supabase stop --no-backup')
    expect(workflow).toContain('playwright install --with-deps chromium')
    expect(workflow).toContain('npm run test:e2e')
    expect(workflow).toContain('playwright-report')
  })

  it('contains no hosted Supabase project reference', () => {
    for (const ref of forbiddenHostedRefs) expect(workflow).not.toContain(ref)
  })

  it('pins the Playwright dependency and exposes stable scripts', () => {
    expect(packageJson.devDependencies['@playwright/test']).toBe('1.61.1')
    expect(packageJson.scripts['test:e2e']).toBe('playwright test')
    expect(packageJson.scripts['test:e2e:install']).toBe(
      'playwright install --with-deps chromium',
    )
  })
})''',
)

write(
    "docs/quality/reconciliations/2026-07-24-authenticated-browser-e2e.md",
    r'''# Authenticated browser E2E foundation

**Date:** 24 July 2026  
**Issue:** #52  
**Branch:** `agent/add-authenticated-browser-e2e`  
**Findings:** `TEST-001`, `DATA-005`  
**Status:** Repository implementation prepared; pull-request validation pending

## Purpose

Add the first real authenticated browser gate without using production or the shared development Supabase project.

## Test environment

The dedicated GitHub Actions workflow:

1. starts disposable local Supabase;
2. rebuilds all committed migrations and seed data;
3. creates a deterministic local-only user through the Admin API;
4. starts the Vite application with the existing development auto-login path;
5. runs Playwright Chromium sequentially at desktop and phone widths;
6. uploads traces, screenshots, video and the HTML report when available;
7. destroys the local database without backup.

The global setup rejects every non-local Supabase hostname. Executable workflow tests also prohibit production, shared-development and legacy project references.

## First journeys

- authenticated Home, Predict, Matches and Profile access at desktop and phone widths;
- real group-score save through the browser;
- reload persistence proof;
- version-safe score clearing through `delete_match_prediction`;
- second reload proving the deleted prediction does not return.

## Evidence boundary

This is meaningful repository/development browser evidence for `DATA-005` and materially improves `TEST-001`. It does not close either production-dependent finding. Production migrations 21–35, compatible hosted application/database state and authenticated hosted smoke evidence remain separately required.

Later browser batches should cover immediate-final-edit submission, save failure/conflict behavior, bracket snapshot conflicts, locked-state rejection, invite/auth recovery and administrator journeys.

## Safety boundary

No production or shared-development credentials are used. No Supabase, Netlify, migration, deployment-contract, scoring or production-data changes are made by this batch.''',
)
