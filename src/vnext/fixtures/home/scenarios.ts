/**
 * THE HOME SCENARIOS.
 *
 * Home is state-adaptive, so reviewing it against one Saturday afternoon proves
 * only that one third of it works. These are the minimum deterministic states
 * needed to see the other two, plus one edge case that has repeatedly been the
 * thing a designed page forgets:
 *
 *   1. LIVE MATCHDAY   — `workshopHomeModel`, the canonical fixture, unchanged.
 *   2. DECISION        — the same matchday four hours earlier: nothing has
 *                        kicked off, two predictions are open, the first lock
 *                        is 55 minutes away.
 *   3. COMPETITION     — the Tuesday after. Matchweek 4 is settled, matchweek 5
 *                        is on Saturday, and there is nothing to watch.
 *   4. NEW SEASON      — a user three predictions old, in no private league,
 *                        looking at fixtures that carry no venue, no head to
 *                        head and no consensus.
 *
 * ONE SCHEMA, FOUR VALUES. Every scenario is a `HomeModel` and no scenario
 * extends the type — if a state needed a new field, that would be a finding
 * about the model rather than a licence to fork it.
 *
 * THESE ARE VISUAL FIXTURES, NOT RULES. The scenarios decide what a designer is
 * looking at. They decide nothing about when a match is live, when a prediction
 * locks, what a result is worth or when points are awarded; those stay with the
 * backend, and every scenario is internally consistent precisely so a surface
 * cannot look right while showing two numbers that disagree.
 *
 * NOTHING HERE READS THE CLOCK. Every instant is a fixed ISO string, so two
 * runs of the workshop are identical and a screenshot can be diffed against
 * yesterday's.
 */

import type { Match, Scoreline } from '../../models/football'
import type { HomeModel } from '../../models/home'
import {
  WORKSHOP_COMPETITION_ID,
  againstTheCrowdMatch,
  deadlineMatch,
  featuredLiveMatch,
  halfTimeLiveMatch,
  settledMatch,
} from '../matches/matchday'
import { workshopTeams } from '../teams/teams'
import { workshopPeople } from '../players/people'
import { workshopHomeModel } from './homeModel'

/* ------------------------------------------------------------------------ *
 * 2. DECISION — Saturday 14:50, before a ball has been kicked.
 * ------------------------------------------------------------------------ */

export const DECISION_NOW = '2027-08-21T13:50:00.000Z'

/** Turn a match back into the fixture it was before kick-off. */
function beforeKickoff(match: Match, prediction: Match['prediction']): Match {
  return {
    ...match,
    status: 'upcoming',
    clock: null,
    score: null,
    prediction,
    // The lock is the kick-off, which is what the matchday's own unplayed
    // fixtures already use. Inventing a different one would be inventing a rule.
    lockAt: match.kickoff,
    isFeatured: false,
  }
}

/** A prediction that has been submitted and has not been scored yet. */
function submitted(score: Scoreline, isJoker = false): Match['prediction'] {
  return {
    score,
    status: 'submitted',
    isJoker,
    outcome: null,
    points: null,
    pointsAreProvisional: false,
  }
}

/**
 * The decision itself: the biggest fixture of the day, unpredicted, locking in
 * 55 minutes. It carries venue, head to head, both consensus groups and a
 * broadcast, which is exactly what the cinematic treatment needs to fill a hero
 * with information rather than with space.
 */
const decisionFixture: Match = {
  ...beforeKickoff(featuredLiveMatch, null),
  isFeatured: true,
}

const decisionUpcoming: readonly Match[] = [
  decisionFixture,
  beforeKickoff(halfTimeLiveMatch, submitted({ home: 1, away: 2 }, true)),
  deadlineMatch,
  againstTheCrowdMatch,
]

export const decisionHomeModel: HomeModel = {
  ...workshopHomeModel,
  generatedAt: DECISION_NOW,
  primaryAction: {
    type: 'predict',
    title: '2 predictions to make',
    description: 'Glenmore Athletic v Strathkelvin United locks at kick-off.',
    deadline: featuredLiveMatch.kickoff,
    progress: { completed: 3, total: 5 },
    routePlaceholder: 'predict/matchweek-4',
    urgency: 'urgent',
  },
  liveMatches: [],
  upcomingMatches: decisionUpcoming,
  recentResults: [settledMatch],
  recentPerformance: {
    ...workshopHomeModel.recentPerformance,
    // Nothing is being played, so nothing is provisional. Friday night's exact
    // score settled this morning and is the only thing banked today.
    provisionalPoints: 0,
    pointsToday: 6,
    matchweekPoints: 6,
  },
  activity: [
    {
      id: 'decision-activity-deadline',
      kind: 'deadline',
      headline: '2 predictions still open',
      detail: 'The first lock is Glenmore Athletic v Strathkelvin United at 15:45.',
      occurredAt: '2027-08-21T13:00:00.000Z',
      relatedMatchId: featuredLiveMatch.id,
      relatedPlayerId: null,
      emphasis: 'neutral',
    },
    {
      id: 'decision-activity-settled',
      kind: 'predictionSettled',
      headline: 'Exact score on Eastcraig v Dunveggie',
      detail: '1–2 called correctly. 6 points.',
      occurredAt: '2027-08-21T08:12:00.000Z',
      relatedMatchId: settledMatch.id,
      relatedPlayerId: null,
      emphasis: 'positive',
    },
    {
      id: 'decision-activity-rank',
      kind: 'rankChange',
      headline: 'Up 214 places overall',
      detail: 'You are 1,428th of 12,490.',
      occurredAt: '2027-08-21T08:12:00.000Z',
      relatedMatchId: null,
      relatedPlayerId: null,
      emphasis: 'positive',
    },
  ],
}

/* ------------------------------------------------------------------------ *
 * 3. COMPETITION — the Tuesday after. Nothing on, and the table is the story.
 * ------------------------------------------------------------------------ */

export const COMPETITION_NOW = '2027-08-24T19:30:00.000Z'

/** A settled fixture with the result the matchday was heading towards. */
function settle(
  match: Match,
  score: Scoreline,
  points: number,
  outcome: 'exact' | 'result' | 'missed',
): Match {
  return {
    ...match,
    status: 'fullTime',
    clock: null,
    score,
    lockAt: null,
    isFeatured: false,
    prediction: match.prediction
      ? {
          ...match.prediction,
          status: 'settled',
          outcome,
          points,
          // Settled means awarded. This is the flag the whole surface is not
          // allowed to get wrong in either direction.
          pointsAreProvisional: false,
        }
      : null,
  }
}

/**
 * A fixture with none of the optional context.
 *
 * Every nullable field in the model is null here, which is what makes these
 * useful: a surface that only ever renders the rich version has not been tested
 * against the data the product can actually get on a fixture nobody has
 * predicted yet.
 */
function plainFixture(
  id: string,
  home: Match['home'],
  away: Match['away'],
  kickoff: string,
): Match {
  return {
    id,
    competitionId: WORKSHOP_COMPETITION_ID,
    kickoff,
    status: 'upcoming',
    clock: null,
    home,
    away,
    score: null,
    venue: null,
    headToHead: null,
    broadcast: null,
    prediction: null,
    consensus: null,
    lockAt: kickoff,
    isFeatured: false,
  }
}

const competitionUpcoming: readonly Match[] = [
  plainFixture(
    'match-mw5-eastcraig-kirktonmuir',
    { team: workshopTeams.eastcraig, form: ['loss', 'draw', 'win', 'loss', 'win'], leaguePosition: 9 },
    { team: workshopTeams.kirktonmuir, form: ['draw', 'loss', 'draw', 'draw', 'draw'], leaguePosition: 10 },
    '2027-08-28T14:00:00.000Z',
  ),
  plainFixture(
    'match-mw5-dunveggie-arbrennan',
    { team: workshopTeams.dunveggie, form: ['win', 'loss', 'win', 'draw', 'win'], leaguePosition: 6 },
    { team: workshopTeams.arbrennan, form: ['win', 'win', 'draw', 'win', 'loss'], leaguePosition: 4 },
    '2027-08-28T16:30:00.000Z',
  ),
]

const competitionResults: readonly Match[] = [
  settle(featuredLiveMatch, { home: 2, away: 1 }, 6, 'exact'),
  settle(halfTimeLiveMatch, { home: 0, away: 1 }, 2, 'result'),
  settle(
    { ...deadlineMatch, prediction: submitted({ home: 1, away: 1 }) },
    { home: 0, away: 2 },
    0,
    'missed',
  ),
]

export const competitionHomeModel: HomeModel = {
  ...workshopHomeModel,
  generatedAt: COMPETITION_NOW,
  competition: {
    ...workshopHomeModel.competition,
    stageLabel: 'Matchweek 5',
    matchweekLabel: 'Matchweek 5',
    matchweekNumber: 5,
  },
  primaryAction: {
    type: 'predict',
    title: 'Matchweek 5 is open',
    description: 'Two fixtures to call before Saturday.',
    deadline: '2027-08-28T14:00:00.000Z',
    progress: { completed: 0, total: 2 },
    routePlaceholder: 'predict/matchweek-5',
    urgency: 'calm',
  },
  liveMatches: [],
  upcomingMatches: competitionUpcoming,
  recentResults: competitionResults,
  recentPerformance: {
    totalPoints: 133,
    matchweekPoints: 0,
    pointsToday: 0,
    provisionalPoints: 0,
    rank: 1102,
    rankOutOf: 12490,
    rankMovement: { direction: 'up', places: 326 },
    accuracy: {
      predicted: 38,
      exact: 10,
      resultOnly: 15,
      missed: 13,
    },
    matchweekHistory: [
      { matchweek: 1, points: 12 },
      { matchweek: 2, points: 4 },
      { matchweek: 3, points: 19 },
      { matchweek: 4, points: 14 },
    ],
  },
  privateLeagues: [
    {
      id: 'league-work',
      name: 'Work League',
      participantCount: 11,
      userRank: 2,
      userPoints: 133,
      userMovement: { direction: 'none', places: 0 },
      gapToLeader: 4,
      leaderName: 'Jamie Ferguson-Whyte',
      standings: [
        {
          player: workshopPeople.jamie,
          rank: 1,
          points: 137,
          movement: { direction: 'none', places: 0 },
          isUser: false,
        },
        {
          player: workshopPeople.user,
          rank: 2,
          points: 133,
          movement: { direction: 'none', places: 0 },
          isUser: true,
        },
        {
          player: workshopPeople.martin,
          rank: 3,
          points: 130,
          movement: { direction: 'up', places: 1 },
          isUser: false,
        },
        {
          player: workshopPeople.soren,
          rank: 4,
          points: 124,
          movement: { direction: 'down', places: 1 },
          isUser: false,
        },
      ],
    },
    {
      id: 'league-sunday',
      name: 'Sunday Morning Five-a-side Survivors',
      participantCount: 6,
      userRank: 1,
      userPoints: 133,
      userMovement: { direction: 'none', places: 0 },
      gapToLeader: 0,
      leaderName: 'Nicky Gregal',
      standings: [
        {
          player: workshopPeople.user,
          rank: 1,
          points: 133,
          movement: { direction: 'none', places: 0 },
          isUser: true,
        },
        {
          player: workshopPeople.bea,
          rank: 2,
          points: 128,
          movement: { direction: 'none', places: 0 },
          isUser: false,
        },
        {
          player: workshopPeople.aisha,
          rank: 3,
          points: 121,
          movement: { direction: 'none', places: 0 },
          isUser: false,
        },
      ],
    },
  ],
  rivals: [
    {
      player: workshopPeople.jamie,
      relation: 'closestAbove',
      rank: 1,
      points: 137,
      movement: { direction: 'none', places: 0 },
      pointsDifference: 4,
      sharedLeagueName: 'Work League',
      headline: '4 points to catch Jamie',
    },
    {
      player: workshopPeople.martin,
      relation: 'closestBelow',
      rank: 3,
      points: 130,
      movement: { direction: 'up', places: 1 },
      pointsDifference: -3,
      sharedLeagueName: 'Work League',
      headline: 'Martin closed to 3 behind you',
    },
    {
      player: workshopPeople.bea,
      relation: 'closestBelow',
      rank: 2,
      points: 128,
      movement: { direction: 'none', places: 0 },
      pointsDifference: -5,
      sharedLeagueName: 'Sunday Morning Five-a-side Survivors',
      headline: 'Bea is 5 behind you',
    },
    {
      player: workshopPeople.soren,
      relation: 'friend',
      rank: 4,
      points: 124,
      movement: { direction: 'down', places: 1 },
      pointsDifference: -9,
      sharedLeagueName: 'Work League',
      headline: null,
    },
  ],
  activity: [
    {
      id: 'competition-activity-open',
      kind: 'deadline',
      headline: 'Matchweek 5 predictions are open',
      detail: 'Two fixtures, both locking at kick-off on Saturday.',
      occurredAt: '2027-08-24T09:00:00.000Z',
      relatedMatchId: null,
      relatedPlayerId: null,
      emphasis: 'neutral',
    },
    {
      id: 'competition-activity-rank',
      kind: 'rankChange',
      headline: 'Up 326 places overall',
      detail: 'Matchweek 4 was your best yet: 14 points.',
      occurredAt: '2027-08-23T07:30:00.000Z',
      relatedMatchId: null,
      relatedPlayerId: null,
      emphasis: 'positive',
    },
    {
      id: 'competition-activity-rival',
      kind: 'rivalMove',
      headline: 'Martin closed the gap to 3',
      detail: 'He has taken 9 points off you over two matchweeks.',
      occurredAt: '2027-08-23T07:30:00.000Z',
      relatedMatchId: null,
      relatedPlayerId: 'player-martin',
      emphasis: 'negative',
    },
    {
      id: 'competition-activity-settled',
      kind: 'predictionSettled',
      headline: 'Exact score on Glenmore v Strathkelvin',
      detail: '2–1 called correctly. 6 points.',
      occurredAt: '2027-08-21T17:05:00.000Z',
      relatedMatchId: featuredLiveMatch.id,
      relatedPlayerId: null,
      emphasis: 'positive',
    },
  ],
}

/* ------------------------------------------------------------------------ *
 * 4. NEW SEASON — three predictions old, no league, and fixtures that carry
 *    almost no optional context.
 * ------------------------------------------------------------------------ */

/**
 * The football a new user actually sees.
 *
 * `venue`, `headToHead`, `consensus` and `broadcast` are all nullable in the
 * model because no backend guarantee for them exists, and a surface that only
 * ever renders the rich version is a surface that has not been tested against
 * the data the product can actually get. These fixtures supply none of them.
 */
const bareUpcoming: readonly Match[] = competitionUpcoming
const bareResult: Match = {
  ...plainFixture(
    'match-mw4-porthaven-balmorral',
    { team: workshopTeams.porthaven, form: ['win', 'win', 'win'], leaguePosition: 3 },
    { team: workshopTeams.balmorral, form: ['draw', 'win', 'loss'], leaguePosition: 5 },
    '2027-08-21T14:00:00.000Z',
  ),
  status: 'fullTime',
  score: { home: 2, away: 0 },
  lockAt: null,
  prediction: {
    score: { home: 2, away: 1 },
    status: 'settled',
    isJoker: false,
    outcome: 'result',
    points: 2,
    pointsAreProvisional: false,
  },
}

export const newSeasonHomeModel: HomeModel = {
  generatedAt: COMPETITION_NOW,
  user: workshopPeople.aisha,
  competition: {
    ...workshopHomeModel.competition,
    stageLabel: 'Matchweek 5',
    matchweekLabel: 'Matchweek 5',
    matchweekNumber: 5,
  },
  primaryAction: {
    type: 'joinLeague',
    title: 'Play against someone',
    description: 'Private leagues are where the game gets its edge.',
    deadline: null,
    progress: null,
    routePlaceholder: 'leagues/join',
    urgency: 'calm',
  },
  liveMatches: [],
  upcomingMatches: bareUpcoming,
  recentResults: [bareResult],
  recentPerformance: {
    totalPoints: 12,
    matchweekPoints: 0,
    pointsToday: 0,
    provisionalPoints: 0,
    rank: 9840,
    rankOutOf: 12490,
    // A player with no previous position has not moved anywhere, and drawing a
    // flat arrow would claim they held a rank they never had.
    rankMovement: { direction: 'new', places: 0 },
    accuracy: {
      predicted: 4,
      exact: 0,
      resultOnly: 2,
      missed: 2,
    },
    matchweekHistory: [{ matchweek: 4, points: 12 }],
  },
  privateLeagues: [],
  rivals: [],
  activity: [
    {
      id: 'new-activity-open',
      kind: 'deadline',
      headline: 'Matchweek 5 predictions are open',
      detail: 'Two fixtures, both locking at kick-off on Saturday.',
      occurredAt: '2027-08-24T09:00:00.000Z',
      relatedMatchId: null,
      relatedPlayerId: null,
      emphasis: 'neutral',
    },
    {
      id: 'new-activity-first',
      kind: 'predictionSettled',
      headline: 'Right result on Porthaven v Balmorral',
      detail: '2 points from your first matchweek.',
      occurredAt: '2027-08-21T16:00:00.000Z',
      relatedMatchId: bareResult.id,
      relatedPlayerId: null,
      emphasis: 'positive',
    },
  ],
}

/* ------------------------------------------------------------------------ *
 * 5. REDUCED — every figure the real application cannot currently state.
 * ------------------------------------------------------------------------ */

/**
 * WHAT HOME LOOKS LIKE WHEN THE TRUTH IS THIN, and it is a fifth scenario
 * rather than an edit to the four above for a reason worth stating.
 *
 * The four scenarios are the accepted visual authority. Stage 4 passed on those
 * exact compositions, so real integration is not allowed to reach back and
 * change one of them — a screenshot that moves because a later stage learned
 * something is a baseline that proves nothing. This is added beside them.
 *
 * IT EXISTS BECAUSE THE NULLS ARE NOW REACHABLE. `rank`, `rankOutOf`,
 * `rankMovement`, `pointsToday` and `provisionalPoints` all became nullable when
 * Home met real reads, and a nullable field with no scenario behind it is a
 * state nobody has ever looked at. Every one of them is null here, at once,
 * which is the honest worst case: a player whose first matchweek has not
 * settled, in a season whose competition has no palette, with no private
 * league, no rival, no activity and no live football.
 *
 * It is a TRUTH fixture, not a design proposal. The reduced page must still read
 * as the same product — same masthead, same surfaces, same type — and this is
 * what the browser matrix measures that against.
 */
export const reducedHomeModel: HomeModel = {
  generatedAt: COMPETITION_NOW,
  user: workshopPeople.aisha,
  competition: {
    ...workshopHomeModel.competition,
    stageLabel: 'Matchweek 5',
    matchweekLabel: 'Matchweek 5',
    matchweekNumber: 5,
    // No application source holds a competition palette. The shell falls back
    // to its own atmosphere, which is what this proves.
    colours: null,
  },
  primaryAction: {
    type: 'predict',
    title: 'Predict matchweek 5',
    description: 'Two fixtures to go before Saturday.',
    deadline: '2027-08-28T14:00:00.000Z',
    progress: { completed: 0, total: 2 },
    routePlaceholder: 'fixtures/matchweek-5',
    urgency: 'calm',
  },
  liveMatches: [],
  upcomingMatches: bareUpcoming,
  recentResults: [],
  recentPerformance: {
    totalPoints: 0,
    matchweekPoints: 0,
    // Not zero. Nobody said what was banked today, or what is on the pitch, and
    // the difference between "nothing" and "not known" is the whole point.
    pointsToday: null,
    provisionalPoints: null,
    rank: null,
    rankOutOf: null,
    rankMovement: null,
    accuracy: { predicted: 0, exact: 0, resultOnly: 0, missed: 0 },
    matchweekHistory: [],
  },
  privateLeagues: [],
  rivals: [],
  activity: [],
}

/** Every Home scenario, for the stories and the consistency suite. */
/**
 * THE PLAYER WHO HAS BEEN AWAY.
 *
 * The competition world, plus the one thing a device knows that the
 * application does not: which of the settled results this reader has not seen.
 * It exists as a world of its own because "since you were last here" is
 * ABSENT from every other scenario — a first visit has no marker, and a
 * reviewer needs a board where the zone is actually drawn.
 *
 * `more` says the list is a sample rather than the whole weekend, which is the
 * honesty rule the Hub's own recap follows: a cap nobody can see reads as "we
 * covered everything".
 */
const returningHomeModel: HomeModel = {
  ...competitionHomeModel,
  /*
   * TWO OF THE THREE, AND `more` IS THE THIRD.
   *
   * It used to be all three with `more: 2`, which was a fixture that lied: the
   * "and 2 more" line promised results that were not in this world at all, and
   * Around the Grounds had nothing left to put under "Already settled". A
   * scenario whose own numbers do not add up is worse than no scenario,
   * because it looks right in a screenshot.
   */
  sinceLastVisit: {
    results: competitionResults.slice(0, 2),
    more: 1,
  },
  /*
   * AND WHAT THOSE RESULTS WERE WORTH. The two zones are a pair on the day a
   * matchweek settles — one says which matches finished, the other says what
   * they did to the reader — so the board that shows either shows both, which
   * is the only way a reviewer can check they do not say the same thing twice.
   *
   * Every figure agrees with `competitionHomeModel`'s own standing: 133 season
   * points, 1,102nd of 12,490. A fixture whose recap disagreed with the
   * masthead above it would look right in isolation and wrong on the page.
   */
  matchweekRecap: {
    matchweekLabel: 'Matchweek 4',
    matchweekOrdinal: 4,
    points: 14,
    jokerPlayed: true,
    seasonPoints: 133,
    seasonRank: 1102,
    fieldSize: 12490,
    exactScores: 10,
    correctOutcomes: 15,
    leagues: [
      {
        leagueId: 'league-work',
        leagueName: 'The Work League',
        rankBefore: 4,
        rankAfter: 2,
        movement: 2,
        // ELEVEN, MATCHING THE LADDER ABOVE IT. The league race on the same
        // page says "11 players"; a recap that said 9 would be the same league
        // two different sizes on one screen.
        fieldSize: 11,
        gapToLeader: 4,
      },
    ],
  },
}

export const homeScenarios = {
  live: workshopHomeModel,
  decision: decisionHomeModel,
  competition: competitionHomeModel,
  returning: returningHomeModel,
  newSeason: newSeasonHomeModel,
  reduced: reducedHomeModel,
} as const

export type HomeScenarioName = keyof typeof homeScenarios
