// Pure model + helpers for the shareable cards (design-system §6). The canvas
// renderer (renderShareCard.ts) draws from a ShareCardModel; the availability
// and text-formatting rules live here so they're unit-testable without a canvas.
// No React, no DOM.

export type ShareVariant = 'tease' | 'bracket' | 'brag'

export type ShareTeam = { name: string; countryCode: string }

export type ShareSurvivorStage = { stage: 'R16' | 'QF' | 'SF' | 'FINAL'; teams: ShareTeam[] }

export type ShareCardModel = {
  header: { playerName: string; locked: boolean; leagueName?: string | null }
  champion: (ShareTeam & { eliminated?: boolean }) | null
  finalists: [ShareTeam, ShareTeam] | null
  venue: string | null
  dateLabel: string | null
  stats: { goalsPredicted: number; jokersArmed: number }
  awards: { goldenBootName: string | null; groupGoals: number }
  survivors: ShareSurvivorStage[]
  brag: { points: number; rank: number | null; total: number } | null
  // The challenge/invite URL shown on the chip (app root, or a league invite).
  url: string
}

export type ShareState = {
  championPicked: boolean
  entryComplete: boolean
  // The tournament has started (results exist) — unlocks the "brag" variant.
  tournamentStarted: boolean
}

/**
 * Which card variants a player can share, in offer order. Quick tease once a
 * champion is picked; full bracket once the entry is complete (pre- or post-lock
 * — sharing is voluntary self-disclosure); during-tournament brag once results
 * exist. Always at least the tease if a champion exists.
 */
export function availableShareVariants(state: ShareState): ShareVariant[] {
  const out: ShareVariant[] = []
  if (state.championPicked) out.push('tease')
  if (state.entryComplete) out.push('bracket')
  if (state.tournamentStarted && state.entryComplete) out.push('brag')
  return out
}

export function ordinal(n: number): string {
  const abs = Math.abs(n) % 100
  const suffix = abs >= 11 && abs <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4)] ?? 'th'
  return `${n.toLocaleString()}${suffix}`
}

/** "89 goals predicted · 5 jokers armed" */
export function statLine(goalsPredicted: number, jokersArmed: number): string {
  return `${goalsPredicted} goals predicted · ${jokersArmed} joker${jokersArmed === 1 ? '' : 's'} armed`
}

/** "112 pts · 89th of 2,140" (drops the rank when it isn't known yet). */
export function bragLine(points: number, rank: number | null, total: number): string {
  const p = `${points.toLocaleString()} pts`
  return rank === null ? p : `${p} · ${ordinal(rank)} of ${total.toLocaleString()}`
}

// Flag size (px on the 1080 canvas) by how far a team was predicted to go — the
// funnel converges as the flags grow toward the champion.
const STAGE_FLAG_SIZE: Record<ShareSurvivorStage['stage'] | 'CHAMPION', number> = {
  R16: 64,
  QF: 88,
  SF: 120,
  FINAL: 150,
  CHAMPION: 300,
}
export function flagSizeForStage(stage: ShareSurvivorStage['stage'] | 'CHAMPION'): number {
  return STAGE_FLAG_SIZE[stage]
}

/** The chip label: a league recruitment ask when shared from a league, else the challenge. */
export function chipText(model: ShareCardModel, variant: ShareVariant): string {
  if (model.header.leagueName) return `Join "${model.header.leagueName}"`
  if (variant === 'brag') return model.url
  return 'Think you know better?'
}
