import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LMS_MAX_LIVES,
  LMS_MAX_SAVES,
  LMS_PRESETS,
  lmsPreset,
  matchLmsPreset,
  publicLmsSetup,
  validateLmsSetup,
  type LmsSetup,
} from '../../../src/domain/season/lmsPresets'
import { resolveLmsPick } from '../../../src/domain/season/lmsRoundResolution'

/**
 * ADR 0022 preset compositions over ADR 0013's axes: three named presets
 * plus custom, the public competition pinned to Classic under the public
 * endgame, and custom bounded rather than free.
 */

describe('the three named presets (ADR 0022)', () => {
  it('encodes exactly the recorded compositions', () => {
    expect(LMS_PRESETS.map((preset) => [preset.name, preset.lives, preset.saves, preset.drawsRule])).toEqual([
      ['classic', 0, 0, 'eliminate'],
      ['second_chance', 1, 1, 'eliminate'],
      ['relaxed', 2, 2, 'survive'],
    ])
  })

  it('gives Classic nothing softening it and Relaxed the shared win', () => {
    expect(lmsPreset('classic').endgame).toEqual({ scope: 'private', onWipeout: 'play_on' })
    expect(lmsPreset('second_chance').endgame).toEqual({ scope: 'private', onWipeout: 'play_on' })
    expect(lmsPreset('relaxed').endgame).toEqual({ scope: 'private', onWipeout: 'shared_win' })
  })

  it('offers three presets — the tested surface is three plus custom, not seventy-two', () => {
    expect(LMS_PRESETS).toHaveLength(3)
    expect(new Set(LMS_PRESETS.map((preset) => preset.name)).size).toBe(3)
  })

  it('carries a label so the interface never invents wording', () => {
    expect(LMS_PRESETS.map((preset) => preset.label)).toEqual([
      'Classic',
      'Second Chance',
      'Relaxed',
    ])
  })

  it('stays inside the ADR 0013 axis bounds', () => {
    for (const preset of LMS_PRESETS) {
      expect(validateLmsSetup(preset)).toEqual({ valid: true })
      expect(preset.lives).toBeLessThanOrEqual(LMS_MAX_LIVES)
      expect(preset.saves).toBeLessThanOrEqual(LMS_MAX_SAVES)
    }
  })
})

describe('the presets behave differently under the round rules', () => {
  it('a drawn pick eliminates under Classic, spends a Save under Second Chance, survives under Relaxed', () => {
    const drew = { outcome: 'drew' } as const

    const classic = lmsPreset('classic')
    expect(
      resolveLmsPick({ ...drew, drawsRule: classic.drawsRule, livesRemaining: classic.lives, savesRemaining: classic.saves }),
    ).toEqual({ alive: false, livesRemaining: 0, savesRemaining: 0 })

    const second = lmsPreset('second_chance')
    expect(
      resolveLmsPick({ ...drew, drawsRule: second.drawsRule, livesRemaining: second.lives, savesRemaining: second.saves }),
    ).toMatchObject({ alive: true, via: 'save' })

    const relaxed = lmsPreset('relaxed')
    expect(
      resolveLmsPick({ ...drew, drawsRule: relaxed.drawsRule, livesRemaining: relaxed.lives, savesRemaining: relaxed.saves }),
    ).toMatchObject({ alive: true, via: 'draw_survives' })
  })

  it('a defeat ends a Classic entrant immediately but not a Second Chance one', () => {
    const lost = { outcome: 'lost', drawsRule: 'eliminate' } as const
    expect(resolveLmsPick({ ...lost, livesRemaining: 0, savesRemaining: 0 })).toMatchObject({
      alive: false,
    })
    expect(resolveLmsPick({ ...lost, livesRemaining: 1, savesRemaining: 1 })).toMatchObject({
      alive: true,
      via: 'life',
    })
  })
})

describe('the public competition is pinned to Classic', () => {
  it('takes Classic values under the public endgame, not a private wipeout rule', () => {
    expect(publicLmsSetup()).toEqual({
      lives: 0,
      saves: 0,
      drawsRule: 'eliminate',
      endgame: { scope: 'public' },
    })
  })

  it('is a legal setup', () => {
    expect(validateLmsSetup(publicLmsSetup())).toEqual({ valid: true })
  })
})

describe('custom setups are permitted but bounded', () => {
  function custom(overrides: Partial<LmsSetup> = {}): LmsSetup {
    return {
      lives: 3,
      saves: 2,
      drawsRule: 'survive',
      endgame: { scope: 'private', onWipeout: 'reset' },
      ...overrides,
    }
  }

  it('accepts a legal custom setup at the axis limits', () => {
    expect(validateLmsSetup(custom())).toEqual({ valid: true })
  })

  it('refuses values beyond the recorded bounds — that is an unreviewed rule, not a variant', () => {
    expect(validateLmsSetup(custom({ lives: 4 }))).toEqual({
      valid: false,
      reason: 'lives_out_of_range',
    })
    expect(validateLmsSetup(custom({ saves: 3 }))).toEqual({
      valid: false,
      reason: 'saves_out_of_range',
    })
    expect(validateLmsSetup(custom({ lives: -1 }))).toEqual({
      valid: false,
      reason: 'lives_out_of_range',
    })
    expect(validateLmsSetup(custom({ saves: 1.5 }))).toEqual({
      valid: false,
      reason: 'saves_out_of_range',
    })
  })

  it('refuses malformed draws rules and endgames', () => {
    expect(
      validateLmsSetup(custom({ drawsRule: 'sometimes' as unknown as LmsSetup['drawsRule'] })),
    ).toEqual({ valid: false, reason: 'invalid_draws_rule' })
    expect(
      validateLmsSetup(
        custom({
          endgame: { scope: 'private', onWipeout: 'carry_on' } as unknown as LmsSetup['endgame'],
        }),
      ),
    ).toEqual({ valid: false, reason: 'invalid_endgame' })
  })
})

describe('naming a setup', () => {
  it('recognises each preset', () => {
    expect(matchLmsPreset(lmsPreset('classic'))).toBe('classic')
    expect(matchLmsPreset(lmsPreset('second_chance'))).toBe('second_chance')
    expect(matchLmsPreset(lmsPreset('relaxed'))).toBe('relaxed')
  })

  it('returns null for a genuinely custom setup', () => {
    expect(
      matchLmsPreset({
        lives: 3,
        saves: 0,
        drawsRule: 'eliminate',
        endgame: { scope: 'private', onWipeout: 'reset' },
      }),
    ).toBeNull()
  })

  it('does not call the public setup Classic — the endgame differs', () => {
    expect(matchLmsPreset(publicLmsSetup())).toBeNull()
  })
})

describe('authority separation', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/domain/season/lmsPresets.ts'), 'utf8')

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
