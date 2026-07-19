// The best-third-placed pipeline: from the user's group predictions (plus their
// manual tie-resolutions) through the domain layer to the ranked third-place
// table and the list of ties still needing the user's call.
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
  title: string // e.g. "Group A" or "Best thirds · positions 4 & 5"
  reason: string // plain-language explanation for the user
  teams: { id: string; name: string; countryCode: string }[] // display order
  resolved: boolean // the user has confirmed an order for this exact set
}

export type ThirdPlacePipeline = {
  groupsComplete: boolean
  // Ranked third-place table, or null until it can be computed (every group
  // predicted and every group's 3rd place settled).
  rows: ThirdPlaceRow[] | null
  // Every tie the automatic criteria couldn't break — pending and resolved.
  ties: TieItem[]
  // Ties still awaiting the user's order (drives the hub's amber count and the
  // Review gate).
  pendingCount: number
}

// scoring-rules §6 step 7 phrasing (group tables).
const GROUP_REASON =
  "These teams can't be split by predicted results — in the real tournament this would come down to " +
  "things like disciplinary records that can't be predicted. Choose the order you expect."

// The third-place analogue (tournament-structure §6): same idea, one level up.
const THIRD_REASON =
  'These third-placed teams are level on every criterion we can predict (points, goal difference, goals, ' +
  'wins). In the real tournament UEFA would separate them on records that can’t be predicted. Choose ' +
  'the order you expect.'

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
): TieItem {
  const stored = resolvedOrderFor(resolutions, tiedIds)
  return {
    key: tieKey(tiedIds),
    scope,
    title,
    reason,
    teams: toTeams(stored ?? tiedIds, nameById),
    resolved: stored !== undefined,
  }
}

export function buildThirdPlacePipeline(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  resolutions: TieResolution[],
): ThirdPlacePipeline {
  const groupMatches = data.matches.filter((m) => m.round === 'group')
  for (const m of groupMatches) {
    const p = getPrediction(m.id)
    if (p.homeScore === null || p.awayScore === null) {
      return { groupsComplete: false, rows: null, ties: [], pendingCount: 0 }
    }
  }

  const nameById = new Map(data.teams.map((t) => [t.id, t.name]))
  const groups = [...data.groups].sort((a, b) => a.letter.localeCompare(b.letter))
  const ties: TieItem[] = []
  const thirds: ThirdPlacedTeam[] = []
  let thirdsDetermined = true

  for (const g of groups) {
    const teamIds = data.teams
      .filter((t) => t.groupId === g.id)
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.id)
    const scores: MatchScore[] = groupMatches
      .filter((m) => m.groupId === g.id && m.homeTeamId && m.awayTeamId)
      .map((m) => {
        const p = getPrediction(m.id)
        return {
          homeTeamId: m.homeTeamId as string,
          awayTeamId: m.awayTeamId as string,
          homeScore: p.homeScore as number,
          awayScore: p.awayScore as number,
        }
      })

    // Every manual tie in this group (independent of what the user has chosen).
    const raw = resolveGroupTies(teamIds, scores)
    for (const block of raw.unresolvedGroups) {
      ties.push(makeTie('group', `Group ${g.letter}`, GROUP_REASON, block, resolutions, nameById))
    }

    // The 3rd-placed team, with the user's orderings applied.
    const resolved = resolveGroupTies(teamIds, scores, resolutions)
    const third = resolved.standings[2]
    if (third?.tiedUnresolved) thirdsDetermined = false
    else if (third) thirds.push({ ...third, groupLetter: g.letter })
  }

  let rows: ThirdPlaceRow[] | null = null
  if (thirdsDetermined && thirds.length === groups.length) {
    const rawRank = rankThirdPlacedTeams(thirds)
    for (const tie of rawRank.unresolvedGroups) {
      ties.push(
        makeTie(
          'third',
          `Best thirds · positions ${tie.positions.join(' & ')}`,
          THIRD_REASON,
          tie.teamIds,
          resolutions,
          nameById,
        ),
      )
    }

    const resolvedRank = rankThirdPlacedTeams(thirds, resolutions)
    rows = resolvedRank.ranking.map((r, i) => ({
      position: i + 1,
      groupLetter: r.groupLetter,
      team: { name: nameById.get(r.teamId) ?? r.teamId, countryCode: '' },
      played: r.played,
      goalDifference: r.goalDifference,
      points: r.points,
    }))
  }

  return {
    groupsComplete: true,
    rows,
    ties,
    pendingCount: ties.filter((t) => !t.resolved).length,
  }
}
