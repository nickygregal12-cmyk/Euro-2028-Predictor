import { describe, expect, it } from 'vitest'
import { metadataAllowsAdminCapability } from './adminAccess'

describe('metadataAllowsAdminCapability', () => {
  it('allows a super administrator for every capability', () => {
    expect(metadataAllowsAdminCapability({ admin_role: 'super_admin' }, 'results')).toBe(true)
    expect(metadataAllowsAdminCapability({ admin_role: 'super_admin' }, 'users')).toBe(true)
  })

  it('allows only explicitly assigned capabilities', () => {
    const metadata = { admin_capabilities: ['results'] }
    expect(metadataAllowsAdminCapability(metadata, 'results')).toBe(true)
    expect(metadataAllowsAdminCapability(metadata, 'users')).toBe(false)
  })

  it('fails closed for missing, malformed or user-controlled lookalike metadata', () => {
    expect(metadataAllowsAdminCapability(null, 'results')).toBe(false)
    expect(metadataAllowsAdminCapability({ admin_capabilities: 'results' }, 'results')).toBe(false)
    expect(metadataAllowsAdminCapability({ admin_role: 'admin' }, 'results')).toBe(false)
  })
})
