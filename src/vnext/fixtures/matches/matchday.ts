/**
 * One carefully designed fictional matchday.
 *
 * The point is not volume. Five matches are enough to put every state the
 * interface has to survive on the screen at once:
 *
 *   1. a featured live match where the user's prediction is currently exact;
 *   2. a second live match, at half-time, where a joker is going badly;
 *   3. an upcoming match with an imminent deadline and NO prediction — the
 *      action the whole surface should be pushing towards;
 *   4. an upcoming match where the crowd is overwhelmingly on one side and the
 *      user has gone the other way;
 *   5. a settled match from Friday night that the user got exactly right.
 *
 * Every instant is a fixed ISO string and `MATCHDAY_NOW` is the instant the
 * scenario describes. Nothing here calls `Date.now()`, so two runs of the
 * workshop are identical and a story can be diffed against yesterday's.
 */

import type { Match, Venue } from '../../models/football'
import { workshopTeams } from '../teams/teams'

/** The instant this matchday describes. Pass it to components as `now`. */
export const MATCHDAY_NOW = '2027-08-21T15:52:00.000Z'

export const WORKSHOP_COMPETITION_ID = 'competition-workshop-premiership'

const venues = {
  glenPark: {
    name: 'Glen Park',
    city: 'Glenmore',
    capacity: 21400,
  },
  carrickRoad: {
    name: 'Carrick Road Stadium',
    city: 'Carrickvale',
    capacity: 13250,
  },
  caledonianStadium: {
    name: 'Caledonian Stadium',
    city: 'Inverness',
    capacity: 9800,
  },
  wanderersPark: {
    name: 'Kirkton Muir Park',
    city: 'Kirktonmuir',
    capacity: 7600,
  },
  albionField: {
    name: 'Albion Field',
    city: 'Eastcraig',
    capacity: 11100,
  },
} as const satisfies Record<string, Venue>

/** Live, featured, and the user is currently exactly right. */
export const featuredLiveMatch: Match = {
  id: 'match-glenmore-strathkelvin',
  competitionId: WORKSHOP_COMPETITION_ID,
  kickoff: '2027-08-21T14:45:00.000Z',
  status: 'live',
  clock: { minute: 67, addedMinutes: null, label: "67'" },
  home: {
    team: workshopTeams.glenmore,
    form: ['win', 'win', 'draw', 'loss', 'win'],
    leaguePosition: 2,
  },
  away: {
    team: workshopTeams.strathkelvin,
    form: ['win', 'win', 'win', 'draw', 'win'],
    leaguePosition: 1,
  },
  score: { home: 2, away: 1 },
  venue: venues.glenPark,
  headToHead: {
    played: 6,
    homeWins: 2,
    draws: 1,
    awayWins: 3,
    lastMeeting: {
      summary: 'Strathkelvin won at Glen Park',
      score: { home: 0, away: 2 },
      playedOn: '2027-04-03T14:00:00.000Z',
    },
  },
  broadcast: 'Premiership Live',
  prediction: {
    score: { home: 2, away: 1 },
    status: 'locked',
    isJoker: false,
    outcome: null,
    points: 6,
    pointsAreProvisional: true,
  },
  consensus: {
    community: {
      label: 'Everyone',
      sampleSize: 1840,
      popular: [
        { score: { home: 1, away: 2 }, share: 0.21 },
        { score: { home: 1, away: 1 }, share: 0.18 },
        { score: { home: 2, away: 1 }, share: 0.11 },
      ],
      homeWinShare: 0.29,
      drawShare: 0.24,
      awayWinShare: 0.47,
    },
    friends: {
      label: 'Work League',
      sampleSize: 11,
      popular: [
        { score: { home: 1, away: 2 }, share: 0.36 },
        { score: { home: 2, away: 1 }, share: 0.27 },
      ],
      homeWinShare: 0.36,
      drawShare: 0.18,
      awayWinShare: 0.46,
    },
  },
  lockAt: null,
  isFeatured: true,
}

/** Live and at half-time, with the user's joker on the wrong scoreline. */
export const halfTimeLiveMatch: Match = {
  id: 'match-carrickvale-balmorral',
  competitionId: WORKSHOP_COMPETITION_ID,
  kickoff: '2027-08-21T15:05:00.000Z',
  status: 'halfTime',
  clock: { minute: 45, addedMinutes: null, label: 'HT' },
  home: {
    team: workshopTeams.carrickvale,
    form: ['loss', 'draw', 'loss', 'loss', 'draw'],
    leaguePosition: 11,
  },
  away: {
    team: workshopTeams.balmorral,
    form: ['draw', 'win', 'loss', 'win', 'win'],
    leaguePosition: 5,
  },
  score: { home: 0, away: 0 },
  venue: venues.carrickRoad,
  headToHead: {
    played: 5,
    homeWins: 1,
    draws: 2,
    awayWins: 2,
    lastMeeting: {
      summary: 'Honours even at Carrick Road',
      score: { home: 1, away: 1 },
      playedOn: '2027-02-14T15:00:00.000Z',
    },
  },
  broadcast: null,
  prediction: {
    score: { home: 1, away: 2 },
    status: 'locked',
    isJoker: true,
    outcome: null,
    points: 0,
    pointsAreProvisional: true,
  },
  consensus: {
    community: {
      label: 'Everyone',
      sampleSize: 1622,
      popular: [
        { score: { home: 0, away: 1 }, share: 0.19 },
        { score: { home: 1, away: 1 }, share: 0.17 },
        { score: { home: 1, away: 2 }, share: 0.12 },
      ],
      homeWinShare: 0.22,
      drawShare: 0.3,
      awayWinShare: 0.48,
    },
    friends: null,
  },
  lockAt: null,
  isFeatured: false,
}

/** Kicks off in 38 minutes and the user has not predicted it. */
export const deadlineMatch: Match = {
  id: 'match-invercaledonian-porthaven',
  competitionId: WORKSHOP_COMPETITION_ID,
  kickoff: '2027-08-21T16:30:00.000Z',
  status: 'upcoming',
  clock: null,
  home: {
    team: workshopTeams.invercaledonian,
    form: ['loss', 'win', 'draw', 'win', 'loss'],
    leaguePosition: 8,
  },
  away: {
    team: workshopTeams.porthaven,
    form: ['win', 'win', 'win', 'win', 'draw'],
    leaguePosition: 3,
  },
  score: null,
  venue: venues.caledonianStadium,
  headToHead: {
    played: 4,
    homeWins: 0,
    draws: 1,
    awayWins: 3,
    lastMeeting: {
      summary: 'Porthaven won comfortably',
      score: { home: 0, away: 3 },
      playedOn: '2027-01-22T19:45:00.000Z',
    },
  },
  broadcast: 'Premiership Live',
  prediction: null,
  // Reveal is a backend rule. Before the user has predicted, the workshop shows
  // only how the crowd is leaning, never the individual predictions behind it.
  consensus: {
    community: {
      label: 'Everyone',
      sampleSize: 1204,
      popular: [
        { score: { home: 0, away: 2 }, share: 0.24 },
        { score: { home: 1, away: 2 }, share: 0.19 },
        { score: { home: 0, away: 1 }, share: 0.16 },
      ],
      homeWinShare: 0.11,
      drawShare: 0.17,
      awayWinShare: 0.72,
    },
    friends: null,
  },
  lockAt: '2027-08-21T16:30:00.000Z',
  isFeatured: false,
}

/** Tomorrow. The crowd is heavily one way; the user has gone the other. */
export const againstTheCrowdMatch: Match = {
  id: 'match-kirktonmuir-arbrennan',
  competitionId: WORKSHOP_COMPETITION_ID,
  kickoff: '2027-08-22T11:00:00.000Z',
  status: 'upcoming',
  clock: null,
  home: {
    team: workshopTeams.kirktonmuir,
    form: ['draw', 'loss', 'draw', 'draw', 'win'],
    leaguePosition: 9,
  },
  away: {
    team: workshopTeams.arbrennan,
    form: ['win', 'win', 'draw', 'win', 'win'],
    leaguePosition: 4,
  },
  score: null,
  venue: venues.wanderersPark,
  headToHead: {
    played: 3,
    homeWins: 1,
    draws: 0,
    awayWins: 2,
    lastMeeting: {
      summary: 'Arbrennan came from behind',
      score: { home: 1, away: 2 },
      playedOn: '2026-12-27T15:00:00.000Z',
    },
  },
  broadcast: null,
  prediction: {
    score: { home: 2, away: 0 },
    status: 'submitted',
    isJoker: false,
    outcome: null,
    points: null,
    pointsAreProvisional: false,
  },
  consensus: {
    community: {
      label: 'Everyone',
      sampleSize: 986,
      popular: [
        { score: { home: 0, away: 2 }, share: 0.27 },
        { score: { home: 1, away: 2 }, share: 0.22 },
        { score: { home: 0, away: 1 }, share: 0.14 },
      ],
      homeWinShare: 0.09,
      drawShare: 0.15,
      awayWinShare: 0.76,
    },
    friends: {
      label: 'Work League',
      sampleSize: 9,
      popular: [
        { score: { home: 0, away: 2 }, share: 0.44 },
        { score: { home: 1, away: 1 }, share: 0.22 },
      ],
      homeWinShare: 0.11,
      drawShare: 0.22,
      awayWinShare: 0.67,
    },
  },
  lockAt: '2027-08-22T11:00:00.000Z',
  isFeatured: false,
}

/** Friday night, settled, and the user called it exactly. */
export const settledMatch: Match = {
  id: 'match-eastcraig-dunveggie',
  competitionId: WORKSHOP_COMPETITION_ID,
  kickoff: '2027-08-20T18:45:00.000Z',
  status: 'fullTime',
  clock: null,
  home: {
    team: workshopTeams.eastcraig,
    form: ['loss', 'draw', 'win', 'loss', 'loss'],
    leaguePosition: 10,
  },
  away: {
    team: workshopTeams.dunveggie,
    form: ['win', 'loss', 'win', 'draw', 'win'],
    leaguePosition: 6,
  },
  score: { home: 1, away: 2 },
  venue: venues.albionField,
  headToHead: {
    played: 7,
    homeWins: 3,
    draws: 2,
    awayWins: 2,
    lastMeeting: {
      summary: 'Eastcraig edged it late',
      score: { home: 2, away: 1 },
      playedOn: '2027-03-06T15:00:00.000Z',
    },
  },
  broadcast: 'Friday Night Football',
  prediction: {
    score: { home: 1, away: 2 },
    status: 'settled',
    isJoker: false,
    outcome: 'exact',
    points: 6,
    pointsAreProvisional: false,
  },
  consensus: {
    community: {
      label: 'Everyone',
      sampleSize: 1731,
      popular: [
        { score: { home: 1, away: 1 }, share: 0.2 },
        { score: { home: 1, away: 2 }, share: 0.13 },
        { score: { home: 2, away: 1 }, share: 0.12 },
      ],
      homeWinShare: 0.35,
      drawShare: 0.28,
      awayWinShare: 0.37,
    },
    friends: {
      label: 'Work League',
      sampleSize: 12,
      popular: [
        { score: { home: 1, away: 1 }, share: 0.33 },
        { score: { home: 1, away: 2 }, share: 0.17 },
      ],
      homeWinShare: 0.33,
      drawShare: 0.34,
      awayWinShare: 0.33,
    },
  },
  lockAt: null,
  isFeatured: false,
}

/**
 * A postponed fixture, and deliberately NOT part of the matchday above.
 *
 * The scenario is five matches for a reason — it is the set every story,
 * screenshot and concept is judged against, and a sixth card in every rail
 * would change what is being reviewed. This one exists so the `postponed`
 * status in the presentation model has something to render: a card that says
 * so, keeps the clubs and their context, and offers no prediction action.
 *
 * The clubs repeat two from the matchday, which is why it stays outside
 * `workshopMatchday` — a club cannot appear twice in one matchday.
 *
 * Nothing here decides what a postponement DOES. Whether the prediction below
 * survives, when a rearranged lock opens and what becomes of a joker are
 * backend rules; the fixture only says the fixture is off.
 */
export const postponedMatch: Match = {
  id: 'match-balmorral-eastcraig-postponed',
  competitionId: WORKSHOP_COMPETITION_ID,
  kickoff: '2027-08-21T14:00:00.000Z',
  status: 'postponed',
  clock: null,
  home: {
    team: workshopTeams.balmorral,
    form: ['draw', 'win', 'loss', 'win', 'win'],
    leaguePosition: 5,
  },
  away: {
    team: workshopTeams.eastcraig,
    form: ['loss', 'draw', 'win', 'loss', 'loss'],
    leaguePosition: 10,
  },
  score: null,
  venue: venues.carrickRoad,
  headToHead: {
    played: 4,
    homeWins: 2,
    draws: 1,
    awayWins: 1,
    lastMeeting: {
      summary: 'Balmorral won on a wet Tuesday',
      score: { home: 2, away: 0 },
      playedOn: '2027-02-02T19:45:00.000Z',
    },
  },
  broadcast: null,
  prediction: {
    score: { home: 2, away: 1 },
    status: 'submitted',
    isJoker: false,
    outcome: null,
    points: null,
    pointsAreProvisional: false,
  },
  consensus: null,
  // No deadline: the one that existed belonged to a kick-off that is not
  // happening, and inventing a new one would be inventing a rule.
  lockAt: null,
  isFeatured: false,
}

export const liveMatches: readonly Match[] = [
  featuredLiveMatch,
  halfTimeLiveMatch,
]

export const upcomingMatches: readonly Match[] = [
  deadlineMatch,
  againstTheCrowdMatch,
]

export const recentResults: readonly Match[] = [settledMatch]

export const workshopMatchday: readonly Match[] = [
  ...liveMatches,
  ...upcomingMatches,
  ...recentResults,
]
