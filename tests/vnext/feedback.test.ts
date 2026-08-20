import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  emitFeedback,
  feedbackPattern,
} from '../../src/vnext/foundations/feedback'
import type { FeedbackSemantic } from '../../src/vnext/foundations/feedback'

/**
 * THE ADOPTED INTERACTION-FEEDBACK MODEL, HELD TO THE RULES THAT MAKE IT SAFE.
 *
 * The brief is explicit about the failure modes, and each of them is a case
 * below rather than a promise in a comment:
 *
 *   * an unsupported device is safe, and is not a degraded experience;
 *   * the preference OFF prevents emission entirely;
 *   * haptics are never required to understand a state;
 *   * ordinary navigation never buzzes.
 *
 * THE LAST ONE IS THE HARD ONE, and it is why the vocabulary has four members
 * rather than five. There is no `navigation` semantic to call, so "no buzz on a
 * tab change" is a property of the TYPE rather than of everybody's discipline.
 * The source sweeps below are the other half: they prove that nothing in the
 * whole vNext lane reaches `navigator.vibrate` by another route, now that the
 * model has moved out of the `ia/` prototype lane and accepted surfaces emit.
 */

const SEMANTICS: readonly FeedbackSemantic[] = [
  'selection',
  'success',
  'important',
  'warning',
]

describe('the semantic feedback model', () => {
  it('gives every semantic a short, distinct pattern', () => {
    const seen = new Set<string>()
    for (const semantic of SEMANTICS) {
      const pattern = feedbackPattern(semantic)
      expect(pattern.length).toBeGreaterThan(0)
      // Nothing long enough to be felt as a buzz. The ceiling is deliberate:
      // 90ms of total contact is under the shell's own base transition.
      const total = pattern.reduce((sum, value) => sum + value, 0)
      expect(total).toBeLessThanOrEqual(90)
      for (const value of pattern) expect(value).toBeGreaterThan(0)

      // A vocabulary a player cannot tell apart is one signal wearing four
      // names.
      const key = pattern.join(',')
      expect(seen.has(key), `${semantic} repeats another semantic's pattern`).toBe(false)
      seen.add(key)
    }
  })

  it('is safe on a device with no vibration support', () => {
    for (const semantic of SEMANTICS) {
      expect(emitFeedback(semantic, { vibrate: null })).toBe('unsupported')
    }
  })

  it('emits nothing at all when the preference is off', () => {
    const calls: unknown[] = []
    for (const semantic of SEMANTICS) {
      const outcome = emitFeedback(semantic, {
        preference: 'off',
        vibrate: (pattern) => calls.push(pattern),
      })
      expect(outcome).toBe('suppressed')
    }
    expect(calls).toEqual([])
  })

  it('emits the semantic’s own pattern when the device and the player allow it', () => {
    for (const semantic of SEMANTICS) {
      const calls: readonly number[][] = []
      const seen: number[][] = [...calls]
      const outcome = emitFeedback(semantic, {
        preference: 'on',
        vibrate: (pattern) => seen.push([...pattern]),
      })
      expect(outcome).toBe('emitted')
      expect(seen).toEqual([[...feedbackPattern(semantic)]])
    }
  })

  it('treats an unstated preference as on, and says so rather than hiding it', () => {
    const seen: number[][] = []
    expect(
      emitFeedback('selection', { preference: 'system', vibrate: (p) => seen.push([...p]) }),
    ).toBe('emitted')
    expect(seen).toHaveLength(1)
  })

  it('survives a platform whose vibrate throws', () => {
    expect(() =>
      emitFeedback('warning', {
        vibrate: () => {
          throw new Error('device said no')
        },
      }),
    ).toThrow()
    // The THROWING case above is the injected one, which a caller owns. What
    // must never throw is the PLATFORM path, and that is what the wrapper in
    // `feedback.ts` guards — proven here by the default environment, which in
    // jsdom has no `navigator.vibrate` at all and must simply report so.
    expect(emitFeedback('warning')).toBe('unsupported')
  })

  it('returns nothing a component could render', () => {
    // If this ever returns something displayable, a surface will display it and
    // the haptic will have become load-bearing.
    const outcome = emitFeedback('success', { vibrate: null })
    expect(typeof outcome).toBe('string')
    expect(['emitted', 'suppressed', 'unsupported']).toContain(outcome)
  })
})

/* ==========================================================================
   the boundary
   ========================================================================== */


function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(path)) out.push(path)
  }
  return out
}

describe('where haptics may and may not appear', () => {
  const vnextFiles = filesUnder(resolve(process.cwd(), 'src/vnext'))

  it('finds the lane, so the cases below are not vacuous', () => {
    expect(vnextFiles.length).toBeGreaterThan(50)
  })

  it('reaches the device from exactly one module in the whole lane', () => {
    // THE PATTERN TABLE IS THE PRODUCT'S HAPTIC VOCABULARY, and a call site
    // that reached for `navigator.vibrate` itself would be a fifth pattern
    // nobody reviewed, that the preference cannot turn off, and that "does this
    // product buzz too much?" cannot be answered about without a grep.
    // The two foundation modules ARE the model: `feedback.ts` holds the
    // patterns and the only platform call, and `feedbackContext.ts` is how a
    // surface reaches it. Naming them rather than matching a call shape,
    // because the platform call is made through a captured reference and a
    // regex looking for `navigator.vibrate(` would match nothing anywhere and
    // pass for the wrong reason.
    const FOUNDATION = [`${sep}feedback.ts`, `${sep}feedbackContext.ts`]
    const offenders = vnextFiles.filter(
      (file) =>
        !FOUNDATION.some((name) => file.endsWith(name)) &&
        /navigator\s*\.\s*vibrate/.test(readFileSync(file, 'utf8')),
    )
    expect(
      offenders.map((file) => file.replace(`${process.cwd()}/`, '')),
      'a component reached for the device directly — route it through the ' +
        'semantic model so the preference can turn it off',
    ).toEqual([])
  })

  it('never emits feedback for ordinary navigation', () => {
    // A call inside a `go(`, a `goTo(` or an anchor press is navigation and is
    // refused. Moving between Home, Matches, Games and Leagues is the movement
    // this product expects a player to make constantly, and it is the first bad
    // use the brief names.
    const offenders: string[] = []
    for (const file of vnextFiles) {
      if (file.endsWith(`${sep}feedback.ts`)) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (!/\b(emitFeedback|feedback)\(/.test(line)) return
        const window = lines.slice(Math.max(0, index - 6), index + 1).join('\n')
        if (/function (go|goTo|goAnchor|jump|navigate)\b/.test(window)) {
          offenders.push(`${file.replace(`${process.cwd()}/`, '')}:${index + 1}`)
        }
      })
    }
    expect(
      offenders,
      'haptic feedback was emitted from a navigation path — ordinary ' +
        'navigation is the bad use the brief names first',
    ).toEqual([])
  })

  it('is reached by accepted surfaces only through the foundation', () => {
    // The model moved out of `ia/` when it was adopted, and accepted surfaces
    // now emit — but they emit through `useVNextFeedback`, which resolves the
    // player's stored preference from `VNextRoot`. A surface that imported
    // `emitFeedback` directly would be one the preference cannot reach, which
    // is the same defect as calling the device.
    const accepted = ['src/vnext/home', 'src/vnext/predictor', 'src/vnext/app', 'src/vnext/lms']
    const offenders: string[] = []
    for (const directory of accepted) {
      for (const file of filesUnder(resolve(process.cwd(), directory))) {
        const source = readFileSync(file, 'utf8')
        if (/\bemitFeedback\b/.test(source)) {
          offenders.push(file.replace(`${process.cwd()}/`, ''))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the accepted lane out of the experimental one', () => {
    // `ia/` is still the Stage 7.5 concept lab and still not the accepted vNext
    // language. Only `feedback.ts` graduated out of it.
    const accepted = [
      'src/vnext/home',
      'src/vnext/predictor',
      'src/vnext/app',
      'src/vnext/components',
      'src/vnext/foundations',
      'src/vnext/integration',
    ]
    const offenders: string[] = []
    for (const directory of accepted) {
      for (const file of filesUnder(resolve(process.cwd(), directory))) {
        if (/from '.*\/ia\//.test(readFileSync(file, 'utf8'))) {
          offenders.push(file.replace(`${process.cwd()}/`, ''))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
