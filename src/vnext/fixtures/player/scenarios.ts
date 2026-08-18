/**
 * STAGE 10'S DETERMINISTIC PLAYER-PROFILE WORLDS.
 *
 * Twenty-one worlds, each one a PREMISE rather than a data dump: the reason it
 * exists is written beside it, and a reviewer reading the Storybook group is
 * reading the reasons.
 *
 * NOTHING HERE READS A CLOCK. Every model carries a fixed `generatedAt`.
 *
 * NOTHING HERE COMPUTES A RANK, A RATE OR A RECORD. Every rank, field size,
 * win, draw and comparison below is written out by hand exactly as a server
 * would send it — including the ones a plausible derivation would get wrong.
 * The climbing and falling seasons exist so an un-inverted chart axis shows up
 * as an upside-down picture; the truncated-window world exists so a record
 * tallied off `recent` shows up as the wrong record.
 *
 * THE THREE PANELS ARE INDEPENDENT AND THE WORLDS PROVE IT. Several below
 * refuse one panel while another answers, because the three reads have three
 * different server boundaries and a page that coupled them would be applying a
 * permission the server did not.
 *
 * THESE ARE PRESENTATION INPUTS AND NOT A PLAYER REGISTRY. The people are
 * invented; nothing downstream may treat them as real accounts.
 */

import type {
  PlayerAccuracy,
  PlayerProfileDetail,
  PlayerProfileModel,
  ProfileMatchweek,
  RankPoint,
  RivalryDetail,
  RivalryMatchweek,
  RivalrySide,
} from '../../models/playerProfile'

/** The instant every world below describes. Module-local by design. */
const PROFILE_NOW = '2027-11-14T19:20:00.000Z'

const competition = {
  competitionName: 'Caledonian Premiership',
  seasonLabel: '2027/28',
  gameName: 'Match Predictor',
} as const

const LONG_NAME = 'Bartholomew Fitzgerald-Macpherson of Auchtermuchty'
const THEIR_REF = 'entry-callum'
const THEIR_ID = 'user-callum'
const YOUR_REF = 'entry-rhona'

/* ==========================================================================
   PARTS
   ========================================================================== */

function matchweek(
  ordinal: number,
  points: number | null,
  picks: number,
  jokerPlayed = false,
): ProfileMatchweek {
  return {
    matchweekId: `mw-${ordinal}`,
    ordinal,
    label: `Matchweek ${ordinal}`,
    result: points === null ? { kind: 'pending' } : { kind: 'settled', points },
    jokerPlayed,
    picks: Array.from({ length: picks }, (_unused, index) => ({
      fixtureId: `fx-${ordinal}-${index}`,
      home: index % 3,
      away: (index + 1) % 3,
    })),
  }
}

function rankPoint(ordinal: number, rank: number, fieldSize: number, points: number): RankPoint {
  return { matchweekId: `mw-${ordinal}`, ordinal, label: `Matchweek ${ordinal}`, rank, fieldSize, points }
}

function accuracy(fixturesPredicted: number, exactScores: number, correctOutcomes: number): PlayerAccuracy {
  return { fixturesPredicted, exactScores, correctOutcomes }
}

function rivalrySide(
  playerRef: string,
  displayName: string,
  points: number,
  matchweeksPlayed: number,
  rank: number | null,
  fieldSize: number,
  hits: PlayerAccuracy,
): RivalrySide {
  return {
    playerRef,
    displayName,
    points,
    matchweeksPlayed,
    standing: rank === null ? null : { rank, fieldSize },
    accuracy: hits,
  }
}

function comparedWeek(
  ordinal: number,
  yourPoints: number,
  theirPoints: number,
  outcome: RivalryMatchweek['outcome'],
): RivalryMatchweek {
  return {
    matchweekId: `mw-${ordinal}`,
    ordinal,
    label: `Matchweek ${ordinal}`,
    yourPoints,
    theirPoints,
    outcome,
  }
}

const ordinarySeason: PlayerProfileDetail = {
  summary: { points: 161, matchweeksPlayed: 12, rank: 2, fieldSize: 412 },
  accuracy: accuracy(96, 11, 54),
  jokers: { played: 2, pointsFromJokerMatchweeks: 41 },
  history: [
    matchweek(12, 18, 8, true),
    matchweek(11, 9, 8),
    matchweek(10, 14, 8),
    matchweek(9, 11, 8),
    matchweek(8, 21, 8, true),
  ],
}

const ordinaryRivalry: RivalryDetail = {
  matchweeksCompared: 12,
  you: rivalrySide(YOUR_REF, 'Rhona Buchanan', 148, 12, 4, 412, accuracy(96, 9, 51)),
  them: rivalrySide(THEIR_REF, 'Callum Aitken', 161, 12, 2, 412, accuracy(96, 11, 54)),
  pointsGap: 13,
  yourWins: 5,
  theirWins: 6,
  draws: 1,
  recent: [
    comparedWeek(12, 14, 18, 'them'),
    comparedWeek(11, 12, 9, 'you'),
    comparedWeek(10, 14, 14, 'level'),
    comparedWeek(9, 15, 11, 'you'),
    comparedWeek(8, 8, 21, 'them'),
  ],
}

const ordinarySeries: readonly RankPoint[] = [
  rankPoint(8, 41, 412, 21),
  rankPoint(9, 22, 412, 11),
  rankPoint(10, 14, 412, 14),
  rankPoint(11, 9, 412, 9),
  rankPoint(12, 2, 412, 18),
]

/** Every world starts here and overrides exactly what its premise is about. */
function world(overrides: Partial<PlayerProfileModel> = {}): PlayerProfileModel {
  return {
    generatedAt: PROFILE_NOW,
    context: competition,
    heading: {
      displayName: 'Callum Aitken',
      address: { ref: THEIR_REF, playerId: THEIR_ID },
      isYou: false,
    },
    profile: { kind: 'profile', detail: ordinarySeason },
    rankHistory: { kind: 'history', series: ordinarySeries },
    rivalry: { kind: 'rivalry', detail: ordinaryRivalry },
    ...overrides,
  }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

const openProfile = world()

const yourOwnProfile = world({
  heading: {
    displayName: 'Rhona Buchanan',
    address: { ref: YOUR_REF, playerId: 'user-rhona' },
    isYou: true,
  },
  rivalry: { kind: 'self' },
})

/** THE BINDING WORLD for the three-boundaries rule. */
const profileRefused = world({ profile: { kind: 'refused' } })

const rankOnly = world({ profile: { kind: 'refused' }, rivalry: { kind: 'refused' } })

const notEntered = world({
  // ALL THREE READS AGREE, AND EACH SAYS IT IN ITS OWN WORDS. A player who
  // never entered has no profile, no position and nothing to compare — and
  // none of those three is a refusal.
  profile: { kind: 'not-entered' },
  rankHistory: { kind: 'not-entered' },
  rivalry: { kind: 'not-entered' },
})

const unaddressable = world({
  heading: {
    // Contract 151 answered, so the page has a name even though both
    // contract-192 reads have no address.
    displayName: 'Callum Aitken',
    address: { ref: null, playerId: THEIR_ID },
    isYou: false,
  },
  rankHistory: { kind: 'unaddressable' },
  rivalry: { kind: 'unaddressable' },
})

const profileUnavailable = world({ profile: { kind: 'unavailable' } })

const allUnavailable = world({
  // NO READ ANSWERED, SO THERE IS NO NAME. The page is named by the server and
  // nothing else, so when all three reads fail it genuinely does not know who
  // this is — and must say so rather than remember a label from somewhere.
  heading: {
    displayName: null,
    address: { ref: THEIR_REF, playerId: THEIR_ID },
    isYou: false,
  },
  profile: { kind: 'unavailable' },
  rankHistory: { kind: 'unavailable' },
  rivalry: { kind: 'unavailable' },
})

const newSeason = world({
  profile: {
    kind: 'profile',
    detail: { summary: null, accuracy: accuracy(0, 0, 0), jokers: null, history: [] },
  },
  rankHistory: { kind: 'history', series: [] },
  rivalry: {
    kind: 'rivalry',
    detail: {
      matchweeksCompared: 0,
      you: rivalrySide(YOUR_REF, 'Rhona Buchanan', 0, 0, null, 0, accuracy(0, 0, 0)),
      them: rivalrySide(THEIR_REF, 'Callum Aitken', 0, 0, null, 0, accuracy(0, 0, 0)),
      pointsGap: 0,
      yourWins: 0,
      theirWins: 0,
      draws: 0,
      recent: [],
    },
  },
})

const climbing = world({
  rankHistory: {
    kind: 'history',
    series: [
      rankPoint(1, 301, 412, 4),
      rankPoint(2, 188, 412, 12),
      rankPoint(3, 96, 412, 15),
      rankPoint(4, 44, 412, 13),
      rankPoint(5, 12, 412, 19),
    ],
  },
})

const falling = world({
  rankHistory: {
    kind: 'history',
    series: [
      rankPoint(1, 2, 412, 22),
      rankPoint(2, 9, 412, 6),
      rankPoint(3, 31, 412, 4),
      rankPoint(4, 60, 412, 5),
      rankPoint(5, 88, 412, 3),
    ],
  },
})

const flatRank = world({
  rankHistory: {
    kind: 'history',
    series: [
      rankPoint(1, 7, 60, 12),
      rankPoint(2, 7, 60, 11),
      rankPoint(3, 7, 60, 13),
      rankPoint(4, 7, 60, 12),
    ],
  },
})

const singlePoint = world({
  rankHistory: { kind: 'history', series: [rankPoint(1, 18, 412, 14)] },
})

const fieldChanged = world({
  rankHistory: {
    kind: 'history',
    series: [
      rankPoint(1, 7, 60, 12),
      rankPoint(2, 9, 190, 11),
      rankPoint(3, 12, 341, 13),
      rankPoint(4, 14, 412, 12),
    ],
  },
})

const bigField = world({
  rankHistory: {
    kind: 'history',
    series: [
      rankPoint(9, 4, 412, 16),
      rankPoint(10, 6, 412, 11),
      rankPoint(11, 7, 412, 9),
      rankPoint(12, 5, 412, 15),
    ],
  },
})

const duplicateName = world({
  heading: {
    displayName: 'Sam Docherty',
    address: { ref: 'entry-sam-two', playerId: 'user-sam-two' },
    isYou: false,
  },
  rivalry: {
    kind: 'rivalry',
    detail: {
      ...ordinaryRivalry,
      you: rivalrySide('entry-sam-one', 'Sam Docherty', 148, 12, 4, 412, accuracy(96, 9, 51)),
      them: rivalrySide('entry-sam-two', 'Sam Docherty', 161, 12, 2, 412, accuracy(96, 11, 54)),
    },
  },
})

const pendingMatchweek = world({
  heading: {
    displayName: 'Rhona Buchanan',
    address: { ref: YOUR_REF, playerId: 'user-rhona' },
    isYou: true,
  },
  profile: {
    kind: 'profile',
    detail: {
      ...ordinarySeason,
      history: [matchweek(13, null, 8), matchweek(12, 18, 8, true), matchweek(11, 9, 8)],
    },
  },
  rivalry: { kind: 'self' },
})

const noAccuracy = world({
  profile: {
    kind: 'profile',
    detail: {
      summary: { points: 0, matchweeksPlayed: 0, rank: 388, fieldSize: 412 },
      accuracy: accuracy(0, 0, 0),
      jokers: { played: 0, pointsFromJokerMatchweeks: 0 },
      history: [],
    },
  },
})

const noStandingYet = world({
  profile: {
    kind: 'profile',
    detail: { ...ordinarySeason, summary: null },
  },
  rivalry: {
    kind: 'rivalry',
    detail: {
      ...ordinaryRivalry,
      them: rivalrySide(THEIR_REF, 'Callum Aitken', 0, 0, null, 412, accuracy(0, 0, 0)),
    },
  },
})

const longName = world({
  heading: {
    displayName: LONG_NAME,
    address: { ref: THEIR_REF, playerId: THEIR_ID },
    isYou: false,
  },
  // THE COMPARISON NAMES ITSELF from its own payload, so the long name has to
  // be there too — otherwise this world would test the heading and quietly
  // leave the column that is hardest to fit reading "Callum Aitken".
  rivalry: {
    kind: 'rivalry',
    detail: {
      ...ordinaryRivalry,
      them: rivalrySide(THEIR_REF, LONG_NAME, 161, 12, 2, 412, accuracy(96, 11, 54)),
    },
  },
})

const levelRivalry = world({
  rivalry: {
    kind: 'rivalry',
    detail: {
      ...ordinaryRivalry,
      you: rivalrySide(YOUR_REF, 'Rhona Buchanan', 161, 12, 2, 412, accuracy(96, 11, 54)),
      pointsGap: 0,
      yourWins: 4,
      theirWins: 4,
      draws: 4,
      recent: [
        comparedWeek(12, 14, 14, 'level'),
        comparedWeek(11, 12, 9, 'you'),
        comparedWeek(10, 9, 12, 'them'),
      ],
    },
  },
})

/** THE DENOMINATOR WORLD. Thirty compared, five in the window. */
const truncatedWindow = world({
  rivalry: {
    kind: 'rivalry',
    detail: {
      ...ordinaryRivalry,
      matchweeksCompared: 30,
      yourWins: 14,
      theirWins: 13,
      draws: 3,
      recent: [
        comparedWeek(30, 18, 11, 'you'),
        comparedWeek(29, 15, 12, 'you'),
        comparedWeek(28, 6, 19, 'them'),
        comparedWeek(27, 13, 9, 'you'),
        comparedWeek(26, 8, 16, 'them'),
      ],
    },
  },
})

const rivalryUnavailable = world({ rivalry: { kind: 'unavailable' } })

const rankUnavailable = world({ rankHistory: { kind: 'unavailable' } })

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const playerProfileScenarios = {
  openProfile,
  yourOwnProfile,
  profileRefused,
  rankOnly,
  notEntered,
  unaddressable,
  profileUnavailable,
  allUnavailable,
  newSeason,
  climbing,
  falling,
  flatRank,
  singlePoint,
  fieldChanged,
  bigField,
  duplicateName,
  pendingMatchweek,
  noAccuracy,
  noStandingYet,
  longName,
  levelRivalry,
  truncatedWindow,
  rivalryUnavailable,
  rankUnavailable,
} as const

export type PlayerProfileScenarioName = keyof typeof playerProfileScenarios

export const playerProfileScenarioNames = Object.keys(
  playerProfileScenarios,
) as readonly PlayerProfileScenarioName[]

/** Why each world exists, for the Storybook description and for a reviewer. */
export const playerProfileScenarioPremises: Readonly<
  Record<PlayerProfileScenarioName, string>
> = {
  openProfile:
    'The ordinary visit. All three reads answered: a season, a plotted position and a comparison.',
  yourOwnProfile:
    'Your own profile. The comparison panel says there is no one to compare with rather than rendering one column twice.',
  profileRefused:
    'THE binding world for the three-boundaries rule. The profile is refused for want of a shared private league, and the chart and the head-to-head answer anyway — because contract 192 needs only `compare`.',
  rankOnly:
    'Profile and comparison both refused, positions still visible. The weakest reach that still plots a season.',
  notEntered:
    'A private-league co-member who never entered this season`s game. About the player, not about permission.',
  unaddressable:
    'The doorway carried no season entry reference, so both contract-192 reads have no address. Not a refusal, and it must not read as one.',
  profileUnavailable:
    'The profile read failed. One panel apologises and offers a retry; the other two are unaffected.',
  allUnavailable:
    'All three reads failed. The page still has a heading, because the doorway held a name and two addresses.',
  newSeason:
    'The first day. No settled matchweek, nothing to plot, and 0-0-0 out of nothing — which must read as "not yet comparable", never as a draw.',
  climbing:
    '301st to 12th. If the chart axis is not inverted, this season of promotions is drawn as a slide downhill.',
  falling: '2nd to 88th, the mirror of the climb. The same test in the other direction.',
  flatRank:
    'Seventh every week. There is no range to scale across, so the line sits on the centre rather than pinning to a best-or-worst edge.',
  singlePoint:
    'One settled matchweek. A single marker and no line, rather than a division by zero.',
  fieldChanged:
    'The field grew from 60 to 412 over the season, so one field size would be wrong for most of the line. The caption says so.',
  bigField:
    'Fourth to seventh in a field of 412 — the whole justification for a zoomed axis, and for printing the bounds beside it.',
  duplicateName:
    'THE social-identity world. You and they are both called Sam Docherty. The columns still differ, because one of them is always "You".',
  pendingMatchweek:
    'Your own locked-but-unsettled matchweek. It reads "Not settled yet", never "0 pts".',
  noAccuracy:
    'A player with a standing and no predictions at all. No percentage is printed, because 0% exact is an accusation and not a statistic.',
  noStandingYet:
    'Entered, nothing banked. "Not yet ranked" rather than a zeroth place, on both the summary and the comparison.',
  longName:
    'A fifty-character display name. Nothing is clipped anywhere; the blocks grow instead.',
  levelRivalry:
    'Level on points and four draws, over twelve real matchweeks. The one that must NOT read the same as the empty rivalry.',
  truncatedWindow:
    'THE denominator world. Thirty matchweeks compared, five in the window. A record tallied off the strip would read 3-2 instead of 14-13-3.',
  rivalryUnavailable: 'The comparison read failed, alone. Its own sentence and its own retry.',
  rankUnavailable: 'The rank-history read failed, alone.',
}
