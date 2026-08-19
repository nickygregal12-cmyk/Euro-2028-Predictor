/**
 * STAGE 11'S DETERMINISTIC LAST MAN STANDING WORLDS.
 *
 * Each one a PREMISE rather than a data dump: the reason it exists is written
 * beside it, and a reviewer reading the Storybook group is reading the reasons.
 *
 * NOTHING HERE READS A CLOCK. Every world carries a fixed `generatedAt` and its
 * round carries a fixed `state`, so the lock a story shows is the lock the
 * fixture chose rather than whatever time the machine happens to think it is.
 * That matters more in this game than anywhere else in the lane: the state
 * decides whether a control that can end a season is on screen.
 *
 * NOTHING HERE DERIVES A SURVIVAL. Every `standing` is written out by hand, and
 * two worlds deliberately pair a standing with a club result that a derivation
 * would get wrong — a won pick beside an elimination, and a lost pick beside a
 * player who is still in.
 *
 * NO TEAM ID APPEARS EXCEPT ON A PICKABLE CLUB, which is the model's rule and
 * is visible here: the used, chosen and unavailable options below simply have
 * no id to write.
 */

import type {
  LmsFixtureChoice,
  LmsPageModel,
  LmsPickAction,
  LmsRound,
  LmsRoundState,
  LmsTeamOption,
} from '../../models/lms'

/** The instant every world below describes. Module-local by design. */
const LMS_NOW = '2027-11-14T19:20:00.000Z'

const competition = {
  competitionName: 'Caledonian Premiership',
  seasonLabel: '2027/28',
  gameName: 'Last Man Standing',
} as const

/* ==========================================================================
   PARTS
   ========================================================================== */

function option(key: string, name: string, action: LmsPickAction): LmsTeamOption {
  return { key, name, action }
}

/** A club that can be picked. THE ONLY SHAPE THAT CARRIES AN ID. */
function pickable(key: string, name: string, teamId: string): LmsTeamOption {
  return option(key, name, { kind: 'pick', teamId })
}

function used(key: string, name: string): LmsTeamOption {
  return option(key, name, { kind: 'used' })
}

function chosen(key: string, name: string): LmsTeamOption {
  return option(key, name, { kind: 'chosen' })
}

function shut(
  key: string,
  name: string,
  reason: 'locked' | 'not-open' | 'eliminated' | 'not-entered',
): LmsTeamOption {
  return option(key, name, { kind: 'unavailable', reason })
}

function fixture(
  ordinal: number,
  kickoffAt: string | null,
  home: LmsTeamOption,
  away: LmsTeamOption,
): LmsFixtureChoice {
  return { key: `fx-${ordinal}`, kickoffAt, home, away }
}

function round(state: LmsRoundState, choices: readonly LmsFixtureChoice[]): LmsRound {
  return {
    windowId: 'window-7',
    sequence: 7,
    label: 'Round 7',
    state,
    opensAt: '2027-11-10T12:00:00.000Z',
    locksAt: '2027-11-15T11:00:00.000Z',
    choices,
  }
}

/** Six fixtures, one club already spent, nothing chosen yet. */
const openChoices: readonly LmsFixtureChoice[] = [
  fixture(1, '2027-11-15T15:00:00.000Z', pickable('fx-1:home', 'Celtic', 'team-celtic'), used('fx-1:away', 'Hearts')),
  fixture(2, '2027-11-15T15:00:00.000Z', pickable('fx-2:home', 'Aberdeen', 'team-aberdeen'), pickable('fx-2:away', 'Hibernian', 'team-hibs')),
  fixture(3, '2027-11-15T17:30:00.000Z', pickable('fx-3:home', 'Rangers', 'team-rangers'), pickable('fx-3:away', 'Motherwell', 'team-motherwell')),
  fixture(4, '2027-11-16T14:00:00.000Z', pickable('fx-4:home', 'Dundee United', 'team-dundee-utd'), pickable('fx-4:away', 'St Mirren', 'team-st-mirren')),
  fixture(5, null, pickable('fx-5:home', 'Kilmarnock', 'team-kilmarnock'), pickable('fx-5:away', 'Ross County', 'team-ross-county')),
  fixture(6, '2027-11-16T16:15:00.000Z', pickable('fx-6:home', 'Livingston', 'team-livingston'), pickable('fx-6:away', 'St Johnstone', 'team-st-johnstone')),
]

function world(overrides: Partial<LmsPageModel> = {}): LmsPageModel {
  return {
    generatedAt: LMS_NOW,
    context: competition,
    standing: 'active',
    usedClubNamesInRound: ['Hearts'],
    body: { kind: 'round', round: round('open', openChoices), pick: null },
    ...overrides,
  }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

const openRound = world()

const pickMade = world({
  body: {
    kind: 'round',
    round: round('open', [
      fixture(1, '2027-11-15T15:00:00.000Z', chosen('fx-1:home', 'Celtic'), used('fx-1:away', 'Hearts')),
      ...openChoices.slice(1),
    ]),
    pick: { clubName: 'Celtic', result: null },
  },
})

/** THE BINDING WORLD for the two-verdicts rule. */
const wonButEliminated = world({
  standing: 'eliminated',
  usedClubNamesInRound: ['Hearts', 'Celtic'],
  body: {
    kind: 'round',
    round: round('settled', [
      fixture(1, '2027-11-15T15:00:00.000Z', shut('fx-1:home', 'Celtic', 'eliminated'), shut('fx-1:away', 'Hearts', 'eliminated')),
      fixture(2, '2027-11-15T15:00:00.000Z', shut('fx-2:home', 'Aberdeen', 'eliminated'), shut('fx-2:away', 'Hibernian', 'eliminated')),
    ]),
    pick: { clubName: 'Celtic', result: 'won' },
  },
})

/** The mirror. */
const lostButAlive = world({
  standing: 'active',
  usedClubNamesInRound: ['Hearts', 'Celtic'],
  body: {
    kind: 'round',
    round: round('settled', [
      fixture(1, '2027-11-15T15:00:00.000Z', shut('fx-1:home', 'Celtic', 'locked'), shut('fx-1:away', 'Hearts', 'locked')),
    ]),
    pick: { clubName: 'Celtic', result: 'lost' },
  },
})

const postponedPick = world({
  standing: 'active',
  body: {
    kind: 'round',
    round: round('settled', [
      fixture(1, null, shut('fx-1:home', 'Celtic', 'locked'), shut('fx-1:away', 'Hearts', 'locked')),
    ]),
    pick: { clubName: 'Celtic', result: 'postponed' },
  },
})

const lockedRound = world({
  body: {
    kind: 'round',
    round: round('locked', openChoices.map((choice) => ({
      ...choice,
      home: shut(choice.home.key, choice.home.name, 'locked'),
      away: shut(choice.away.key, choice.away.name, 'locked'),
    }))),
    pick: null,
  },
})

const notOpenYet = world({
  body: {
    kind: 'round',
    round: round('not-open', openChoices.map((choice) => ({
      ...choice,
      home: shut(choice.home.key, choice.home.name, 'not-open'),
      away: shut(choice.away.key, choice.away.name, 'not-open'),
    }))),
    pick: null,
  },
})

const eliminated = world({
  standing: 'eliminated',
  usedClubNamesInRound: ['Hearts', 'Celtic', 'Rangers'],
  body: {
    kind: 'round',
    round: round('open', openChoices.map((choice) => ({
      ...choice,
      home: shut(choice.home.key, choice.home.name, 'eliminated'),
      away: shut(choice.away.key, choice.away.name, 'eliminated'),
    }))),
    pick: null,
  },
})

const champion = world({
  standing: 'champion',
  usedClubNamesInRound: ['Hearts', 'Celtic', 'Rangers', 'Aberdeen'],
  body: { kind: 'no-round' },
})

const survivedLastRound = world({ standing: 'survived' })

const manyUsed = world({
  usedClubNamesInRound: [
    'Hearts',
    'Celtic',
    'Rangers',
    'Aberdeen',
    'Hibernian',
    'Motherwell',
    'St Mirren',
    'Dundee United',
  ],
  body: {
    kind: 'round',
    round: round('open', [
      fixture(1, '2027-11-15T15:00:00.000Z', used('fx-1:home', 'Celtic'), used('fx-1:away', 'Hearts')),
      fixture(2, '2027-11-15T15:00:00.000Z', used('fx-2:home', 'Aberdeen'), used('fx-2:away', 'Hibernian')),
      fixture(3, '2027-11-15T17:30:00.000Z', pickable('fx-3:home', 'Kilmarnock', 'team-kilmarnock'), used('fx-3:away', 'Motherwell')),
    ]),
    pick: null,
  },
})

const oneClubLeft = world({
  usedClubNamesInRound: ['Hearts', 'Celtic', 'Rangers', 'Aberdeen', 'Hibernian'],
  body: {
    kind: 'round',
    round: round('open', [
      fixture(1, '2027-11-15T15:00:00.000Z', used('fx-1:home', 'Celtic'), pickable('fx-1:away', 'Hearts', 'team-hearts')),
    ]),
    pick: null,
  },
})

const noRound = world({ body: { kind: 'no-round' } })

const notEntered = world({ standing: null, usedClubNamesInRound: [], body: { kind: 'not-entered' } })

const notOffered = world({ standing: null, usedClubNamesInRound: [], body: { kind: 'not-offered' } })

const unavailable = world({ standing: null, usedClubNamesInRound: [], body: { kind: 'unavailable' } })

const unscheduled = world({
  body: {
    kind: 'round',
    round: {
      ...round('not-open', openChoices.map((choice) => ({
        ...choice,
        home: shut(choice.home.key, choice.home.name, 'not-open'),
        away: shut(choice.away.key, choice.away.name, 'not-open'),
      }))),
      locksAt: null,
    },
    pick: null,
  },
})

const longClubNames = world({
  usedClubNamesInRound: ['Inverness Caledonian Thistle'],
  body: {
    kind: 'round',
    round: round('open', [
      fixture(
        1,
        '2027-11-15T15:00:00.000Z',
        pickable('fx-1:home', 'Inverness Caledonian Thistle', 'team-ict'),
        pickable('fx-1:away', 'Heart of Midlothian', 'team-hearts'),
      ),
      fixture(
        2,
        '2027-11-15T15:00:00.000Z',
        pickable('fx-2:home', 'Bonnyrigg Rose Athletic', 'team-bonnyrigg'),
        used('fx-2:away', 'Spartans'),
      ),
    ]),
    pick: null,
  },
})

const emptyRound = world({
  body: { kind: 'round', round: round('open', []), pick: null },
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const lmsScenarios = {
  openRound,
  pickMade,
  wonButEliminated,
  lostButAlive,
  postponedPick,
  lockedRound,
  notOpenYet,
  unscheduled,
  eliminated,
  champion,
  survivedLastRound,
  manyUsed,
  oneClubLeft,
  longClubNames,
  emptyRound,
  noRound,
  notEntered,
  notOffered,
  unavailable,
} as const

export type LmsScenarioName = keyof typeof lmsScenarios

export const lmsScenarioNames = Object.keys(lmsScenarios) as readonly LmsScenarioName[]

/** Why each world exists, for the Storybook description and for a reviewer. */
export const lmsScenarioPremises: Readonly<Record<LmsScenarioName, string>> = {
  openRound:
    'The ordinary visit. Six fixtures, one club already spent, nothing picked yet — one press away from spending a club for the season.',
  pickMade:
    'A pick is held. The club is marked rather than pressable, because re-picking it changes nothing, and every other club stays available.',
  wonButEliminated:
    'THE binding world. The picked club WON and the player is ELIMINATED. Only the settlement job decides survival, and a page that read the result to write the verdict would say the opposite of the truth here.',
  lostButAlive:
    'The mirror. The club LOST and the player is still in — some rules give a second life, and the browser cannot see them.',
  postponedPick:
    'The pick has no result at all. A round without one never eliminates, and the page must not read the silence as bad news.',
  lockedRound:
    'The deadline has passed. Every club is text, not a dead button, and the page says when picks closed rather than counting anything.',
  notOpenYet: 'The round has not opened. A different sentence from locked, and not a failure.',
  unscheduled:
    'A window with no deadline at all. Not open — there is nothing to beat, and the write would have nothing to validate against.',
  eliminated:
    'Out of the competition, looking at an open round. The clubs say "eliminated" rather than "locked": being out outranks being late.',
  champion: 'The last one standing. The season is over and there is nothing to pick.',
  survivedLastRound: 'Survived the last round and back for the next one.',
  manyUsed:
    'Eight clubs spent. The used list is permanent furniture rather than a detail — it is the thing a player forgets between rounds.',
  oneClubLeft:
    'One pickable club in the whole round. The count beneath the list is the warning, and it is a real state rather than an error.',
  longClubNames:
    'Inverness Caledonian Thistle against Heart of Midlothian. Nothing may clip: a club name is the one thing a player must read exactly before spending it.',
  emptyRound: 'A round with no fixtures published yet. A sentence, not an empty grid.',
  noRound: 'Entered, between rounds. Not a failure and not the end of the game.',
  notEntered:
    'The player has not joined. This game is opt-in, so it is an ordinary answer — and there is no join button, because Stage 11 does not own entry.',
  notOffered:
    'The competition season does not run this game at all. About the COMPETITION, and it must not read as "come back later".',
  unavailable: 'The round read did not answer. The only state with a retry.',
}
