/**
 * STAGE 10'S DETERMINISTIC PLAYER-PROFILE WORLDS.
 *
 * Twenty-seven worlds, each one a PREMISE rather than a data dump: the reason it
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
  PlayerSeasonSummary,
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

/**
 * `cumulativePoints` IS A RUNNING TOTAL, so every series below MUST increase.
 *
 * It is written out that way deliberately. A non-monotonic series models a
 * per-matchweek figure, which is what the field was mistaken for once — and a
 * fixture that encodes the misunderstanding is a fixture that can never catch
 * it. If a series here ever falls, either the fixture is wrong or the server's
 * contract changed.
 */
function rankPoint(
  ordinal: number,
  rank: number,
  fieldSize: number,
  cumulativePoints: number,
): RankPoint {
  return {
    matchweekId: `mw-${ordinal}`,
    ordinal,
    label: `Matchweek ${ordinal}`,
    rank,
    fieldSize,
    cumulativePoints,
  }
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

/**
 * A SEASON SUMMARY THAT AGREES WITH THE SERIES BESIDE IT.
 *
 * The migration asserts this and the pgTAP suite checks it: at the LAST settled
 * matchweek the cumulative total IS the season total, and it is out of the same
 * field. Hand-writing the two invites exactly the contradiction Stage 10's own
 * Blocker was about — a chart's table reading 151 while the summary panel reads
 * 161 for one player, in one world, on one screen.
 *
 * So a world that states a series derives its summary from it. `agreementTest`
 * in `tests/vnext/playerProfile.test.tsx` enforces the pairing across every
 * world, because a helper only helps the worlds that remember to call it.
 */
function seasonFrom(
  series: readonly RankPoint[],
  matchweeksPlayed: number,
): PlayerSeasonSummary | null {
  const last = series[series.length - 1]
  if (last === undefined) return null
  return {
    points: last.cumulativePoints,
    matchweeksPlayed,
    rank: last.rank,
    fieldSize: last.fieldSize,
  }
}

/** A world whose chart, summary and comparison all describe one season. */
function chartWorld(series: readonly RankPoint[], matchweeksPlayed: number): PlayerProfileModel {
  return world({
    profile: {
      kind: 'profile',
      detail: { ...ordinarySeason, summary: seasonFrom(series, matchweeksPlayed) },
    },
    rankHistory: { kind: 'history', series },
  })
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

/**
 * ANCHORED SO THE LAST POINT IS THE SEASON TOTAL, and stepped by contract 151's
 * own per-matchweek figures above: 161 − (11 + 14 + 9 + 18) = 109 at matchweek
 * eight, then +11, +14, +9, +18.
 */
const ordinarySeries: readonly RankPoint[] = [
  rankPoint(8, 41, 412, 109),
  rankPoint(9, 22, 412, 120),
  rankPoint(10, 14, 412, 134),
  rankPoint(11, 9, 412, 143),
  rankPoint(12, 2, 412, 161),
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
    // PINNING FOLLOWS THE PROFILE READ, BECAUSE THE SERVER SAYS IT DOES.
    // `set_pinned_rival` and contract 151's profile read require the same
    // shared private league, so a world that refuses the profile cannot lawfully
    // offer a pin — and a world that spelled both out by hand would let the
    // next one be added in a state the mapper cannot produce.
    //
    // AFTER the spread, so a world may still say `pinned` or `unavailable`
    // where its profile answered: those are real states the same read produces.
    pin: pinFor(overrides),
  }
}

function pinFor(overrides: Partial<PlayerProfileModel>): PlayerProfileModel['pin'] {
  const profile = overrides.profile?.kind ?? 'profile'
  const isYou = overrides.heading?.isYou ?? false
  if (isYou || profile !== 'profile') return { kind: 'not-offered' }
  return overrides.pin ?? { kind: 'not-pinned' }
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
/** Already pinned. The control's other position, which is a stored fact. */
const alreadyPinned = world({ pin: { kind: 'pinned' } })

/**
 * The preference read did not answer, and the profile did.
 *
 * NO CONTROL IS DRAWN OFF. A pin button in a position nobody chose toggles the
 * WRONG WAY the first time it is pressed, and the player has no way to know.
 */
const pinUnavailable = world({ pin: { kind: 'unavailable' } })

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
    // Entered, nothing banked: last of the field on nothing, which is what the
    // standings authority actually returns rather than an absent season.
    detail: {
      summary: { points: 0, matchweeksPlayed: 0, rank: 1, fieldSize: 412 },
      accuracy: accuracy(0, 0, 0),
      jokers: { played: 0, pointsFromJokerMatchweeks: 0 },
      history: [],
    },
  },
  rankHistory: { kind: 'history', series: [] },
  rivalry: {
    kind: 'rivalry',
    detail: {
      matchweeksCompared: 0,
      // BOTH ARE RANKED, EVEN ON THE FIRST DAY. `season_standings` left-joins
      // the scores, so every entry is in the table from the moment it exists —
      // on nothing from nothing, tied at the bottom. A null pair here would be
      // the impossible shape this file removed from `noStandingYet`.
      you: rivalrySide(YOUR_REF, 'Rhona Buchanan', 0, 0, 1, 412, accuracy(0, 0, 0)),
      them: rivalrySide(THEIR_REF, 'Callum Aitken', 0, 0, 1, 412, accuracy(0, 0, 0)),
      pointsGap: 0,
      yourWins: 0,
      theirWins: 0,
      draws: 0,
      recent: [],
    },
  },
})

const climbing = chartWorld(
  [
    rankPoint(1, 301, 412, 4),
    rankPoint(2, 188, 412, 16),
    rankPoint(3, 96, 412, 31),
    rankPoint(4, 44, 412, 44),
    rankPoint(5, 12, 412, 63),
  ],
  5,
)

/**
 * THE CUMULATIVE LINE STILL RISES WHILE THE RANK FALLS, and that is the point
 * rather than a mistake: a total cannot go down, so a player slides only
 * because everyone else is gaining faster.
 */
const falling = chartWorld(
  [
    rankPoint(1, 2, 412, 22),
    rankPoint(2, 9, 412, 28),
    rankPoint(3, 31, 412, 32),
    rankPoint(4, 60, 412, 37),
    rankPoint(5, 88, 412, 40),
  ],
  5,
)

const flatRank = chartWorld(
  [
    rankPoint(1, 7, 60, 12),
    rankPoint(2, 7, 60, 23),
    rankPoint(3, 7, 60, 36),
    rankPoint(4, 7, 60, 48),
  ],
  4,
)

const singlePoint = chartWorld([rankPoint(1, 18, 412, 14)], 1)

const fieldChanged = chartWorld(
  [
    rankPoint(1, 7, 60, 12),
    rankPoint(2, 9, 190, 23),
    rankPoint(3, 12, 341, 36),
    rankPoint(4, 14, 412, 48),
  ],
  4,
)

const bigField = chartWorld(
  [
    rankPoint(9, 4, 412, 120),
    rankPoint(10, 6, 412, 134),
    rankPoint(11, 7, 412, 143),
    rankPoint(12, 5, 412, 161),
  ],
  12,
)

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

/**
 * A STANDING, AND NO PREDICTIONS AT ALL.
 *
 * The series is flat on nothing, which is what the read returns for such a
 * player rather than an empty one: `season_rank_history` cross-joins the field
 * with the settled matchweeks and LEFT-joins the scores, so somebody who banked
 * nothing still has a point at every settled matchweek — carrying zero forward,
 * sinking as everyone else gains.
 */
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
  rankHistory: {
    kind: 'history',
    series: [
      rankPoint(10, 296, 412, 0),
      rankPoint(11, 341, 412, 0),
      rankPoint(12, 388, 412, 0),
    ],
  },
})

/**
 * ENTERED, NOTHING BANKED — AND ALL THREE PANELS AGREE ABOUT IT.
 *
 * Two earlier versions of this world were impossible, in opposite directions.
 * The first spread `ordinaryRivalry` and only replaced the opponent, giving
 * twelve compared matchweeks and a 5-6-1 record against a player on nothing.
 * The second set `summary: null` — which is ALSO unreachable: contract 151
 * builds its season block from `predictor_internal.season_standings`, the same
 * `entries LEFT JOIN scores` that makes a null rivalry standing impossible, so
 * an ENTERED player always has a season block. It is last place on nothing, not
 * an absent one.
 *
 * So this world is the reachable shape: bottom of the field on nothing from
 * nothing, no revealed matchweek, no position plotted, and nothing comparable
 * because a matchweek counts only once BOTH players have banked it. The
 * defensive `summary: null` branch is exercised from a hand-built model in
 * `tests/vnext/playerProfile.test.tsx`, where it is labelled as defensive.
 */
const noStandingYet = world({
  profile: {
    kind: 'profile',
    detail: {
      summary: { points: 0, matchweeksPlayed: 0, rank: 412, fieldSize: 412 },
      accuracy: accuracy(0, 0, 0),
      jokers: { played: 0, pointsFromJokerMatchweeks: 0 },
      history: [],
    },
  },
  rankHistory: { kind: 'history', series: [] },
  rivalry: {
    kind: 'rivalry',
    detail: {
      matchweeksCompared: 0,
      you: rivalrySide(YOUR_REF, 'Rhona Buchanan', 148, 12, 4, 412, accuracy(0, 0, 0)),
      them: rivalrySide(THEIR_REF, 'Callum Aitken', 0, 0, 412, 412, accuracy(0, 0, 0)),
      pointsGap: -148,
      yourWins: 0,
      theirWins: 0,
      draws: 0,
      recent: [],
    },
  },
})

/**
 * ACCURACY DID NOT DECODE, AND THE JOKERS DID.
 *
 * `summary`, `accuracy` and `jokers` decode independently — `mapAccuracy`
 * returns null on a count it cannot read while `mapJokers` succeeds beside it —
 * so this is the world that proves the surface draws them independently too.
 * Nesting one inside another's branch silently deletes a player's jokers, and
 * without this world nothing on the page would notice.
 */
const accuracyMissing = world({
  profile: {
    kind: 'profile',
    detail: { ...ordinarySeason, accuracy: null, jokers: { played: 3, pointsFromJokerMatchweeks: 52 } },
  },
})

/**
 * ONE EXACT SCORE IN 380 FIXTURES, AND 379 CORRECT OUTCOMES.
 *
 * The two rates that ROUNDING lies about. 1/380 is 0.26% and renders "0%" —
 * the same accusation `accuracyRate` refuses on a zero denominator, arriving
 * the long way round — and 379/380 renders "100%", claiming a perfect season
 * that did not happen. Both are real figures for a season-long game, and no
 * other world comes near either boundary.
 */
const roundingEdges = world({
  profile: {
    kind: 'profile',
    detail: { ...ordinarySeason, accuracy: accuracy(380, 1, 379) },
  },
})

/**
 * TWO PLAYERS, TWO DENOMINATORS, ONE RULE.
 *
 * `count(*) … group by prediction.entry_id` counts each entry's OWN prediction
 * rows, so a player who skipped fixtures inside a compared matchweek has fewer.
 * Both here have eleven exact scores; only the denominator tells the reader
 * that one of them is a far better rate. It is the world that proves the
 * comparison prints the denominator at all.
 */
const unevenDenominators = world({
  rivalry: {
    kind: 'rivalry',
    detail: {
      ...ordinaryRivalry,
      you: rivalrySide(YOUR_REF, 'Rhona Buchanan', 148, 12, 4, 412, accuracy(96, 11, 54)),
      them: rivalrySide(THEIR_REF, 'Callum Aitken', 161, 12, 2, 412, accuracy(60, 11, 38)),
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
  alreadyPinned,
  pinUnavailable,
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
  accuracyMissing,
  roundingEdges,
  unevenDenominators,
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
  alreadyPinned:
    'The reader has already pinned this player. The control\u2019s other position, and a stored fact rather than a local one.',
  pinUnavailable:
    'The preference read did not answer and the profile did. NO control is drawn off \u2014 a pin button in a position nobody chose toggles the wrong way the first time it is pressed.',
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
    'All three reads failed, so the page does not know who this is — the doorway carries two identifiers and no name. The heading reads "Player", and three separate sentences appear rather than one error screen standing in for three failures.',
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
    'Entered, nothing banked. The profile says nothing has been banked rather than drawing a zeroth place, and the comparison says there is nothing to compare — because a matchweek only counts once BOTH players have banked it.',
  accuracyMissing:
    'The accuracy block did not decode and the jokers did. They are independently nullable, and a surface that nested one inside the other`s branch would silently delete this player`s three jokers.',
  roundingEdges:
    'One exact score in 380 fixtures, and 379 correct outcomes. Rounding renders those "0%" and "100%" — an accusation and a false perfect season — so the shares are clamped to "<1%" and ">99%".',
  unevenDenominators:
    'Both players have eleven exact scores over the same compared matchweeks, out of 96 and 60 fixtures. Same rule, different denominators, and only the stated denominator tells the reader which rate is better.',
  longName:
    'A fifty-character display name. Nothing is clipped anywhere; the blocks grow instead.',
  levelRivalry:
    'Level on points and four draws, over twelve real matchweeks. The one that must NOT read the same as the empty rivalry.',
  truncatedWindow:
    'THE denominator world. Thirty matchweeks compared, five in the window. A record tallied off the strip would read 3-2 instead of 14-13-3.',
  rivalryUnavailable: 'The comparison read failed, alone. Its own sentence and its own retry.',
  rankUnavailable: 'The rank-history read failed, alone.',
}
