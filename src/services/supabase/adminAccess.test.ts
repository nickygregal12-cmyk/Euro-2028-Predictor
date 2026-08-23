import { describe, expect, it } from 'vitest'
import {
  metadataAllowsAdminCapability,
  parseAdminAccess,
} from './adminCapabilities'

describe('admin capability metadata', () => {
  it('allows a super administrator for every capability', () => {
    expect(metadataAllowsAdminCapability({ admin_role: 'super_admin' }, 'results')).toBe(true)
    expect(metadataAllowsAdminCapability({ admin_role: 'super_admin' }, 'users')).toBe(true)
    expect(metadataAllowsAdminCapability({ admin_role: 'super_admin' }, 'competitions')).toBe(true)
    expect(parseAdminAccess({ admin_role: 'super_admin' })).toEqual({
      isSuperAdmin: true,
      capabilities: [],
    })
  })

  it('recognises the server-owned competitions capability used by season admin and AI Lab', () => {
    expect(
      metadataAllowsAdminCapability(
        { admin_role: 'admin', admin_capabilities: ['competitions'] },
        'competitions',
      ),
    ).toBe(true)
    expect(
      metadataAllowsAdminCapability(
        { admin_role: 'admin', admin_capabilities: ['results'] },
        'competitions',
      ),
    ).toBe(false)
  })

  it('allows only explicitly assigned capabilities', () => {
    const metadata = { admin_capabilities: ['results'] }
    expect(metadataAllowsAdminCapability(metadata, 'results')).toBe(true)
    expect(metadataAllowsAdminCapability(metadata, 'users')).toBe(false)
    expect(parseAdminAccess(metadata)).toEqual({
      isSuperAdmin: false,
      capabilities: ['results'],
    })
  })

  it('drops unknown tokens rather than widening the client vocabulary', () => {
    expect(
      parseAdminAccess({ admin_capabilities: ['results', 'operations', 'providers', 42] }),
    ).toEqual({ isSuperAdmin: false, capabilities: ['results'] })
  })

  it('deduplicates trusted capabilities without changing their order', () => {
    expect(
      parseAdminAccess({ admin_capabilities: ['users', 'users', 'competitions'] }),
    ).toEqual({ isSuperAdmin: false, capabilities: ['users', 'competitions'] })
  })

  it('fails closed for missing or malformed metadata', () => {
    expect(parseAdminAccess(null)).toEqual({ isSuperAdmin: false, capabilities: [] })
    expect(metadataAllowsAdminCapability(null, 'results')).toBe(false)
    expect(metadataAllowsAdminCapability({ admin_capabilities: 'results' }, 'results')).toBe(false)
    expect(metadataAllowsAdminCapability({ admin_role: 'admin' }, 'results')).toBe(false)
  })
})
