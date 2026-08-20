/**
 * The domestic season share cards — what may go on one, decided once.
 *
 * WHY THIS IS NOT `renderShareCard.ts`. That renderer draws a Euro 2028
 * knockout bracket: a champion, two finalists, survivor flags per stage. There
 * is no bracket in a weekly league season and no champion to pick, so pointing
 * it at domestic data would mean either drawing empty furniture or inventing
 * facts to fill it. The two products get two renderers; they share the export
 * glue in `shareImage.ts`, which is the part that is genuinely common.
 *
 * AN ALLOW-LIST, NOT A TEMPLATE ENGINE. A caller cannot hand this arbitrary
 * content: it names a KIND of card and supplies the few fields that kind
 * permits. That is what makes the privacy guarantees below properties of the
 * type rather than rules everybody has to remember at every call site — the
 * same discipline `shareTextModel.ts` applies to share TEXT, for the same
 * reason.
 *
 * ── WHAT CANNOT BE PUT ON A CARD, AND WHY EACH ─────────────────────────────
 *
 *   - A PREDICTION, settled or not. There is no field for a scoreline. Before
 *     the lock it is the competitive secret the whole reveal model protects;
 *     after it, a card is a boast about a result, not a disclosure of how it
 *     was reached.
 *   - AN UNREVEALED PICK — a Last Man Standing club still in play, a
 *     Championship opponent's Penalty Number. Only `survived` and `eliminated`
 *     appear, which are facts about the player and about a round that is over.
 *   - PRIVATE COMPETITION MEMBERSHIP. No league name, no competition name for
 *     a private one, no field size drawn from a private league. Which private
 *     leagues someone is in is not theirs alone to publish — the other members
 *     did not agree to be on a picture. `rank` is the PUBLIC season position;
 *     a private-league position is deliberately absent even though the player
 *     could recite it themselves.
 *   - AN INVITE CODE. It is a bearer credential; anyone holding one can join.
 *   - ANOTHER PLAYER'S ANYTHING. No rival name, no opponent's score, no
 *     co-member's position. A card says what the SHARER did.
 *   - AN UNFINALISED RESULT SHOWN AS FINAL. Every kind below is constructed
 *     only from facts that exist after settlement, and `settled` is a literal
 *     `true` rather than a boolean, so a caller cannot pass an unsettled
 *     matchweek at all.
 *
 * Pure. No canvas, no DOM, no React — `renderDomesticShareCard.ts` draws what
 * this decides, and the deciding is testable without a browser.
 */

/** A matchweek that has been scored, said in the numbers a player quotes. */
export type MatchweekCardFacts = {
  readonly kind: 'matchweek'
  /**
   * `true` and only `true`. A matchweek that has not settled has no points,
   * so there is nothing to make a card out of — and this is what makes
   * "unfinalised results are never represented as final" unwriteable rather
   * than merely forbidden.
   */
  readonly settled: true
  /** The public competition, e.g. "Premier League". Never a private one. */
  readonly competitionName: string
  readonly matchweekLabel: string
  readonly points: number
  readonly exactScores: number
  readonly correctOutcomes: number
  readonly jokerPlayed: boolean
  /** The player's own PUBLIC season position, where the server states one. */
  readonly rank: SeasonRank | null
}

type SeasonRank = {
  readonly position: number
  readonly fieldSize: number
  /**
   * Places moved since the previous matchweek, where the server states it.
   * Positive is upwards. Null means the server did not say, which is different
   * from "no movement" and is drawn differently.
   */
  readonly movement: number | null
}

/**
 * A moment worth marking, from the four the games actually produce.
 *
 * A closed union rather than a headline string, so a caller cannot write
 * their own claim onto a branded card.
 */
type Milestone =
  | { readonly kind: 'personal-best'; readonly points: number; readonly previousBest: number }
  | { readonly kind: 'rank'; readonly rank: SeasonRank }
  | {
      readonly kind: 'lms-survival'
      readonly roundsSurvived: number
      /** Still in it, or the round it ended on. Both are facts about a settled round. */
      readonly stillIn: boolean
    }
  | {
      readonly kind: 'championship'
      /** The stage reached, from the competition's own vocabulary. */
      readonly stageLabel: string
      readonly advanced: boolean
    }

type MilestoneCardFacts = {
  readonly kind: 'milestone'
  readonly settled: true
  readonly competitionName: string
  readonly milestone: Milestone
}

/** A finished season. Only reachable once the season itself is final. */
type SeasonCardFacts = {
  readonly kind: 'season'
  readonly settled: true
  readonly competitionName: string
  readonly seasonLabel: string
  readonly finalPosition: number
  readonly fieldSize: number
  readonly totalPoints: number
  readonly exactScores: number
  readonly bestMatchweek: { readonly label: string; readonly points: number } | null
}

/**
 * The building-block types above are deliberately unexported: they are reached
 * through `DomesticCardFacts`, which is the shape a caller actually holds, and
 * an export nothing imports is one more name to keep. Export one when a
 * consumer names it.
 */
export type DomesticCardFacts =
  | MatchweekCardFacts
  | MilestoneCardFacts
  | SeasonCardFacts

/** One line of the card, as the renderer draws it. */
export type CardLine = {
  readonly label: string
  readonly value: string
}

/**
 * What the card SAYS, separated from how it is drawn.
 *
 * The renderer takes this rather than the facts, so the wording is testable
 * without a canvas and cannot drift between the image and the share text.
 */
export type DomesticCardCopy = {
  /** Small, above the headline. The competition, never a private league. */
  readonly eyebrow: string
  /** The one number the card is about. */
  readonly headline: string
  /** What that number is. */
  readonly headlineLabel: string
  /** Up to three supporting facts. More than three is a spreadsheet. */
  readonly lines: readonly CardLine[]
  /** The line along the bottom. Never a URL with a code in it. */
  readonly footer: string
}

export function domesticCardCopy(facts: DomesticCardFacts): DomesticCardCopy {
  switch (facts.kind) {
    case 'matchweek':
      return matchweekCopy(facts)
    case 'milestone':
      return milestoneCopy(facts)
    case 'season':
      return seasonCopy(facts)
  }
}

function matchweekCopy(facts: MatchweekCardFacts): DomesticCardCopy {
  // ORDERED BY WHAT A PLAYER WOULD ACTUALLY SAY OUT LOUD, then cut to three.
  // Exact scores are the thing this game is won on; where they stand in the
  // season is the second question anyone asks; a Joker is an event. Correct
  // outcomes are the least quotable of the four and are what falls off.
  //
  // Three, because a card is a poster read at thumbnail size in a chat list. A
  // fourth column makes every value smaller and none of them legible.
  const candidates: readonly (CardLine | null)[] = [
    { label: 'Exact scores', value: String(facts.exactScores) },
    facts.rank ? { label: 'Season position', value: rankValue(facts.rank) } : null,
    facts.jokerPlayed ? { label: 'Joker', value: 'Played' } : null,
    { label: 'Correct outcomes', value: String(facts.correctOutcomes) },
  ]

  return {
    eyebrow: `${facts.competitionName} · ${facts.matchweekLabel}`,
    headline: String(facts.points),
    headlineLabel: facts.points === 1 ? 'point' : 'points',
    lines: candidates.filter((line): line is CardLine => line !== null).slice(0, 3),
    footer: 'Predictor Hub',
  }
}

function milestoneCopy(facts: MilestoneCardFacts): DomesticCardCopy {
  const milestone = facts.milestone
  switch (milestone.kind) {
    case 'personal-best':
      return {
        eyebrow: `${facts.competitionName} · New personal best`,
        headline: String(milestone.points),
        headlineLabel: 'points in a matchweek',
        lines: [{ label: 'Previous best', value: String(milestone.previousBest) }],
        footer: 'Predictor Hub',
      }
    case 'rank':
      return {
        eyebrow: `${facts.competitionName} · Season position`,
        headline: ordinal(milestone.rank.position),
        headlineLabel: `of ${milestone.rank.fieldSize}`,
        lines: movementLine(milestone.rank),
        footer: 'Predictor Hub',
      }
    case 'lms-survival':
      return {
        eyebrow: `${facts.competitionName} · Last Man Standing`,
        headline: String(milestone.roundsSurvived),
        headlineLabel:
          milestone.roundsSurvived === 1 ? 'round survived' : 'rounds survived',
        // The CLUB is deliberately absent. A pick is spent, but naming it says
        // which clubs are still available to the sharer, and to everyone in
        // their round.
        lines: [
          { label: 'Status', value: milestone.stillIn ? 'Still in' : 'Eliminated' },
        ],
        footer: 'Predictor Hub',
      }
    case 'championship':
      return {
        eyebrow: `${facts.competitionName} · Predictor Championship`,
        headline: milestone.stageLabel,
        headlineLabel: milestone.advanced ? 'through' : 'reached',
        lines: [],
        footer: 'Predictor Hub',
      }
  }
}

function seasonCopy(facts: SeasonCardFacts): DomesticCardCopy {
  const lines: CardLine[] = [
    { label: 'Points', value: String(facts.totalPoints) },
    { label: 'Exact scores', value: String(facts.exactScores) },
  ]
  if (facts.bestMatchweek) {
    lines.push({
      label: 'Best matchweek',
      value: `${facts.bestMatchweek.points} · ${facts.bestMatchweek.label}`,
    })
  }

  return {
    eyebrow: `${facts.competitionName} · ${facts.seasonLabel}`,
    headline: ordinal(facts.finalPosition),
    headlineLabel: `of ${facts.fieldSize}`,
    lines,
    footer: 'Predictor Hub',
  }
}

function rankValue(rank: SeasonRank): string {
  return `${ordinal(rank.position)} of ${rank.fieldSize}`
}

function movementLine(rank: SeasonRank): readonly CardLine[] {
  if (rank.movement === null) return []
  if (rank.movement === 0) return [{ label: 'Movement', value: 'Held' }]
  const places = Math.abs(rank.movement)
  const word = places === 1 ? 'place' : 'places'
  return [
    {
      label: 'Movement',
      value: `${rank.movement > 0 ? 'Up' : 'Down'} ${places} ${word}`,
    },
  ]
}

export function ordinal(position: number): string {
  const rest = position % 100
  if (rest >= 11 && rest <= 13) return `${position}th`
  switch (position % 10) {
    case 1:
      return `${position}st`
    case 2:
      return `${position}nd`
    case 3:
      return `${position}rd`
    default:
      return `${position}th`
  }
}

/**
 * The file name a saved card is offered under.
 *
 * Deliberately dull and deliberately anonymous: it lands in somebody's
 * Downloads folder and, on a phone, in a share sheet's preview. A name
 * carrying a competition, a position or a date would be a small disclosure in
 * a place nobody is looking.
 */
export function domesticCardFileName(facts: DomesticCardFacts): string {
  return `predictor-hub-${facts.kind}.png`
}
