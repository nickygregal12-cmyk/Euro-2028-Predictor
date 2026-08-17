/**
 * WHICH OF HOME'S THREE EMPHASES THE SUPPLIED STATE DESERVES.
 *
 * THIS IS PRESENTATION LOGIC AND NOTHING ELSE. It answers exactly one
 * question — "what should Home make the biggest thing on the page?" — from
 * state the model has already decided. It is not an authority for locks,
 * scoring, settlement, reveal, official match status or progression, and it
 * must never become one.
 *
 * The distinction is visible in what it reads. It does not compare `kickoff`
 * against `now` to work out whether a match has started, because that would be
 * presentation deciding what "live" means; it reads `model.liveMatches`, which
 * is the partition the model was handed. It does not decide whether a
 * prediction is still editable; it reads `primaryAction.urgency`, which the
 * model states. Every input below is a field somebody upstream already owns.
 *
 * The order is a product decision, and it is the one the brief settles:
 *
 *   1. FOOTBALL IS LIVE  → the football is the event.
 *   2. A DECISION IS DUE → your next decision is the event.
 *   3. OTHERWISE         → your competition is the event.
 *
 * Live outranks a pending deadline for the dominant zone, which is not the same
 * as hiding the deadline: the outstanding action keeps its own banner above the
 * football in live emphasis, because a deadline you can still act on outranks a
 * match you cannot.
 */

import type { HomeModel } from '../models/home'
import type { Match } from '../models/football'

export type HomeEmphasis = 'live' | 'decision' | 'competition'

/** Urgencies the model considers worth interrupting a quiet page for. */
const PRESSING: ReadonlySet<string> = new Set(['soon', 'urgent'])

/** Action types that represent a football decision rather than an errand. */
const FOOTBALL_DECISION: ReadonlySet<string> = new Set(['predict', 'review'])

export function selectHomeEmphasis(model: HomeModel): HomeEmphasis {
  if (model.liveMatches.length > 0) return 'live'

  const { primaryAction } = model
  if (
    FOOTBALL_DECISION.has(primaryAction.type) &&
    PRESSING.has(primaryAction.urgency) &&
    // A decision hero with no fixture to draw is an empty stage. If the model
    // offers no upcoming match to build one from, the competition state is the
    // better use of the space.
    pickDecisionMatch(model) !== null
  ) {
    return 'decision'
  }

  return 'competition'
}

/**
 * The match the live emphasis puts on the stage.
 *
 * `isFeatured` is the model's own hint and is honoured first. Falling back to
 * the first live match is a presentation tie-break, not a ranking rule — Home
 * never decides which game matters most, it only has to draw one of them.
 */
export function pickFeaturedLiveMatch(model: HomeModel): Match | null {
  return (
    model.liveMatches.find((match) => match.isFeatured) ??
    model.liveMatches[0] ??
    null
  )
}

/**
 * The match the decision emphasis builds its hero from.
 *
 * The one the user has NOT predicted comes first, because that is the decision;
 * a featured hint is the tie-break between several, and an already-predicted
 * fixture is only used when there is nothing outstanding at all — at which
 * point the hero is showing you what you have already done, which the card says
 * in words.
 */
export function pickDecisionMatch(model: HomeModel): Match | null {
  const open = model.upcomingMatches.filter(
    (match) => match.prediction === null && match.status === 'upcoming',
  )
  const pool = open.length > 0 ? open : model.upcomingMatches
  return pool.find((match) => match.isFeatured) ?? pool[0] ?? null
}

/**
 * The private league Home leads with.
 *
 * The one where the user is closest to a place they could take, because that is
 * the live battle — and, where two are equally close, the larger league. The
 * user's own rank and the gap both come from the model; nothing here works out
 * what it would take to overtake anybody.
 */
export function pickHeadlineLeague(model: HomeModel) {
  const leagues = [...model.privateLeagues]
  if (leagues.length === 0) return null

  return leagues.sort((a, b) => {
    // Leading a league is a fact worth showing, but a two-point chase is a
    // better headline than a title already held.
    const chase = (gap: number) => (gap === 0 ? Number.POSITIVE_INFINITY : gap)
    const byGap = chase(a.gapToLeader) - chase(b.gapToLeader)
    if (byGap !== 0) return byGap
    return b.participantCount - a.participantCount
  })[0]
}
