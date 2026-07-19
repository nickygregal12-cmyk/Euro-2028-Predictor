// Canonical score-event shape — the unit behind the Points breakdown
// (design-system §6). No `score_events` table exists yet (deferred to the
// scoring tier), so this defines the shape NOW and provides the pure pipeline
// that turns a `ScoreBreakdown` into display-ready events. The Points breakdown
// component and the eventual `score_events` table both follow this shape, so the
// rendered rows and the pinned total always derive from one source of truth.
//
// Pure domain: data in, data out. No React, no database, no side effects, and
// no imports from the UI layer (domain never depends on design-system).

import type { KnockoutStage } from './scoringConfig'
import type { ScoreBreakdown } from './calculateScore'

export type ScoreCategory = 'group_matches' | 'group_positions' | 'knockout' | 'awards'

// Matches the scoring doc's section order exactly (scoring-rules §1–§4).
export const SCORE_CATEGORY_ORDER: ScoreCategory[] = [
  'group_matches',
  'group_positions',
  'knockout',
  'awards',
]

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  group_matches: 'Group matches',
  group_positions: 'Group positions',
  knockout: 'Knockout',
  awards: 'Awards',
}

// A team badge on an event row. Domain-local (the domain never imports UI types);
// the UI maps this onto its own flag primitive.
export type ScoreEventFlag = { name: string; countryCode: string }

export type ScoreEvent = {
  id: string
  category: ScoreCategory
  // Plain-language explanation, e.g. "Sco 2–1 Eng · exact score".
  explanation: string
  // Optional team badge for the row.
  flag?: ScoreEventFlag
  // Final points awarded, with any joker already applied.
  points: number
  // Whether a joker doubled this event (group matches only).
  joker?: boolean
}

export type CategoryGroup = {
  category: ScoreCategory
  label: string
  subtotal: number
  events: ScoreEvent[]
  // No scored events in this category yet — the row shows "0 · pending", never
  // hidden.
  pending: boolean
}

export type GroupedScore = {
  // Always all four categories, in canonical order (unscored ones are pending,
  // not omitted).
  categories: CategoryGroup[]
  total: number
}

/**
 * Group events by category, compute subtotals and the pinned total. The total
 * is the sum of every rendered event, so the "total === sum of rows" invariant
 * (design-system §6) holds by construction: both derive from the same array.
 */
export function groupScoreEvents(events: ScoreEvent[]): GroupedScore {
  const byCategory = new Map<ScoreCategory, ScoreEvent[]>()
  for (const category of SCORE_CATEGORY_ORDER) byCategory.set(category, [])
  for (const event of events) byCategory.get(event.category)?.push(event)

  const categories = SCORE_CATEGORY_ORDER.map((category): CategoryGroup => {
    const catEvents = byCategory.get(category) ?? []
    const subtotal = catEvents.reduce((sum, e) => sum + e.points, 0)
    return {
      category,
      label: SCORE_CATEGORY_LABELS[category],
      subtotal,
      events: catEvents,
      pending: catEvents.length === 0,
    }
  })

  return {
    categories,
    total: categories.reduce((sum, c) => sum + c.subtotal, 0),
  }
}

// --- Deriving events from a scored breakdown ----------------------------------

// The breakdown speaks in IDs; turning it into readable events needs the
// tournament's reference data. The caller (the scoring persistence layer, or the
// dev seed) supplies these resolvers — the domain stays free of any data source.
export type ScoreEventResolvers = {
  // A group match, e.g. { text: 'Sco 2–1 Eng', flag: { name: 'Scotland', … } }.
  match: (matchId: string) => { text: string; flag?: ScoreEventFlag }
  // A group, e.g. { text: 'Group A' }.
  group: (groupId: string) => { text: string; flag?: ScoreEventFlag }
  // A team, e.g. { text: 'Spain', flag: { … } }.
  team: (teamId: string) => { text: string; flag?: ScoreEventFlag }
  // A golden-boot player's name, when one was picked.
  player?: (playerId: string) => string
}

const MATCH_KIND_TEXT: Record<'exact' | 'correct' | 'wrong', string> = {
  exact: 'exact score',
  correct: 'correct result',
  wrong: 'wrong',
}

function stageText(stage: KnockoutStage): string {
  switch (stage) {
    case 'R16':
      return 'reached the last 16'
    case 'QF':
      return 'reached the quarter-finals'
    case 'SF':
      return 'reached the semi-finals'
    case 'FINAL':
      return 'reached the final'
    case 'CHAMPION':
      return 'won the tournament'
  }
}

/**
 * Turn a scored `ScoreBreakdown` (from calculateScore — the real pipeline) into
 * a flat list of display-ready `ScoreEvent`s. Only events that actually scored
 * points are emitted, except wrong group-match guesses whose row is still
 * useful context ("Sco 0–3 Eng · wrong · +0"); pass `includeZero: false` to
 * drop those. Deterministic and side-effect-free.
 */
export function scoreEventsFromBreakdown(
  breakdown: ScoreBreakdown,
  resolvers: ScoreEventResolvers,
  options: { includeZero?: boolean } = {},
): ScoreEvent[] {
  const includeZero = options.includeZero ?? true
  const events: ScoreEvent[] = []

  // §1 Group matches
  for (const item of breakdown.groupMatches.items) {
    if (item.points === 0 && !includeZero) continue
    const { text, flag } = resolvers.match(item.matchId)
    events.push({
      id: `gm-${item.matchId}`,
      category: 'group_matches',
      explanation: `${text} · ${MATCH_KIND_TEXT[item.kind]}`,
      flag,
      points: item.points,
      joker: item.joker || undefined,
    })
  }

  // §2 Group positions
  for (const item of breakdown.groupOrders.items) {
    if (item.points === 0 && !includeZero) continue
    const { text, flag } = resolvers.group(item.groupId)
    const detail = item.fullOrderBonus
      ? 'full order correct'
      : `${item.correctPositions} in the right place`
    events.push({
      id: `gp-${item.groupId}`,
      category: 'group_positions',
      explanation: `${text} · ${detail}`,
      flag,
      points: item.points,
    })
  }

  // §3 Knockout progression
  for (const item of breakdown.knockout.items) {
    if (item.points === 0) continue // no partial-credit "wrong" row for knockout
    const furthest = item.correctStages[item.correctStages.length - 1]
    const { text, flag } = resolvers.team(item.teamId)
    events.push({
      id: `ko-${item.teamId}`,
      category: 'knockout',
      explanation: `${text} · ${stageText(furthest)}`,
      flag,
      points: item.points,
    })
  }

  // §4 Awards (golden boot + total goals)
  const { goldenBoot, totalGoals } = breakdown.bonus
  if (goldenBoot.points > 0 || (includeZero && goldenBoot.predicted)) {
    const name =
      goldenBoot.predicted && resolvers.player
        ? resolvers.player(goldenBoot.predicted)
        : 'Top scorer'
    events.push({
      id: 'aw-golden-boot',
      category: 'awards',
      explanation: `${name} · ${goldenBoot.correct ? 'golden boot' : 'not the top scorer'}`,
      points: goldenBoot.points,
    })
  }
  if (totalGoals.points > 0 || (includeZero && totalGoals.band !== 'none')) {
    const detail =
      totalGoals.band === 'exact'
        ? 'exact group-stage goals'
        : totalGoals.band === 'outside'
          ? 'group-stage goals · outside range'
          : 'group-stage goals · close'
    events.push({
      id: 'aw-total-goals',
      category: 'awards',
      explanation: `Total goals · ${detail}`,
      points: totalGoals.points,
    })
  }

  return events
}
