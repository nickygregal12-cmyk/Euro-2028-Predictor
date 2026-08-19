import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * MEASURED CONTRAST FOR EVERY vNEXT TEXT/SURFACE PAIRING, IN BOTH THEMES.
 *
 * `UX-006` recorded that `src/vnext/foundations/tokens.css` was "the one
 * palette nobody measures": the production palette has had this test since
 * July, and the lane that was about to become production had nothing. The axe
 * scans catch a bad pairing only where a story happens to render it, and jsdom
 * cannot evaluate contrast at all — so every vNext colour decision was, until
 * now, taken by eye.
 *
 * It matters twice over because the light ramp is new. `DEC-016` attached a
 * condition to building one — *"an inverted dark ramp is not a measured light
 * ramp"* — and this is what discharges it: the light values were chosen against
 * these numbers, not sampled from the dark ones. `--vnext-hit` is `#0c7141`
 * rather than the more natural `#0d7a45` for exactly this reason; the lighter
 * green measured **4.44:1** on the interactive hover surface and nowhere else.
 *
 * THE TABLE IS PINNED, not just floor-checked. A floor tells you nothing broke;
 * a pinned table shows what a token edit did to every pairing at once, which is
 * what makes a palette change reviewable instead of a leap.
 */

const tokensCss = readFileSync(
  resolve(import.meta.dirname, '../../src/vnext/foundations/tokens.css'),
  'utf8',
)

/**
 * The `--name: value` declarations inside one theme block.
 *
 * THE SELECTOR MUST INCLUDE ITS OPENING BRACE. Without it the header comment —
 * which explains both themes to a reader, and therefore contains the light
 * selector as prose — matches first, and every light measurement below is
 * silently taken from the dark block. The production test records the same trap
 * and it is not hypothetical.
 */
function theme(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(selector)
  if (start === -1) throw new Error(`vNext tokens.css has no ${selector} block`)

  const body = tokensCss.slice(start, tokensCss.indexOf('}', start))
  const values: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--vnext-([a-z0-9-]+):\s*([^;]+);/g)) {
    if (name === undefined || value === undefined) {
      throw new Error(`a declaration in ${selector} did not parse`)
    }
    const hex = /^#[0-9A-Fa-f]{6}$/.exec(value.trim())?.[0]
    if (hex !== undefined) values[name] = hex
  }
  return values
}

const dark = theme('[data-vnext] {')
const light = theme("[data-vnext][data-vnext-theme='light'] {")

/** WCAG 2.x relative luminance. */
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

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function ratio(tokens: Record<string, string>, text: string, surface: string): number {
  const fg = tokens[text]
  const bg = tokens[surface]
  if (fg === undefined) throw new Error(`missing --vnext-${text}`)
  if (bg === undefined) throw new Error(`missing --vnext-${surface}`)
  return Number(contrast(fg, bg).toFixed(2))
}

/** Surfaces text is actually placed on. */
const SURFACES = [
  'canvas',
  'canvas-deep',
  'surface',
  'surface-raised',
  'surface-interactive',
  'surface-interactive-hover',
  'surface-sunken',
] as const

/**
 * THE GENERAL-PURPOSE TEXT RAMP. These three carry ordinary words and can land
 * on any surface in the lane, so the floor applies to all of them everywhere.
 */
const TEXT_RAMP = ['text', 'text-secondary', 'text-muted', 'rank-flat'] as const

/**
 * STATE COLOURS, WHICH ARE NOT GENERAL-PURPOSE. Each is placed deliberately —
 * a live chip draws its word over `--vnext-live-veil`, not over a hover
 * surface — so they are floored on the surfaces a page actually puts them on
 * and pinned everywhere else.
 *
 * The distinction is not a softening. It is the difference between measuring
 * the palette and measuring a pairing: an earlier draft of this file floored
 * every state colour on every surface, and its first failure was
 * `--vnext-text-on-live` on `--vnext-live` at 3.21 — a pairing NO component
 * renders. `text-on-live` is the crest monogram and the live chip's word, and
 * neither sits on the live fill; the fill is a seven-pixel dot. Changing a
 * shipped palette to satisfy that would have been correcting the product to
 * match the test.
 */
const STATE_COLOURS = [
  'accent',
  'live',
  'hit',
  'warn',
  'miss',
  'rank-up',
  'rank-down',
  'joker',
  'focus',
] as const

/** Where state-coloured text is actually placed. */
const STATE_SURFACES = ['canvas', 'surface', 'surface-raised'] as const

const TEXTS = [...TEXT_RAMP, ...STATE_COLOURS] as const

const AA_NORMAL_TEXT = 4.5

describe('vNext token contrast', () => {
  it('reads both themes, so nothing below measures an empty palette', () => {
    for (const [name, tokens] of [
      ['dark', dark],
      ['light', light],
    ] as const) {
      for (const token of [...TEXTS, ...SURFACES]) {
        expect(tokens[token], `${name} theme is missing --vnext-${token}`).toMatch(
          /^#[0-9A-Fa-f]{6}$/,
        )
      }
    }
  })

  it('agrees with a hand-computed ratio, so the arithmetic is not fiction', () => {
    // Black on white is 21:1 by definition. Anything else here means the
    // luminance implementation is wrong and every number below is invented.
    expect(Number(contrast('#000000', '#ffffff').toFixed(2))).toBe(21)
    expect(Number(contrast('#ffffff', '#ffffff').toFixed(2))).toBe(1)
  })

  it.each(['dark', 'light'] as const)(
    'clears AA for the general text ramp on every surface — %s',
    (name) => {
      const tokens = name === 'dark' ? dark : light
      const failures: string[] = []
      for (const text of TEXT_RAMP) {
        for (const surface of SURFACES) {
          const measured = ratio(tokens, text, surface)
          if (measured < AA_NORMAL_TEXT) {
            failures.push(`--vnext-${text} on --vnext-${surface}: ${measured}`)
          }
        }
      }
      expect(failures, `${name}:\n${failures.join('\n')}`).toEqual([])
    },
  )

  it.each(['dark', 'light'] as const)(
    'clears AA for state colours where a page places them — %s',
    (name) => {
      const tokens = name === 'dark' ? dark : light
      const failures: string[] = []
      for (const text of STATE_COLOURS) {
        for (const surface of STATE_SURFACES) {
          const measured = ratio(tokens, text, surface)
          if (measured < AA_NORMAL_TEXT) {
            failures.push(`--vnext-${text} on --vnext-${surface}: ${measured}`)
          }
        }
      }
      expect(failures, `${name}:\n${failures.join('\n')}`).toEqual([])
    },
  )

  it('clears AA for text placed ON the accent fill', () => {
    // The accent IS a background for words — a primary button. `live` is not:
    // its fill is a seven-pixel dot, and `--vnext-text-on-live` names the crest
    // monogram and the live chip's word, neither of which sits on it.
    for (const [name, tokens] of [
      ['dark', dark],
      ['light', light],
    ] as const) {
      expect(ratio(tokens, 'text-on-accent', 'accent'), `${name} on accent`).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      )
    }
  })

  it('pins the headline ratios, so a token edit shows its consequences', () => {
    expect({
      darkTextOnCanvas: ratio(dark, 'text', 'canvas'),
      darkMutedOnSurface: ratio(dark, 'text-muted', 'surface'),
      darkAccentOnSurface: ratio(dark, 'accent', 'surface'),
      lightTextOnCanvas: ratio(light, 'text', 'canvas'),
      lightMutedOnSurface: ratio(light, 'text-muted', 'surface'),
      lightAccentOnSurface: ratio(light, 'accent', 'surface'),
      // The pairing that chose `--vnext-hit`. Its predecessor sat at 4.44.
      lightHitOnHover: ratio(light, 'hit', 'surface-interactive-hover'),
    }).toMatchInlineSnapshot(`
      {
        "darkAccentOnSurface": 10.9,
        "darkMutedOnSurface": 6.61,
        "darkTextOnCanvas": 18.61,
        "lightAccentOnSurface": 5.76,
        "lightHitOnHover": 5,
        "lightMutedOnSurface": 5.89,
        "lightTextOnCanvas": 17.32,
      }
    `)
  })
})
