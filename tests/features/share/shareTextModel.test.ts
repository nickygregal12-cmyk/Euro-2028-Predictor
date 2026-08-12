import { describe, expect, it } from 'vitest'
import {
  buildShareContent,
  type ShareSubject,
} from '../../../src/features/share/shareTextModel'

/**
 * `INNOV-007`. The allow-list is the guardrail: a caller names a kind and
 * supplies its fields, and this module writes the sentence. There is no kind
 * for an unlocked prediction and no field for another player's name, so a
 * caller cannot construct a share that leaks one.
 */

describe('buildShareContent', () => {
  it('describes a settled matchweek without naming anybody else', () => {
    const subject: ShareSubject = {
      kind: 'matchweek_result',
      competitionName: 'Scottish Premiership',
      matchweekLabel: 'Matchweek 5',
      points: 21,
      exactScores: 2,
      jokerPlayed: true,
    }
    const content = buildShareContent(subject, 'https://example.test/mw5')
    expect(content.text).toBe(
      '21 points in Matchweek 5 of Scottish Premiership, including 2 exact scores. Joker played.',
    )
    expect(content.url).toBe('https://example.test/mw5')
    expect(content.clipboard).toContain('https://example.test/mw5')
  })

  it('says nothing about exact scores when the caller has no count', () => {
    const content = buildShareContent(
      {
        kind: 'matchweek_result',
        competitionName: 'Premier League',
        matchweekLabel: 'Matchweek 1',
        points: 1,
        exactScores: null,
        jokerPlayed: false,
      },
      '/x',
    )
    expect(content.text).toBe('1 point in Matchweek 1 of Premier League.')
  })

  it('omits the exact-score clause rather than boasting of nought', () => {
    const content = buildShareContent(
      {
        kind: 'matchweek_result',
        competitionName: 'Premier League',
        matchweekLabel: 'Matchweek 1',
        points: 6,
        exactScores: 0,
        jokerPlayed: false,
      },
      '/x',
    )
    expect(content.text).not.toContain('exact')
  })

  it('never shares the DNA signature without the measurement behind it', () => {
    const content = buildShareContent(
      {
        kind: 'prediction_dna',
        competitionName: 'Premier League',
        signature: 'Goals optimist',
        evidence: '3.1 goals predicted over 60 predictions',
      },
      '/me',
    )
    expect(content.text).toContain('Goals optimist')
    expect(content.text).toContain('3.1 goals predicted over 60 predictions')
  })

  it('states a league position with the field it was won in', () => {
    const content = buildShareContent(
      { kind: 'league_position', leagueName: 'The Office', position: 2, fieldSize: 12 },
      '/lg',
    )
    expect(content.title).toBe('2nd in The Office')
    expect(content.text).toBe('2nd of 12 in The Office.')
  })

  it('gets the awkward ordinals right', () => {
    const of = (position: number) =>
      buildShareContent(
        { kind: 'league_position', leagueName: 'L', position, fieldSize: 100 },
        '/lg',
      ).text
    expect(of(11)).toContain('11th')
    expect(of(12)).toContain('12th')
    expect(of(13)).toContain('13th')
    expect(of(21)).toContain('21st')
    expect(of(102)).toContain('102nd')
    expect(of(103)).toContain('103rd')
  })

  it('always carries a destination', () => {
    const content = buildShareContent(
      { kind: 'league_position', leagueName: 'The Office', position: 1, fieldSize: 8 },
      'https://example.test/competitions/spl/2026-27/leagues/1',
    )
    expect(content.url).toContain('/competitions/spl/2026-27/leagues/1')
  })
})
