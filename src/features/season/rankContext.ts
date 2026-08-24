/**
 * Rank with the scale that makes it mean something.
 *
 * "384th" says nothing on its own; "384th of 4,812 · Top 8%" says the player is
 * doing well. The direction asks for rank never to be shown without context
 * where that context is available — and here it is: both numbers are the
 * server's, and a percentile is arithmetic over them.
 *
 * THIS IS NOT RANK MOVEMENT AND MUST NOT BE MISTAKEN FOR IT. "↑3 this
 * matchweek" needs the rank the player held before. That history now exists, in
 * contract 150, but only for a PRIVATE LEAGUE and only over a SETTLED
 * matchweek — so movement is rendered beside the league it was measured in and
 * never beside a season-wide rank. Current standing and change in standing are
 * different facts from different sources, and conflating them is how a product
 * starts inventing one from the other.
 *
 * IT CREATES NO RANKING AUTHORITY. The rank is the server's, the field size is
 * the server's, and the percentile is a presentation of the two. Nothing here
 * orders anybody.
 *
 * PURE.
 */

/**
 * Below this the percentile is noise rather than context.
 *
 * In a league of eight, "top 25%" is second place said less clearly, and it
 * invites a comparison with a season table where the same words mean something
 * quite different. The threshold is a presentation judgement recorded once;
 * the season leaderboard clears it easily and a private league usually will
 * not, which is the correct outcome for both.
 */
export const MIN_FIELD_FOR_PERCENTILE = 50

/**
 * "Top 8%" for a player who is genuinely near the top, or null.
 *
 * ROUNDED UP, so a player is never told they are in a better bracket than they
 * are: rank 9 of 100 is "top 9%", not "top 8%". Rank 1 is "top 1%" rather than
 * "top 0%", which would be a bracket nobody is in.
 *
 * NOT SHOWN BELOW THE HALFWAY POINT. "Top 96%" is a euphemism, and a product
 * that only frames a position flatteringly is not being straight with the
 * player — the rank and the field size are already both on screen.
 */
export function percentileLine(
  rank: number | null,
  fieldSize: number | null,
): string | null {
  if (rank === null || fieldSize === null) return null
  if (!Number.isFinite(rank) || !Number.isFinite(fieldSize)) return null
  if (rank < 1 || fieldSize < MIN_FIELD_FOR_PERCENTILE || rank > fieldSize) return null

  const percentile = Math.max(1, Math.ceil((rank / fieldSize) * 100))
  if (percentile > 50) return null
  return `Top ${percentile}%`
}

/** "4,812" — a field size a player reads rather than a bare integer. */
export function formatFieldSize(fieldSize: number): string {
  return fieldSize.toLocaleString()
}
