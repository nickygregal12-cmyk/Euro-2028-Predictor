import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('vNext Control Room discovery boundary', () => {
  const entry = read('src/app/vnext/AdminUtilityEntry.tsx')
  const shell = read('src/app/AppShell.tsx')
  const css = read('src/app/vnext/AdminUtilityEntry.module.css')

  it('discovers admin access from the trusted snapshot and renders nothing by default', () => {
    expect(entry).toContain('fetchAdminAccessSnapshot()')
    expect(entry).toContain('snapshotHasAnyAdminAccess(access)')
    expect(entry).toContain('if (!visible) return null')
    expect(entry).not.toContain('user_metadata')
  })

  it('mounts the utility only where the site-aware vNext frame owns the signed-in surface, never TV mode', () => {
    const tv = shell.indexOf('if (isTvModePath(location.pathname))')
    const vnext = shell.indexOf('vNextOwnsFrame(location.pathname, {')
    const siteBoundary = shell.indexOf('servesDomesticCompetitions: site.servesDomesticCompetitions')
    const utility = shell.indexOf('<AdminUtilityEntry />')
    expect(tv).toBeGreaterThan(-1)
    expect(vnext).toBeGreaterThan(tv)
    expect(siteBoundary).toBeGreaterThan(vnext)
    expect(utility).toBeGreaterThan(siteBoundary)
  })

  it('keeps privileged discovery out of the application entry chunk', () => {
    expect(shell).toContain('const AdminUtilityEntry = lazy(() =>')
    expect(shell).toContain("import('./vnext/AdminUtilityEntry')")
    expect(shell).not.toContain("import { AdminUtilityEntry } from './vnext/AdminUtilityEntry'")
    expect(shell).toContain('<Suspense fallback={null}>')
  })

  it('keeps compact discovery on Account and preserves a 44px pointer target', () => {
    expect(entry).toContain("location.pathname === '/account'")
    expect(css).toMatch(/min-height:\s*44px/)
    expect(css).toContain(".entry[data-account-route='true']")
  })
})
