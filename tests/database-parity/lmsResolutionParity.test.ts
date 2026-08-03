import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveLmsPick,
  type LmsDrawsRule,
  type LmsFixtureOutcome,
} from '../../src/domain/season/lmsRoundResolution'

/**
 * ADR 0013 governs Last Man Standing, and ADR 0012's parity requirement
 * applies to it as much as to scoring — LMS decides who is still in, which is
 * a harder thing to correct after the fact than a points total.
 *
 * The property this exists to protect is the asymmetry between the currencies:
 *
 *     a Save rescues a DRAW.      A Save never rescues a DEFEAT.
 *     a Life rescues either.
 *
 * Spend a Save on a defeat and the entrant survives a round they should have
 * left, with a decremented counter and entirely plausible-looking state. The
 * only thing that catches it is losing while holding Saves.
 *
 * The TypeScript authority is executed here; the SQL is read. Its behaviour is
 * proven against a real database in `123_lms_pick_resolution.sql`.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const resolution = /resolve_lms_pick\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''

describe('the SQL counterpart exists', () => {
  it('finds the resolution body', () => {
    expect(resolution, 'resolve_lms_pick body not found').not.toBe('')
  })
})

describe('a Save rescues a draw but never a defeat', () => {
  it('spends a Save on a draw', () => {
    expect(
      resolveLmsPick({
        outcome: 'drew',
        drawsRule: 'eliminate',
        livesRemaining: 1,
        savesRemaining: 1,
      }),
    ).toEqual({ alive: true, via: 'save', livesRemaining: 1, savesRemaining: 0 })
  })

  it('spends a Life, not a Save, on a defeat', () => {
    // The Save is untouched. If SQL consulted Saves here, an entrant would
    // survive a defeat and the counters would still look sane.
    expect(
      resolveLmsPick({
        outcome: 'lost',
        drawsRule: 'eliminate',
        livesRemaining: 1,
        savesRemaining: 1,
      }),
    ).toEqual({ alive: true, via: 'life', livesRemaining: 0, savesRemaining: 1 })
  })

  it('eliminates on a defeat with Saves but no Lives', () => {
    // The case that exposes a Save wrongly rescuing a defeat.
    expect(
      resolveLmsPick({
        outcome: 'lost',
        drawsRule: 'eliminate',
        livesRemaining: 0,
        savesRemaining: 2,
      }),
    ).toEqual({ alive: false, livesRemaining: 0, savesRemaining: 2 })
  })

  it('never consults Saves in the SQL defeat branch', () => {
    const defeat = resolution.slice(resolution.indexOf("p_outcome = 'lost'"))
    const defeatBranch = defeat.slice(0, defeat.indexOf('else jsonb_build_object'))

    expect(defeatBranch).toContain('p_lives_remaining > 0')
    expect(
      defeatBranch,
      'the defeat branch tests Saves, so a Save would rescue a defeat',
    ).not.toMatch(/p_saves_remaining\s*>\s*0/)
  })
})

describe('a draw spends the Save before the Life', () => {
  it('keeps the Life back in TypeScript', () => {
    const resolved = resolveLmsPick({
      outcome: 'drew',
      drawsRule: 'eliminate',
      livesRemaining: 2,
      savesRemaining: 2,
    })
    expect(resolved).toMatchObject({ via: 'save', livesRemaining: 2, savesRemaining: 1 })
  })

  it('orders the SQL branches the same way', () => {
    // Reversed, an entrant would burn the currency that also covers defeats
    // while holding one that does not.
    const saveBranch = resolution.indexOf("p_outcome = 'drew' and p_saves_remaining > 0")
    const lifeBranch = resolution.indexOf("p_outcome = 'drew' and p_lives_remaining > 0")

    expect(saveBranch).toBeGreaterThan(-1)
    expect(lifeBranch).toBeGreaterThan(saveBranch)
  })
})

describe('outcomes that cost nothing', () => {
  it.each([
    ['won', 'win'],
    ['postponed', 'postponement'],
  ])('%s survives without spending', (outcome, via) => {
    expect(
      resolveLmsPick({
        outcome: outcome as LmsFixtureOutcome,
        drawsRule: 'eliminate',
        livesRemaining: 1,
        savesRemaining: 1,
      }),
    ).toEqual({ alive: true, via, livesRemaining: 1, savesRemaining: 1 })
    expect(resolution).toContain(`'${via}'`)
  })

  it('survives a draw untouched when draws do not eliminate', () => {
    expect(
      resolveLmsPick({
        outcome: 'drew',
        drawsRule: 'survive' as LmsDrawsRule,
        livesRemaining: 0,
        savesRemaining: 0,
      }),
    ).toEqual({ alive: true, via: 'draw_survives', livesRemaining: 0, savesRemaining: 0 })
    expect(resolution).toContain('draw_survives')
  })
})

describe('invalid input is refused, not survived', () => {
  it.each([
    [-1, 0],
    [0, -1],
    [1.5, 0],
  ])('lives %s saves %s is refused in TypeScript', (lives, saves) => {
    expect(
      resolveLmsPick({
        outcome: 'lost',
        drawsRule: 'eliminate',
        livesRemaining: lives,
        savesRemaining: saves,
      }),
    ).toEqual({ refused: 'invalid_input' })
  })

  it('refuses the same shapes in SQL, and refuses before deciding', () => {
    expect(resolution).toContain("'refused', 'invalid_input'")
    const refusal = resolution.indexOf('invalid_input')
    const firstDecision = resolution.indexOf("p_outcome = 'won'")

    expect(
      refusal,
      'a decision precedes the refusal, so invalid counters could produce a survival',
      ).toBeLessThan(firstDecision)
  })
})

describe('the resolution stays server-side and pure', () => {
  it('is immutable and revoked from every browser role', () => {
    expect(allSql).toMatch(/resolve_lms_pick[\s\S]*?immutable/)
    expect(allSql).toMatch(
      /revoke all on function predictor_internal\.resolve_lms_pick[\s\S]*?from public, anon, authenticated/,
    )
  })

  it('awards no points, because LMS eliminates rather than scores', () => {
    expect(resolution).not.toMatch(/\bpoints\b/i)
  })
})
