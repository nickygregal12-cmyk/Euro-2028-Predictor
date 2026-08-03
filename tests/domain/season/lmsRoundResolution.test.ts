import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  concludeLmsRound,
  resolveLmsPick,
  resolveLmsSeasonExhaustion,
  type LmsPickInput,
  type LmsRoundEntrant,
} from '../../../src/domain/season/lmsRoundResolution'

/**
 * ADR 0013 season LMS survival: win to survive, Saves convert draws only,
 * lives absorb eliminations, postponement survives without winning, and the
 * zero-survivor branches are first-class — mass elimination is more likely
 * than independence suggests.
 */

function pick(overrides: Partial<LmsPickInput> = {}): LmsPickInput {
  return {
    outcome: 'won',
    drawsRule: 'eliminate',
    livesRemaining: 0,
    savesRemaining: 0,
    ...overrides,
  }
}

describe('pick resolution', () => {
  it('wins survive without consuming anything', () => {
    expect(resolveLmsPick(pick({ livesRemaining: 2, savesRemaining: 1 }))).toEqual({
      alive: true,
      via: 'win',
      livesRemaining: 2,
      savesRemaining: 1,
    })
  })

  it('a postponed fixture survives the player — and consumes nothing here either', () => {
    expect(resolveLmsPick(pick({ outcome: 'postponed', livesRemaining: 1 }))).toEqual({
      alive: true,
      via: 'postponement',
      livesRemaining: 1,
      savesRemaining: 0,
    })
  })

  it('a draw eliminates or survives per the immutable draws rule', () => {
    expect(resolveLmsPick(pick({ outcome: 'drew' }))).toEqual({
      alive: false,
      livesRemaining: 0,
      savesRemaining: 0,
    })
    expect(resolveLmsPick(pick({ outcome: 'drew', drawsRule: 'survive' }))).toEqual({
      alive: true,
      via: 'draw_survives',
      livesRemaining: 0,
      savesRemaining: 0,
    })
  })

  it('a Save converts a drawn fixture into survival, before any life', () => {
    expect(resolveLmsPick(pick({ outcome: 'drew', savesRemaining: 2, livesRemaining: 3 }))).toEqual({
      alive: true,
      via: 'save',
      livesRemaining: 3,
      savesRemaining: 1,
    })
  })

  it('a Save never rescues a defeat', () => {
    expect(resolveLmsPick(pick({ outcome: 'lost', savesRemaining: 2 }))).toEqual({
      alive: false,
      livesRemaining: 0,
      savesRemaining: 2,
    })
  })

  it('a life absorbs an elimination nothing else prevented', () => {
    expect(resolveLmsPick(pick({ outcome: 'lost', livesRemaining: 1 }))).toEqual({
      alive: true,
      via: 'life',
      livesRemaining: 0,
      savesRemaining: 0,
    })
    expect(resolveLmsPick(pick({ outcome: 'drew', livesRemaining: 1 }))).toEqual({
      alive: true,
      via: 'life',
      livesRemaining: 0,
      savesRemaining: 0,
    })
  })

  it('refuses malformed counters', () => {
    expect(resolveLmsPick(pick({ livesRemaining: -1 }))).toEqual({ refused: 'invalid_input' })
    expect(resolveLmsPick(pick({ savesRemaining: 0.5 }))).toEqual({ refused: 'invalid_input' })
  })
})

function entrant(entryId: string, alive: boolean, viaPostponement = false): LmsRoundEntrant {
  return { entryId, alive, viaPostponement }
}

const PRIVATE_PLAY_ON = { scope: 'private', onWipeout: 'play_on' } as const
const PUBLIC = { scope: 'public' } as const

describe('round conclusion', () => {
  it('continues with more than one survivor', () => {
    expect(
      concludeLmsRound([entrant('a', true), entrant('b', true), entrant('c', false)], PUBLIC),
    ).toEqual({ kind: 'continues' })
  })

  it('names a sole survivor the winner when their fixture played', () => {
    expect(concludeLmsRound([entrant('a', true), entrant('b', false)], PUBLIC)).toEqual({
      kind: 'winner',
      entryId: 'a',
    })
  })

  it('a postponement cannot win — eliminations stand but the competition continues', () => {
    expect(
      concludeLmsRound([entrant('a', true, true), entrant('b', false)], PRIVATE_PLAY_ON),
    ).toEqual({ kind: 'continues_postponement_cannot_win', soleSurvivorEntryId: 'a' })
  })
})

describe('wipeout rounds — zero survivors', () => {
  const wiped = [entrant('a', false), entrant('b', false), entrant('c', false)]

  it('private play on eliminates nobody', () => {
    expect(concludeLmsRound(wiped, PRIVATE_PLAY_ON)).toEqual({ kind: 'wipeout_play_on' })
  })

  it('private shared win names everyone alive at round start', () => {
    expect(concludeLmsRound(wiped, { scope: 'private', onWipeout: 'shared_win' })).toEqual({
      kind: 'shared_win',
      entryIds: ['a', 'b', 'c'],
    })
  })

  it('private reset ends with no winner', () => {
    expect(concludeLmsRound(wiped, { scope: 'private', onWipeout: 'reset' })).toEqual({
      kind: 'reset_no_winner',
    })
  })

  it('public names joint winners at the cap or below', () => {
    expect(concludeLmsRound(wiped, PUBLIC)).toEqual({
      kind: 'shared_win',
      entryIds: ['a', 'b', 'c'],
    })
  })

  it('public above the cap has no winner and restarts everyone — the mass-elimination branch', () => {
    const mass = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => entrant(id, false))
    expect(concludeLmsRound(mass, PUBLIC)).toEqual({ kind: 'restart_all_reentered' })
  })

  it('refuses duplicate or blank entrants and an empty round', () => {
    expect(concludeLmsRound([entrant('a', true), entrant('a', false)], PUBLIC)).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
    expect(concludeLmsRound([entrant('  ', true)], PUBLIC)).toEqual({
      kind: 'refused',
      reason: 'invalid_input',
    })
    expect(concludeLmsRound([], PUBLIC)).toEqual({ kind: 'refused', reason: 'invalid_input' })
  })
})

describe('season exhaustion backstop', () => {
  it('shares the win under play on with more than one alive', () => {
    expect(resolveLmsSeasonExhaustion(['b', 'a'], PRIVATE_PLAY_ON)).toEqual({
      kind: 'shared_win',
      entryIds: ['a', 'b'],
    })
  })

  it('records no authority for any other configuration — null, never a guess', () => {
    expect(resolveLmsSeasonExhaustion(['a', 'b'], PUBLIC)).toBeNull()
    expect(
      resolveLmsSeasonExhaustion(['a', 'b'], { scope: 'private', onWipeout: 'shared_win' }),
    ).toBeNull()
    expect(resolveLmsSeasonExhaustion(['a'], PRIVATE_PLAY_ON)).toBeNull()
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/lmsRoundResolution.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation or its LMS helper', () => {
    expect(source).not.toMatch(/from '.*tournament/)
    expect(source).not.toMatch(/from '.*competitions\/lmsSelection/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })

  it('never calls the draw token a joker', () => {
    expect(source.toLowerCase()).not.toContain('joker')
  })
})
