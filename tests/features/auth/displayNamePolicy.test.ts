import { describe, it, expect } from 'vitest'
import {
  checkDisplayName,
  normaliseDisplayName,
  BANNED_EXACT,
  BANNED_SUBSTRINGS,
} from '../../../src/features/auth/displayNamePolicy'

describe('checkDisplayName', () => {
  it('accepts ordinary and hostile-but-legit names', () => {
    for (const ok of [
      'Alex Turner',
      'Zoë Müller',
      'Maximilian von Habsburg-Lothringen III',
      'Modric', // contains "mod" but is not the banned exact token
      '🦁 Leo the Lion',
      "O'Sullivan",
      'MEGA FAN 2028',
    ]) {
      expect(checkDisplayName(ok)).toBeNull()
    }
  })

  it('rejects empty / whitespace-only', () => {
    expect(checkDisplayName('')).toBe('Please choose a display name.')
    expect(checkDisplayName('   ')).toBe('Please choose a display name.')
  })

  it('rejects excessive length', () => {
    expect(checkDisplayName('x'.repeat(41))).toMatch(/40 characters or fewer/)
  })

  it('rejects impersonation / official names (case- and space-insensitive, exact)', () => {
    for (const bad of ['Admin', 'ADMIN', ' moderator ', 'Euro 2028', 'euro2028', 'Support']) {
      expect(checkDisplayName(bad)).toBe('That display name isn’t available. Please choose another.')
    }
  })

  it('rejects profanity/slur substrings', () => {
    expect(checkDisplayName('xX_FUCKlord_Xx')).not.toBeNull()
    expect(checkDisplayName('the official ref')).not.toBeNull() // "official" substring
  })

  it('normalises for matching (trim, collapse spaces, lowercase)', () => {
    expect(normaliseDisplayName('  Euro   2028  ')).toBe('euro 2028')
  })

  it('lists are non-empty and data-driven (easy to extend)', () => {
    expect(BANNED_EXACT.length).toBeGreaterThan(0)
    expect(BANNED_SUBSTRINGS.length).toBeGreaterThan(0)
  })
})
