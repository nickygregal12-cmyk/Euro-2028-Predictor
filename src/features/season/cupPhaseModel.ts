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
  rows: readonly CupPresentedRow[]
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
    return { phaseLine: null, phaseExplanation: null, groupLine: null, rows: [] }
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
    groupLine: `Group of ${page.group.size}, ranked from settled rounds.`,
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
