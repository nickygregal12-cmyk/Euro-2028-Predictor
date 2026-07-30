import { describe, expect, it } from 'vitest'
import {
  clubOverlay,
  deriveMonogram,
  parseClubColours,
  resolveClubIdentity,
  resolveClubName,
  type ProviderClub,
} from '../../../src/domain/clubIdentity/clubIdentityTokens'

/**
 * The club identity resolver.
 *
 * The shape that matters: this is an **overlay of eight entries**, not a table
 * of forty clubs. A club with no overlay entry is not a defect — it renders
 * solid, in its provider colour, with a light monogram, which is correct for
 * most clubs. That is what lets a promoted club work on day one without a code
 * change, and the roster turns over every summer.
 */

function club(over: Partial<ProviderClub> = {}): ProviderClub {
  return { externalId: 'p-1', name: 'Arsenal FC', ...over }
}

describe('parseClubColours', () => {
  it('preserves order, because the first colour is the shirt', () => {
    expect(parseClubColours('Gold / Black')).toEqual(['#FDB913', '#241F20'])
    expect(parseClubColours('Black / Gold')).toEqual(['#241F20', '#FDB913'])
  })

  it('drops an unknown colour name rather than guessing a shade', () => {
    const parsed = parseClubColours('Claret / Sky Blue')
    expect(parsed).not.toContain(undefined)
    for (const hex of parsed) expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('returns an empty list for empty or absent input', () => {
    expect(parseClubColours()).toEqual([])
    expect(parseClubColours('')).toEqual([])
  })

  it('handles a single-colour string', () => {
    expect(parseClubColours('Black')).toEqual(['#241F20'])
  })
})

describe('deriveMonogram', () => {
  it('takes the first three letters of a single word', () => {
    expect(deriveMonogram('Arsenal')).toBe('ARS')
  })

  it('takes initials from multiple words', () => {
    expect(deriveMonogram('Manchester City')).toBe('MC')
    expect(deriveMonogram('West Bromwich Albion')).toBe('WBA')
  })

  it('drops noise words that carry no distinguishing information', () => {
    expect(deriveMonogram('Arsenal FC')).toBe('ARS')
    expect(deriveMonogram('The Arsenal')).toBe('ARS')
  })

  it('caps at three letters however many words there are', () => {
    expect(deriveMonogram('Brighton and Hove Albion FC')).toHaveLength(3)
  })

  it('returns a placeholder rather than throwing when a name yields nothing', () => {
    expect(deriveMonogram('!!! ???')).toBe('???')
    expect(deriveMonogram('')).toBe('???')
  })
})

describe('resolveClubName', () => {
  it('prefers the provider short name', () => {
    expect(resolveClubName(club({ name: 'Wolverhampton Wanderers FC', shortName: 'Wolves' }))).toBe(
      'Wolves',
    )
  })

  it('falls back to the full name when the short name is absent or blank', () => {
    expect(resolveClubName(club({ name: 'Arsenal FC' }))).toBe('Arsenal FC')
    expect(resolveClubName(club({ name: 'Arsenal FC', shortName: '   ' }))).toBe('Arsenal FC')
  })
})

describe('resolveClubIdentity — precedence', () => {
  it('lets the overlay win over the provider', () => {
    const resolved = resolveClubIdentity(
      club({ tla: 'NEW', name: 'Newcastle United', clubColors: 'Black / White' }),
    )
    expect(resolved.pattern).toBe('stripes')
  })

  it('lets the provider win over the derived monogram', () => {
    const resolved = resolveClubIdentity(club({ name: 'Arsenal FC', tla: 'ARS' }))
    expect(resolved.monogram).toBe('ARS')
  })

  it('derives a monogram when the provider supplies no code', () => {
    const resolved = resolveClubIdentity(club({ name: 'Luton Town' }))
    expect(resolved.monogram).toBe('LT')
  })

  it('falls back to a neutral primary when no colour is resolvable', () => {
    const resolved = resolveClubIdentity(club({ name: 'Unknown Club' }))
    expect(resolved.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

describe('resolveClubIdentity — the unlisted club is the common case', () => {
  it('renders a club with no overlay entry as solid, in its provider colour', () => {
    const resolved = resolveClubIdentity(
      club({ tla: 'LUT', name: 'Luton Town', clubColors: 'White / Black' }),
    )

    expect(resolved.pattern).toBe('solid')
    expect(resolved.primary).toBe('#FFFFFF')
    expect(resolved.onPrimary).toBeUndefined()
  })

  it('omits secondary entirely when the pattern is solid', () => {
    const resolved = resolveClubIdentity(club({ clubColors: 'Red / White' }))

    expect(resolved.pattern).toBe('solid')
    expect(resolved.secondary).toBeUndefined()
  })

  it('carries secondary when a pattern needs it', () => {
    const resolved = resolveClubIdentity(club({ tla: 'NEW', clubColors: 'Black / White' }))

    expect(resolved.pattern).toBe('stripes')
    expect(resolved.secondary).toBeDefined()
  })

  it('leaves secondary undefined when an overlay pattern has no resolvable second colour', () => {
    const resolved = resolveClubIdentity(club({ tla: 'NEW', clubColors: 'Black' }))

    expect(resolved.pattern).toBe('stripes')
    expect(resolved.secondary).toBeUndefined()
  })

  it('never throws on a club with no usable field at all', () => {
    expect(() => resolveClubIdentity({ externalId: 'p-0', name: '' })).not.toThrow()
    const resolved = resolveClubIdentity({ externalId: 'p-0', name: '' })
    expect(resolved.monogram).toBe('???')
  })
})

describe('the overlay stays an overlay', () => {
  it('is small enough to be a set of judgements rather than a roster', () => {
    expect(Object.keys(clubOverlay).length).toBeLessThanOrEqual(12)
  })

  it('only carries what no provider supplies', () => {
    for (const [code, entry] of Object.entries(clubOverlay)) {
      expect(
        Boolean(entry.pattern) || Boolean(entry.onPrimary),
        `${code} overrides nothing a provider cannot supply`,
      ).toBe(true)
    }
  })
})
