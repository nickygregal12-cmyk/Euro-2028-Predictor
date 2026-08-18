/**
 * THE vNEXT PLAYER PROFILE PRESENTATION CONTRACT — STAGE 10.
 *
 * ============================ WHAT THIS ANSWERS ===========================
 *
 * > **WHO IS THIS PLAYER, HOW ARE THEY PERFORMING, AND HOW DO WE COMPARE?**
 *
 * Inside one football competition season. Stage 9 built the doorway — a league
 * row the SERVER said the caller may open — and this is what is behind it.
 *
 * ============================ THREE READS, THREE PERMISSIONS, AND THEY DO
 * NOT TRAVEL TOGETHER ======================================================
 *
 * The single most important decision in this file. The page is assembled from
 * three server contracts whose boundaries are DIFFERENT:
 *
 *   • contract 151 `get_season_player_profile` needs a SHARED PRIVATE LEAGUE.
 *     Sharing a competition is not enough: a season may have fifty thousand
 *     entrants and none of them agreed to be looked up, whereas sharing a
 *     private league is a mutual act;
 *   • contract 192 `get_season_rank_history` needs only `compare` — contract
 *     191's weakest reachable answer — because a matchweek, a cumulative total
 *     and a position are exactly what the season leaderboard already shows
 *     every entrant, and NO PREDICTION APPEARS IN THAT PAYLOAD AT ALL;
 *   • contract 192 `get_season_rivalry` needs `compare` likewise.
 *
 * So a player whose PROFILE the caller may not open can still have a readable
 * rank history and a readable head-to-head. A page that hid all three because
 * one refused would be applying a permission the server did not apply, and a
 * page with one page-level `permitted` flag could not express the difference.
 *
 * Each panel therefore carries ITS OWN outcome union. There is no page-level
 * permission in this file and there must never be one.
 *
 * ============================ REFUSAL, ABSENCE AND FAILURE ARE THREE
 * DIFFERENT SENTENCES ======================================================
 *
 * `refused` is a fact about PERMISSION and is the server's answer. `absent` is
 * a fact about the PLAYER — they hold no entry, or nothing has settled yet.
 * `unavailable` is a fact about THE READ: it did not answer, and the page knows
 * nothing. Collapsing any two of them produces the failure Stage 9 spent a
 * whole review round removing: a failed read rendered as a fact about a person.
 *
 * ============================ THE REVEAL BOUNDARY IS ENFORCED BY ABSENCE ==
 *
 * Contract 151 does not send an unlocked matchweek with its predictions
 * emptied — it OMITS THE MATCHWEEK. Its `where` clause admits a round only once
 * that round's own lock has passed (or the profile is the caller's own, because
 * those are their own picks), and only where the player actually predicted.
 *
 * Two consequences this file is built around:
 *
 *   1. NOTHING HERE MAY INFER FROM A GAP. A missing matchweek means "not yet
 *      revealed" OR "they did not play it", and the payload does not say which.
 *      There is no gap-counting selector in this file and there must not be
 *      one; a surface that drew "3 of 12 matchweeks" would be inventing the
 *      denominator.
 *   2. A MATCHWEEK THAT IS PRESENT BUT UNSETTLED IS NOT A ZERO. On the
 *      caller's own profile a locked-but-unsettled matchweek arrives with null
 *      points, and `ProfileMatchweekResult` makes that a distinct case rather
 *      than a nullable number some component will coalesce.
 *
 * ============================ RANK IS PLOTTED, POINTS ARE NOT =============
 *
 * The Stage 10 predicate requires the chart to plot ACTUAL CANONICAL RANK. The
 * RPC states why in a comment beside the field — points over time is derivable
 * from the matchweek scores, POSITION over time is not — and a running points
 * total is a line that only ever goes up, in a season where the player may have
 * been overtaken every week.
 *
 * `rankPlot` below is the ONLY place a rank becomes a coordinate, so no
 * component can quietly plot the points column instead, and the axis is drawn
 * from the same bounds the line was.
 *
 * ============================ IDENTITY IS TWO SERVER-ISSUED IDENTIFIERS,
 * AND NEVER A NAME ==========================================================
 *
 * `playerRef` is contract 191's season-scoped ENTRY id and addresses the rank
 * history and the rivalry. `playerId` is the ACCOUNT id and addresses the
 * profile. They are different identifiers for different purposes and are never
 * substituted for one another. A display name addresses NOTHING: two players
 * may legitimately share one, and the Stage 10 predicate requires that they
 * stay distinguishable.
 *
 * ============================ WHAT IT IS NOT ==============================
 *
 * No search, no directory, no followers, no friend requests, no feed, no
 * cross-competition identity. Nothing here defines a permission, a rank, a
 * points total or a reveal boundary — every one of those is a server answer
 * this file carries.
 */

/* ==========================================================================
   WHO, AND WHERE
   ========================================================================== */

/**
 * THE TWO SERVER-ISSUED ADDRESSES A PROFILE PAGE IS OPENED WITH.
 *
 * `ref` is nullable because contract 191 is what issues it and a row below that
 * contract has none — in which case the rank history and the rivalry cannot be
 * asked at all, and their panels say so rather than pretending to have failed.
 */
export type PlayerAddress = {
  /** Contract 191's season-scoped entry id. Addresses history and rivalry. */
  readonly ref: string | null
  /** The account id. Addresses the profile. */
  readonly playerId: string
}

/**
 * WHERE THE READER IS STANDING, so the page can name it once.
 *
 * The same three dimensions the Competition Deck has kept apart since Stage
 * 7.6. A profile is a profile IN A SEASON — the person is not global here, and
 * a page that dropped the season would be claiming a cross-competition identity
 * Stage 10 explicitly does not own.
 */
export type PlayerProfileContext = {
  readonly competitionName: string
  readonly seasonLabel: string | null
  readonly gameName: string
}

/**
 * THE HEADING. Present whatever the three panels answered, because the caller
 * arrived here holding a name and an address and the page must not go blank.
 *
 * `displayName` IS A LABEL, NOT AN IDENTITY. See the header.
 */
export type PlayerHeading = {
  readonly displayName: string
  readonly address: PlayerAddress
  /** The caller looking at their own profile. Drawn differently, not linked. */
  readonly isYou: boolean
}

/* ==========================================================================
   PANEL ONE — THE PROFILE (contract 151)
   ========================================================================== */

export type PlayerSeasonSummary = {
  readonly points: number
  /** ADR 0012 pairs this with points. Points without it is half a fact. */
  readonly matchweeksPlayed: number
  readonly rank: number
  /** What that rank was out of. Never separated from it. */
  readonly fieldSize: number
}

/**
 * COUNTS, NOT RATES.
 *
 * A rate needs a denominator and this one can be zero. `accuracyRate` below is
 * the only place a division happens and it refuses rather than returning zero
 * or NaN, because "0% exact" and "no fixtures to be exact about" are different
 * sentences and only one of them is true of a player who has not started.
 */
export type PlayerAccuracy = {
  readonly fixturesPredicted: number
  readonly exactScores: number
  readonly correctOutcomes: number
}

export type PlayerJokers = {
  readonly played: number
  readonly pointsFromJokerMatchweeks: number
}

/** One prediction. A pair of scores against a fixture id, and nothing else. */
export type ProfilePick = {
  readonly fixtureId: string
  readonly home: number
  readonly away: number
}

/**
 * WHAT A REVEALED MATCHWEEK SCORED — OR THAT IT HAS NOT SCORED YET.
 *
 * A union rather than `points: number | null`, because a nullable number is one
 * `?? 0` away from telling a player they scored nothing in a matchweek that has
 * not been marked. There is no zero to reach for here.
 */
export type ProfileMatchweekResult =
  | { readonly kind: 'settled'; readonly points: number }
  | { readonly kind: 'pending' }

/**
 * ONE MATCHWEEK THE SERVER WAS WILLING TO SHOW.
 *
 * Every row in this list is past its own lock, or belongs to the caller. The
 * list's GAPS are the reveal boundary and must never be counted — see the
 * header.
 */
export type ProfileMatchweek = {
  readonly matchweekId: string
  readonly ordinal: number
  readonly label: string
  readonly result: ProfileMatchweekResult
  readonly jokerPlayed: boolean
  readonly picks: readonly ProfilePick[]
}

/**
 * THE PROFILE, WHERE THE PLAYER ACTUALLY ENTERED THIS SEASON'S GAME.
 *
 * `summary`, `accuracy` and `jokers` are independently nullable because a
 * co-member who entered but has nothing banked yet has a profile with no
 * standing in it — an ordinary early-season state, not a degraded read.
 */
export type PlayerProfileDetail = {
  readonly summary: PlayerSeasonSummary | null
  readonly accuracy: PlayerAccuracy | null
  readonly jokers: PlayerJokers | null
  /** Most recent first, as the server ordered it. Bounded at forty. */
  readonly history: readonly ProfileMatchweek[]
}

/**
 * WHAT THE PROFILE READ ANSWERED.
 *
 * `not-entered` is about the PLAYER — a private-league co-member who never
 * joined this season's game — and contract 151 returns it deliberately, because
 * "the alternative hides a league from the person who created it". It is not a
 * refusal and not a failure.
 */
export type PlayerProfilePanel =
  | { readonly kind: 'profile'; readonly detail: PlayerProfileDetail }
  | { readonly kind: 'not-entered' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unavailable' }

/* ==========================================================================
   PANEL TWO — RANK OVER TIME (contract 192)
   ========================================================================== */

/**
 * ONE SETTLED MATCHWEEK'S STANDING.
 *
 * `rank` IS THE PLOTTED VALUE and `points` is context printed beside it. They
 * are named for that difference on purpose: the predicate turns on the chart
 * plotting a position rather than a total, and a series whose two numeric
 * fields were called `value` and `points` would make the wrong one a one-token
 * mistake.
 */
export type RankPoint = {
  readonly matchweekId: string
  readonly ordinal: number
  readonly label: string
  /** THE LINE. The server's standing, never derived from points. */
  readonly rank: number
  /** What that rank was out of. Never separated from it. */
  readonly fieldSize: number
  /** That matchweek's own banked points. Beside the line, never the line. */
  readonly points: number
}

export type RankHistoryPanel =
  | { readonly kind: 'history'; readonly series: readonly RankPoint[] }
  /** The player holds no entry reference — the read cannot be addressed. */
  | { readonly kind: 'unaddressable' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unavailable' }

/* ==========================================================================
   PANEL THREE — HOW WE COMPARE (contract 192's rivalry)
   ========================================================================== */

export type RivalryStanding = {
  readonly rank: number
  readonly fieldSize: number
}

export type RivalrySide = {
  readonly playerRef: string
  readonly displayName: string
  readonly points: number
  readonly matchweeksPlayed: number
  /** Null where the player holds no banked standing. Absent, not zeroth. */
  readonly standing: RivalryStanding | null
  readonly accuracy: PlayerAccuracy
}

export type RivalryOutcome = 'you' | 'them' | 'level'

export type RivalryMatchweek = {
  readonly matchweekId: string
  readonly ordinal: number
  readonly label: string
  readonly yourPoints: number
  readonly theirPoints: number
  /** The server's verdict. Never recomputed from the two figures. */
  readonly outcome: RivalryOutcome
}

/**
 * THE COMPARISON, IN ONE READ.
 *
 * `matchweeksCompared` IS THE DENOMINATOR AND `recent` IS A WINDOW ON IT. The
 * server truncates the window to at most twenty; a record tallied off it would
 * report the last five matchweeks of a thirty-matchweek rivalry as the whole
 * story. Only matchweeks settled, revealed and banked BY BOTH are compared,
 * because a matchweek the opponent could not play is not a win.
 */
export type RivalryDetail = {
  readonly matchweeksCompared: number
  readonly you: RivalrySide
  readonly them: RivalrySide
  /** Positive means THEY are ahead. The server's sign, unflipped. */
  readonly pointsGap: number
  readonly yourWins: number
  readonly theirWins: number
  readonly draws: number
  /** Most recent first. A window, never the denominator. */
  readonly recent: readonly RivalryMatchweek[]
}

export type RivalryPanel =
  | { readonly kind: 'rivalry'; readonly detail: RivalryDetail }
  /** The caller's own profile: there is no one to compare with. */
  | { readonly kind: 'self' }
  /** The player holds no entry reference — the read cannot be addressed. */
  | { readonly kind: 'unaddressable' }
  /** They hold no entry in this season. About them, not about permission. */
  | { readonly kind: 'not-entered' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unavailable' }

/* ==========================================================================
   THE PAGE
   ========================================================================== */

export type PlayerProfileModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: PlayerProfileContext
  readonly heading: PlayerHeading
  readonly profile: PlayerProfilePanel
  readonly rankHistory: RankHistoryPanel
  readonly rivalry: RivalryPanel
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

/**
 * TWO PERCENTAGES, OR NOTHING AT ALL.
 *
 * The only division in this file. A player who has predicted no fixtures has no
 * accuracy — not zero accuracy — and returning 0 here would print "0% exact"
 * against someone who has simply not started. NaN would be worse, because it
 * renders.
 */
export function accuracyRate(
  accuracy: PlayerAccuracy,
): { readonly exact: number; readonly outcome: number } | null {
  if (accuracy.fixturesPredicted <= 0) return null
  return {
    exact: accuracy.exactScores / accuracy.fixturesPredicted,
    outcome: accuracy.correctOutcomes / accuracy.fixturesPredicted,
  }
}

/**
 * Whether the two players have anything comparable yet.
 *
 * 0-0-0 out of nothing is "not yet comparable", not a drawn rivalry, and only
 * the denominator tells the two apart. Exists so a surface asks rather than
 * reading the record.
 */
export function rivalryComparable(detail: RivalryDetail): boolean {
  return detail.matchweeksCompared > 0
}

/**
 * A STABLE KEY, WHICH IS NEVER A DISPLAY NAME.
 *
 * Two players may share a name; the reference tells them apart, and where there
 * is none the fallback is a fact about the list rather than about a person.
 */
export function rankPointKey(point: RankPoint): string {
  return point.matchweekId
}

/**
 * THE BOUNDS A RANK CHART IS DRAWN BETWEEN.
 *
 * `best` is the lowest rank number (first place is 1) and `worst` the highest.
 *
 * WHY NOT [1, fieldSize]: in a field of 412, a season spent between 4th and 7th
 * is three pixels of a flat line — technically the whole truth and practically
 * no information. The chart is therefore ZOOMED to the range actually occupied,
 * which is honest ONLY because the axis is labelled with these same numbers.
 * That is why the bounds are returned rather than kept inside a drawing
 * routine: the line and its axis come from one calculation, so a chart cannot
 * be scaled by one rule and captioned by another.
 *
 * `fieldSize` is the field at the LAST point — the standing the reader is
 * looking at now — and `fieldChanged` says so where the season's field moved,
 * because "7th of 412" is a different fact from "7th of 60".
 */
export type RankBounds = {
  readonly best: number
  readonly worst: number
  readonly fieldSize: number
  readonly fieldChanged: boolean
}

export function rankBounds(series: readonly RankPoint[]): RankBounds | null {
  const first = series[0]
  if (first === undefined) return null

  let best = first.rank
  let worst = first.rank
  let fieldChanged = false
  let fieldSize = first.fieldSize

  for (const point of series) {
    if (point.rank < best) best = point.rank
    if (point.rank > worst) worst = point.rank
    if (point.fieldSize !== fieldSize) fieldChanged = true
    fieldSize = point.fieldSize
  }

  return { best, worst, fieldSize, fieldChanged }
}

export type RankPlotPoint = {
  readonly point: RankPoint
  /** 0 at the left edge, 1 at the right. */
  readonly x: number
  /** 0 AT THE TOP, where first place belongs. 1 at the bottom. */
  readonly y: number
}

/**
 * THE ONLY PLACE A RANK BECOMES A COORDINATE.
 *
 * Two things it exists to get right, both of which are silent when wrong:
 *
 *   • FIRST PLACE IS AT THE TOP. A rank is a number that improves as it falls,
 *     so the naive linear scale draws a season of promotions as a slide
 *     downhill. The inversion happens once, here;
 *   • THE SCALE IS THE ONE THE AXIS IS LABELLED WITH, because it comes from
 *     `rankBounds` and the caller labels from the same value.
 *
 * A single-point series, and a season spent entirely at one rank, both have no
 * range to scale across; those plot on the CENTRE LINE rather than dividing by
 * zero or pinning to an edge that would read as a best-or-worst season.
 *
 * Fractions rather than pixels, so the same series is correct in a phone card
 * and a desktop panel and no component holds a second copy of the geometry.
 */
export function rankPlot(series: readonly RankPoint[]): readonly RankPlotPoint[] {
  const bounds = rankBounds(series)
  if (bounds === null) return []

  const span = bounds.worst - bounds.best
  const lastIndex = series.length - 1

  return series.map((point, index) => ({
    point,
    x: lastIndex === 0 ? 0.5 : index / lastIndex,
    // Inverted: `best` (the smallest number) is the top of the chart.
    y: span === 0 ? 0.5 : (point.rank - bounds.best) / span,
  }))
}

/**
 * HOW A POINTS GAP SHOULD READ, FROM THE CALLER'S SIDE.
 *
 * The sign is the server's — positive means THEY are ahead — and this is the
 * one place it is turned into a sentence, so no surface has to remember which
 * way round it was and none re-signs it.
 */
export function pointsGapLabel(pointsGap: number): string {
  if (pointsGap > 0) {
    return `${pointsGap} ${pointsGap === 1 ? 'point' : 'points'} behind`
  }
  if (pointsGap < 0) {
    const ahead = Math.abs(pointsGap)
    return `${ahead} ${ahead === 1 ? 'point' : 'points'} ahead`
  }
  return 'level on points'
}
