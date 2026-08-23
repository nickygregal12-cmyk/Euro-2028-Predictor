import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Variant, Variants } from 'framer-motion'
import {
  vnextMotion,
  vnextTransition,
} from '../../src/vnext/foundations/motion'

/**
 * THE MOTION CONTRACT, NOT FRAMER'S INTERNALS.
 *
 * The existing reduced-motion test proves the reduced path renders the same
 * CONTENT, which is worth holding and is not the promise the foundation makes.
 * The promise is about MOVEMENT: under the preference, a primitive stops
 * travelling, stops scaling and stops looping, and still says what state the
 * thing is in. Content equivalence is true of a preset whose "reduced" variant
 * is a verbatim copy of its full one, so it cannot catch the failure it looks
 * like it is catching.
 *
 * These assertions read the resolved variants — the objects `useVNextMotion`
 * hands a component — and say nothing about how Framer applies them. What is
 * tested is the shape this repository designed.
 */

const TRAVEL_KEYS = ['x', 'y', 'z', 'rotate', 'rotateX', 'rotateY'] as const
const SCALE_KEYS = ['scale', 'scaleX', 'scaleY'] as const

type VariantValues = Record<string, unknown>

function variantValues(variant: Variant | undefined): VariantValues {
  // A variant may be a function of custom data; none of ours is, and a preset
  // that became one would need designing rather than silently passing here.
  expect(typeof variant, 'a vNext variant must be a plain object').not.toBe(
    'function',
  )
  return (variant ?? {}) as VariantValues
}

function statesOf(variants: Variants): string[] {
  return Object.keys(variants)
}

const presets = Object.entries(vnextMotion)

describe('vNext reduced motion removes movement', () => {
  it('has a reduced pair for every primitive, with the same states', () => {
    expect(presets.length).toBe(11)

    for (const [name, preset] of presets) {
      expect(statesOf(preset.reduced).sort(), name).toEqual(
        statesOf(preset.full).sort(),
      )
    }
  })

  it('leaves no travel in any reduced variant', () => {
    const offenders: string[] = []

    for (const [name, preset] of presets) {
      for (const [state, variant] of Object.entries(preset.reduced)) {
        const values = variantValues(variant)
        for (const key of TRAVEL_KEYS) {
          if (!(key in values)) continue
          const value = values[key]
          // 0 is "already where it belongs". Anything else, including a
          // keyframe array that starts elsewhere and lands at 0, is travel.
          if (value !== 0) {
            offenders.push(`${name}.${state}.${key} = ${JSON.stringify(value)}`)
          }
        }
      }
    }

    expect(offenders, `reduced variants still travelling:\n${offenders.join('\n')}`).toEqual(
      [],
    )
  })

  it('leaves no scale change in any reduced variant', () => {
    const offenders: string[] = []

    for (const [name, preset] of presets) {
      for (const [state, variant] of Object.entries(preset.reduced)) {
        const values = variantValues(variant)
        for (const key of SCALE_KEYS) {
          if (!(key in values)) continue
          if (values[key] !== 1) {
            offenders.push(
              `${name}.${state}.${key} = ${JSON.stringify(values[key])}`,
            )
          }
        }
      }
    }

    expect(offenders, `reduced variants still scaling:\n${offenders.join('\n')}`).toEqual([])
  })

  it('leaves no loop and no keyframe sequence in any reduced variant', () => {
    const offenders: string[] = []

    for (const [name, preset] of presets) {
      for (const [state, variant] of Object.entries(preset.reduced)) {
        const values = variantValues(variant)
        const transition = values.transition as
          | Record<string, unknown>
          | undefined

        if (transition && 'repeat' in transition && transition.repeat !== 0) {
          offenders.push(`${name}.${state} repeats ${String(transition.repeat)}`)
        }
        if (transition && 'staggerChildren' in transition) {
          if (transition.staggerChildren !== 0) {
            offenders.push(
              `${name}.${state} still staggers by ${String(transition.staggerChildren)}`,
            )
          }
        }

        for (const [key, value] of Object.entries(values)) {
          if (key === 'transition') continue
          if (Array.isArray(value)) {
            // A keyframe array is a journey by definition — livePulse's
            // `[1, 0.45, 1]` is the breath the preference asks to stop.
            offenders.push(`${name}.${state}.${key} is a keyframe sequence`)
          }
        }
      }
    }

    expect(offenders, `reduced variants still animating:\n${offenders.join('\n')}`).toEqual(
      [],
    )
  })

  it('still says what state the thing is in', () => {
    // The reduced path is not "no feedback". Every state that ends visible on
    // the full path ends visible on the reduced one, so a live mark, a rank
    // arrow and a navigation marker are all still there — they just arrive
    // rather than travel.
    for (const [name, preset] of presets) {
      for (const [state, variant] of Object.entries(preset.full)) {
        const full = variantValues(variant)
        if (!('opacity' in full)) continue

        const fullOpacity = Array.isArray(full.opacity)
          ? (full.opacity as unknown[]).at(-1)
          : full.opacity
        const reduced = variantValues(preset.reduced[state])
        const reducedOpacity = Array.isArray(reduced.opacity)
          ? (reduced.opacity as unknown[]).at(-1)
          : reduced.opacity

        expect(reducedOpacity, `${name}.${state} opacity`).toBe(fullOpacity)
      }
    }
  })

  it('removes the navigation marker’s travel rather than slowing it', () => {
    // The marker's journey is a layout animation, so it lives in a transition
    // rather than in a variant. Reduced motion has to remove it there too —
    // a shorter journey is still a journey.
    expect(vnextTransition.navIndicator.full).toEqual(
      expect.objectContaining({ type: 'spring' }),
    )
    expect(vnextTransition.navIndicator.reduced).toEqual({ duration: 0 })
  })
})

/**
 * COMPONENTS CONSUME RESOLVED MOTION.
 *
 * `VNextNav` imported `vnextSpring` and applied it directly, which is how a
 * component ends up with one animation the preference cannot reach: the pair
 * exists, the resolver exists, and the component quietly uses neither. The
 * guard is on the import rather than on the rendered output because that is
 * where the decision is made.
 */
describe('vNext components resolve their motion through the foundation', () => {
  const vnextRoot = resolve(import.meta.dirname, '../../src/vnext')

  /**
   * EVERY TREE UNDER `src/vnext/`, AND IT USED TO BE TWO.
   *
   * The guard was written for `components/` and `home/` when those were the
   * only animated surfaces, and it stayed that way while thirteen more shipped.
   * The 20 August 2026 motion-consistency audit read all of them and found the
   * rule already held everywhere — no accepted surface names a raw motion value
   * and none builds a variant object inline — so widening the guard costs
   * nothing today and is the only way that stays true tomorrow. A rule proved
   * by an audit and enforced over a fifth of the code is a rule that will be
   * broken by the next surface nobody thought to audit.
   *
   * `models/` and `states/` carry no JSX and simply contribute no files.
   */
  const roots = readdirSync(vnextRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(vnextRoot, entry.name))

  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return sources(path)
      return entry.name.endsWith('.tsx') ? [path] : []
    })
  }

  const files = roots.flatMap(sources)
  const componentsRoot = vnextRoot

  /** Raw, unresolved motion values. A component naming one has bypassed the pair. */
  const RAW_MOTION = /\b(vnextSpring|vnextEase|vnextDuration)\b/

  it('reads the whole of vNext at all', () => {
    // Well under the real count, so an accidental narrowing of the walk is
    // caught while an ordinary new component is not a reason to edit this.
    expect(files.length).toBeGreaterThan(90)
  })

  it('imports no raw full-motion value into a component', () => {
    const offenders = files.filter((file) => RAW_MOTION.test(readFileSync(file, 'utf8')))

    expect(
      offenders.map((file) => relative(componentsRoot, file)),
      'components must take motion from useVNextMotion/useVNextTransition, ' +
        'so the reduced pair cannot be bypassed',
    ).toEqual([])
  })

  it('reaches into no preset’s full or reduced half directly', () => {
    const offenders = files.filter((file) =>
      /vnextMotion\.\w+\.(full|reduced)/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders.map((file) => relative(componentsRoot, file))).toEqual([])
  })

  /**
   * AND IT BUILDS NO VARIANT WHERE IT STANDS.
   *
   * `animate={{ opacity: 1 }}` is not caught by either rule above: it names no
   * foundation value and reaches into no preset, and it is still one animation
   * the player's preference cannot reach. It is also the easiest thing in the
   * world to write while adding a surface at speed, which is why the audit that
   * found none of them left this behind rather than a sentence saying so.
   */
  const INLINE_MOTION =
    /\b(initial|animate|exit|whileHover|whileTap|whileFocus|whileInView|transition|variants)=\{\{/

  it('builds no motion object inline', () => {
    const offenders = files.filter((file) => INLINE_MOTION.test(readFileSync(file, 'utf8')))

    expect(
      offenders.map((file) => relative(componentsRoot, file)),
      'motion belongs to a preset in foundations/motion.ts, which is the only ' +
        'place a reduced-motion pair can be written for it',
    ).toEqual([])
  })
})

/**
 * A non-interactive card does not press.
 *
 * Framer's gesture props leave no trace in the DOM, so there is nothing to
 * assert on a rendered card — the decision is only visible where it is written.
 */
describe('MatchCard press feedback', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/vnext/components/football/MatchCard.tsx'),
    'utf8',
  )

  // Sliced by position rather than by a regex for the opening tag: the props
  // contain `onClick={() => …}`, and the first `>` in the element is that
  // arrow, not the end of the tag.
  const articleAt = source.indexOf('<motion.article')
  const buttonAt = source.indexOf('<motion.button')

  it('reads both elements at all', () => {
    expect(articleAt, 'the card is still a motion.article').toBeGreaterThan(-1)
    expect(buttonAt, 'the action is still a motion.button').toBeGreaterThan(
      articleAt,
    )
  })

  it('presses in exactly one place, and it is the button', () => {
    expect(source.match(/whileTap/g) ?? [], 'one press, one control').toHaveLength(1)
    expect(
      source.indexOf('whileTap'),
      'the press must sit on the button, not on the article',
    ).toBeGreaterThan(buttonAt)
    expect(source.slice(buttonAt)).toContain('whileTap="tap"')
  })

  it('hovers the card only where the card offers an action', () => {
    // Hover depth on a card with nothing to do is the same false promise in a
    // quieter form.
    expect(source.slice(articleAt, buttonAt)).toContain(
      "{...(action ? { whileHover: 'hover' } : {})}",
    )
  })
})

/**
 * THE WORKSHOP MUST SHOW THE WHOLE VOCABULARY.
 *
 * The motion gallery is where a reviewer sees what this product's movement IS,
 * and it had already drifted: `saveSettle` was added to the foundation and the
 * gallery went on showing nine primitives as though it were all of them. A
 * gallery that is silently a subset is worse than no gallery, because it
 * licenses "there is no preset for that" from somebody who looked.
 */
describe('the motion gallery', () => {
  const gallery = readFileSync(
    resolve(__dirname, '../../src/vnext/stories/Foundation.stories.tsx'),
    'utf8',
  )

  it.each(Object.keys(vnextMotion))('shows %s', (name) => {
    expect(gallery).toContain(`vnextMotion.${name}`)
    // Named in words as well as consumed, so the sample has a caption rather
    // than being an unlabelled rectangle that moves.
    expect(gallery).toContain(name)
  })
})
