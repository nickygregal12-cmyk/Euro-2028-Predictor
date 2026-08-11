import { describe, expect, it } from 'vitest'
import { clubDisplayName } from '../../../src/domain/clubIdentity/clubName'

/**
 * The cases here are the real ones. Every club name asserted below is either a
 * row of `predictor_internal.club_identity_reference` written out in the legal
 * form a provider supplies, or the exact shape contract 137's defect report
 * named.
 */
describe('clubDisplayName', () => {
  it('drops a trailing club-type token', () => {
    expect(clubDisplayName('Wolverhampton Wanderers FC')).toBe('Wolverhampton Wanderers')
    expect(clubDisplayName('Brighton & Hove Albion FC')).toBe('Brighton & Hove Albion')
    expect(clubDisplayName('Nottingham Forest FC')).toBe('Nottingham Forest')
    expect(clubDisplayName('Celtic FC')).toBe('Celtic')
  })

  it('drops a leading club-type token', () => {
    expect(clubDisplayName('AFC Bournemouth')).toBe('Bournemouth')
    expect(clubDisplayName('FC Barcelona')).toBe('Barcelona')
    expect(clubDisplayName('AC Milan')).toBe('Milan')
  })

  it('does not repeat contract 137 — the whole word goes, not the letters', () => {
    // 'Chelsea FC' -> 'chelseafc' -> /(afc)$/ -> 'chelse' was the shipped bug.
    expect(clubDisplayName('Chelsea FC')).toBe('Chelsea')
    expect(clubDisplayName('Aston Villa FC')).toBe('Aston Villa')
  })

  it('leaves a token that is part of the name alone', () => {
    // Mid-name, so it is not paperwork at the edge — it is the name.
    expect(clubDisplayName('1. FC Köln')).toBe('1. FC Köln')
    // 'City' and 'United' are not organisational tokens and never were.
    expect(clubDisplayName('Manchester City')).toBe('Manchester City')
    expect(clubDisplayName('Newcastle United')).toBe('Newcastle United')
  })

  it('keeps the curated names where the token is the identity', () => {
    expect(clubDisplayName('AFC Wimbledon')).toBe('AFC Wimbledon')
    expect(clubDisplayName('afc wimbledon')).toBe('afc wimbledon')
    expect(clubDisplayName('AFC Telford United')).toBe('AFC Telford United')
  })

  it('drops a national association suffix', () => {
    expect(clubDisplayName('England FA')).toBe('England')
    expect(clubDisplayName('Scotland National Team')).toBe('Scotland')
  })

  it('leaves an ordinary national team untouched', () => {
    for (const team of ['England', 'Scotland', 'Wales', 'Republic of Ireland']) {
      expect(clubDisplayName(team)).toBe(team)
    }
  })

  it('resolves a doubled token in one call', () => {
    expect(clubDisplayName('FC Chelsea FC')).toBe('Chelsea')
  })

  it('collapses the whitespace a feed leaves behind', () => {
    expect(clubDisplayName('  Leeds   United  ')).toBe('Leeds United')
    expect(clubDisplayName('Everton  FC ')).toBe('Everton')
  })

  it('never returns nothing', () => {
    // A name that IS a token is all we have; a blank club is worse than a
    // verbose one.
    expect(clubDisplayName('FC')).toBe('FC')
    expect(clubDisplayName('   ')).toBe('')
    expect(clubDisplayName(null)).toBe('')
    expect(clubDisplayName(undefined)).toBe('')
  })

  it('is idempotent', () => {
    for (const name of [
      'Wolverhampton Wanderers FC',
      'AFC Bournemouth',
      'AFC Wimbledon',
      '1. FC Köln',
      'England FA',
    ]) {
      expect(clubDisplayName(clubDisplayName(name))).toBe(clubDisplayName(name))
    }
  })
})
