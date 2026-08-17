/**
 * Predictor Cup league-phase schedule generation.
 *
 * Authority: ADR 0014 as amended by ADR 0020. At entry close the complete
 * fixture list is generated and published, and generation must be
 * DETERMINISTIC from the audited draw: the same draw always yields the same
 * fixtures, so the schedule can be independently reproduced from the audit
 * record. This module is that reproduction — no randomness, no clock, no
 * storage; the draw order is the only input that shapes the result.
 *
 * Scope is the league phase: `meetings` repetitions of a single round-robin
 * over the drawn field, home and away reversed on each successive meeting,
 * with a rotating bye when the field is odd. The split tail's pairings
 * depend on standings at the split, and the playoff on qualification — both
 * are decided when they occur, by their own authorities. Publishing the
 * league phase in full is what lets a player see in August that they face
 * Dave in matchweek 7.
 *
 * Round-robin pairing uses the circle method: the first drawn entrant is
 * fixed and the rest rotate one position per round. Home/away within a
 * pairing alternates with the round index so no entrant plays a long
 * home-only run.
 */

export type CupScheduledTie = {
  home: string
  away: string
}

export type CupScheduledRound = {
  /** 1-based round number across the whole league phase. */
  round: number
  ties: readonly CupScheduledTie[]
  /** The entrant resting this round — odd fields only. */
  bye: string | null
}

export type CupScheduleResult =
  | { ok: true; rounds: readonly CupScheduledRound[] }
  | { ok: false; reason: 'invalid_input' | 'duplicate_entrant' | 'field_too_small' }

/**
 * Generate the league-phase schedule from the audited draw order.
 * Deterministic: an identical draw and meeting count always produces an
 * identical fixture list.
 */
export function generateCupLeagueSchedule(
  drawOrder: readonly string[],
  meetings: number,
): CupScheduleResult {
  if (!Number.isInteger(meetings) || meetings < 1) return { ok: false, reason: 'invalid_input' }
  const seen = new Set<string>()
  for (const entryId of drawOrder) {
    if (entryId.trim().length === 0) return { ok: false, reason: 'invalid_input' }
    if (seen.has(entryId)) return { ok: false, reason: 'duplicate_entrant' }
    seen.add(entryId)
  }
  if (drawOrder.length < 2) return { ok: false, reason: 'field_too_small' }

  // The circle method needs an even circle; an odd field carries a bye slot.
  const BYE = null
  const circle: (string | null)[] =
    drawOrder.length % 2 === 0 ? [...drawOrder] : [...drawOrder, BYE]
  const size = circle.length
  const roundsPerMeeting = size - 1

  // Every read below is at an offset already proven `< size` by the circle
  // method's own arithmetic (a rotation mod `size - 1`, plus the fixed slot
  // `0`) — genuinely never out of range, but not something the index
  // signature can see. A guard that throws documents the invariant instead
  // of silently asserting past it.
  function circleAt(i: number): string | null {
    const value = circle[i]
    if (value === undefined) throw new Error(`circle index ${i} out of range`)
    return value
  }

  const rounds: CupScheduledRound[] = []
  for (let meeting = 0; meeting < meetings; meeting += 1) {
    for (let turn = 0; turn < roundsPerMeeting; turn += 1) {
      const ties: CupScheduledTie[] = []
      let bye: string | null = null

      for (let pair = 0; pair < size / 2; pair += 1) {
        const first = pair === 0 ? circleAt(0) : circleAt(((turn + pair - 1) % (size - 1)) + 1)
        const second = circleAt(((turn + size - 1 - pair - 1) % (size - 1)) + 1)
        if (first === BYE || second === BYE) {
          bye = first === BYE ? (second as string) : (first as string)
          continue
        }
        // Alternate within the meeting by turn parity, then reverse the
        // whole meeting on each successive meeting so a double round-robin
        // is an exact home/away mirror.
        const flip = (turn + pair) % 2 === Number(meeting % 2 === 1)
        ties.push(flip ? { home: second, away: first } : { home: first, away: second })
      }

      rounds.push({
        round: meeting * roundsPerMeeting + turn + 1,
        ties,
        bye,
      })
    }
  }

  return { ok: true, rounds }
}
