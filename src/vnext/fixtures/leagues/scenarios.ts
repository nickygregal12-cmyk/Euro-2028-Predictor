/**
 * STAGE 9'S DETERMINISTIC LEAGUE WORLDS.
 *
 * Twenty-one worlds, each one a PREMISE rather than a data dump: the reason it
 * exists is written beside it, and a reviewer reading the Storybook group is
 * reading the reasons.
 *
 * NOTHING HERE READS A CLOCK. Every model carries a fixed `generatedAt`, so a
 * story rendered at midnight and a story rendered at noon are the same picture.
 *
 * NOTHING HERE COMPUTES A RANK. Every `rank`, `tied` and `position` below is
 * written out by hand exactly as a server would send it, including the ones
 * that a naive `index + 1` would get wrong — the tied worlds and the pinned
 * `you` row are there precisely so a renumbering regression shows up as a
 * changed picture rather than as nothing at all.
 *
 * THESE ARE PRESENTATION INPUTS AND NOT A PLAYER REGISTRY. The people are
 * invented; nothing downstream may treat them as real accounts.
 */

import type {
  LeagueChoice,
  LeaguePlayer,
  LeaguesGlobalRow,
  LeaguesGlobalTable,
  LeaguesModel,
  LeaguesPrivateRow,
  LeaguesPrivateTable,
} from '../../models/leagues'

/**
 * The instant every world below describes.
 *
 * MODULE-LOCAL: a world carries its own `generatedAt`, so nothing outside this
 * file needs the constant.
 */
const LEAGUES_NOW = '2027-11-14T19:20:00.000Z'

const competition = {
  competitionName: 'Caledonian Premiership',
  seasonLabel: '2027/28',
  gameName: 'Match Predictor',
} as const

/* ==========================================================================
   PEOPLE — every destination shape, written out rather than derived
   ========================================================================== */

/** The caller. Marked, never linked. */
function you(displayName: string, ref: string): LeaguePlayer {
  return { ref, displayName, destination: { kind: 'you' } }
}

/** Someone the server said the caller may open, and told it where. */
function open(displayName: string, ref: string, playerId: string): LeaguePlayer {
  return { ref, displayName, destination: { kind: 'open', playerId } }
}

/**
 * A same-season entrant the caller shares no private league with.
 *
 * THE ORDINARY CASE, and the one most of a season table is made of. It is not
 * an error and it is not a degraded row.
 */
function shared(displayName: string, ref: string): LeaguePlayer {
  return { ref, displayName, destination: { kind: 'closed', reason: 'not-shared' } }
}

/**
 * A `profile` reach the server did not give an id for.
 *
 * RARE AND DELIBERATE. It exists so the surface is exercised against the one
 * case where "you may look" and "here is where" disagree, which is the case a
 * browser that inferred permission from the presence of an id would get wrong.
 */
function unaddressed(displayName: string, ref: string): LeaguePlayer {
  return { ref, displayName, destination: { kind: 'closed', reason: 'not-stated' } }
}

/* ==========================================================================
   ROW BUILDERS — every field explicit, nothing defaulted
   ========================================================================== */

function globalRow(row: {
  player: LeaguePlayer
  rank: number
  position: number
  points: number
  matchweeksPlayed: number
  tied?: boolean
  isYou?: boolean
}): LeaguesGlobalRow {
  return {
    player: row.player,
    rank: row.rank,
    tied: row.tied ?? false,
    position: row.position,
    points: row.points,
    matchweeksPlayed: row.matchweeksPlayed,
    isYou: row.isYou ?? false,
  }
}

function privateRow(row: {
  player: LeaguePlayer
  rank: number
  position: number
  points: number
  matchweeksPlayed: number
  tied?: boolean
  isYou?: boolean
  isOwner?: boolean
  hasEntry?: boolean
  moved?: number
}): LeaguesPrivateRow {
  return {
    player: row.player,
    rank: row.rank,
    tied: row.tied ?? false,
    position: row.position,
    points: row.points,
    matchweeksPlayed: row.matchweeksPlayed,
    isYou: row.isYou ?? false,
    isOwner: row.isOwner ?? false,
    hasEntry: row.hasEntry ?? true,
    movement:
      row.moved === undefined
        ? null
        : { matchweekLabel: 'Matchweek 12', places: row.moved },
  }
}

function globalTable(table: {
  rows: readonly LeaguesGlobalRow[]
  totalCount?: number
  you?: LeaguesGlobalRow | null
  hasMore?: boolean
}): LeaguesGlobalTable {
  return {
    rows: table.rows,
    totalCount: table.totalCount ?? table.rows.length,
    you: table.you ?? null,
    hasMore: table.hasMore ?? false,
  }
}

function privateTable(table: {
  leagueId: string
  name: string
  memberCount: number
  rows: readonly LeaguesPrivateRow[]
  totalCount?: number
  you?: LeaguesPrivateRow | null
  hasMore?: boolean
  movementSettled?: boolean
}): LeaguesPrivateTable {
  return {
    leagueId: table.leagueId,
    name: table.name,
    memberCount: table.memberCount,
    rows: table.rows,
    totalCount: table.totalCount ?? table.rows.length,
    you: table.you ?? null,
    hasMore: table.hasMore ?? false,
    movementSettled: table.movementSettled ?? false,
  }
}

function seasonModel(model: {
  global: LeaguesGlobalTable | null
  leagues?: readonly LeagueChoice[]
  /** False only where the list itself did not answer. */
  leaguesKnown?: boolean
  unavailable?: readonly string[]
}): LeaguesModel {
  return {
    generatedAt: LEAGUES_NOW,
    context: competition,
    scope: { kind: 'global' },
    leagues: model.leagues ?? [],
    leaguesKnown: model.leaguesKnown ?? true,
    global: model.global,
    private: null,
    unavailable: model.unavailable ?? [],
  }
}

function leagueModel(model: {
  table: LeaguesPrivateTable | null
  leagueId: string
  leagues: readonly LeagueChoice[]
  leaguesKnown?: boolean
  unavailable?: readonly string[]
}): LeaguesModel {
  return {
    generatedAt: LEAGUES_NOW,
    context: competition,
    scope: { kind: 'private', leagueId: model.leagueId },
    leagues: model.leagues,
    leaguesKnown: model.leaguesKnown ?? true,
    global: null,
    private: model.table,
    unavailable: model.unavailable ?? [],
  }
}

/* ==========================================================================
   LEAGUE LISTS
   ========================================================================== */

const sundayClub: LeagueChoice = {
  id: 'league-sunday-club',
  name: 'Sunday Club',
  memberCount: 8,
}
const office: LeagueChoice = { id: 'league-office', name: 'The Office', memberCount: 24 }
const family: LeagueChoice = { id: 'league-family', name: 'Family', memberCount: 5 }
const oldSchool: LeagueChoice = {
  id: 'league-old-school',
  name: 'Old School Friends',
  memberCount: 12,
}

/* ==========================================================================
   THE SEASON TABLE
   ========================================================================== */

/**
 * THE ORDINARY VISIT. The caller is on the page, most rows cannot be opened
 * because most of a season's entrants are strangers, and two can be.
 */
const seasonTable = seasonModel({
  leagues: [sundayClub, office],
  global: globalTable({
    rows: [
      globalRow({
        player: shared('Rhona Buchanan', 'ref-rhona'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: open('Jamie Ferguson-Whyte', 'ref-jamie', 'player-jamie'),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Callum Bruce', 'ref-callum'),
        rank: 3,
        position: 3,
        points: 205,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 4,
        position: 4,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
      }),
      globalRow({
        player: open('Martin Okafor', 'ref-martin', 'player-martin'),
        rank: 5,
        position: 5,
        points: 198,
        matchweeksPlayed: 11,
      }),
      globalRow({
        player: shared('Elspeth Nairn', 'ref-elspeth'),
        rank: 6,
        position: 6,
        points: 194,
        matchweeksPlayed: 12,
      }),
    ],
    totalCount: 6,
  }),
})

/**
 * THE PLAYER WHO IS NOT ON THE PAGE.
 *
 * The single most common shape of this table in a real competition: 412
 * entrants, twenty-five shown, and the person asking is 318th. The pinned row
 * below the table is the whole answer to "where do I stand", and a surface that
 * looked for `isYou` among the rows would have found nothing to show them.
 */
const seasonYouOffPage = seasonModel({
  leagues: [sundayClub],
  global: globalTable({
    rows: [
      globalRow({
        player: shared('Rhona Buchanan', 'ref-rhona'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Callum Bruce', 'ref-callum'),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Elspeth Nairn', 'ref-elspeth'),
        rank: 3,
        position: 3,
        points: 205,
        matchweeksPlayed: 12,
      }),
    ],
    totalCount: 412,
    hasMore: true,
    you: globalRow({
      player: you('Nicky Gregal', 'ref-you'),
      rank: 318,
      position: 318,
      points: 96,
      matchweeksPlayed: 9,
      isYou: true,
    }),
  }),
})

/**
 * TIED RANKS, AND THE ROW ORDER DOES NOT MATCH THEM.
 *
 * Four players share rank 2 and the row after them is rank 6, not rank 3. Any
 * renumbering from the array index produces 1,2,3,4,5,6 and looks perfectly
 * plausible — which is why this world exists as a picture a reviewer can
 * compare rather than as a rule somebody has to remember.
 */
const tiedRanks = seasonModel({
  leagues: [sundayClub],
  global: globalTable({
    rows: [
      globalRow({
        player: shared('Rhona Buchanan', 'ref-rhona'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Callum Bruce', 'ref-callum'),
        rank: 2,
        tied: true,
        position: 2,
        points: 205,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 2,
        tied: true,
        position: 3,
        points: 205,
        matchweeksPlayed: 12,
        isYou: true,
      }),
      globalRow({
        player: open('Martin Okafor', 'ref-martin', 'player-martin'),
        rank: 2,
        tied: true,
        position: 4,
        points: 205,
        matchweeksPlayed: 11,
      }),
      globalRow({
        player: shared('Elspeth Nairn', 'ref-elspeth'),
        rank: 2,
        tied: true,
        position: 5,
        points: 205,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Douglas Petrie', 'ref-douglas'),
        rank: 6,
        position: 6,
        points: 198,
        matchweeksPlayed: 12,
      }),
    ],
    totalCount: 6,
  }),
})

/**
 * TWO PEOPLE WITH THE SAME NAME, AND THEY MUST STAY TWO PEOPLE.
 *
 * The binding social-identity world. Both rows read "Sam Docherty"; one is
 * openable and one is not, and their references differ. A surface keying rows
 * or deciding destinations by display name collapses them — either both rows
 * become clickable, or pressing one opens the other, or React reuses one row
 * for the other on the next render. All three failures are visible here and
 * invisible in every other world.
 */
const duplicateNames = seasonModel({
  leagues: [sundayClub],
  global: globalTable({
    rows: [
      globalRow({
        player: open('Sam Docherty', 'ref-sam-a', 'player-sam-a'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Sam Docherty', 'ref-sam-b'),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: you('Sam Docherty', 'ref-sam-you'),
        rank: 3,
        position: 3,
        points: 205,
        matchweeksPlayed: 12,
        isYou: true,
      }),
      globalRow({
        player: shared('Alex Munro', 'ref-alex'),
        rank: 4,
        position: 4,
        points: 201,
        matchweeksPlayed: 12,
      }),
    ],
    totalCount: 4,
  }),
})

/**
 * NOBODY IS OPENABLE. A player in no private league shares nothing with
 * anybody, so every row is `not-shared`. There must be no button anywhere in
 * this table and nothing that looks like one — no disabled control, no lock, no
 * hover affordance that leads nowhere.
 */
const nothingOpenable = seasonModel({
  global: globalTable({
    rows: [
      globalRow({
        player: shared('Rhona Buchanan', 'ref-rhona'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: shared('Callum Bruce', 'ref-callum'),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 3,
        position: 3,
        points: 205,
        matchweeksPlayed: 12,
        isYou: true,
      }),
    ],
    totalCount: 3,
  }),
})

/**
 * EVERY ROW OPENABLE, PLUS THE ONE THE SERVER COULD NOT ADDRESS.
 *
 * The mirror of the world above, and the place `not-stated` is visible: Søren's
 * reach said profile and no id came with it, so his row is plain text like a
 * stranger's — with the one sr-only sentence that distinguishes the two facts.
 */
const everyoneOpenable = seasonModel({
  leagues: [sundayClub, office, family],
  global: globalTable({
    rows: [
      globalRow({
        player: open('Jamie Ferguson-Whyte', 'ref-jamie', 'player-jamie'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: open('Martin Okafor', 'ref-martin', 'player-martin'),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: unaddressed('Søren Kjær', 'ref-soren'),
        rank: 3,
        position: 3,
        points: 205,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 4,
        position: 4,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
      }),
    ],
    totalCount: 4,
  }),
})

/**
 * THE FIRST DAY OF THE SEASON. Everyone on nothing, from nothing. The design
 * has to be legible when the numbers carry no information at all, and it must
 * not read as an error or an empty state — this is a full table.
 */
const newSeason = seasonModel({
  leagues: [sundayClub],
  global: globalTable({
    rows: [
      globalRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 1,
        tied: true,
        position: 1,
        points: 0,
        matchweeksPlayed: 0,
        isYou: true,
      }),
      globalRow({
        player: open('Jamie Ferguson-Whyte', 'ref-jamie', 'player-jamie'),
        rank: 1,
        tied: true,
        position: 2,
        points: 0,
        matchweeksPlayed: 0,
      }),
      globalRow({
        player: shared('Rhona Buchanan', 'ref-rhona'),
        rank: 1,
        tied: true,
        position: 3,
        points: 0,
        matchweeksPlayed: 0,
      }),
    ],
    totalCount: 3,
  }),
})

/**
 * THE SEASON TABLE ITSELF DID NOT ANSWER.
 *
 * The strip says so and the page says there is no table. It does NOT say the
 * competition has no players, and it does not offer a retry it cannot honour —
 * the retry belongs to the connected states, one layer up.
 */
const seasonUnavailable = seasonModel({
  leagues: [sundayClub],
  global: null,
  unavailable: ['the season table'],
})

/**
 * THE LEAGUE LIST DID NOT ANSWER, BUT THE TABLE DID.
 *
 * A partial page and an honest one: the season table is drawn in full and the
 * strip names exactly what is missing. The chooser is absent because there is
 * nothing to choose between — not because it was hidden to tidy the failure up.
 */
const leagueListUnavailable = seasonModel({
  leaguesKnown: false,
  global: globalTable({
    rows: [
      globalRow({
        player: shared('Rhona Buchanan', 'ref-rhona'),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
      }),
      globalRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
        isYou: true,
      }),
    ],
    totalCount: 2,
  }),
  unavailable: ['your private leagues'],
})

/** NOBODY HAS ENTERED. An empty season table is an ordinary early state. */
const emptySeason = seasonModel({
  global: globalTable({ rows: [], totalCount: 0 }),
})

/* ==========================================================================
   PRIVATE LEAGUES
   ========================================================================== */

/**
 * ONE LEAGUE, NOTHING SETTLED YET.
 *
 * No movement column at all — not a column of dashes. Contract 150 forbids
 * rendering movement while `settled` is false, and a column of em-dashes is a
 * rendering of it that says "nobody moved" when the truth is "nothing has been
 * settled".
 */
const leagueUnsettled = leagueModel({
  leagueId: sundayClub.id,
  leagues: [{ ...sundayClub, memberCount: 4 }],
  table: privateTable({
    leagueId: sundayClub.id,
    name: sundayClub.name,
    memberCount: 4,
    movementSettled: false,
    rows: [
      privateRow({
        player: open('Jamie Ferguson-Whyte', 'ref-jamie', 'player-jamie'),
        rank: 1,
        position: 1,
        points: 209,
        matchweeksPlayed: 12,
        isOwner: true,
      }),
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 2,
        position: 2,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
      }),
      privateRow({
        player: open('Martin Okafor', 'ref-martin', 'player-martin'),
        rank: 3,
        position: 3,
        points: 198,
        matchweeksPlayed: 11,
      }),
      privateRow({
        player: open('Aisha Rahman', 'ref-aisha', 'player-aisha'),
        rank: 4,
        position: 4,
        points: 190,
        matchweeksPlayed: 12,
      }),
    ],
  }),
})

/**
 * A SETTLED MATCHWEEK MOVED PEOPLE. Up, down and nobody, all three in one
 * picture, each with an arrow, a colour AND a word.
 */
const leagueSettled = leagueModel({
  leagueId: sundayClub.id,
  leagues: [{ ...sundayClub, memberCount: 5 }, office],
  table: privateTable({
    leagueId: sundayClub.id,
    name: sundayClub.name,
    memberCount: 5,
    movementSettled: true,
    rows: [
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 1,
        position: 1,
        points: 209,
        matchweeksPlayed: 12,
        isYou: true,
        moved: 3,
      }),
      privateRow({
        player: open('Jamie Ferguson-Whyte', 'ref-jamie', 'player-jamie'),
        rank: 2,
        position: 2,
        points: 205,
        matchweeksPlayed: 12,
        isOwner: true,
        moved: -1,
      }),
      privateRow({
        player: open('Martin Okafor', 'ref-martin', 'player-martin'),
        rank: 3,
        position: 3,
        points: 198,
        matchweeksPlayed: 12,
        moved: 0,
      }),
      privateRow({
        player: open('Aisha Rahman', 'ref-aisha', 'player-aisha'),
        rank: 4,
        position: 4,
        points: 190,
        matchweeksPlayed: 12,
        moved: -2,
      }),
      /* Settled, but this member has no movement of their own — they joined
       * after the matchweek. `null` inside a settled table is a real gap and
       * reads as a dash, which here honestly means "no movement recorded". */
      privateRow({
        player: open('Bea', 'ref-bea', 'player-bea'),
        rank: 5,
        position: 5,
        points: 184,
        matchweeksPlayed: 10,
      }),
    ],
  }),
})

/**
 * A MEMBER WHO NEVER ENTERED THE GAME.
 *
 * Two of them, and one is the person who CREATED the league. The read includes
 * them deliberately — the alternative hides a league from its own organiser —
 * so they must be visibly marked rather than drawn on zero points beside people
 * who have actually played.
 */
const leagueWithNonEntrants = leagueModel({
  leagueId: family.id,
  leagues: [{ ...family, memberCount: 4 }, sundayClub],
  table: privateTable({
    leagueId: family.id,
    name: family.name,
    memberCount: 4,
    movementSettled: true,
    rows: [
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 1,
        position: 1,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
        moved: 1,
      }),
      privateRow({
        player: open('Aisha Rahman', 'ref-aisha', 'player-aisha'),
        rank: 2,
        position: 2,
        points: 190,
        matchweeksPlayed: 12,
        moved: -1,
      }),
      privateRow({
        player: open('Søren Kjær', 'ref-soren', 'player-soren'),
        rank: 3,
        tied: true,
        position: 3,
        points: 0,
        matchweeksPlayed: 0,
        hasEntry: false,
        isOwner: true,
      }),
      privateRow({
        player: open('Bea', 'ref-bea', 'player-bea'),
        rank: 3,
        tied: true,
        position: 4,
        points: 0,
        matchweeksPlayed: 0,
        hasEntry: false,
      }),
    ],
  }),
})

/**
 * A LEAGUE OF ONE. Somebody made it and nobody joined. It is not an error, it
 * is not empty, and the rank is meaningless but real — the design must not
 * congratulate them on being top.
 */
const leagueOfOne = leagueModel({
  leagueId: 'league-solo',
  leagues: [{ id: 'league-solo', name: 'Just Me', memberCount: 1 }, sundayClub],
  table: privateTable({
    leagueId: 'league-solo',
    name: 'Just Me',
    memberCount: 1,
    rows: [
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 1,
        position: 1,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
        isOwner: true,
      }),
    ],
  }),
})

/** Twelve names for the paged league below. Declared first: `largeLeague`
 * reads them while it is being built, and a `const` declared after it would be
 * in its temporal dead zone at import time. */
const largeLeagueNames = [
  'Rhona Buchanan',
  'Callum Bruce',
  'Elspeth Nairn',
  'Douglas Petrie',
  'Jamie Ferguson-Whyte',
  'Martin Okafor',
  'Aisha Rahman',
  'Søren Kjær',
  'Bea',
  'Alex Munro',
  'Fiona Strachan',
  'Gregor Lithgow',
] as const

/**
 * A BIG LEAGUE, PAGED, WITH THE CALLER OFF THE PAGE.
 *
 * The private-table twin of `seasonYouOffPage`: 240 members, twelve shown, the
 * caller 148th. The pinned row and the honest "Showing 12 of 240" are the two
 * things that stop this being a table that quietly omits the reader.
 */
const largeLeague = leagueModel({
  leagueId: office.id,
  leagues: [office, sundayClub],
  table: privateTable({
    leagueId: office.id,
    name: office.name,
    memberCount: 240,
    totalCount: 240,
    hasMore: true,
    movementSettled: true,
    rows: Array.from({ length: 12 }, (_, index) =>
      privateRow({
        player: open(
          largeLeagueNames[index] ?? `Member ${index + 1}`,
          `ref-office-${index + 1}`,
          `player-office-${index + 1}`,
        ),
        rank: index + 1,
        position: index + 1,
        points: 220 - index * 3,
        matchweeksPlayed: 12,
        moved: index % 3 === 0 ? 2 : index % 3 === 1 ? -1 : 0,
      }),
    ),
    you: privateRow({
      player: you('Nicky Gregal', 'ref-you'),
      rank: 148,
      position: 148,
      points: 96,
      matchweeksPlayed: 9,
      isYou: true,
      moved: -6,
    }),
  }),
})

/**
 * THE WORST REALISTIC STRINGS.
 *
 * A league name longer than any chooser chip was drawn for, a display name with
 * no spaces in it at all, and a double-barrelled name with an accent. Nothing
 * may clip, nothing may ellipsise, and the page must not scroll sideways.
 */
const longNames = leagueModel({
  leagueId: 'league-long',
  leagues: [
    {
      id: 'league-long',
      name: 'The Thursday Night Extremely Competitive Prediction Society',
      memberCount: 3,
    },
    oldSchool,
  ],
  table: privateTable({
    leagueId: 'league-long',
    name: 'The Thursday Night Extremely Competitive Prediction Society',
    memberCount: 3,
    movementSettled: true,
    rows: [
      privateRow({
        player: open(
          'Bartholomew Fitzwilliam-Cholmondeley',
          'ref-bart',
          'player-bart',
        ),
        rank: 1,
        position: 1,
        points: 214,
        matchweeksPlayed: 12,
        isOwner: true,
        moved: 1,
      }),
      privateRow({
        player: open(
          'Averyveryverylongsinglewordusernamewithnobreaks',
          'ref-longword',
          'player-longword',
        ),
        rank: 2,
        position: 2,
        points: 209,
        matchweeksPlayed: 12,
        moved: -1,
      }),
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 3,
        position: 3,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
        moved: 0,
      }),
    ],
  }),
})

/**
 * FOUR LEAGUES TO SWITCH BETWEEN. The chooser is the subject of this world:
 * five options including Season, at every width, without wrapping into a wall.
 */
const severalLeagues = leagueModel({
  leagueId: oldSchool.id,
  leagues: [sundayClub, office, family, { ...oldSchool, memberCount: 3 }],
  table: privateTable({
    leagueId: oldSchool.id,
    name: oldSchool.name,
    memberCount: 3,
    movementSettled: true,
    rows: [
      privateRow({
        player: open('Callum Bruce', 'ref-callum', 'player-callum'),
        rank: 1,
        position: 1,
        points: 212,
        matchweeksPlayed: 12,
        isOwner: true,
        moved: 0,
      }),
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 2,
        position: 2,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
        moved: 2,
      }),
      privateRow({
        player: open('Bea', 'ref-bea', 'player-bea'),
        rank: 3,
        position: 3,
        points: 184,
        matchweeksPlayed: 11,
        moved: -2,
      }),
    ],
  }),
})

/**
 * TIED INSIDE A LEAGUE, AND THE POINTS ARE THE SAME BUT THE MATCHWEEKS ARE NOT.
 *
 * ADR 0012's world. Two players on 205 from 12 and 11 matchweeks are tied on
 * the server's own rank and are NOT tied in meaning, and the only reason a
 * reader can tell is that the table refuses to print points on their own.
 */
const leagueTied = leagueModel({
  leagueId: sundayClub.id,
  leagues: [{ ...sundayClub, memberCount: 3 }],
  table: privateTable({
    leagueId: sundayClub.id,
    name: sundayClub.name,
    memberCount: 3,
    rows: [
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 1,
        tied: true,
        position: 1,
        points: 205,
        matchweeksPlayed: 12,
        isYou: true,
      }),
      privateRow({
        player: open('Martin Okafor', 'ref-martin', 'player-martin'),
        rank: 1,
        tied: true,
        position: 2,
        points: 205,
        matchweeksPlayed: 11,
      }),
      privateRow({
        player: open('Bea', 'ref-bea', 'player-bea'),
        rank: 3,
        position: 3,
        points: 190,
        matchweeksPlayed: 12,
        isOwner: true,
      }),
    ],
  }),
})

/**
 * THE CHOSEN LEAGUE'S TABLE DID NOT ANSWER, BUT THE LIST DID.
 *
 * The chooser is fully usable and shows which league was asked for; only the
 * table is missing. A page that dropped the chooser too would strand the player
 * in a league they cannot leave.
 */
const leagueTableUnavailable = leagueModel({
  leagueId: office.id,
  leagues: [sundayClub, office],
  table: null,
  unavailable: ['this league’s table'],
})

/**
 * A LEAGUE THE LIST COULD NOT NAME.
 *
 * The standings answered and the league list did not, so the table exists but
 * its name does not. "This league" is the honest label; inventing one from the
 * id would be worse than admitting it.
 */
const leagueUnnamed = leagueModel({
  leagueId: 'league-unknown',
  leagues: [],
  leaguesKnown: false,
  unavailable: ['your private leagues'],
  table: privateTable({
    leagueId: 'league-unknown',
    name: 'This league',
    memberCount: 3,
    rows: [
      privateRow({
        player: you('Nicky Gregal', 'ref-you'),
        rank: 1,
        position: 1,
        points: 201,
        matchweeksPlayed: 12,
        isYou: true,
      }),
      privateRow({
        player: open('Bea', 'ref-bea', 'player-bea'),
        rank: 2,
        position: 2,
        points: 184,
        matchweeksPlayed: 12,
      }),
    ],
  }),
})

/** AN EMPTY LEAGUE TABLE. Members exist; none has an entry the read returned. */
const leagueEmpty = leagueModel({
  leagueId: sundayClub.id,
  leagues: [{ ...sundayClub, memberCount: 0 }],
  table: privateTable({
    leagueId: sundayClub.id,
    name: sundayClub.name,
    memberCount: 0,
    rows: [],
    totalCount: 0,
  }),
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const leaguesScenarios = {
  seasonTable,
  seasonYouOffPage,
  tiedRanks,
  duplicateNames,
  nothingOpenable,
  everyoneOpenable,
  newSeason,
  emptySeason,
  seasonUnavailable,
  leagueListUnavailable,
  leagueUnsettled,
  leagueSettled,
  leagueWithNonEntrants,
  leagueOfOne,
  largeLeague,
  longNames,
  severalLeagues,
  leagueTied,
  leagueTableUnavailable,
  leagueUnnamed,
  leagueEmpty,
} as const

export type LeaguesScenarioName = keyof typeof leaguesScenarios

export const leaguesScenarioNames = Object.keys(
  leaguesScenarios,
) as readonly LeaguesScenarioName[]

/** Why each world exists, for the Storybook description and for a reviewer. */
export const leaguesScenarioPremises: Readonly<Record<LeaguesScenarioName, string>> = {
  seasonTable:
    'The ordinary visit. Most rows are strangers and cannot be opened; two are league co-members and can.',
  seasonYouOffPage:
    'The commonest real shape: 412 entrants, three shown, and the reader is 318th. The pinned row is the whole answer to "where do I stand".',
  tiedRanks:
    'Four players share rank 2 and the next row is rank 6. Any renumbering from the array index produces 1–6 and looks plausible.',
  duplicateNames:
    'THE binding social-identity world. Three rows read "Sam Docherty"; one opens, one does not, one is you. Only the reference tells them apart.',
  nothingOpenable:
    'A player in no private league shares nothing with anybody. No button, no disabled control, no lock anywhere in the table.',
  everyoneOpenable:
    'Every row openable, plus the one row whose reach said profile and carried no id. That row is plain text, with the one sentence that says why.',
  newSeason:
    'The first day. Everyone on nothing from nothing, all tied on rank 1. A full table that must not read as an error.',
  emptySeason: 'Nobody has entered yet. An ordinary early state, not a failure.',
  seasonUnavailable:
    'The season table did not answer. The page says so and does NOT say the competition has no players.',
  leagueListUnavailable:
    'The league list failed and the table did not. A partial page that names exactly what is missing.',
  leagueUnsettled:
    'Nothing has settled, so there is no movement column at all — not a column of dashes, which would say "nobody moved".',
  leagueSettled:
    'A settled matchweek. Up, down, no change and one member with no movement recorded, each with an arrow, a colour AND a word.',
  leagueWithNonEntrants:
    'Two members never entered the game, and one of them created the league. Marked, not silently ranked on zero.',
  leagueOfOne:
    'Somebody made a league and nobody joined. Rank 1 of 1 is real and meaningless, and must not be congratulated.',
  largeLeague:
    'The private twin of the off-page world: 240 members, twelve shown, the reader 148th and pinned.',
  longNames:
    'A sixty-character league name, an unbroken forty-character username and a long accented double-barrelled name. Nothing clips.',
  severalLeagues:
    'Five chooser options including Season. The control is the subject: it must work at 375 and at 1920.',
  leagueTied:
    'Tied on the server’s rank, on the same points, from different matchweek counts. ADR 0012’s world.',
  leagueTableUnavailable:
    'The chosen league’s table did not answer but the list did. The chooser stays usable so the player is not stranded.',
  leagueUnnamed:
    'Standings answered, the list did not. The table is drawn and honestly called "This league" rather than given an invented name.',
  leagueEmpty: 'A league whose members have no entries the read returned.',
}
