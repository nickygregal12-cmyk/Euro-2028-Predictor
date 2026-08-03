import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateCupLeagueSchedule } from '../../src/domain/season/cupSchedule'

/**
 * The season Cup's league-phase schedule, in both languages.
 *
 * ADR 0014 requires the fixture list to be generated at entry close and to be
 * DETERMINISTIC from the audited draw, so anyone can reproduce it from the
 * audit record. The TypeScript authority is executed here; the SQL is read, and
 * proven against a real database in `130_cup_league_schedule.sql`.
 *
 * NOT A GENERALISATION OF THE TOURNAMENT SCHEDULE. The tournament Cup writes
 * hardcoded `values` tuples for groups of exactly three and four. I expected
 * the circle method to reproduce them and checked before claiming it: both give
 * a valid round robin over the same pairings, but assign those pairings to
 * different rounds — for four entrants the circle method's round 1 is the
 * tournament's round 3. So the tournament tables stay exactly as they are, and
 * the guard below pins that they were not replaced.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const schedule = /cup_league_schedule\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''

const draw = (size: number): string[] => Array.from({ length: size }, (_, i) => `p${i + 1}`)

describe('the SQL counterpart exists', () => {
  it('finds the body', () => {
    expect(schedule, 'cup_league_schedule body not found').not.toBe('')
  })
})

describe('the schedule is a valid round robin', () => {
  it.each([
    [4, 1],
    [5, 1],
    [8, 2],
    [11, 3],
  ])('field %i over %i meeting(s): every pair meets exactly that many times', (size, meetings) => {
    const result = generateCupLeagueSchedule(draw(size), meetings)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const met = new Map<string, number>()
    for (const round of result.rounds) {
      const playing = new Set<string>()
      for (const tie of round.ties) {
        const key = [tie.home, tie.away].sort().join('|')
        met.set(key, (met.get(key) ?? 0) + 1)
        // Nobody plays twice in one round.
        expect(playing.has(tie.home), `${tie.home} plays twice in round ${round.round}`).toBe(false)
        expect(playing.has(tie.away), `${tie.away} plays twice in round ${round.round}`).toBe(false)
        playing.add(tie.home)
        playing.add(tie.away)
      }
    }

    expect(met.size, 'not every pairing occurred').toBe((size * (size - 1)) / 2)
    for (const [pair, count] of met) {
      expect(count, `${pair} met ${count} times rather than ${meetings}`).toBe(meetings)
    }
  })

  it('rests exactly one entrant per round when the field is odd, and never the same twice early', () => {
    const result = generateCupLeagueSchedule(draw(5), 1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const byes = result.rounds.map((round) => round.bye)
    expect(byes.every((bye) => bye !== null)).toBe(true)
    // Five entrants, five rounds: everyone rests exactly once.
    expect(new Set(byes).size).toBe(5)
  })

  it('gives an even field no bye at all', () => {
    const result = generateCupLeagueSchedule(draw(6), 1)
    expect(result.ok && result.rounds.every((round) => round.bye === null)).toBe(true)
  })
})

describe('a double round robin is an exact mirror', () => {
  it('reverses home and away on the second meeting', () => {
    const single = generateCupLeagueSchedule(draw(4), 1)
    const double = generateCupLeagueSchedule(draw(4), 2)
    expect(single.ok && double.ok).toBe(true)
    if (!single.ok || !double.ok) return

    const roundsPerMeeting = single.rounds.length
    for (let index = 0; index < roundsPerMeeting; index += 1) {
      const first = single.rounds[index].ties
      const second = double.rounds[roundsPerMeeting + index].ties
      expect(second.length).toBe(first.length)
      for (let tie = 0; tie < first.length; tie += 1) {
        // Same pairing, opposite orientation. A repeat rather than a mirror
        // would give one entrant the same home fixture twice.
        expect([second[tie].home, second[tie].away].sort()).toEqual(
          [first[tie].home, first[tie].away].sort(),
        )
        expect(second[tie].home).toBe(first[tie].away)
      }
    }
  })

  it('reverses in SQL by the same meeting parity', () => {
    expect(schedule).toMatch(/v_meeting % 2 = 1/)
    expect(schedule).toMatch(/\(\(v_turn \+ v_pair\) % 2\)/)
  })
})

describe('the SQL keeps the rules the port could lose', () => {
  it('fixes the first drawn entrant and rotates the rest', () => {
    // This is what makes the schedule reproducible from the audited draw.
    expect(schedule).toMatch(/when v_pair = 0 then v_circle\[1\]/)
    expect(schedule).toMatch(/% \(v_size - 1\)\) \+ 2/)
  })

  it('adds a bye slot only for an odd field', () => {
    expect(schedule).toMatch(/v_field % 2 = 0 then p_draw_order else p_draw_order \|\| array\[null::text\]/)
  })

  it('derives the rounds per meeting from the circle, not the field', () => {
    // With a bye the circle is one larger than the field, and using the field
    // here would drop a round for every odd competition.
    expect(schedule).toMatch(/v_rounds_per_meeting := v_size - 1/)
  })
})

describe('refusals match', () => {
  it.each([
    ['a duplicate entrant', ['a', 'a'], 1, 'duplicate_entrant'],
    ['a blank entrant', ['a', '  '], 1, 'invalid_input'],
    ['a field of one', ['a'], 1, 'field_too_small'],
    ['zero meetings', ['a', 'b'], 0, 'invalid_input'],
  ])('%s is refused in TypeScript', (_label, order, meetings, reason) => {
    expect(generateCupLeagueSchedule(order as string[], meetings as number)).toEqual({
      ok: false,
      reason,
    })
  })

  it.each(['duplicate_entrant', 'invalid_input', 'field_too_small'])(
    '%s exists in SQL',
    (reason) => {
      expect(schedule).toContain(reason)
    },
  )

  it('checks the duplicate before the field size, so two of the same name is not "too small"', () => {
    // ['a','a'] has length two. Reordered, it would refuse as field_too_small
    // after deduplication and blame the wrong thing.
    expect(schedule.indexOf('duplicate_entrant')).toBeLessThan(schedule.indexOf('field_too_small'))
  })
})

describe('the tournament schedule is untouched', () => {
  it('leaves the hardcoded three- and four-player tables in place', () => {
    // The circle method is NOT a drop-in for them: it produces the same
    // pairings in a different round order. Replacing them would move published
    // tournament fixtures for no benefit.
    expect(allSql).toMatch(/insert into public\.bonus_cup_fixtures[\s\S]*?values[\s\S]*?'group'/)
    expect(schedule).not.toMatch(/bonus_cup_fixtures/)
  })
})
