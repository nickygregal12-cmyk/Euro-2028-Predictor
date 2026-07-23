// Final group-standings pipeline: from the user's group predictions (plus their
// manual tie-resolutions) through the domain layer to the ranked third-place
// table and every tie still needing the user's call.
//
// It runs the domain twice per stage — once WITHOUT resolutions to discover
// every tie the automatic criteria can't break, once WITH them to produce the
// order actually shown. Comparing the two classifies each tie as still-pending
// or already-resolved without the domain functions having to report that
// themselves. All logic stays in the pure domain functions; this module only
// shapes their inputs and outputs (CLAUDE.md architecture rule 2).

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import {
  rankThirdPlacedTeams,
  type ThirdPlacedTeam,
} from '../../domain/tournament/rankThirdPlacedTeams'
import {
  resolvedOrderFor,
  tieKey,
  type TieResolution,
} from '../../domain/tournament/tieResolutions'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'
import type { ThirdPlaceRow } from '../../design-system'

export type TieScope = 'group' | 'third'

export type TieItem = {
  key: string
  scope: TieScope
  title: string
  reason: string
  teams: { id: string; name: string; countryCode: string }[]
  resolved: boolean
  // Groups whose score inputs can change this tie. Same-group ties have one;
  // best-third ties can span several groups.
  reviewGroups: string[]
}

export type ThirdPlacePipeline = {
  groupsComplete: boolean
  // Ranked third-place table, or null until it can be computed (every group
  // predicted and every group's third place settled).
  rows: ThirdPlaceRow[] | null
  // Every tie the automatic criteria couldn't break — pending and resolved.
  ties: TieItem[]
  // Ties still awaiting the user's order (drives the hub's amber count and the
  // Review gate).
  pendingCount: number
}

const GROUP_REASON =
  'These teams are still level after points, head-to-head results, goal difference and goals scored. ' +
  'In the real tournament, disciplinary records may decide the order. Because you are not predicting ' +
  'cards, keep the order shown, rearrange the teams, or change the group scores.'

const THIRD_REASON =
  'These third-placed teams are level on every score-derived criterion. Keep the order shown, ' +
  'rearrange the teams, or review the relevant group scores before deciding.'

function toTeams(
  ids: string[],
  nameById: Map<string, string>,
): { id: string; name: string; countryCode: string }[] {
  // Teams are placeholders until the qualifying draw, so there is no flag yet
  // (countryCode empty) — same treatment as every other predictor screen.
  return ids.map((id) => ({ id, name: nameById.get(id) ?? id, countryCode: '' }))
}

function makeTie(
  scope: TieScope,
  title: string,
  reason: string,
  tiedIds: string[],
  resolutions: TieResolution[],
  nameById: Map<string, string>,
  reviewGroups: string[],
): TieItem {
  const stored = resolvedOrderFor(resolutions, tiedIds)
  return {
    key: tieKey(tiedIds),
    scope,
    title,
    reason,
    teams: toTeams(stored ?? tiedIds, nameById),
    resolved: stored !== undefined,
    reviewGroups: [...new Set(reviewGroups)].sort(),
  }
}

export function buildThirdPlacePipeline(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  resolutions: TieResolution[],
): ThirdPlacePipeline {
  const groupMatches = data.matches.filter((match) => match.round === 'group')
  for (const match of groupMatches) {
    const prediction = getPrediction(match.id)
    if (prediction.homeScore === null || prediction.awayScore === null) {
      return { groupsComplete: false, rows: null, ties: [], pendingCount: 0 }
    }
  }

  const nameById = new Map(data.teams.map((team) => [team.id, team.name]))
  const groupLetterById = new Map(data.groups.map((group) => [group.id, group.letter]))
  const groupLetterByTeamId = new Map(
    data.teams.map((team) => [team.id, groupLetterById.get(team.groupId) ?? '']),
  )
  const groups = [...data.groups].sort((a, b) => a.letter.localeCompare(b.letter))
  const ties: TieItem[] = []
  const thirds: ThirdPlacedTeam[] = []
  let thirdsDetermined = true

  for (const group of groups) {
    const teamIds = data.teams
      .filter((team) => team.groupId === group.id)
      .sort((a, b) => a.slot - b.slot)
      .map((team) => team.id)
    const scores: MatchScore[] = groupMatches
      .filter(
        (match) =>
          match.groupId === group.id && match.homeTeamId && match.awayTeamId,
      )
      .map((match) => {
        const prediction = getPrediction(match.id)
        return {
          homeTeamId: match.homeTeamId as string,
          awayTeamId: match.awayTeamId as string,
          homeScore: prediction.homeScore as number,
          awayScore: prediction.awayScore as number,
        }
      })

    // Every manual tie in this group (independent of what the user has chosen).
    const raw = resolveGroupTies(teamIds, scores)
    for (const block of raw.unresolvedGroups) {
      ties.push(
        makeTie(
          'group',
          `Group ${group.letter} needs your decision`,
          GROUP_REASON,
          block,
          resolutions,
          nameById,
          [group.letter],
        ),
      )
    }

    // The third-placed team, with the user's orderings applied.
    const resolved = resolveGroupTies(teamIds, scores, resolutions)
    const third = resolved.standings[2]
    if (third?.tiedUnresolved) thirdsDetermined = false
    else if (third) thirds.push({ ...third, groupLetter: group.letter })
  }

  let rows: ThirdPlaceRow[] | null = null
  if (thirdsDetermined && thirds.length === groups.length) {
    const rawRank = rankThirdPlacedTeams(thirds)
    for (const tie of rawRank.unresolvedGroups) {
      const reviewGroups = tie.teamIds
        .map((teamId) => groupLetterByTeamId.get(teamId))
        .filter((letter): letter is string => Boolean(letter))

      ties.push(
        makeTie(
          'third',
          `Best thirds · positions ${tie.positions.join(' & ')}`,
          THIRD_REASON,
          tie.teamIds,
          resolutions,
          nameById,
          reviewGroups,
        ),
      )
    }

    const resolvedRank = rankThirdPlacedTeams(thirds, resolutions)
    rows = resolvedRank.ranking.map((standing, index) => ({
      position: index + 1,
      groupLetter: standing.groupLetter,
      team: {
        name: nameById.get(standing.teamId) ?? standing.teamId,
        countryCode: '',
      },
      played: standing.played,
      goalDifference: standing.goalDifference,
      points: standing.points,
    }))
  }

  return {
    groupsComplete: true,
    rows,
    ties,
    pendingCount: ties.filter((tie) => !tie.resolved).length,
  }
}
