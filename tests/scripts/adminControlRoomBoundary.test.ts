import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/admin-control-room/index.ts'),
  'utf8',
)
const supabaseConfig = readFileSync(
  resolve(process.cwd(), 'supabase/config.toml'),
  'utf8',
)

describe('admin Control Room support boundary', () => {
  it('keeps the service role server-side and re-resolves the caller through Auth', () => {
    expect(source).toContain("required('SUPABASE_SERVICE_ROLE_KEY')")
    expect(source).toContain('/auth/v1/user')
    expect(source).toContain('app_metadata')
    expect(source).not.toContain('user_metadata')
  })

  it('declares custom Auth ownership instead of relying on the gateway default', () => {
    expect(supabaseConfig).toMatch(
      /\[functions\.admin-control-room\][\s\S]*?verify_jwt\s*=\s*false/,
    )
    expect(source).toContain("if (!caller) return json({ error: 'unauthorized' }, 401)")
  })

  it('keeps user and league support as separately capability-gated reads', () => {
    expect(source).toContain("action === 'search-users'")
    expect(source).toContain("capabilityAllowed(caller, 'users')")
    expect(source).toContain("action === 'search-leagues'")
    expect(source).toContain("capabilityAllowed(caller, 'leagues')")
  })

  it('counts only active game memberships and resolves linked game identity directly', () => {
    expect(source).toContain('status=eq.active')
    expect(source).toContain('linkedGameIds')
    expect(source).toContain('select=id,game_key')
    expect(source).toContain('gameKeys.get(league.game_competition_id)')
    expect(source).not.toContain('privateIdsSet')
  })

  it('never reads invite credentials or exposes a generic mutation proxy', () => {
    expect(source).not.toMatch(/invite_code/i)
    expect(source).not.toMatch(/method:\s*['"](?:PUT|PATCH|DELETE)['"]/i)
    expect(source).not.toMatch(/\/rest\/v1\/rpc\//i)
    expect(source).not.toContain('make-admin')
    expect(source).not.toContain('set-admin')
  })
})
