/**
 * `INNOV-007` — what a share actually says, decided once.
 *
 * IT IS AN ALLOW-LIST AND NOT A FORMATTER. A caller cannot hand this arbitrary
 * text: it names a KIND of share and supplies the few fields that kind permits,
 * and this module writes the sentence. That is what makes "no hidden or private
 * data" a property of the code rather than a rule everybody has to remember at
 * every call site.
 *
 * NOTHING PRE-REVEAL IS SHAREABLE, BY CONSTRUCTION. Every kind below describes
 * something already settled or already the player's own: a matchweek that has
 * been scored, the player's own habits, a result that has been confirmed. There
 * is no kind for a prediction that has not locked, so no caller can make one.
 *
 * NO NAME BUT THE PLAYER'S OWN. A share may say what the sharer did. It never
 * carries a co-member's display name, a league member list or another player's
 * prediction — a private league's membership is not the sharer's to publish.
 *
 * EVERY SHARE CARRIES A DESTINATION. A card that links to a generic home page
 * teaches the reader nothing about where the thing they were shown lives.
 *
 * PURE.
 */

export type ShareSubject =
  | {
      kind: 'matchweek_result'
      competitionName: string
      matchweekLabel: string
      points: number
      exactScores: number | null
      jokerPlayed: boolean
    }
  | {
      kind: 'prediction_dna'
      competitionName: string
      signature: string
      /** The measurement the signature came from. Never the word alone. */
      evidence: string
    }
  | {
      kind: 'league_position'
      leagueName: string
      position: number
      fieldSize: number
    }

export type ShareContent = {
  /** The share sheet's title, where the platform shows one. */
  title: string
  /** The body. Complete without the URL, because some targets drop it. */
  text: string
  /** Absolute URL to the surface this describes. */
  url: string
  /** Title, text and URL as one string, for the copy fallback. */
  clipboard: string
}

export function buildShareContent(subject: ShareSubject, url: string): ShareContent {
  const { title, text } = sentenceOf(subject)
  return { title, text, url, clipboard: `${text} ${url}`.trim() }
}

function sentenceOf(subject: ShareSubject): { title: string; text: string } {
  switch (subject.kind) {
    case 'matchweek_result': {
      const exact =
        subject.exactScores === null
          ? ''
          : subject.exactScores === 1
            ? ', including 1 exact score'
            : subject.exactScores > 1
              ? `, including ${subject.exactScores} exact scores`
              : ''
      const joker = subject.jokerPlayed ? ' Joker played.' : ''
      return {
        title: `${subject.matchweekLabel} — ${subject.points} points`,
        text: `${subject.points} ${subject.points === 1 ? 'point' : 'points'} in ${subject.matchweekLabel} of ${subject.competitionName}${exact}.${joker}`,
      }
    }
    case 'prediction_dna':
      return {
        title: `Prediction DNA — ${subject.signature}`,
        // The word is never shared without the measurement behind it, exactly
        // as the panel renders it.
        text: `My prediction habits in ${subject.competitionName}: ${subject.signature} — ${subject.evidence}.`,
      }
    case 'league_position':
      return {
        title: `${ordinalOf(subject.position)} in ${subject.leagueName}`,
        text: `${ordinalOf(subject.position)} of ${subject.fieldSize} in ${subject.leagueName}.`,
      }
  }
}

function ordinalOf(position: number): string {
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
