/**
 * Contract 183 / `MIG-UI-18` response parsing. Pure: no Supabase import, no
 * network, no clock — the configured wrapper is
 * `seasonLeaderboardNeighbourhood.ts`.
 *
 * WHAT THIS READ IS FOR. `get_season_leaderboard` answers "who is at the top",
 * pages from there, and pins the caller's own row on the end. It cannot answer
 * "who is immediately above me", which at rank 4,000 of 5,000 is eighty pages
 * away. This one answers exactly that in one request, and computes no rank of
 * its own: every figure and the whole total order come from
 * `predictor_internal.season_standings` and contract 95's ordering.
 *
 * `pointsFromYou` IS SIGNED AND IS THE SERVER'S ARITHMETIC. Positive means the
 * row is ahead of the caller. It is decoded rather than derived here, because a
 * browser subtracting two points totals would be a second opinion about a gap
 * the server already stated — and the two would diverge the moment either side
 * of the subtraction changed meaning.
 *
 * `atTop` AND `atBottom` ARE STATED, NEVER INFERRED. The migration's own header
 * records why: a caller at rank 1 legitimately receives fewer rows above them
 * than they asked for, so counting rows would report the top of the table as
 * missing data. A parser that recomputed either flag would reintroduce exactly
 * that defect.
 *
 * ============================ NO IDENTITY LIVES HERE =====================
 *
 * THIS PAYLOAD PREDATES CONTRACT 191 AND CARRIES NONE OF ITS IDENTITY. There is
 * no `playerRef`, no `reach` and no `playerId` on a neighbourhood row, and this
 * module must never invent one. In particular it must not match a neighbour to
 * a leaderboard row by display name: that is the precise defect contract 191's
 * reference exists to make impossible, and two entrants may legitimately share
 * a display name.
 *
 * A neighbour is therefore NOT openable from this payload alone. Where a
 * surface wants to open one it must join on `position` — the server's own
 * ordinal, which pgTAP `232_season_clubs_and_neighbourhood.sql` requires this
 * read and the paged leaderboard to agree on — and take the identity from
 * contract 191's row. That join belongs to the surface that holds both
 * payloads; it is deliberately not done here, because this module only ever
 * sees one of them.
 */

/**
 * One entrant in the window around the caller.
 *
 * `position` is the server's total-order ordinal and is the ONLY key another
 * payload may be joined on. `rank` is the competitive rank and is shared by
 * tied entrants, which is what makes it unusable as a key.
 */
export type SeasonNeighbourRow = {
  displayName: string
  points: number
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
  isYou: boolean
  /** Signed, relative to the caller. Positive is ahead of them. */
  pointsFromYou: number
}

/** The caller's own standing, as the same read measured it. */
export type SeasonNeighbourhoodYou = {
  displayName: string
  points: number
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
}

export type SeasonLeaderboardNeighbourhood = {
  rows: SeasonNeighbourRow[]
  you: SeasonNeighbourhoodYou | null
  /** The window the server actually applied, after its own clamp. */
  window: number
  /** The field size, so a rank never stands alone. */
  totalCount: number
  atTop: boolean
  atBottom: boolean
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function mapYou(value: unknown): SeasonNeighbourhoodYou | null {
  // ABSENT `you` IS A REAL ANSWER, not a malformed payload. The RPC refuses a
  // caller holding no entry in the season, so the one way this is null is a
  // season whose standings hold no row for them yet — and a surface must be
  // able to say "you are not in this table" rather than render a zero.
  if (value === null || value === undefined) return null
  const row = objectOf(value)

  const displayName = row.displayName
  const points = integerOrNull(row.points)
  const rank = integerOrNull(row.rank)
  const matchweeksPlayed = integerOrNull(row.matchweeksPlayed)
  const position = integerOrNull(row.position)

  if (
    typeof displayName !== 'string' ||
    points === null ||
    rank === null ||
    // MATCHES PLAYED IS NOT OPTIONAL, for the reason `seasonLeaderboardModel`
    // defends it: ADR 0012 pairs it with points because two players on 84
    // points from 22 and 23 matchweeks are not tied in meaning. Defaulting it
    // to zero would render a plausible table in which nobody had played.
    matchweeksPlayed === null ||
    position === null
  ) {
    throw new Error('The leaderboard neighbourhood response has an invalid caller row.')
  }

  return {
    displayName,
    points,
    rank,
    matchweeksPlayed,
    tied: row.tied === true,
    position,
  }
}

function mapRow(value: unknown): SeasonNeighbourRow {
  const row = objectOf(value)

  const displayName = row.displayName
  const points = integerOrNull(row.points)
  const rank = integerOrNull(row.rank)
  const matchweeksPlayed = integerOrNull(row.matchweeksPlayed)
  const position = integerOrNull(row.position)
  const pointsFromYou = integerOrNull(row.pointsFromYou)

  if (
    typeof displayName !== 'string' ||
    points === null ||
    rank === null ||
    matchweeksPlayed === null ||
    position === null ||
    // THE GAP IS NOT DERIVED ON A MALFORMED PAYLOAD. Computing it here from
    // `points` would silently substitute this module's arithmetic for the
    // server's on exactly the rows where the payload is least trustworthy.
    pointsFromYou === null
  ) {
    throw new Error('The leaderboard neighbourhood response has an invalid row.')
  }

  return {
    displayName,
    points,
    rank,
    matchweeksPlayed,
    tied: row.tied === true,
    position,
    isYou: row.isYou === true,
    pointsFromYou,
  }
}

export function mapSeasonLeaderboardNeighbourhood(
  value: unknown,
): SeasonLeaderboardNeighbourhood {
  const payload = objectOf(value)

  if (!Array.isArray(payload.rows)) {
    throw new Error('The leaderboard neighbourhood response is missing its rows.')
  }

  const window = integerOrNull(payload.window)
  const totalCount = integerOrNull(payload.totalCount)
  if (window === null || window < 1 || totalCount === null || totalCount < 0) {
    throw new Error('The leaderboard neighbourhood response has invalid bounds.')
  }

  // THE FLAGS ARE THE SERVER'S OR THEY ARE A DECODE FAILURE. Defaulting a
  // missing `atTop` to `false` would draw "more players above" above the
  // leader, which is the one thing this window must never claim.
  if (typeof payload.atTop !== 'boolean' || typeof payload.atBottom !== 'boolean') {
    throw new Error('The leaderboard neighbourhood response is missing its bounds flags.')
  }

  return {
    rows: payload.rows.map(mapRow),
    you: mapYou(payload.you),
    window,
    totalCount,
    atTop: payload.atTop,
    atBottom: payload.atBottom,
  }
}
