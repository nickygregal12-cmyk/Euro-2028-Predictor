/**
 * Predictor Cup group table and split execution for a season competition.
 *
 * Authority: ADR 0014 as amended by ADR 0020, over the table and tie-break
 * rules in `docs/predictor-cup-rules.md` §5. ADR 0014 names the new season
 * work as the format selector, the split, and the matchweek points source;
 * this module is the split, and the table it needs to divide a field.
 *
 * The table follows football logic on head-to-head results: 3 for a win, 1
 * for a draw, 0 for a loss, with PF/PA/PD carrying the prediction points
 * that produced them. Ranking tied players uses the pinned sequence — total
 * prediction points, then exacts, then correct results, then head-to-head
 * table points, then head-to-head prediction difference, then overall
 * prediction difference, then lowest scoreline error, then the neutral draw
 * number assigned at entry close. The draw number is the guaranteed
 * terminator: every entrant has one, so ranking is always total and never
 * falls back to insertion order.
 *
 * The split divides the ranked field into halves and POINTS CARRY THROUGH —
 * that is what makes the split a continuation of the same competition rather
 * than a sorting operation, and why finishing sixth rather than seventh
 * matters. Nobody is eliminated. An odd field gives the larger half to the
 * top, matching the sizing the format selector published at entry close.
 *
 * Pure domain: no storage, network or ambient clock.
 */

export const CUP_TABLE_POINTS = { win: 3, draw: 1, loss: 0 } as const

/** One settled tie, as `cupTieSettlement.ts` produced it. */
export type CupTableTie = {
  homeEntryId: string
  awayEntryId: string
  homePoints: number
  awayPoints: number
}

/**
 * Per-entrant facts the tie-breaks need that the tie results do not carry:
 * scoring-window totals (including any bye window), accuracy counts, and the
 * neutral draw number.
 */
export type CupEntrantRecord = {
  entryId: string
  /** Total prediction points across all scoring windows, byes included. */
  windowPredictionPoints: number
  exactScores: number
  correctResults: number
  /** Summed scoreline error — lower is better. */
  scorelineError: number
  /** Neutral draw number assigned at entry close. Unique per entrant. */
  drawNumber: number
}

export type CupTableRow = {
  entryId: string
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  /** Prediction points scored across the entrant's ties. */
  pointsFor: number
  pointsAgainst: number
  pointsDifference: number
  tablePoints: number
}

export type CupGroupTableResult =
  | { ok: true; rows: readonly CupTableRow[] }
  | {
      ok: false
      reason:
        | 'invalid_input'
        | 'unknown_entrant'
        | 'entrant_against_itself'
        | 'duplicate_entrant'
        | 'duplicate_draw_number'
    }

type Accumulator = {
  entryId: string
  played: number
  won: number
  drawn: number
  lost: number
  pointsFor: number
  pointsAgainst: number
  /** Head-to-head table points against each opponent, for tie-break 4/5. */
  headToHeadPoints: Map<string, number>
  headToHeadDifference: Map<string, number>
}

function blank(entryId: string): Accumulator {
  return {
    entryId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    headToHeadPoints: new Map(),
    headToHeadDifference: new Map(),
  }
}

function credit(
  side: Accumulator,
  opponentId: string,
  own: number,
  against: number,
): void {
  side.played += 1
  side.pointsFor += own
  side.pointsAgainst += against
  const tablePoints =
    own > against
      ? CUP_TABLE_POINTS.win
      : own === against
        ? CUP_TABLE_POINTS.draw
        : CUP_TABLE_POINTS.loss
  if (own > against) side.won += 1
  else if (own === against) side.drawn += 1
  else side.lost += 1
  side.headToHeadPoints.set(opponentId, (side.headToHeadPoints.get(opponentId) ?? 0) + tablePoints)
  side.headToHeadDifference.set(
    opponentId,
    (side.headToHeadDifference.get(opponentId) ?? 0) + (own - against),
  )
}

function tablePointsOf(accumulator: Accumulator): number {
  return (
    accumulator.won * CUP_TABLE_POINTS.win + accumulator.drawn * CUP_TABLE_POINTS.draw
  )
}

/**
 * Build and rank one group's table. Ranking is total: every comparison ends
 * at the neutral draw number, so two entrants never share a position.
 */
export function buildCupGroupTable(
  entrants: readonly CupEntrantRecord[],
  ties: readonly CupTableTie[],
): CupGroupTableResult {
  const records = new Map<string, CupEntrantRecord>()
  const drawNumbers = new Set<number>()
  for (const entrant of entrants) {
    if (
      entrant.entryId.trim().length === 0 ||
      !Number.isInteger(entrant.drawNumber) ||
      !Number.isFinite(entrant.windowPredictionPoints) ||
      !Number.isFinite(entrant.scorelineError)
    ) {
      return { ok: false, reason: 'invalid_input' }
    }
    if (records.has(entrant.entryId)) return { ok: false, reason: 'duplicate_entrant' }
    if (drawNumbers.has(entrant.drawNumber)) return { ok: false, reason: 'duplicate_draw_number' }
    records.set(entrant.entryId, entrant)
    drawNumbers.add(entrant.drawNumber)
  }
  if (records.size === 0) return { ok: false, reason: 'invalid_input' }

  const accumulators = new Map<string, Accumulator>(
    [...records.keys()].map((entryId) => [entryId, blank(entryId)]),
  )

  for (const tie of ties) {
    if (!records.has(tie.homeEntryId) || !records.has(tie.awayEntryId)) {
      return { ok: false, reason: 'unknown_entrant' }
    }
    if (tie.homeEntryId === tie.awayEntryId) {
      return { ok: false, reason: 'entrant_against_itself' }
    }
    if (!Number.isFinite(tie.homePoints) || !Number.isFinite(tie.awayPoints)) {
      return { ok: false, reason: 'invalid_input' }
    }
    credit(
      accumulators.get(tie.homeEntryId) as Accumulator,
      tie.awayEntryId,
      tie.homePoints,
      tie.awayPoints,
    )
    credit(
      accumulators.get(tie.awayEntryId) as Accumulator,
      tie.homeEntryId,
      tie.awayPoints,
      tie.homePoints,
    )
  }

  const ranked = [...accumulators.values()].sort((left, right) => {
    const leftRecord = records.get(left.entryId) as CupEntrantRecord
    const rightRecord = records.get(right.entryId) as CupEntrantRecord

    const byTablePoints = tablePointsOf(right) - tablePointsOf(left)
    if (byTablePoints !== 0) return byTablePoints

    const byWindowPoints = rightRecord.windowPredictionPoints - leftRecord.windowPredictionPoints
    if (byWindowPoints !== 0) return byWindowPoints

    const byExacts = rightRecord.exactScores - leftRecord.exactScores
    if (byExacts !== 0) return byExacts

    const byResults = rightRecord.correctResults - leftRecord.correctResults
    if (byResults !== 0) return byResults

    const headToHead =
      (right.headToHeadPoints.get(left.entryId) ?? 0) -
      (left.headToHeadPoints.get(right.entryId) ?? 0)
    if (headToHead !== 0) return headToHead

    const headToHeadDifference =
      (right.headToHeadDifference.get(left.entryId) ?? 0) -
      (left.headToHeadDifference.get(right.entryId) ?? 0)
    if (headToHeadDifference !== 0) return headToHeadDifference

    const byDifference =
      right.pointsFor - right.pointsAgainst - (left.pointsFor - left.pointsAgainst)
    if (byDifference !== 0) return byDifference

    const byError = leftRecord.scorelineError - rightRecord.scorelineError
    if (byError !== 0) return byError

    // The guaranteed terminator: draw numbers are unique, lower first.
    return leftRecord.drawNumber - rightRecord.drawNumber
  })

  return {
    ok: true,
    rows: ranked.map((accumulator, index) => ({
      entryId: accumulator.entryId,
      position: index + 1,
      played: accumulator.played,
      won: accumulator.won,
      drawn: accumulator.drawn,
      lost: accumulator.lost,
      pointsFor: accumulator.pointsFor,
      pointsAgainst: accumulator.pointsAgainst,
      pointsDifference: accumulator.pointsFor - accumulator.pointsAgainst,
      tablePoints: tablePointsOf(accumulator),
    })),
  }
}

export type CupSplitHalf = {
  half: 'top' | 'bottom'
  /** Ranked entrants, each keeping the table points they arrived with. */
  rows: readonly CupTableRow[]
}

export type CupSplitResult =
  | { ok: true; halves: readonly [CupSplitHalf, CupSplitHalf] }
  | { ok: false; reason: 'invalid_input' | 'field_too_small' }

/**
 * Execute the split on a ranked table. Points carry through unchanged —
 * the split continues the competition with a narrower field rather than
 * restarting it, and nobody is eliminated. An odd field gives the larger
 * half to the top, matching the sizing published at entry close.
 */
export function executeCupSplit(rows: readonly CupTableRow[]): CupSplitResult {
  if (rows.length < 4) return { ok: false, reason: 'field_too_small' }
  const positions = rows.map((row) => row.position)
  const expected = rows.map((_, index) => index + 1)
  if (positions.join(',') !== expected.join(',')) return { ok: false, reason: 'invalid_input' }

  const topHalfSize = Math.ceil(rows.length / 2)
  return {
    ok: true,
    halves: [
      { half: 'top', rows: rows.slice(0, topHalfSize) },
      { half: 'bottom', rows: rows.slice(topHalfSize) },
    ],
  }
}
