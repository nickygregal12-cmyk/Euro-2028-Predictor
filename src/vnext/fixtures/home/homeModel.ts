/**
 * The workshop's Home model: the matchday in `../matches/matchday.ts` seen from
 * the signed-in user's position in the game.
 *
 * The numbers are internally consistent on purpose — the user's 125 points are
 * the same 125 that put them second in the Work League, two behind Jamie — so a
 * concept that shows the same figure in two places cannot accidentally look
 * right while being wrong. None of it is authoritative: scoring, ranking and
 * settlement stay with the backend.
 */

import type { HomeModel } from '../../models/home'
import {
  MATCHDAY_NOW,
  WORKSHOP_COMPETITION_ID,
  liveMatches,
  recentResults,
  upcomingMatches,
} from '../matches/matchday'
import { workshopPeople } from '../players/people'

export const workshopHomeModel: HomeModel = {
  generatedAt: MATCHDAY_NOW,
  user: workshopPeople.user,
  competition: {
    id: WORKSHOP_COMPETITION_ID,
    name: 'Caledonian Premiership',
    shortName: 'Premiership',
    seasonLabel: '2027/28',
    stageLabel: 'Matchweek 4',
    matchweekLabel: 'Matchweek 4',
    matchweekNumber: 4,
    colours: {
      primary: '#123B72',
      accent: '#37E0A0',
    },
  },
  primaryAction: {
    type: 'predict',
    title: '2 predictions to make',
    description: 'Inverness Caledonian Rangers v Porthaven City locks at kick-off.',
    deadline: '2027-08-21T16:30:00.000Z',
    progress: { completed: 3, total: 5 },
    routePlaceholder: 'predict/matchweek-4',
    urgency: 'urgent',
  },
  secondaryActions: [],
  liveMatches,
  upcomingMatches,
  recentResults,
  recentPerformance: {
    totalPoints: 125,
    matchweekPoints: 6,
    // Friday night's match was confirmed and settled this morning, which is why
    // points banked "today" and points from "this matchweek" agree here.
    pointsToday: 6,
    provisionalPoints: 6,
    rank: 1428,
    rankOutOf: 12490,
    rankMovement: { direction: 'up', places: 214 },
    accuracy: {
      predicted: 34,
      exact: 9,
      resultOnly: 14,
      missed: 11,
    },
    matchweekHistory: [
      { matchweek: 1, points: 12 },
      { matchweek: 2, points: 4 },
      { matchweek: 3, points: 19 },
      { matchweek: 4, points: 6 },
    ],
  },
  privateLeagues: [
    {
      id: 'league-work',
      name: 'Work League',
      participantCount: 11,
      userRank: 2,
      userPoints: 125,
      userMovement: { direction: 'up', places: 2 },
      gapToLeader: 2,
      leaderName: 'Jamie Ferguson-Whyte',
      standings: [
        {
          player: workshopPeople.jamie,
          rank: 1,
          points: 127,
          movement: { direction: 'down', places: 1 },
          isUser: false,
        },
        {
          player: workshopPeople.user,
          rank: 2,
          points: 125,
          movement: { direction: 'up', places: 2 },
          isUser: true,
        },
        {
          player: workshopPeople.martin,
          rank: 3,
          points: 122,
          movement: { direction: 'down', places: 1 },
          isUser: false,
        },
        {
          player: workshopPeople.soren,
          rank: 4,
          points: 118,
          movement: { direction: 'none', places: 0 },
          isUser: false,
        },
      ],
    },
    {
      id: 'league-sunday',
      name: 'Sunday Morning Five-a-side Survivors',
      participantCount: 6,
      userRank: 1,
      userPoints: 125,
      userMovement: { direction: 'none', places: 0 },
      gapToLeader: 0,
      leaderName: 'Nicky Gregal',
      standings: [
        {
          player: workshopPeople.user,
          rank: 1,
          points: 125,
          movement: { direction: 'none', places: 0 },
          isUser: true,
        },
        {
          player: workshopPeople.bea,
          rank: 2,
          points: 119,
          movement: { direction: 'up', places: 1 },
          isUser: false,
        },
        {
          player: workshopPeople.aisha,
          rank: 3,
          points: 117,
          movement: { direction: 'down', places: 1 },
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
      points: 127,
      movement: { direction: 'down', places: 1 },
      pointsDifference: 2,
      sharedLeagueName: 'Work League',
      headline: '2 points to catch Jamie',
    },
    {
      player: workshopPeople.martin,
      relation: 'closestBelow',
      rank: 3,
      points: 122,
      movement: { direction: 'down', places: 1 },
      pointsDifference: -3,
      sharedLeagueName: 'Work League',
      headline: 'Martin is 3 behind you',
    },
    {
      player: workshopPeople.bea,
      relation: 'closestBelow',
      rank: 2,
      points: 119,
      movement: { direction: 'up', places: 1 },
      pointsDifference: -6,
      sharedLeagueName: 'Sunday Morning Five-a-side Survivors',
      headline: 'Bea gained 6 on you this week',
    },
    {
      player: workshopPeople.soren,
      relation: 'friend',
      rank: 4,
      points: 118,
      movement: { direction: 'none', places: 0 },
      pointsDifference: -7,
      sharedLeagueName: 'Work League',
      headline: null,
    },
  ],
  activity: [
    {
      id: 'activity-live-lead',
      kind: 'liveEvent',
      headline: 'Glenmore lead 2–1 on 63 minutes',
      detail: 'Your 2–1 is exact right now — 6 points on the pitch.',
      occurredAt: '2027-08-21T15:48:00.000Z',
      relatedMatchId: 'match-glenmore-strathkelvin',
      relatedPlayerId: null,
      emphasis: 'positive',
    },
    {
      id: 'activity-rival-jamie',
      kind: 'rivalMove',
      headline: 'Jamie took the Work League lead',
      detail: 'Jamie is 2 points ahead with two matches still to play.',
      occurredAt: '2027-08-21T15:30:00.000Z',
      relatedMatchId: null,
      relatedPlayerId: 'player-jamie',
      emphasis: 'negative',
    },
    {
      id: 'activity-deadline',
      kind: 'deadline',
      headline: '2 predictions still open',
      detail: 'Inverness Caledonian Rangers v Porthaven City locks at 17:30.',
      occurredAt: '2027-08-21T15:00:00.000Z',
      relatedMatchId: 'match-invercaledonian-porthaven',
      relatedPlayerId: null,
      emphasis: 'neutral',
    },
    {
      id: 'activity-settled',
      kind: 'predictionSettled',
      headline: 'Exact score on Eastcraig v Dunveggie',
      detail: '1–2 called correctly. 6 points.',
      occurredAt: '2027-08-21T08:12:00.000Z',
      relatedMatchId: 'match-eastcraig-dunveggie',
      relatedPlayerId: null,
      emphasis: 'positive',
    },
    {
      id: 'activity-rank',
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
