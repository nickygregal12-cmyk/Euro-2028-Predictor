// The "what's next in the entry" target — the single source of truth for the
// group page's continuation CTA. Reuses the SAME stage-status logic as the
// Predict hub (computeHubStatus) so the CTA and the hub can never disagree; the
// only thing computed here that the hub aggregates away is PER-GROUP completion
// (to name the next incomplete group in A–F order). Pure: data in, target out.

import { computeHubStatus, type HubStatus } from './hubStatus'
import type { TieResolution } from '../../domain/tournament/tieResolutions'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'

export type NextStage =
  | { kind: 'group'; letter: string }
  | { kind: 'third' }
  | { kind: 'bracket'; started: boolean }
  | { kind: 'review' }

/** Group letters in A–F order with per-group completion (all matches predicted). */
export function groupCompletion(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
): { letter: string; complete: boolean }[] {
  return [...data.groups]
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .map((g) => {
      const matches = data.matches.filter((m) => m.round === 'group' && m.groupId === g.id)
      const complete =
        matches.length > 0 &&
        matches.every((m) => {
          const p = getPrediction(m.id)
          return p.homeScore !== null && p.awayScore !== null
        })
      return { letter: g.letter, complete }
    })
}

/**
 * The pure decision, given per-group completion + the hub status. Order mirrors
 * the hub: first incomplete group (A–F) → best-thirds (while ties pend) →
 * bracket → review. Jokers are optional and never the CTA target. 'review' is
 * always the last resort once groups + thirds + bracket are done. Testable
 * without any tournament data.
 */
export function nextStageFromStatus(
  groups: { letter: string; complete: boolean }[],
  status: HubStatus,
): NextStage {
  const firstIncompleteGroup = groups.find((g) => !g.complete)
  if (firstIncompleteGroup) return { kind: 'group', letter: firstIncompleteGroup.letter }
  if (status.thirdPlace.state === 'ties') return { kind: 'third' }
  if (status.bracket.picked < status.bracket.total) {
    return { kind: 'bracket', started: status.bracket.picked > 0 }
  }
  return { kind: 'review' }
}

/**
 * The next incomplete stage of the entry. Composes per-group completion with the
 * SAME `computeHubStatus` the Predict hub uses (single source of truth), so the
 * CTA and the hub can never disagree.
 */
export function nextEntryStage(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  jokerCount: number,
  resolutions: TieResolution[] = [],
  progression: Record<string, ProgressionStage> = {},
): NextStage {
  return nextStageFromStatus(
    groupCompletion(data, getPrediction),
    computeHubStatus(data, getPrediction, jokerCount, resolutions, progression),
  )
}

export function nextStagePath(stage: NextStage): string {
  switch (stage.kind) {
    case 'group':
      return `/predict/groups/${stage.letter}`
    case 'third':
      return '/predict/third-place'
    case 'bracket':
      return '/predict/bracket'
    case 'review':
      return '/predict/review'
  }
}

/**
 * CTA label. When the entry is locked the CTA is pure navigation — neutral
 * wording ("Next: …") with no verb that implies editability.
 */
export function nextStageLabel(stage: NextStage, locked: boolean): string {
  if (locked) {
    switch (stage.kind) {
      case 'group':
        return `Next: Group ${stage.letter} →`
      case 'third':
        return 'Next: Best third-placed teams →'
      case 'bracket':
        return 'Next: Knockout bracket →'
      case 'review':
        return 'Next: Review →'
    }
  }
  switch (stage.kind) {
    case 'group':
      return `Continue to Group ${stage.letter} →`
    case 'third':
      // Labelled with the hub's own name for this stage.
      return 'Best third-placed teams →'
    case 'bracket':
      return stage.started ? 'Continue your bracket →' : 'Start your bracket →'
    case 'review':
      return 'Review your entry →'
  }
}
