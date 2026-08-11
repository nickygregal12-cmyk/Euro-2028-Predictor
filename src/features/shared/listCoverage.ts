/**
 * What a capped server list actually carried, and how to say so (contract 171).
 *
 * WHY THIS EXISTS AT ALL. Several bounded reads return a hard-capped array beside
 * the collection's REAL size. Before contract 171 they returned only the array and
 * the size, and those two numbers disagreeing is indistinguishable from members who
 * simply did not predict — so a league of three hundred showed two hundred rows and
 * a hundred people who looked like non-players. The server now states how many rows
 * it carried and whether that was all of them, and this module is the single place
 * that turns those two facts into a sentence.
 *
 * ONE AUTHORITY, BECAUSE TWO SURFACES ASK THE SAME QUESTION. The Match Centre's
 * tournament league picks and the season league matchweek both hit a cap, from two
 * different RPCs with two different field names. If each wrote its own sentence the
 * two would drift, and the drift would be in the exact wording that stops a reader
 * drawing a false conclusion.
 *
 * SILENT WHEN NOTHING WAS DROPPED. A list that carried everything says nothing —
 * "Showing 8 of 8" is noise, and noise trains people to stop reading the line that
 * matters. The notice appears only when the server said it truncated.
 *
 * IT NEVER RE-DERIVES TRUNCATION. `truncated` is the server's answer. Comparing
 * `returned` with `total` in the browser would be a second authority, and it would
 * be wrong in both directions: a list shorter than the collection is the ordinary
 * case for a read that returns only members who predicted, and a list exactly at the
 * cap may or may not have lost a row.
 */

export type ListCoverage = {
  /** Rows this payload actually carried. */
  readonly returned: number
  /** The collection's real size, as the server counts it. */
  readonly total: number
  /** The server's answer to "was that all of them". Never derived here. */
  readonly truncated: boolean
}

export type ListCoverageNoun = {
  /** Singular, for a total of one. */
  readonly one: string
  /** Plural, for anything else. */
  readonly many: string
}

/**
 * The sentence to show above a truncated list, or null when there is nothing to
 * say.
 *
 * The second clause is the load-bearing one: without it "Showing 200 of 300" reads
 * as "100 did not take part", which is the false conclusion contract 171 was written
 * to prevent.
 */
export function coverageNotice(
  coverage: ListCoverage,
  noun: ListCoverageNoun,
): string | null {
  if (!coverage.truncated) return null

  const word = coverage.total === 1 ? noun.one : noun.many
  return (
    `Showing ${coverage.returned} of ${coverage.total} ${word}. ` +
    `The rest are not listed here — that is not a record of who predicted.`
  )
}

/** The one noun both league surfaces use, so they cannot describe it differently. */
export const LEAGUE_MEMBER_NOUN: ListCoverageNoun = {
  one: 'league member',
  many: 'league members',
}
