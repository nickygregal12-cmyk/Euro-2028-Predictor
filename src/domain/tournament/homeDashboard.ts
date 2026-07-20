// Pure domain helpers for the phase-aware Home dashboard (design-system §6).
// Data in, data out: no React, no database, no formatting. The Home data hook
// fetches the raw numbers and calls these; the page renders the result.

// Which layout Home shows. Post-tournament is a Phase 3 refinement (slot
// reserved in the design); until then a finished tournament still reads as
// 'during'.
export type HomePhase = 'preIncomplete' | 'preSubmitted' | 'during'

/**
 * The during-tournament layers (stat strip, today, catch-up, league snapshot)
 * appear only once results exist. Before that: the submitted banner if the entry
 * is in, else the completion/continue state.
 */
export function homePhase(input: { hasResults: boolean; submitted: boolean }): HomePhase {
  if (input.hasResults) return 'during'
  if (input.submitted) return 'preSubmitted'
  return 'preIncomplete'
}

/**
 * Points from matches played on the local "today". Score events carry the match
 * they scored; `matchDateById` maps matchId → ISO date (yyyy-mm-dd) and `todayISO`
 * is the viewer's local date. Non-match events (positions/knockout/awards) carry
 * no matchId and never count toward "today".
 */
export function pointsToday(
  scoreEvents: { matchId: string | null; points: number }[],
  matchDateById: Map<string, string>,
  todayISO: string,
): number {
  return scoreEvents.reduce((sum, e) => {
    if (!e.matchId) return sum
    return matchDateById.get(e.matchId) === todayISO ? sum + e.points : sum
  }, 0)
}

export type LeagueStanding = {
  id: string
  name: string
  memberCount: number
  // The user's standard-competition rank in this league; null pre-results.
  rank: number | null
  // Points behind the league leader; null pre-results.
  gapToTop: number | null
  // For tie-breaking "best" — larger (more recent) wins.
  lastActivityMs: number
}

/**
 * The user's best/favourite league for the Home snapshot + the stat strip's
 * best-league position: highest rank (1 = best), ties broken by most recent
 * activity, then name. A null rank (pre-results) sorts last. Returns null when
 * the user is in no leagues.
 */
export function selectBestLeague(leagues: LeagueStanding[]): LeagueStanding | null {
  if (leagues.length === 0) return null
  return [...leagues].sort((a, b) => {
    const ar = a.rank ?? Number.POSITIVE_INFINITY
    const br = b.rank ?? Number.POSITIVE_INFINITY
    if (ar !== br) return ar - br
    if (b.lastActivityMs !== a.lastActivityMs) return b.lastActivityMs - a.lastActivityMs
    return a.name.localeCompare(b.name)
  })[0]
}

export type CatchUp = { pointsDelta: number; rankDelta: number | null }

/**
 * The catch-up line's content, or null to hide it. "Meaningful change since last
 * visit" = the user gained points since the total we snapshotted when they were
 * last here. First visit (no snapshot) → null. rankDelta stays null until
 * rank_history exists (Phase 2/3 boundary roadmap item) — the line then shows
 * points only. Recent visitors with no gain see nothing.
 */
export function catchUpSummary(input: {
  lastSeenAt: string | null
  lastSeenPoints: number | null
  currentPoints: number
}): CatchUp | null {
  if (input.lastSeenAt === null || input.lastSeenPoints === null) return null
  const pointsDelta = input.currentPoints - input.lastSeenPoints
  if (pointsDelta <= 0) return null
  // TODO(rank_history): once per-matchday rank snapshots exist, compute
  // rankDelta ("up N places"). See docs/roadmap.md § Phase 2 rank_history.
  return { pointsDelta, rankDelta: null }
}
