/**
 * Presentation model for the Predictor Championship phase read (contract 120).
 *
 * THIS SURFACE RANKS NOBODY. `get_season_cup_phase` returns the caller's own
 * phase and their own group's table from whichever authority owns that phase —
 * `cup_final_group_tables` for the league phase, `cup_split_group_tables` for
 * the split — already ranked. Re-deriving rank, points or the phase in the
 * browser would put a second settlement authority in the client, so this file
 * only decides how to *show* what the server said.
 *
 * ROWS CARRY NO NAME, BY CONTRACT DESIGN. The read returns `user_id` and the
 * stats the authority computed; resolving an identity to a display name is a
 * disclosure the profile reads own, and contract 120 deliberately does not
 * join it. So an opponent is presented as an entrant at a rank — never by a
 * raw identifier, which is not a name and must not leak into the interface.
 *
 * THE SPLIT IS NOT AN ELIMINATION. ADR 0014: the split is the same competition
 * continuing with a narrower field, points carry through it, and nobody is
 * eliminated. The split explanation states that and nothing more — which half
 * a group is, or what the other half is doing, is not in this payload and is
 * not guessed here.
 */

export type CupPhaseKind = 'initial' | 'split'

/**
 * Which server authority produced the table (contract 169's `table_source`).
 *
 * IT IS READ, NEVER DERIVED. Contract 169 exists because one table was being
 * ranked over the wrong span: `cup_final_group_tables` measures four of ADR
 * 0014's nine keys over the tournament's three group matchdays, and contracts
 * 120 and 167 were showing it for a season group stage running to thirty-eight.
 * The fix put a second authority beside it and made the server say which one
 * answered. A browser that inferred the source back from the competition's kind
 * would be re-deriving exactly the fact the server was changed to state, so this
 * is decoded from the payload and nothing else.
 *
 * An unrecognised token decodes to `null` and the surface says nothing, rather
 * than guessing a span it has no authority for.
 */
export type CupTableSource = 'split' | 'season_initial' | 'tournament_initial'

export type CupTableRow = {
  /** Identity for keys and self-matching only. Never rendered. */
  userId: string
  isYou: boolean
  groupRank: number
  tablePoints: number
  pointsFor: number
  pointsAgainst: number
  windowPoints: number
  exacts: number
  corrects: number
  scorelineError: number
}

export type CupPhasePage = {
  competitionId: string
  entered: boolean
  phaseKind: CupPhaseKind | null
  /** Contract 169. Null for a non-entrant, and null for an unknown token. */
  tableSource: CupTableSource | null
  group: {
    id: string
    ordinal: number
    size: number
    phaseKind: CupPhaseKind
    parentGroupId: string | null
  } | null
  table: readonly CupTableRow[]
}

/** A row as the table renders it. Reachable through `CupPhasePresentation`;
 *  not exported separately, so it does not become a needless public name. */
type CupPresentedRow = {
  key: string
  /** "4", or "=4" when the server gave the same rank to more than one row. */
  rankLabel: string
  rank: number
  /** "You" or "Entrant" — the payload discloses no name, so neither does this. */
  label: string
  isYou: boolean
  tablePoints: number
  pointsFor: number
  pointsAgainst: number
  /** Screen-reader sentence; the visual row is a table of numbers. */
  accessibleSummary: string
}

export type CupPhasePresentation = {
  /** Names the phase the caller is in: the league phase or the split. */
  phaseLine: string | null
  /** Split only: what the split means, per ADR 0014. Null in the league phase. */
  phaseExplanation: string | null
  /** One sentence sizing the group, for the table caption. */
  groupLine: string | null
  /**
   * Contract 169. Names the authority that produced this table, and nothing
   * else — no span, no qualification consequence. Null when the server named a
   * source this build does not recognise, because a table whose provenance is
   * unknown is better left unlabelled than labelled with a guess.
   */
  tableSourceLine: string | null
  rows: readonly CupPresentedRow[]
}

const TABLE_SOURCE_LINES: Record<CupTableSource, string> = {
  season_initial: 'Ranked by the season group table.',
  tournament_initial: 'Ranked by the tournament group table.',
  split: 'Ranked by the split group table.',
}

function summarise(row: CupTableRow, tied: boolean): string {
  const who = row.isYou ? 'You' : 'An entrant'
  const rank = tied ? `joint ${row.groupRank}` : `${row.groupRank}`
  return (
    `${who}, ${rank}, ${row.tablePoints} table points, ` +
    `${row.pointsFor} for, ${row.pointsAgainst} against`
  )
}

export function presentCupPhase(page: CupPhasePage): CupPhasePresentation {
  if (!page.entered || !page.group) {
    return {
      phaseLine: null,
      phaseExplanation: null,
      groupLine: null,
      tableSourceLine: null,
      rows: [],
    }
  }

  const split = page.phaseKind === 'split'
  const rankCounts = new Map<number, number>()
  for (const row of page.table) {
    rankCounts.set(row.groupRank, (rankCounts.get(row.groupRank) ?? 0) + 1)
  }

  return {
    phaseLine: split ? 'The split' : 'League phase',
    phaseExplanation: split
      ? 'The competition continues with a narrower field. Points carry through from the league phase — nobody is eliminated.'
      : null,
    // The size, and no span claim. This line used to end "ranked from settled
    // rounds", which is a statement about the span the server measures over —
    // and contract 169 exists precisely because that span differs by authority.
    // The span belongs to the source, and the source is now named beside it.
    groupLine: `Group of ${page.group.size}.`,
    tableSourceLine: page.tableSource ? TABLE_SOURCE_LINES[page.tableSource] : null,
    rows: page.table.map((row) => {
      const tied = (rankCounts.get(row.groupRank) ?? 0) > 1
      return {
        key: row.userId,
        rankLabel: tied ? `=${row.groupRank}` : `${row.groupRank}`,
        rank: row.groupRank,
        label: row.isYou ? 'You' : 'Entrant',
        isYou: row.isYou,
        tablePoints: row.tablePoints,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        accessibleSummary: summarise(row, tied),
      }
    }),
  }
}

/** Everything the page may ask of the world. Injected, so the page stays pure. */
export type SeasonCupGateway = {
  load(): Promise<CupPhasePage>
}
