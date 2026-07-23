import { describe, expect, it } from 'vitest'
import {
  resolvedOrderFor,
  tieKey,
  type TieResolution,
} from '../../src/domain/tournament/tieResolutions'

describe('tieResolutions', () => {
  it('keys a tied set independent of ordering', () => {
    expect(tieKey(['b', 'a', 'c'])).toBe(tieKey(['c', 'b', 'a']))
    expect(tieKey(['a', 'b'])).not.toBe(tieKey(['a', 'c']))
  })

  it('returns a defensive copy of the chosen order for a matching resolution', () => {
    const storedOrder = ['b', 'a']
    const resolutions: TieResolution[] = [
      { teamIds: ['a', 'b'], order: storedOrder },
    ]

    const result = resolvedOrderFor(resolutions, ['b', 'a'])
    expect(result).toEqual(['b', 'a'])
    expect(result).not.toBe(storedOrder)
    expect(resolvedOrderFor(resolutions, ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('returns undefined when no resolution covers the exact set', () => {
    const resolutions: TieResolution[] = [
      { teamIds: ['a', 'b'], order: ['b', 'a'] },
    ]

    expect(resolvedOrderFor(resolutions, ['a', 'c'])).toBeUndefined()
    expect(resolvedOrderFor([], ['a', 'b'])).toBeUndefined()
  })

  it.each([
    { name: 'duplicate order member', teamIds: ['a', 'b'], order: ['a', 'a'] },
    { name: 'missing order member', teamIds: ['a', 'b'], order: ['a'] },
    { name: 'extra order member', teamIds: ['a', 'b'], order: ['a', 'b', 'c'] },
    { name: 'foreign order member', teamIds: ['a', 'b'], order: ['a', 'c'] },
    { name: 'duplicate keyed member', teamIds: ['a', 'a'], order: ['a', 'a'] },
  ])('ignores a hostile row with a $name', ({ teamIds, order }) => {
    expect(
      resolvedOrderFor([{ teamIds, order }], ['a', 'b']),
    ).toBeUndefined()
  })

  it('ignores a stale resolution after the current tied set changes', () => {
    const resolutions: TieResolution[] = [
      { teamIds: ['a', 'b', 'c'], order: ['c', 'a', 'b'] },
    ]

    expect(resolvedOrderFor(resolutions, ['a', 'b'])).toBeUndefined()
  })

  it('checks later matching rows when an earlier stored row is malformed', () => {
    const resolutions: TieResolution[] = [
      { teamIds: ['a', 'b'], order: ['a', 'a'] },
      { teamIds: ['b', 'a'], order: ['b', 'a'] },
    ]

    expect(resolvedOrderFor(resolutions, ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('rejects a malformed current tied block', () => {
    const resolutions: TieResolution[] = [
      { teamIds: ['a', 'b'], order: ['b', 'a'] },
    ]

    expect(resolvedOrderFor(resolutions, ['a', 'a'])).toBeUndefined()
  })

  it('re-checks exact membership instead of trusting a colliding key', () => {
    const colliding: TieResolution = {
      teamIds: ['a', 'b|c'],
      order: ['b|c', 'a'],
    }

    expect(tieKey(colliding.teamIds)).toBe(tieKey(['a|b', 'c']))
    expect(resolvedOrderFor([colliding], ['a|b', 'c'])).toBeUndefined()
  })
})
