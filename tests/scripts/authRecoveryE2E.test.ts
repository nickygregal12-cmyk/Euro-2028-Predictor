import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/browser-e2e.yml'), 'utf8')
const authConfig = readFileSync(resolve(root, 'playwright.auth.config.ts'), 'utf8')
const defaultConfig = readFileSync(resolve(root, 'playwright.config.ts'), 'utf8')
const localMail = readFileSync(resolve(root, 'e2e/local-mail.ts'), 'utf8')
const authJourney = readFileSync(resolve(root, 'e2e/auth-recovery.spec.ts'), 'utf8')
const supabaseConfig = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

const forbiddenHostedRefs = [
  'vkfnsqdyhvtwyqkisxhk',
  'iouzoutneyjpugbbtdem',
  'gcfdwobpnanjchcnvdco',
]

const authHarness = `${workflow}\n${authConfig}\n${localMail}\n${authJourney}`

describe('authentication recovery browser E2E', () => {
  it('runs separately with development auto-login disabled', () => {
    expect(defaultConfig).toContain("testIgnore: 'auth-recovery.spec.ts'")
    expect(authConfig).toContain("testMatch: 'auth-recovery.spec.ts'")
    expect(authConfig).toContain('VITE_DEV_AUTOLOGIN=false')
    expect(authConfig).not.toContain('globalSetup')
    expect(packageJson.scripts['test:e2e:auth']).toBe(
      'playwright test --config=playwright.auth.config.ts',
    )
    expect(workflow).toContain('npm run test:e2e:auth')
  })

  it('uses only the disposable local Supabase Mailpit service', () => {
    expect(workflow).toContain('E2E_MAIL_URL')
    expect(localMail).toContain("LOCAL_MAIL_PORT = '54324'")
    expect(localMail).toContain("parsed.protocol !== 'http:'")
    expect(localMail).toContain("['127.0.0.1', 'localhost'].includes(parsed.hostname)")
    expect(localMail).toContain('parsed.port !== LOCAL_MAIL_PORT')
    expect(localMail).toContain('/api/v1/messages?limit=100')
    expect(localMail).toContain('/api/v1/message/${encodeURIComponent(id)}')
    for (const ref of forbiddenHostedRefs) expect(authHarness).not.toContain(ref)
  })

  it('enables confirmation and redirects only on local test origins', () => {
    expect(supabaseConfig).toContain('enable_confirmations = true')
    expect(supabaseConfig).toContain('site_url = "http://127.0.0.1:4174"')
    expect(supabaseConfig).toContain('http://127.0.0.1:4173/**')
    expect(supabaseConfig).toContain('http://127.0.0.1:4174/**')
  })

  it('covers confirmation, welcome, recovery and old-password rejection', () => {
    expect(authJourney).toContain('ensureFutureTournamentLock()')
    expect(authJourney).toContain("waitForAuthLink(EMAIL, 'signup')")
    expect(authJourney).toContain("url.pathname === '/welcome'")
    expect(authJourney).toContain("waitForAuthLink(EMAIL, 'recovery')")
    expect(authJourney).toContain('Password updated')
    expect(authJourney).toContain("That email or password isn't right")
  })
})
