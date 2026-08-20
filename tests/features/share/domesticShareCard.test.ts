import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  domesticCardCopy,
  domesticCardFileName,
  ordinal,
  type DomesticCardFacts,
  type MatchweekCardFacts,
} from '../../../src/features/share/domesticShareCard'
import {
  DOMESTIC_CARD_SIZE,
  paint,
  readCardPalette,
} from '../../../src/features/share/renderDomesticShareCard'

/**
 * The domestic season share cards, and the things they must never carry.
 *
 * A share card is the one thing this product makes that leaves it: it lands in
 * a group chat, on somebody else's phone, where nobody can take it back. So the
 * assertions worth having are the negative ones — and they are made by
 * CONSTRUCTING each card and reading everything it produces, rather than by
 * inspecting the one field somebody remembered to check.
 */

const MATCHWEEK: MatchweekCardFacts = {
  kind: 'matchweek',
  settled: true,
  competitionName: 'Premier League',
  matchweekLabel: 'Matchweek 12',
  points: 47,
  exactScores: 3,
  correctOutcomes: 7,
  jokerPlayed: true,
  rank: { position: 4, fieldSize: 212, movement: 6 },
}

const EVERY_CARD: readonly DomesticCardFacts[] = [
  MATCHWEEK,
  { ...MATCHWEEK, jokerPlayed: false, rank: null },
  {
    kind: 'milestone',
    settled: true,
    competitionName: 'Premier League',
    milestone: { kind: 'personal-best', points: 52, previousBest: 44 },
  },
  {
    kind: 'milestone',
    settled: true,
    competitionName: 'Premier League',
    milestone: { kind: 'rank', rank: { position: 1, fieldSize: 212, movement: null } },
  },
  {
    kind: 'milestone',
    settled: true,
    competitionName: 'Scottish Premiership',
    milestone: { kind: 'lms-survival', roundsSurvived: 9, stillIn: true },
  },
  {
    kind: 'milestone',
    settled: true,
    competitionName: 'Scottish Premiership',
    milestone: { kind: 'lms-survival', roundsSurvived: 3, stillIn: false },
  },
  {
    kind: 'milestone',
    settled: true,
    competitionName: 'Premier League',
    milestone: { kind: 'championship', stageLabel: 'Semi-final', advanced: true },
  },
  {
    kind: 'season',
    settled: true,
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    finalPosition: 3,
    fieldSize: 212,
    totalPoints: 1284,
    exactScores: 41,
    bestMatchweek: { label: 'MW12', points: 52 },
  },
]

function everythingSaid(facts: DomesticCardFacts): string {
  const copy = domesticCardCopy(facts)
  return [
    copy.eyebrow,
    copy.headline,
    copy.headlineLabel,
    copy.footer,
    ...copy.lines.flatMap((line) => [line.label, line.value]),
  ].join(' | ')
}

describe('what each card says', () => {
  it('leads with the number the card is about', () => {
    const copy = domesticCardCopy(MATCHWEEK)
    expect(copy.headline).toBe('47')
    expect(copy.headlineLabel).toBe('points')
    expect(copy.eyebrow).toBe('Premier League · Matchweek 12')
  })

  it('says "point" for one of them', () => {
    expect(domesticCardCopy({ ...MATCHWEEK, points: 1 }).headlineLabel).toBe('point')
  })

  it('keeps a matchweek to three facts, in the order a player would say them', () => {
    // A fourth column makes every value smaller and none of them legible at
    // the size this is actually read.
    const copy = domesticCardCopy(MATCHWEEK)
    expect(copy.lines).toHaveLength(3)
    expect(copy.lines.map((line) => line.label)).toEqual([
      'Exact scores',
      'Season position',
      'Joker',
    ])
  })

  it('drops the Joker line where none was played, rather than saying "no"', () => {
    const copy = domesticCardCopy({ ...MATCHWEEK, jokerPlayed: false })
    expect(copy.lines.map((line) => line.label)).not.toContain('Joker')
    expect(everythingSaid({ ...MATCHWEEK, jokerPlayed: false })).not.toMatch(/joker/i)
  })

  it('says a rank held rather than leaving it blank, and says nothing where the server did not', () => {
    const held = domesticCardCopy({
      kind: 'milestone',
      settled: true,
      competitionName: 'Premier League',
      milestone: { kind: 'rank', rank: { position: 9, fieldSize: 212, movement: 0 } },
    })
    expect(held.lines).toEqual([{ label: 'Movement', value: 'Held' }])

    const unknown = domesticCardCopy({
      kind: 'milestone',
      settled: true,
      competitionName: 'Premier League',
      milestone: { kind: 'rank', rank: { position: 9, fieldSize: 212, movement: null } },
    })
    // Null is "the server did not say", which is a different fact from "did not
    // move" and must not be drawn as one.
    expect(unknown.lines).toEqual([])
  })

  it('counts ordinals the way English does', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd',
      '101st', '111th',
    ])
  })
})

describe('what no card may ever carry', () => {
  it('never names the club a Last Man Standing pick spent', () => {
    // A spent club is public in the round it was spent in, but naming it on a
    // shareable image tells everyone which clubs the sharer has LEFT — which is
    // the part still in play.
    const survived = everythingSaid({
      kind: 'milestone',
      settled: true,
      competitionName: 'Scottish Premiership',
      milestone: { kind: 'lms-survival', roundsSurvived: 9, stillIn: true },
    })
    expect(survived).toContain('9')
    expect(survived).toContain('Still in')
    expect(survived.toLowerCase()).not.toMatch(/celtic|rangers|club|picked/)
  })

  it('has nowhere to put a scoreline, a league, an invite code or a rival', () => {
    // Structural, and deliberately so. Asserting on one constructed card proves
    // that card; reading the TYPE proves there is no field a future caller
    // could put these in.
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/share/domesticShareCard.ts'),
      'utf8',
    )
    const types = source.slice(0, source.indexOf('export function domesticCardCopy'))
    for (const forbidden of [
      'homeScore',
      'awayScore',
      'prediction',
      'leagueName',
      'leagueId',
      'inviteCode',
      'rival',
      'opponentName',
      'displayName',
      'clubName',
      'teamId',
    ]) {
      expect(
        types.includes(`${forbidden}:`),
        `DomesticCardFacts gained a "${forbidden}" field. Everything in it ends ` +
          'up on an image somebody else keeps.',
      ).toBe(false)
    }
  })

  it('cannot be built from an unsettled matchweek at all', () => {
    // `settled` is the literal `true`, so this is a compile error rather than a
    // runtime check — the assertion is that the type stayed that way.
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/share/domesticShareCard.ts'),
      'utf8',
    )
    expect(source).toContain('readonly settled: true')
    expect(source).not.toContain('readonly settled: boolean')
    for (const facts of EVERY_CARD) expect(facts.settled).toBe(true)
  })

  it('offers a file name that discloses nothing on its own', () => {
    // It lands in a Downloads folder and in a share sheet's preview, where a
    // competition, a position or a date would be a small disclosure nobody is
    // looking at.
    for (const facts of EVERY_CARD) {
      const name = domesticCardFileName(facts)
      expect(name).toMatch(/^predictor-hub-(matchweek|milestone|season)\.png$/)
      expect(name).not.toMatch(/premier|scottish|\d{4}/i)
    }
  })
})

describe('the card is this product, not a second visual language', () => {
  it('signs every card as the Hub and nothing else', () => {
    for (const facts of EVERY_CARD) {
      expect(domesticCardCopy(facts).footer).toBe('Predictor Hub')
      expect(everythingSaid(facts).toLowerCase()).not.toContain('euro')
    }
  })

  it('does not reuse the Euro tournament bracket renderer', () => {
    // The batch's own instruction, and the reason two renderers exist: a weekly
    // league season has no bracket, no champion and no finalists, so pointing
    // that renderer at this data would mean drawing empty furniture or
    // inventing facts to fill it.
    const renderer = readFileSync(
      resolve(process.cwd(), 'src/features/share/renderDomesticShareCard.ts'),
      'utf8',
    )
    // IMPORTS, not the words. The file's own header explains at length why it
    // is not the bracket renderer, so a substring check would fail on the
    // explanation — which would teach the next person to delete the test
    // rather than to keep the property.
    for (const module of ['renderShareCard', 'shareModel', 'flagAssets']) {
      expect(renderer).not.toMatch(new RegExp(`from '\\./${module}'`))
    }
  })

  it('fetches nothing, so the canvas can never be tainted at export', () => {
    // A tainted canvas fails at `toBlob`, which is AFTER the player pressed
    // Share. Every glyph is text and every shape is drawn.
    const renderer = readFileSync(
      resolve(process.cwd(), 'src/features/share/renderDomesticShareCard.ts'),
      'utf8',
    )
    expect(renderer).not.toMatch(/new Image\(/)
    expect(renderer).not.toMatch(/\bfetch\(/)
    expect(renderer).not.toMatch(/drawImage/)
  })
})

describe('drawing', () => {
  /** A context that records what it was asked to draw. */
  function recordingContext() {
    const written: string[] = []
    const calls: string[] = []
    const context = new Proxy(
      {
        canvas: { width: DOMESTIC_CARD_SIZE, height: DOMESTIC_CARD_SIZE },
        fillText: (value: string) => written.push(value),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        measureText: () => ({ width: 100 }),
      } as unknown as CanvasRenderingContext2D,
      {
        get(target, property: string) {
          const existing = (target as unknown as Record<string, unknown>)[property]
          if (existing !== undefined) return existing
          return (...args: unknown[]) => {
            calls.push(`${property}(${args.length})`)
          }
        },
        set() {
          return true
        },
      },
    )
    return { context, written, calls }
  }

  it('draws every line of the copy and nothing else', () => {
    const { context, written } = recordingContext()
    paint(context, domesticCardCopy(MATCHWEEK), readCardPalette())

    expect(written).toContain('47')
    expect(written).toContain('points')
    expect(written).toContain('PREMIER LEAGUE · MATCHWEEK 12')
    expect(written).toContain('PREDICTOR HUB')
    // Nothing appears on the image that the copy did not produce.
    const copy = domesticCardCopy(MATCHWEEK)
    const allowed = new Set(
      [
        copy.eyebrow,
        copy.headline,
        copy.headlineLabel,
        copy.footer,
        ...copy.lines.flatMap((line) => [line.label, line.value]),
      ].map((value) => value.toUpperCase()),
    )
    for (const value of written) expect(allowed.has(value.toUpperCase())).toBe(true)
  })

  it('draws the panel only where there is something to put in it', () => {
    const { context, written } = recordingContext()
    paint(
      context,
      domesticCardCopy({
        kind: 'milestone',
        settled: true,
        competitionName: 'Premier League',
        milestone: { kind: 'championship', stageLabel: 'Semi-final', advanced: true },
      }),
      readCardPalette(),
    )
    expect(written).toContain('Semi-final')
    expect(written).toContain('through')
  })
})
