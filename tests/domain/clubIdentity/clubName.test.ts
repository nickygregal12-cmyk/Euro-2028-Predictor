import { describe, expect, it } from 'vitest'
import {
  clubDisplayName,
  clubShortNames,
  normalisedClubName,
} from '../../../src/domain/clubIdentity/clubName'

/**
 * The cases here are the real ones. Every club name asserted below is either a
 * row of `predictor_internal.club_identity_reference` written out in the legal
 * form a provider supplies, or the exact shape contract 137's defect report
 * named.
 */
describe('clubDisplayName', () => {
  it('uses the name a football audience actually says', () => {
    // Confirmed by the owner, 11 August 2026. None of these is derivable:
    // 'Wolves' is not a substring operation on 'Wolverhampton Wanderers'.
    expect(clubDisplayName('Wolverhampton Wanderers FC')).toBe('Wolves')
    expect(clubDisplayName('Tottenham Hotspur FC')).toBe('Spurs')
    expect(clubDisplayName('Brighton & Hove Albion FC')).toBe('Brighton')
    expect(clubDisplayName('Manchester City FC')).toBe('Man City')
    expect(clubDisplayName('Manchester United FC')).toBe('Man Utd')
    expect(clubDisplayName('Newcastle United FC')).toBe('Newcastle')
    expect(clubDisplayName('Heart of Midlothian FC')).toBe('Hearts')
  })

  it('reaches the curated name from any spelling that normalises to it', () => {
    // The provider may or may not send the suffix; both must land on one name.
    for (const spelling of [
      'Wolverhampton Wanderers FC',
      'Wolverhampton Wanderers',
      'wolverhampton wanderers fc',
    ]) {
      expect(clubDisplayName(spelling)).toBe('Wolves')
    }
  })

  it('falls through to the filter for a club nobody listed', () => {
    // Not a defect. Most clubs need no shortening, and a promoted club renders
    // properly on the day it appears rather than after somebody notices.
    expect(clubDisplayName('Arsenal FC')).toBe('Arsenal')
    expect(clubDisplayName('Everton FC')).toBe('Everton')
    expect(clubDisplayName('Celtic FC')).toBe('Celtic')
    expect(clubDisplayName('Sunderland AFC')).toBe('Sunderland')
  })

  it('drops a trailing club-type token', () => {
    expect(clubDisplayName('Fulham FC')).toBe('Fulham')
    expect(clubDisplayName('Aberdeen FC')).toBe('Aberdeen')
    expect(clubDisplayName('Kilmarnock FC')).toBe('Kilmarnock')
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
    // The same order, in the key that reaches the curated map.
    expect(normalisedClubName('Chelsea FC')).toBe('chelsea')
    expect(normalisedClubName('Aston Villa FC')).toBe('astonvilla')
    expect(normalisedClubName('Brighton & Hove Albion FC')).toBe('brightonhovealbion')
  })

  it('keys the curated map exactly as the server keys its own club reference', () => {
    // `predictor_internal.normalised_club_name`, reproduced. If these drift,
    // moving the map to club_identity_reference stops being a lookup swap.
    for (const key of Object.keys(clubShortNames)) {
      expect(normalisedClubName(key), `${key} is not in normalised form`).toBe(key)
    }
  })

  it('lists a club only where the common name differs from the filtered one', () => {
    // A row saying 'Arsenal' is 'Arsenal' can rot without ever being wrong
    // enough for anyone to notice.
    for (const [key, short] of Object.entries(clubShortNames)) {
      expect(normalisedClubName(short), `${key} adds nothing`).not.toBe(key)
    }
  })

  it('leaves a token that is part of the name alone', () => {
    // Mid-name, so it is not paperwork at the edge — it is the name.
    expect(clubDisplayName('1. FC Köln')).toBe('1. FC Köln')
    // 'City' and 'United' are not organisational tokens and never were. Both
    // clubs here are deliberately absent from the curated map, so the filter is
    // what is being measured.
    expect(clubDisplayName('Stoke City')).toBe('Stoke City')
    expect(clubDisplayName('Oxford United')).toBe('Oxford United')
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
    expect(clubDisplayName('  Stoke   City  ')).toBe('Stoke City')
    expect(clubDisplayName('Everton  FC ')).toBe('Everton')
    // And a ragged spelling still normalises onto the curated name.
    expect(clubDisplayName('  Wolverhampton   Wanderers  FC ')).toBe('Wolves')
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
