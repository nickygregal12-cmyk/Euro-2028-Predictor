// The Predict hub's hero + journey-map model (design-system §6 "Predict hub —
// hero + journey map", decided 2026-07-22). Pure derivation over the same
// domain pipelines the stage screens consume, so the hub, the screens and
// Review can never disagree (CLAUDE.md architecture rule 2):
//
//   - per-group A–F chips: predicted counts, completion and unresolved
//     group-scope ties (amber "needs your call");
//   - a weighted entry completion across all 51 picks (36 group scorelines +
//     15 knockout winners) — the old groups-only percent read "100%" while
//     the bracket was empty;
//   - the five journey stages with their stepper states, exactly one of
//     which is "current";
//   - the hero's single Continue target: the first incomplete thing, in the
//     decided order — first unpredicted group → first unresolved group tie →
//     the thirds ranking → first unpicked winner → Review and submit;
//   - the predicted champion as the hero's emotional anchor once the final
//     is picked.

import { computeHubStatus, type HubStatus } from './hubStatus'
import { buildGroupTiePrompt } from './groupTiePrompt'
import { buildThirdPlacePipeline } from './thirdPlacePipeline'
import { isGroupComplete } from './groupContinuation'
import {
  buildBracketPipeline,
  type BracketChampion,
} from '../bracket/bracketPipeline'
import type { TieResolution } from '../../domain/tournament/tieResolutions'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'

export type GroupChip = {
  letter: string
  predicted: number
  total: number
  complete: boolean
  pendingTies: number
}

export type StageKey = 'groups' | 'standings' | 'bracket' | 'jokers' | 'review'
export type StageState = 'done' | 'current' | 'attention' | 'todo' | 'locked'

export type ContinueTarget = { label: string; route: string }

export type PredictHubModel = {
  status: HubStatus
  groupChips: GroupChip[]
  /** Weighted completion across all 51 picks (36 scorelines + 15 winners). */
  entryPercent: number
  stageStates: Record<StageKey, StageState>
  continueTarget: ContinueTarget
  champion: BracketChampion | null
  /** Whether the user has made any prediction at all (spectator detection). */
  hasAnyEntry: boolean
}

export function buildPredictHubModel(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  jokerCount: number,
  resolutions: TieResolution[] = [],
  progression: Record<string, ProgressionStage> = {},
): PredictHubModel {
  const status = computeHubStatus(
    data,
    getPrediction,
    jokerCount,
    resolutions,
    progression,
  )

  // Chips follow the tournament's real groups (ordered by letter), so the
  // model never invents a group the data doesn't have.
  const groupChips: GroupChip[] = data.groups.map((group) => {
    const letter = group.letter
    const teams = data.teams.filter((team) => team.groupId === group.id)
    const matches = data.matches.filter(
      (match) => match.round === 'group' && match.groupId === group.id,
    )
    let predicted = 0
    for (const match of matches) {
      const prediction = getPrediction(match.id)
      if (prediction.homeScore !== null && prediction.awayScore !== null) {
        predicted += 1
      }
    }
    const complete = isGroupComplete(matches, getPrediction)
    // Ties can only need a call once the group is fully predicted.
    const pendingTies = complete
      ? buildGroupTiePrompt(letter, teams, matches, getPrediction, resolutions)
          .pendingCount
      : 0
    return { letter, predicted, total: matches.length, complete, pendingTies }
  })

  const groupTieCount = groupChips.reduce((sum, chip) => sum + chip.pendingTies, 0)

  // Thirds-scope ties belong to the standings step; group-scope ties belong to
  // the Groups step (design-system §6 — each tie surfaces where it is fixed).
  const pipeline = buildThirdPlacePipeline(data, getPrediction, resolutions)
  const thirdTieCount = pipeline.ties.filter(
    (tie) => tie.scope === 'third' && !tie.resolved,
  ).length

  const bracket = buildBracketPipeline(data, getPrediction, resolutions, progression)
  const champion = bracket.ready ? bracket.champion : null

  const pickTotal = status.groups.total + status.bracket.total
  const picksMade = status.groups.predicted + status.bracket.picked
  const entryPercent = pickTotal > 0 ? Math.round((picksMade / pickTotal) * 100) : 0

  const groupsState: StageState = !status.groups.complete
    ? 'todo'
    : groupTieCount > 0
      ? 'attention'
      : 'done'
  const standingsState: StageState =
    status.thirdPlace.state === 'settled'
      ? 'done'
      : thirdTieCount > 0
        ? 'attention'
        : 'todo'
  const bracketState: StageState =
    status.bracket.picked === status.bracket.total ? 'done' : 'todo'
  const jokersState: StageState =
    status.jokers.placed === status.jokers.total ? 'done' : 'todo'
  const reviewState: StageState = !status.reviewUnlocked ? 'locked' : 'todo'

  const stageStates: Record<StageKey, StageState> = {
    groups: groupsState,
    standings: standingsState,
    bracket: bracketState,
    jokers: jokersState,
    review: reviewState,
  }

  // Exactly one stage carries "current": the first actionable, non-done stage
  // on the entry's critical path (jokers are optional and never claim it).
  if (groupsState === 'todo') {
    stageStates.groups = 'current'
  } else if (
    groupsState !== 'attention' &&
    standingsState === 'todo' &&
    status.thirdPlace.state !== 'blocked'
  ) {
    stageStates.standings = 'current'
  } else if (
    groupsState === 'done' &&
    standingsState === 'done' &&
    bracketState === 'todo'
  ) {
    stageStates.bracket = 'current'
  } else if (reviewState === 'todo') {
    stageStates.review = 'current'
  }

  const firstIncompleteChip = groupChips.find((chip) => !chip.complete)
  const firstTieChip = groupChips.find((chip) => chip.pendingTies > 0)
  const continueTarget: ContinueTarget = firstIncompleteChip
    ? {
        label: `Continue Group ${firstIncompleteChip.letter}`,
        route: `/predict/groups/${firstIncompleteChip.letter}`,
      }
    : firstTieChip
      ? {
          label: `Resolve the Group ${firstTieChip.letter} tie`,
          route: `/predict/groups/${firstTieChip.letter}`,
        }
      : status.thirdPlace.state !== 'settled'
        ? { label: 'Finalise Group Standings', route: '/predict/third-place' }
        : status.bracket.picked < status.bracket.total
          ? { label: 'Pick your knockout winners', route: '/predict/bracket' }
          : { label: 'Review & submit', route: '/predict/review' }

  const hasAnyEntry = picksMade > 0 || jokerCount > 0

  return {
    status,
    groupChips,
    entryPercent,
    stageStates,
    continueTarget,
    champion,
    hasAnyEntry,
  }
}
