import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  generateCupLeagueSchedule,
  type CupScheduledRound,
} from '../../../src/domain/season/cupSchedule'

/**
 * ADR 0014 schedule generation: deterministic from the audited draw, so the
 * published fixture list can be independently reproduced. The suite proves
 * the round-robin properties at every field size the format selector can
 * produce for a single group or a drawn group (2 through 20).
 */

function draw(size: number): string[] {
  return Array.from({ length: size }, (_, index) => `entrant-${index + 1}`)
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function assertRoundRobinProperties(
  rounds: readonly CupScheduledRound[],
  entrants: readonly string[],
  meetings: number,
): void {
  const fieldSize = entrants.length
  const roundsPerMeeting = fieldSize % 2 === 0 ? fieldSize - 1 : fieldSize
  expect(rounds.length).toBe(meetings * roundsPerMeeting)

  const meetingsByPair = new Map<string, number>()
  const homeByEntrant = new Map<string, number>()
  const byesByEntrant = new Map<string, number>()

  rounds.forEach((round, index) => {
    expect(round.round).toBe(index + 1)
    const appearing = new Set<string>()
    for (const tie of round.ties) {
      expect(tie.home).not.toBe(tie.away)
      for (const entryId of [tie.home, tie.away]) {
        expect(appearing.has(entryId)).toBe(false)
        appearing.add(entryId)
      }
      meetingsByPair.set(pairKey(tie.home, tie.away), (meetingsByPair.get(pairKey(tie.home, tie.away)) ?? 0) + 1)
      homeByEntrant.set(tie.home, (homeByEntrant.get(tie.home) ?? 0) + 1)
    }
    if (fieldSize % 2 === 1) {
      expect(round.bye).not.toBeNull()
      expect(appearing.has(round.bye as string)).toBe(false)
      byesByEntrant.set(round.bye as string, (byesByEntrant.get(round.bye as string) ?? 0) + 1)
      expect(appearing.size).toBe(fieldSize - 1)
    } else {
      expect(round.bye).toBeNull()
      expect(appearing.size).toBe(fieldSize)
    }
  })

  // Every pair meets exactly `meetings` times.
  expect(meetingsByPair.size).toBe((fieldSize * (fieldSize - 1)) / 2)
  for (const count of meetingsByPair.values()) expect(count).toBe(meetings)

  // Odd fields: everyone rests exactly once per meeting.
  if (fieldSize % 2 === 1) {
    expect(byesByEntrant.size).toBe(fieldSize)
    for (const count of byesByEntrant.values()) expect(count).toBe(meetings)
  }
}

describe('deterministic reproduction from the audited draw', () => {
  it('an identical draw always yields an identical fixture list', () => {
    const order = draw(12)
    expect(generateCupLeagueSchedule(order, 3)).toEqual(generateCupLeagueSchedule(order, 3))
  })

  it('a different draw order yields a different fixture list', () => {
    const reversed = [...draw(12)].reverse()
    expect(generateCupLeagueSchedule(draw(12), 2)).not.toEqual(
      generateCupLeagueSchedule(reversed, 2),
    )
  })
})

describe('round-robin properties at every drawable field size', () => {
  it('holds from 2 through 20 for one, two and three meetings', () => {
    for (let fieldSize = 2; fieldSize <= 20; fieldSize += 1) {
      for (const meetings of [1, 2, 3]) {
        const result = generateCupLeagueSchedule(draw(fieldSize), meetings)
        expect(result.ok).toBe(true)
        if (result.ok) assertRoundRobinProperties(result.rounds, draw(fieldSize), meetings)
      }
    }
  })

  it('a double round-robin is an exact home and away mirror', () => {
    const result = generateCupLeagueSchedule(draw(8), 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const firstMeeting = result.rounds.slice(0, 7)
    const secondMeeting = result.rounds.slice(7)
    const mirrored = new Set(
      firstMeeting.flatMap((round) => round.ties.map((tie) => `${tie.away}>${tie.home}`)),
    )
    for (const round of secondMeeting) {
      for (const tie of round.ties) {
        expect(mirrored.has(`${tie.home}>${tie.away}`)).toBe(true)
      }
    }
  })

  it('publishes the named-opponent fact — the same tie sits in the same round on every regeneration', () => {
    const result = generateCupLeagueSchedule(draw(8), 5)
    const again = generateCupLeagueSchedule(draw(8), 5)
    expect(result.ok && again.ok).toBe(true)
    if (!result.ok || !again.ok) return
    expect(again.rounds).toEqual(result.rounds)
  })
})

describe('contradictory data refuses', () => {
  it('refuses malformed input outright', () => {
    expect(generateCupLeagueSchedule(draw(6), 0)).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
    expect(generateCupLeagueSchedule(draw(6), 1.5)).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
    expect(generateCupLeagueSchedule(['a', 'a'], 1)).toEqual({
      ok: false,
      reason: 'duplicate_entrant',
    })
    expect(generateCupLeagueSchedule(['a', '  '], 1)).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
    expect(generateCupLeagueSchedule(['a'], 1)).toEqual({
      ok: false,
      reason: 'field_too_small',
    })
  })
})

describe('authority separation', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/domain/season/cupSchedule.ts'), 'utf8')

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('uses no randomness and reads no clock — the draw is the only shape', () => {
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(|Intl\./)
  })
})
