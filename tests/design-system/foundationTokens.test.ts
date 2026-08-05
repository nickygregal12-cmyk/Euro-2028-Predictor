import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The target design foundations, against the contract that specifies them.
 *
 * `docs/design/hub-architecture-and-modernisation-plan.md` §11.1, §11.6 and
 * §11.7 fix the shape of these: twelve neutral steps, three surface levels, a
 * border ramp kept separate from text and accent, six type sizes, three radii,
 * a motion contract in which nothing routine exceeds 300ms, and one declared
 * stacking order. A prose specification and a stylesheet drift the moment one
 * is edited without the other — the design-system document and `tokens.css`
 * did exactly that on 31 July 2026, and the fix then was the same as the fix
 * here: relate them, and make disagreement fail.
 *
 * THE PROPERTY THAT MATTERS MOST is the ramp's monotonicity. A step number is
 * only meaningful if every step is further from the page background than the
 * one before it — that is what lets a component say "step 9" and get a
 * sensible value in a theme that descends in lightness and one that climbs.
 * A ramp with two steps out of order still looks like a ramp in a swatch grid
 * and silently gives some component less contrast than its neighbour.
 *
 * The AA floors are asserted rather than pinned. This palette is not on screen
 * yet, so nothing else would catch a step edited below the threshold, and the
 * repository has found the same defect twice already by measurement after the
 * fact — `--tx3` on `--chip` at 4.06:1, and this ramp's own tertiary text step
 * at 4.48:1 on the sunken surface while it was being derived.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const tokensCss = readFileSync(resolve(repositoryRoot, 'src/styles/tokens.css'), 'utf8')

/** Declarations inside one block, resolving `var(--x)` aliases within it. */
function block(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(selector)
  if (start === -1) throw new Error(`tokens.css has no ${selector} block`)
  const body = tokensCss.slice(start, tokensCss.indexOf('}', start))

  const raw: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    raw[name] = value.trim()
  }

  const resolved: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value)
    resolved[name] = alias ? (raw[alias[1]] ?? value) : value
  }
  return resolved
}

const dark = block(':root,')
const light = block('[data-theme="light"] {')
const scale = block(':root {')

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  )
}

function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const THEMES = [
  ['dark', dark],
  ['light', light],
] as const

const STEPS = Array.from({ length: 12 }, (_, index) => `n-${index + 1}`)
const SURFACES = ['surface-page', 'surface-raised', 'surface-sunken'] as const
const TEXT = ['text-1', 'text-2', 'text-3'] as const
const AA_NORMAL_TEXT = 4.5

describe('the target neutral ramp', () => {
  it('declares twelve steps in both themes', () => {
    for (const [name, tokens] of THEMES) {
      for (const step of STEPS) {
        expect(tokens[step], `${name} theme is missing --${step}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })

  it('moves further from the page background at every step', () => {
    // The whole point of a numbered ramp. Without this a step number is
    // decoration, and two adjacent steps can silently swap contrast order.
    for (const [name, tokens] of THEMES) {
      const distances = STEPS.map((step) => contrast(tokens[step], tokens['n-1']))
      for (let index = 1; index < distances.length; index += 1) {
        expect(
          distances[index],
          `${name} --n-${index + 1} is no further from the background than --n-${index}`,
        ).toBeGreaterThan(distances[index - 1])
      }
    }
  })

  it('spans a usable range in both themes', () => {
    for (const [name, tokens] of THEMES) {
      expect(
        contrast(tokens['n-12'], tokens['n-1']),
        `${name} ramp is too shallow to carry primary text`,
      ).toBeGreaterThanOrEqual(15)
    }
  })
})

describe('the target surface, border and text tokens', () => {
  it('keeps every text step above AA on every surface', () => {
    for (const [name, tokens] of THEMES) {
      for (const text of TEXT) {
        for (const surface of SURFACES) {
          expect(
            Number(contrast(tokens[text], tokens[surface]).toFixed(2)),
            `--${text} on --${surface} in the ${name} theme`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
        }
      }
    }
  })

  it('keeps the three surface levels distinguishable from each other', () => {
    // §11.1: dark elevates by surface step rather than shadow, so two surfaces
    // that measure the same are two levels the user cannot tell apart.
    for (const [name, tokens] of THEMES) {
      const values = SURFACES.map((surface) => tokens[surface])
      expect(new Set(values).size, `${name} theme repeats a surface value`).toBe(SURFACES.length)
    }
  })

  it('draws borders from the border ramp rather than text or accent tokens', () => {
    // §11.1: hairlines are structure, never emphasis. Borrowing a text or
    // accent colour for a border is how a hairline becomes emphasis by
    // accident, which is the failure this separation prevents.
    for (const [name, tokens] of THEMES) {
      for (const border of ['border-hairline', 'border-strong'] as const) {
        const forbidden = [...TEXT.map((text) => tokens[text]), tokens.acc, tokens.gold]
        expect(
          forbidden.includes(tokens[border]),
          `${name} --${border} reuses a text or accent value`,
        ).toBe(false)
      }
    }
  })
})

describe('the scale, motion and layering contracts', () => {
  it('declares exactly six type steps, ascending', () => {
    const sizes = [1, 2, 3, 4, 5, 6].map((step) => Number.parseInt(scale[`fs-${step}`], 10))
    expect(sizes.every(Number.isFinite), 'the six-step type scale is incomplete').toBe(true)
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index], `--fs-${index + 1} does not exceed --fs-${index}`).toBeGreaterThan(
        sizes[index - 1],
      )
    }
    expect(scale['fs-7'], 'a seventh type step defeats a fixed scale').toBeUndefined()
  })

  it('tracks tighter above 24px and opener below 13px', () => {
    // §11.7 states the direction, so the tokens must actually run that way —
    // two tracking tokens with the same sign would satisfy a presence check
    // and none of the intent.
    expect(Number.parseFloat(scale['tracking-tight'])).toBeLessThan(0)
    expect(Number.parseFloat(scale['tracking-open'])).toBeGreaterThan(0)
  })

  it('keeps routine motion under 300ms and the signature at 400ms', () => {
    const duration = (name: string) => Number.parseInt(scale[`duration-${name}`], 10)
    for (const routine of ['micro', 'enter', 'sheet']) {
      expect(duration(routine), `--duration-${routine} exceeds the routine ceiling`).toBeLessThan(
        300,
      )
    }
    expect(duration('micro')).toBeLessThan(duration('enter'))
    expect(duration('enter')).toBeLessThan(duration('sheet'))
    expect(duration('signature')).toBe(400)
  })

  it('honours reduced motion for animation and transition alike', () => {
    // The contract is that reduced motion removes travel, not feedback. What
    // can be checked here is that the query exists and covers both properties;
    // that a state change still confirms itself is a gallery and browser
    // concern.
    const reduced = tokensCss.slice(tokensCss.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toContain('animation-duration')
    expect(reduced).toContain('transition-duration')
  })

  it('declares exactly three radii', () => {
    // §11.1: controls/chips, cards, sheets/dialogs. `--radius-pill` is the
    // fully-rounded chip shape rather than a fourth elevation radius, so the
    // three that describe elevation are the ones pinned here.
    for (const radius of ['radius-input', 'radius-card', 'radius-sheet']) {
      const declared = scale[radius] ?? dark[radius]
      expect(declared, `--${radius} is missing`).toMatch(/^\d+px$/)
    }
  })

  it('declares one ordered stacking scale', () => {
    const order = ['content', 'sticky', 'navigation', 'overlay', 'modal', 'toast'].map((layer) =>
      Number.parseInt(scale[`z-${layer}`], 10),
    )
    expect(order.every(Number.isFinite), 'the stacking scale is incomplete').toBe(true)
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index], 'the stacking scale is not ordered').toBeGreaterThan(order[index - 1])
    }
  })

  it('supplies one tabular-numeral token for every numeric surface', () => {
    expect(scale.numeric).toBe('tabular-nums')
  })
})
