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
 * these numbers, not sampled from the dark ones. `--vnext-hit` is `#0b6b3e`
 * rather than the more natural `#0d7a45` for exactly this reason — and it is
 * darker still than the `#0c7141` this file first pinned, because the opaque
 * table below is not the whole palette. See `VEILED_PAIRINGS`.
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

/** The `rgba(r, g, b, a)` veil declarations inside one theme block. */
function veils(selector: string): Record<string, { rgb: string; alpha: number }> {
  const start = tokensCss.indexOf(selector)
  if (start === -1) throw new Error(`vNext tokens.css has no ${selector} block`)

  const body = tokensCss.slice(start, tokensCss.indexOf('}', start))
  const found: Record<string, { rgb: string; alpha: number }> = {}
  const declaration = /--vnext-([a-z0-9-]+)-veil:\s*rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\);/g
  for (const [, name, r, g, b, a] of body.matchAll(declaration)) {
    if (name === undefined) throw new Error(`a veil in ${selector} did not parse`)
    const channel = (raw: string | undefined) =>
      Number(raw).toString(16).padStart(2, '0')
    found[name] = { rgb: `#${channel(r)}${channel(g)}${channel(b)}`, alpha: Number(a) }
  }
  return found
}

const dark = theme('[data-vnext] {')
const light = theme("[data-vnext][data-vnext-theme='light'] {")
const darkVeils = veils('[data-vnext] {')
const lightVeils = veils("[data-vnext][data-vnext-theme='light'] {")

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

/**
 * TEXT DRAWN ON A TRANSLUCENT VEIL, WHICH IS THE PAIRING THE TABLE ABOVE CANNOT
 * SEE. Every ratio above is token-against-token, and a veil is not a token: it
 * is `rgba(...)` composited over whatever surface the chip was dropped onto, so
 * the effective background is a colour that appears nowhere in `tokens.css`.
 *
 * The gap was not theoretical. The light ramp shipped its first Storybook run
 * with `--vnext-accent` at **4.45** on `--vnext-accent-veil` over
 * `--vnext-surface-interactive` — caught by axe, on one story, because
 * `.youTag` happened to be rendered there. Nothing measured it; the chip could
 * as easily have existed only on a screen with no story and shipped.
 *
 * THE LIST IS EXPLICIT, NOT DERIVED FROM THE CSS. A parser that reads every
 * rule setting `background-color: var(--vnext-*-veil)` alongside a `color:`
 * finds `LiveIndicator`'s `.indicator`, which declares `color: var(--vnext-live)`
 * — and would then demand 4.5:1 of a token that renders NO text. Every text node
 * in that chip overrides the colour: the word is `--vnext-text-on-live` and the
 * minute is `--vnext-text`. What `--vnext-live` actually draws there is a 1px
 * border and a 7px dot, non-text graphics whose floor is 3:1 (WCAG 1.4.11),
 * which they clear at 3.64 worst-case. Deriving the list would have washed out
 * the live colour to satisfy a pairing that does not exist — the same mistake
 * the state-surface note above records.
 *
 * So each entry below was read off a rule that pairs a veil background with
 * text in that colour, whether declared or inherited from the ancestor ramp.
 */
const VEILED_PAIRINGS: ReadonlyArray<readonly [string, string]> = [
  // Declared: the chip states a colour on its own veil.
  ['accent', 'accent'], // .youTag, .catalogueRelationship, conceptC .jump
  ['hit', 'hit'], // FormRun .win, matches .badgeSettled, .capabilityState
  ['warn', 'warn'], // matches .badgeNeeded, .capabilityState partial
  ['miss', 'miss'], // FormRun .loss, .capabilityState absent
  ['joker', 'warn'], // .jokerTag, playerProfile .joker — the one cross pairing
  // Inherited: the veil is a row or banner and the ramp comes from above.
  ['text', 'accent'],
  ['text', 'hit'],
  ['text', 'warn'],
  ['text', 'miss'],
  ['text', 'live'],
  ['text-secondary', 'accent'],
  ['text-secondary', 'hit'],
  ['text-secondary', 'warn'],
  ['text-secondary', 'miss'],
  ['text-secondary', 'live'],
  // `--vnext-text-on-live` NAMES A FILL IT NEVER SITS ON. It is the live chip's
  // word, and that word sits on `--vnext-live-veil` — which is why it belongs
  // here and not in the on-fill test below. The light ramp shipped it as
  // `#ffffff` copied from dark and measured **1.33** on its own chip; axe found
  // it, this row is what would have.
  ['text-on-live', 'live'],
]

/** Composite `over` at `alpha` onto `under`, the way a browser paints it. */
function composite(over: string, alpha: number, under: string): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const [a, b] = [channels(over), channels(under)]
  const mixed = a.map((value, i) => {
    const beneath = b[i]
    if (value === undefined || beneath === undefined) throw new Error('bad colour')
    return Math.round(value * alpha + beneath * (1 - alpha))
  })
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function veiledRatio(
  tokens: Record<string, string>,
  veilTokens: Record<string, { rgb: string; alpha: number }>,
  text: string,
  veil: string,
  surface: string,
): number {
  const fg = tokens[text]
  const under = tokens[surface]
  const paint = veilTokens[veil]
  if (fg === undefined) throw new Error(`missing --vnext-${text}`)
  if (under === undefined) throw new Error(`missing --vnext-${surface}`)
  if (paint === undefined) throw new Error(`missing --vnext-${veil}-veil`)
  return Number(contrast(fg, composite(paint.rgb, paint.alpha, under)).toFixed(2))
}

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

  it.each(['dark', 'light'] as const)(
    'clears AA for text placed on a translucent veil — %s',
    (name) => {
      const tokens = name === 'dark' ? dark : light
      const veilTokens = name === 'dark' ? darkVeils : lightVeils
      const failures: string[] = []
      for (const [text, veil] of VEILED_PAIRINGS) {
        for (const surface of SURFACES) {
          const measured = veiledRatio(tokens, veilTokens, text, veil, surface)
          if (measured < AA_NORMAL_TEXT) {
            failures.push(
              `--vnext-${text} on --vnext-${veil}-veil over --vnext-${surface}: ${measured}`,
            )
          }
        }
      }
      expect(failures, `${name}:\n${failures.join('\n')}`).toEqual([])
    },
  )

  it('pins the tightest veil ratio for every pairing, in both themes', () => {
    const tightest = (name: 'dark' | 'light') => {
      const tokens = name === 'dark' ? dark : light
      const veilTokens = name === 'dark' ? darkVeils : lightVeils
      const pinned: Record<string, number> = {}
      for (const [text, veil] of VEILED_PAIRINGS) {
        pinned[`${text}-on-${veil}`] = Math.min(
          ...SURFACES.map((surface) =>
            veiledRatio(tokens, veilTokens, text, veil, surface),
          ),
        )
      }
      return pinned
    }
    expect({ dark: tightest('dark'), light: tightest('light') }).toMatchInlineSnapshot(`
      {
        "dark": {
          "accent-on-accent": 5.97,
          "hit-on-hit": 5.72,
          "joker-on-warn": 6.16,
          "miss-on-miss": 4.6,
          "text-on-accent": 9.4,
          "text-on-hit": 9.43,
          "text-on-live": 10.76,
          "text-on-live-on-live": 11.65,
          "text-on-miss": 10.65,
          "text-on-warn": 9.7,
          "text-secondary-on-accent": 5.62,
          "text-secondary-on-hit": 5.64,
          "text-secondary-on-live": 6.44,
          "text-secondary-on-miss": 6.37,
          "text-secondary-on-warn": 5.8,
          "warn-on-warn": 5.74,
        },
        "light": {
          "accent-on-accent": 4.69,
          "hit-on-hit": 4.69,
          "joker-on-warn": 4.76,
          "miss-on-miss": 4.75,
          "text-on-accent": 13.31,
          "text-on-hit": 13.34,
          "text-on-live": 13.11,
          "text-on-live-on-live": 13.36,
          "text-on-miss": 13.14,
          "text-on-warn": 13.04,
          "text-secondary-on-accent": 6.33,
          "text-secondary-on-hit": 6.34,
          "text-secondary-on-live": 6.23,
          "text-secondary-on-miss": 6.25,
          "text-secondary-on-warn": 6.2,
          "warn-on-warn": 4.72,
        },
      }
    `)
  })

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
      // The opaque reading of the pairing that chose `--vnext-hit`. The
      // binding one is `hit-on-hit` in the veil table, which is far tighter.
      lightHitOnHover: ratio(light, 'hit', 'surface-interactive-hover'),
    }).toMatchInlineSnapshot(`
      {
        "darkAccentOnSurface": 10.9,
        "darkMutedOnSurface": 6.61,
        "darkTextOnCanvas": 18.61,
        "lightAccentOnSurface": 6.59,
        "lightHitOnHover": 5.42,
        "lightMutedOnSurface": 5.89,
        "lightTextOnCanvas": 17.32,
      }
    `)
  })
})
