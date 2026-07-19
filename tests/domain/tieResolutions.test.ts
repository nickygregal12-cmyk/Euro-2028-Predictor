import { describe, it, expect } from 'vitest'
import {
  tieKey,
  resolvedOrderFor,
  type TieResolution,
} from '../../src/domain/tournament/tieResolutions'

describe('tieResolutions', () => {
  it('keys a tied set independent of ordering', () => {
    expect(tieKey(['b', 'a', 'c'])).toBe(tieKey(['c', 'b', 'a']))
    expect(tieKey(['a', 'b'])).not.toBe(tieKey(['a', 'c']))
  })

  it('returns the chosen order for a matching resolution', () => {
    const resolutions: TieResolution[] = [{ teamIds: ['a', 'b'], order: ['b', 'a'] }]
    // Looked up by a differently-ordered but equal set.
    expect(resolvedOrderFor(resolutions, ['b', 'a'])).toEqual(['b', 'a'])
    expect(resolvedOrderFor(resolutions, ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('returns undefined when no resolution covers the set', () => {
    const resolutions: TieResolution[] = [{ teamIds: ['a', 'b'], order: ['b', 'a'] }]
    expect(resolvedOrderFor(resolutions, ['a', 'c'])).toBeUndefined()
    expect(resolvedOrderFor([], ['a', 'b'])).toBeUndefined()
  })

  it('ignores a stale resolution whose order no longer matches the tied set', () => {
    // The user resolved {a,b,c} but the current tie is only {a,b}: stale → ignored.
    const resolutions: TieResolution[] = [
      { teamIds: ['a', 'b', 'c'], order: ['c', 'a', 'b'] },
    ]
    expect(resolvedOrderFor(resolutions, ['a', 'b'])).toBeUndefined()
    // And an order that isn't a clean permutation of its own key is rejected.
    const broken: TieResolution[] = [{ teamIds: ['a', 'b'], order: ['a', 'a'] }]
    expect(resolvedOrderFor(broken, ['a', 'b'])).toBeUndefined()
  })
})
