import { readFileSync } from 'node:fs'
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
})
