/**
 * The scripted product preview's frames.
 *
 * WHAT A SCRIPTED PREVIEW IS FOR. A single still of a dashboard shows what the
 * product LOOKS like and says nothing about what it DOES. The acquisition
 * direction asks the preview to carry the weekly loop — a deadline arrives,
 * you predict, it locks, the football happens, the table moves — because that
 * loop is the product and one frame cannot show a loop.
 *
 * IT IS FIXED LOCAL DATA AND NOTHING ELSE. Every number, name, time and label
 * below is a literal. No frame reads a service, an account, a clock or a
 * random source, so the sequence a visitor sees on Tuesday is the sequence
 * they see on Friday and the one a screenshot comparison sees on the runner.
 * That determinism is a requirement rather than a nicety: a preview that
 * differs per render cannot have a visual baseline, and a preview that reads
 * the real product on a public page would be reading it for a visitor with no
 * account.
 *
 * NOTHING HERE IS AN AUTHORITY, AND THE NUMBERS MUST STAY OBVIOUSLY INVENTED.
 * These are not standings. No player owns these rows, nothing computes them,
 * and the surfaces that render them are exposed to assistive technology as one
 * described picture rather than as a table of results. If a real standing ever
 * reaches this page it must come from the standings authority — a second
 * source of ranked football numbers is exactly what ADR 0011 forbids.
 *
 * THE FRAMES DESCRIBE THEMSELVES. Each carries the sentence assistive
 * technology is given for it, so the accessible description changes with the
 * picture instead of a single label describing whichever frame happened to be
 * first.
 *
 * WHAT THE SEQUENCE MAY NOT CONTAIN. No frame shows another player's
 * unrevealed prediction, because that is a reveal rule and a marketing page
 * must not teach a visitor to expect the product to break one. The league
 * frame is a settled matchweek, which is when the real product reveals.
 */

export type PreviewMovement = 'up' | 'down' | 'none'

export type PreviewRowData = {
  readonly code: string
  readonly name: string
  readonly detail: string
  readonly value: string
  readonly movement: PreviewMovement
}

export type PreviewContextSlot = {
  readonly kind: 'time-critical' | 'live' | 'social'
  readonly label: string
  readonly value: string
  readonly detail: string
}

export type PreviewFrame = {
  /** Stable across renders; used as a React key and in the step controls. */
  readonly id: string
  /** The step label a visitor reads under the device. Short by design. */
  readonly step: string
  /** The date line at the top of the previewed screen. A literal, never a clock. */
  readonly day: string
  readonly greeting: string
  readonly summary: string
  readonly action: {
    readonly meta: string
    readonly title: string
    readonly body: string
    /** The label on the previewed control. It is a picture, never a link. */
    readonly cta: string
    readonly deadline: string
  }
  readonly competitions: readonly PreviewRowData[]
  readonly leagues: readonly PreviewRowData[]
  /** The ambient status line beneath the rows; omitted where there is none. */
  readonly status: string | null
  /** Exactly three, per the desktop preview's declared slots. */
  readonly context: readonly PreviewContextSlot[]
  /** What assistive technology is told this frame shows. */
  readonly description: string
}

/**
 * Four frames, in the order the weekly loop happens.
 *
 * FOUR RATHER THAN MORE. Each frame has to be readable in the seconds it is on
 * screen, and a visitor who scrolls past after eight seconds should have seen
 * at least two. A longer script is a longer wait for the payoff, which on an
 * acquisition page is the whole cost.
 */
export const PREVIEW_FRAMES: readonly PreviewFrame[] = [
  {
    id: 'outstanding',
    step: 'An action is waiting',
    day: 'Tuesday 4 August',
    greeting: 'Good evening',
    summary: 'One action needs your attention.',
    action: {
      meta: 'Premier League · Match Predictor',
      title: 'Finish your Matchweek 1 picks',
      body: 'Seven saved. Three fixtures still need a score.',
      cta: 'Continue',
      deadline: 'Fri 18:30',
    },
    competitions: [
      {
        code: 'PL',
        name: 'Premier League',
        detail: 'Matchweek 1 · 7 of 10 predicted',
        value: '—',
        movement: 'none',
      },
      {
        code: 'SP',
        name: 'Scottish Premiership',
        detail: 'Matchweek 1 · complete',
        value: '6th',
        movement: 'none',
      },
    ],
    leagues: [
      { code: 'SN', name: 'Saturday Night League', detail: '12 players', value: '4th', movement: 'none' },
    ],
    status: 'Predictions saved · 17:43',
    context: [
      { kind: 'time-critical', label: 'Deadline', value: '1d 04h', detail: 'Premier League Matchweek 1' },
      { kind: 'live', label: 'Next kick-off', value: 'Fri 20:00', detail: 'Three fixtures still open' },
      { kind: 'social', label: 'Your league', value: '4th of 12', detail: 'Six points off the lead' },
    ],
    description:
      'Preview of the signed-in Hub with one outstanding action: seven of ten Matchweek 1 ' +
      'predictions saved, a Friday deadline, and row-led competition and league summaries.',
  },
  {
    id: 'complete',
    step: 'Your card is in',
    day: 'Friday 7 August',
    greeting: 'Good evening',
    summary: 'Nothing outstanding. Matchweek 1 is in.',
    action: {
      meta: 'Premier League · Match Predictor',
      title: 'Matchweek 1 confirmed',
      body: 'All ten scores in, with your Joker on Arsenal v Chelsea.',
      cta: 'Review card',
      deadline: 'Locks 18:30',
    },
    competitions: [
      {
        code: 'PL',
        name: 'Premier League',
        detail: 'Matchweek 1 · 10 of 10 predicted',
        value: '—',
        movement: 'none',
      },
      {
        code: 'SP',
        name: 'Scottish Premiership',
        detail: 'Matchweek 1 · complete',
        value: '6th',
        movement: 'none',
      },
    ],
    leagues: [
      { code: 'SN', name: 'Saturday Night League', detail: '12 players', value: '4th', movement: 'none' },
    ],
    status: 'Predictions saved · 18:12',
    context: [
      { kind: 'time-critical', label: 'Locks in', value: '18m', detail: 'Premier League Matchweek 1' },
      { kind: 'live', label: 'Joker', value: 'Played', detail: 'Arsenal v Chelsea · doubles the matchweek' },
      { kind: 'social', label: 'Your league', value: '9 of 12 in', detail: 'Predictions reveal after the lock' },
    ],
    description:
      'Preview of the signed-in Hub with the matchweek complete: ten of ten scores entered, a ' +
      'Joker played on one fixture, eighteen minutes to the lock, and nine of twelve league ' +
      'members already in.',
  },
  {
    id: 'live',
    step: 'The football happens',
    day: 'Saturday 8 August',
    greeting: 'Three matches in play',
    summary: 'Provisional points move as the results come in.',
    action: {
      meta: 'Premier League · Matchweek 1',
      title: 'Arsenal 2 – 1 Chelsea',
      body: 'Your 2–1 is exact. Provisional, until the result is confirmed.',
      cta: 'Open Match Centre',
      deadline: "78'",
    },
    competitions: [
      {
        code: 'PL',
        name: 'Premier League',
        detail: 'Matchweek 1 · in play',
        value: '+18',
        movement: 'up',
      },
      {
        code: 'SP',
        name: 'Scottish Premiership',
        detail: 'Matchweek 1 · settled',
        value: '6th',
        movement: 'none',
      },
    ],
    leagues: [
      { code: 'SN', name: 'Saturday Night League', detail: '12 players', value: '2nd', movement: 'up' },
    ],
    status: 'Provisional · not yet confirmed',
    context: [
      { kind: 'time-critical', label: 'In play', value: '3 matches', detail: 'Two still to kick off' },
      { kind: 'live', label: 'Provisional', value: '+18 pts', detail: 'Joker doubled · up two places' },
      { kind: 'social', label: 'Your league', value: '2nd of 12', detail: 'Callum M. still leads by four' },
    ],
    description:
      'Preview of the signed-in Hub during a live matchweek: an exact scoreline in play, ' +
      'eighteen provisional points clearly labelled as provisional, and a rise of two places ' +
      'inside a private league.',
  },
  {
    id: 'settled',
    step: 'The table moves',
    day: 'Monday 10 August',
    greeting: 'Matchweek 1 settled',
    summary: 'Your best matchweek so far, and it moved you three places.',
    action: {
      meta: 'Saturday Night League · Matchweek 1',
      title: '34 points · 4th → 2nd',
      body: 'Two exact scores and the Joker. Four points off the lead.',
      cta: 'See the table',
      deadline: 'Settled',
    },
    competitions: [
      {
        code: 'PL',
        name: 'Premier League',
        detail: 'Matchweek 1 · settled',
        value: '31st',
        movement: 'up',
      },
      {
        code: 'SP',
        name: 'Scottish Premiership',
        detail: 'Matchweek 2 opens Wednesday',
        value: '6th',
        movement: 'none',
      },
    ],
    leagues: [
      { code: 'SN', name: 'Saturday Night League', detail: '12 players', value: '2nd', movement: 'up' },
    ],
    status: 'Settled · 34 points banked',
    context: [
      { kind: 'time-critical', label: 'Next deadline', value: 'Wed 19:45', detail: 'Scottish Premiership Matchweek 2' },
      { kind: 'live', label: 'Matchweek', value: '34 pts', detail: 'Two exact · Joker doubled' },
      { kind: 'social', label: 'League movement', value: '4th → 2nd', detail: 'Four points off the lead' },
    ],
    description:
      'Preview of the signed-in Hub after a matchweek settles: thirty-four points banked, a ' +
      'climb from fourth to second in a private league, and the next competition deadline ' +
      'already named.',
  },
] as const

/**
 * The frame a given step shows.
 *
 * TOTAL BY CONSTRUCTION. An index outside the script wraps rather than
 * returning undefined, so no caller can render an empty device — and the
 * wrapping is what makes the sequence a loop rather than something that ends
 * on a still.
 */
export function previewFrameAt(index: number): PreviewFrame {
  const count = PREVIEW_FRAMES.length
  // `((n % c) + c) % c` rather than `n % c`, because a negative step from a
  // "previous" control is a real input and `-1 % 4` is `-1` in JavaScript.
  const wrapped = ((index % count) + count) % count
  return PREVIEW_FRAMES[wrapped] as PreviewFrame
}

/** How long each frame holds, in milliseconds. */
export const PREVIEW_FRAME_MS = 4200
