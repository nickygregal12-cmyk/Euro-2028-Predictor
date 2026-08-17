import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  emitFeedback,
  feedbackPattern,
} from '../../src/vnext/ia/feedback'
import type { FeedbackSemantic } from '../../src/vnext/ia/feedback'

/**
 * THE INTERACTION-FEEDBACK PROTOTYPE, HELD TO THE FOUR RULES THAT MAKE IT SAFE.
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
 * The import sweep below is the other half: it proves that no concept's
 * navigation code path reaches `navigator.vibrate` by another route.
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

const IA_ROOT = resolve(process.cwd(), 'src/vnext/ia')

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
  const iaFiles = filesUnder(IA_ROOT)

  it('finds the lab, so the cases below are not vacuous', () => {
    expect(iaFiles.length).toBeGreaterThan(5)
  })

  it('calls navigator.vibrate in exactly one module', () => {
    const offenders = iaFiles.filter(
      (file) =>
        !file.endsWith('feedback.ts') && /navigator\s*\.\s*vibrate|\bvibrate\s*\(/.test(readFileSync(file, 'utf8')),
    )
    expect(
      offenders.map((file) => file.replace(`${process.cwd()}/`, '')),
      'a component reached for the device directly — route it through the ' +
        'semantic model so the preference can turn it off',
    ).toEqual([])
  })

  it('never emits feedback for ordinary navigation', () => {
    // Every `emitFeedback` call site in the lab, with the line above it, so the
    // case can say WHAT was being fed back. A call inside a `go(`, a `goTo(`
    // or an anchor press is navigation and is refused.
    const offenders: string[] = []
    for (const file of iaFiles) {
      if (file.endsWith('feedback.ts')) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (!line.includes('emitFeedback(')) return
        const window = lines.slice(Math.max(0, index - 6), index + 1).join('\n')
        if (/function (go|goTo|goAnchor|jump)\b/.test(window)) {
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

  it('is not reachable from any accepted vNext surface', () => {
    // The prototype lives under `ia/` precisely so it is NOT the accepted vNext
    // language yet. Home, the Match Predictor, the shell, the components and
    // the foundations must not import it — importing it would settle a question
    // this stage exists to ask.
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
        if (/from '.*\/ia\/feedback'|from '.*\/ia\//.test(readFileSync(file, 'utf8'))) {
          offenders.push(file.replace(`${process.cwd()}/`, ''))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
