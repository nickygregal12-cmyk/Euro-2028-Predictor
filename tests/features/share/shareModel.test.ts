import { describe, it, expect } from 'vitest'
import {
  availableShareVariants,
  ordinal,
  statLine,
  bragLine,
  flagSizeForStage,
  chipText,
  type ShareCardModel,
} from '../../../src/features/share/shareModel'

describe('availableShareVariants', () => {
  it('offers only the tease with just a champion picked', () => {
    expect(availableShareVariants({ championPicked: true, entryComplete: false, tournamentStarted: false })).toEqual(['tease'])
  })
  it('adds the full bracket once the entry is complete (pre-lock ok)', () => {
    expect(availableShareVariants({ championPicked: true, entryComplete: true, tournamentStarted: false })).toEqual(['tease', 'bracket'])
  })
  it('adds the brag once the tournament has started', () => {
    expect(availableShareVariants({ championPicked: true, entryComplete: true, tournamentStarted: true })).toEqual(['tease', 'bracket', 'brag'])
  })
  it('offers nothing before a champion is picked', () => {
    expect(availableShareVariants({ championPicked: false, entryComplete: false, tournamentStarted: true })).toEqual([])
  })
})

describe('ordinal', () => {
  it('handles the teens and normal cases', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(89)).toBe('89th')
    expect(ordinal(2141)).toBe('2,141st')
  })
})

describe('statLine / bragLine', () => {
  it('formats the derived stat line, pluralising jokers', () => {
    expect(statLine(89, 5)).toBe('89 goals predicted · 5 jokers armed')
    expect(statLine(60, 1)).toBe('60 goals predicted · 1 joker armed')
  })
  it('formats the brag line, dropping the rank when unknown', () => {
    expect(bragLine(112, 89, 2140)).toBe('112 pts · 89th of 2,140')
    expect(bragLine(0, null, 2140)).toBe('0 pts')
  })
})

describe('flagSizeForStage', () => {
  it('grows toward the champion (the converging funnel)', () => {
    expect(flagSizeForStage('R16')).toBeLessThan(flagSizeForStage('QF'))
    expect(flagSizeForStage('SF')).toBeLessThan(flagSizeForStage('FINAL'))
    expect(flagSizeForStage('FINAL')).toBeLessThan(flagSizeForStage('CHAMPION'))
  })
})

describe('chipText', () => {
  const base: ShareCardModel = {
    header: { playerName: 'Alex', locked: true },
    champion: { name: 'Spain', countryCode: 'es' },
    finalists: null,
    venue: null,
    dateLabel: null,
    stats: { goalsPredicted: 89, jokersArmed: 5 },
    awards: { goldenBootName: null, groupGoals: 89 },
    survivors: [],
    brag: null,
    url: 'https://euro28predictor.com',
  }
  it('is the challenge on a tease, the URL on a brag', () => {
    expect(chipText(base, 'tease')).toBe('Think you know better?')
    expect(chipText(base, 'brag')).toBe('https://euro28predictor.com')
  })
  it('becomes a league recruitment ask when shared from a league', () => {
    expect(chipText({ ...base, header: { ...base.header, leagueName: 'The Office Sweepstake' } }, 'tease')).toBe('Join "The Office Sweepstake"')
  })
})
