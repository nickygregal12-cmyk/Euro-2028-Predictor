import { describe, expect, it } from 'vitest'
import {
  presentBriefing,
  type BriefingInput,
} from '../../../src/features/hub/briefingModel'

/**
 * `INNOV-016`. The briefing counts and words; it must never state a fact
 * nobody gave it, and it must be silent rather than reporting three zeroes.
 */

const now = new Date('2026-08-15T09:00:00Z')

function input(overrides: Partial<BriefingInput> = {}): BriefingInput {
  return {
    now,
    fixturesToday: 8,
    competitionsWithFixturesToday: 1,
    outstanding: [
      {
        competitionName: 'Scottish Premiership',
        gameName: 'Match Predictor',
        title: '3 predictions to make',
        locksAt: '2026-08-15T11:30:00Z',
      },
      {
        competitionName: 'Premier League',
        gameName: 'Last Man Standing',
        title: 'Pick a club',
        locksAt: '2026-08-15T14:00:00Z',
      },
    ],
    standing: null,
    ...overrides,
  }
}

describe('presentBriefing', () => {
  it('is silent when there is no football, nothing to do and no standing', () => {
    const briefing = presentBriefing(
      input({ fixturesToday: 0, competitionsWithFixturesToday: 0, outstanding: [] }),
    )
    expect(briefing.quiet).toBe(true)
  })

  it('is not silent for football alone', () => {
    expect(presentBriefing(input({ outstanding: [] })).quiet).toBe(false)
  })

  it('counts the football it was given and names more than one competition', () => {
    expect(presentBriefing(input()).footballLine).toBe('8 matches today.')
    expect(
      presentBriefing(input({ fixturesToday: 11, competitionsWithFixturesToday: 3 })).footballLine,
    ).toBe('11 matches today across 3 competitions.')
    expect(presentBriefing(input({ fixturesToday: 1 })).footballLine).toBe('1 match today.')
    expect(presentBriefing(input({ fixturesToday: 0 })).footballLine).toBe(
      'No matches today in your competitions.',
    )
  })

  it('counts outstanding actions and never anything else', () => {
    expect(presentBriefing(input()).actionLine).toBe('2 things to do.')
    expect(presentBriefing(input({ outstanding: [] })).actionLine).toBe('Nothing outstanding.')
  })

  it('takes the soonest lock among the outstanding actions', () => {
    const briefing = presentBriefing(input())
    // 11:30Z is the earlier of the two, and the panel states it as a time.
    expect(briefing.lockLine).toMatch(/^First lock /)
    expect(briefing.lockLine).not.toContain('14:')
  })

  it('states the day when the soonest lock is not today', () => {
    const briefing = presentBriefing(
      input({
        outstanding: [
          {
            competitionName: 'Premier League',
            gameName: 'Match Predictor',
            title: 'Predictions to make',
            locksAt: '2026-08-22T14:00:00Z',
          },
        ],
      }),
    )
    expect(briefing.lockLine).toContain('First lock ')
    expect(briefing.lockLine?.split(' ').length).toBeGreaterThan(3)
  })

  it('has no lock line when nothing outstanding carries an instant', () => {
    const briefing = presentBriefing(
      input({
        outstanding: [
          {
            competitionName: 'Premier League',
            gameName: 'Predictor Championship',
            title: 'Group stage in progress',
            locksAt: null,
          },
        ],
      }),
    )
    expect(briefing.lockLine).toBeNull()
  })

  it('ignores an unparseable lock rather than printing Invalid Date', () => {
    const briefing = presentBriefing(
      input({
        outstanding: [
          {
            competitionName: 'Premier League',
            gameName: 'Match Predictor',
            title: 'Predictions to make',
            locksAt: 'not-a-date',
          },
        ],
      }),
    )
    expect(briefing.lockLine).toBeNull()
  })

  it('omits the denominator where the caller has no field size', () => {
    const briefing = presentBriefing(
      input({
        standing: {
          where: 'The Office',
          position: 2,
          fieldSize: null,
          rivalName: 'Craig',
          pointsBehind: 4,
        },
      }),
    )
    expect(briefing.standingLine).toBe('2nd in The Office · 4 points behind Craig.')
  })

  it('states a season position with its field size and no rival', () => {
    const briefing = presentBriefing(
      input({
        standing: {
          where: 'Scottish Premiership',
          position: 14,
          fieldSize: 210,
          rivalName: null,
          pointsBehind: null,
        },
      }),
    )
    expect(briefing.standingLine).toBe('14th of 210 in Scottish Premiership.')
  })

  it('never invents a football fact', () => {
    expect(presentBriefing(input()).worthKnowing).toBeNull()
    expect(
      presentBriefing(input({ worthKnowing: 'Celtic have won their last four at home.' }))
        .worthKnowing,
    ).toBe('Celtic have won their last four at home.')
  })
})
