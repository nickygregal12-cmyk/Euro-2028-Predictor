import type { MatchLifecycleState } from './matchCentreContract'

export type MatchCentreLifecycleContent = {
  heading: string
  summary: string
  emphasis: 'neutral' | 'live' | 'warning' | 'danger' | 'success'
  showPredictionContext: boolean
  showMatchImpact: boolean
}

const CONTENT: Record<MatchLifecycleState, MatchCentreLifecycleContent> = {
  SCHEDULED: {
    heading: 'Match preview',
    summary: 'Review your prediction and the match details before kick-off.',
    emphasis: 'neutral',
    showPredictionContext: true,
    showMatchImpact: false,
  },
  PRE_MATCH: {
    heading: 'Starting soon',
    summary: 'The match is close to kick-off. Predictions remain hidden until the entry lock is confirmed.',
    emphasis: 'neutral',
    showPredictionContext: true,
    showMatchImpact: false,
  },
  LIVE_FIRST_HALF: {
    heading: 'First half',
    summary: 'Follow the live score against your prediction. Any points shown during play are provisional.',
    emphasis: 'live',
    showPredictionContext: true,
    showMatchImpact: true,
  },
  HALF_TIME: {
    heading: 'Half-time',
    summary: 'The first half is complete. Live prediction and league impact remain provisional.',
    emphasis: 'live',
    showPredictionContext: true,
    showMatchImpact: true,
  },
  LIVE_SECOND_HALF: {
    heading: 'Second half',
    summary: 'Follow the closing stages and how the current score affects your prediction.',
    emphasis: 'live',
    showPredictionContext: true,
    showMatchImpact: true,
  },
  EXTRA_TIME: {
    heading: 'Extra time',
    summary: 'The match has gone beyond 90 minutes. Knockout progression remains provisional until the tie is settled.',
    emphasis: 'live',
    showPredictionContext: true,
    showMatchImpact: true,
  },
  PENALTIES: {
    heading: 'Penalty shoot-out',
    summary: 'The tie is being decided on penalties. Progression points remain provisional until the winner is confirmed.',
    emphasis: 'live',
    showPredictionContext: true,
    showMatchImpact: true,
  },
  FULL_TIME: {
    heading: 'Match complete',
    summary: 'The result is complete. Review your points and the effect on league and knockout predictions.',
    emphasis: 'success',
    showPredictionContext: true,
    showMatchImpact: true,
  },
  POSTPONED: {
    heading: 'Match postponed',
    summary: 'This fixture will not start as scheduled. Existing predictions remain saved until an authoritative update is available.',
    emphasis: 'warning',
    showPredictionContext: true,
    showMatchImpact: false,
  },
  SUSPENDED: {
    heading: 'Match suspended',
    summary: 'Play has stopped. Scores and prediction impact must not be treated as final until the fixture status is resolved.',
    emphasis: 'danger',
    showPredictionContext: true,
    showMatchImpact: false,
  },
  CANCELLED: {
    heading: 'Match cancelled',
    summary: 'This fixture will not be played in its current form. No result or prediction impact should be treated as final.',
    emphasis: 'danger',
    showPredictionContext: true,
    showMatchImpact: false,
  },
}

export function matchCentreLifecycleContent(
  lifecycle: MatchLifecycleState,
): MatchCentreLifecycleContent {
  return CONTENT[lifecycle]
}
