import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const config = readFileSync(resolve(root, 'playwright.shipping-vnext.config.ts'), 'utf8')
const weeklyConfig = readFileSync(resolve(root, 'playwright.config.ts'), 'utf8')
const setup = readFileSync(resolve(root, 'e2e/shipping-vnext-global-setup.ts'), 'utf8')
const journeys = readFileSync(resolve(root, 'e2e/shipping-vnext-journeys.spec.ts'), 'utf8')
const lms = readFileSync(resolve(root, 'e2e/shipping-vnext-private-lms.spec.ts'), 'utf8')
const acceptance = readFileSync(
  resolve(root, 'e2e/shipping-vnext-release-acceptance.spec.ts'),
  'utf8',
)

describe('shipping vNext release browser gate', () => {
  it('runs the whole shipping-vNext spec family only under the shipping config', () => {
    expect(config).toContain("testMatch: ['shipping-vnext-*.spec.ts']")
    // Playwright tests the RegExp against the full path, not just the basename.
    // Keeping the expression unanchored at the start prevents the same shipping
    // spec from being collected by the fail-closed weekly app on port 4173.
    expect(weeklyConfig).toContain('/shipping-vnext-.*\\.spec\\.ts$/')
    expect(weeklyConfig).not.toContain('/^shipping-vnext-.*\\.spec\\.ts$/')
    expect(journeys).toContain('shipping vNext user-found regression matrix')
    expect(lms).toContain('private LMS creates, invites, joins and persists a first pick')
    expect(acceptance).toContain('Matches uses the real filter, league-table context and Match Centre journey')
  })

  it('wraps the canonical global setup instead of replacing it', () => {
    expect(config).toContain("globalSetup: './e2e/shipping-vnext-global-setup.ts'")
    expect(setup).toContain("import baseGlobalSetup from './global-setup'")
    expect(setup).toContain('await baseGlobalSetup()')
    expect(setup).toContain("parsed.protocol !== 'http:'")
    expect(setup).toContain("parsed.port !== LOCAL_SUPABASE_PORT")
  })

  it('forces both desktop and Pixel-class shipping projects', () => {
    expect(config).toContain("devices['Desktop Chrome']")
    expect(config).toContain("devices['Pixel 7']")
  })
})
