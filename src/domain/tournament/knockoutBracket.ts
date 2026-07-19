// Tournament-structure config (NOT logic). The post-R16 knockout tree,
// transcribed verbatim from docs/tournament-structure.md sections 4-5.
// advanceBracket() reads this; it does not derive the feed-through any other
// way. R16 fixtures themselves come from resolveRoundOf16 — this table only
// covers how winners feed forward (R16 → QF → SF → Final).

export type KnockoutRound = 'QF' | 'SF' | 'FINAL'

// A knockout match fed by the winners of two earlier matches (by slot ref).
export type BracketMatch = {
  ref: string // 'QF-1' … 'QF-4', 'SF-1', 'SF-2', 'FINAL'
  round: KnockoutRound
  homeFrom: string // ref of the match whose winner is the home side
  awayFrom: string // ref of the match whose winner is the away side
}

// Home/away order matches the doc exactly ("Winner R16-3 v Winner R16-1", etc.).
export const KNOCKOUT_BRACKET: BracketMatch[] = [
  { ref: 'QF-1', round: 'QF', homeFrom: 'R16-3', awayFrom: 'R16-1' },
  { ref: 'QF-2', round: 'QF', homeFrom: 'R16-5', awayFrom: 'R16-6' },
  { ref: 'QF-3', round: 'QF', homeFrom: 'R16-4', awayFrom: 'R16-2' },
  { ref: 'QF-4', round: 'QF', homeFrom: 'R16-7', awayFrom: 'R16-8' },
  { ref: 'SF-1', round: 'SF', homeFrom: 'QF-1', awayFrom: 'QF-2' },
  { ref: 'SF-2', round: 'SF', homeFrom: 'QF-4', awayFrom: 'QF-3' },
  { ref: 'FINAL', round: 'FINAL', homeFrom: 'SF-1', awayFrom: 'SF-2' },
]
