import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Measured contrast between every text token and every surface token.
 *
 * `tokens.css` is the only place a colour may be defined, and nothing measured
 * what those colours do when put together. The axe scans catch a bad pairing
 * only where a route happens to render it — which is how `--tx3` on `--chip`
 * shipped and was then found on 31 July 2026 by the first scan of `/league/:id`,
 * at 4.06:1 against the 4.5:1 AA minimum.
 *
 * This measures the palette itself, so a pairing is answerable before anyone
 * writes it and a token edit shows its consequences immediately.
 *
 * ## The table is pinned
 *
 * Every text token now clears AA on every surface it is paired with for text.
 * The one number still under 4.5 is `--tx3` on `--mut`, which no rule declares —
 * it is in the table because the table is the whole palette, not a list of
 * problems.
 *
 * The table was pinned while several pairs were failing, so the numbers were
 * visible while the palette decision was open. It stays pinned now they pass:
 * a token edit shows its consequences across every surface at once, which is
 * what made raising `--tx2` and `--tx3` together an obvious move rather than a
 * discovery. `Button.module.css` carries a hand-measured note of the same kind
 * — this replaces measuring by hand.
 */

const tokensCss = readFileSync(
  resolve(import.meta.dirname, '../../src/styles/tokens.css'),
  'utf8',
)

/**
 * The `--name: #rrggbb` declarations inside one theme block.
 *
 * The selector must include its opening brace. Without it, `[data-theme="light"]`
 * matches the file's header comment first — which explains the themes to a
 * reader — and every "light" measurement below is silently taken from the dark
 * block instead. The pinned table caught that on the first run.
 */
function theme(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(selector)
  if (start === -1) throw new Error(`tokens.css has no ${selector} block`)

  const body = tokensCss.slice(start, tokensCss.indexOf('}', start))
  const values: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    values[name] = value
  }
  return values
}

const dark = theme(':root,')
const light = theme('[data-theme="light"] {')

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

/** Two decimals, matching how axe reports a ratio. */
function ratio(tokens: Record<string, string>, text: string, surface: string): number {
  return Number(contrast(tokens[text], tokens[surface]).toFixed(2))
}

const SURFACES = ['bg', 'card', 'chip', 'mut', 'input-bg'] as const
const AA_NORMAL_TEXT = 4.5

describe('design token contrast', () => {
  it('reads both themes, so nothing below measures an empty palette', () => {
    for (const [name, tokens] of [
      ['dark', dark],
      ['light', light],
    ] as const) {
      for (const token of ['tx', 'tx2', 'tx3', ...SURFACES]) {
        expect(tokens[token], `${name} theme is missing --${token}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })

  it('agrees with axe on a ratio axe actually measured', () => {
    // The control for the arithmetic: anything else here means the luminance
    // implementation is wrong and every number below is fiction.
    //
    // Pinned to the colours rather than to the tokens. axe reported 4.06 for
    // #7E8BA8 on #1A2B52 when `/league/:id` failed, and those were `--tx3` and
    // `--chip` at the time. `--tx3` has since been raised, so reading it from
    // the palette would compare the implementation against a number axe never
    // produced — the check would survive as a shape while losing its meaning.
    expect(Number(contrast('#7E8BA8', '#1A2B52').toFixed(2))).toBeCloseTo(4.06, 1)
  })

  it('keeps primary and secondary text above AA on a chip', () => {
    // The pairing the /league/:id fix moved to. Asserted rather than pinned,
    // because a change that pushed it back under AA would reintroduce the
    // defect that scan found.
    for (const [name, tokens] of [
      ['dark', dark],
      ['light', light],
    ] as const) {
      for (const text of ['tx', 'tx2'] as const) {
        expect(
          ratio(tokens, text, 'chip'),
          `--${text} on --chip in the ${name} theme`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    }
  })

  it('pins the measured table for both themes', () => {
    const measure = (tokens: Record<string, string>) =>
      Object.fromEntries(
        (['tx', 'tx2', 'tx3'] as const).map((text) => [
          text,
          Object.fromEntries(SURFACES.map((surface) => [surface, ratio(tokens, text, surface)])),
        ]),
      )

    expect(measure(dark)).toEqual({
      tx: { bg: 17.11, card: 15.05, chip: 12.72, mut: 10.79, 'input-bg': 14.75 },
      tx2: { bg: 7.66, card: 6.74, chip: 5.7, mut: 4.83, 'input-bg': 6.6 },
      // --tx3 was raised on 31 July 2026 and now clears AA everywhere except
      // --mut, which no rule pairs it with for text.
      tx3: { bg: 6.06, card: 5.34, chip: 4.51, mut: 3.82, 'input-bg': 5.23 },
    })

    expect(measure(light)).toEqual({
      tx: { bg: 15.83, card: 16.82, chip: 14.7, mut: 11.64, 'input-bg': 17.25 },
      tx2: { bg: 7.16, card: 7.6, chip: 6.65, mut: 5.26, 'input-bg': 7.8 },
      // Both were raised together on 31 July 2026. --tx3 was below AA on every
      // surface in this theme; the value that fixes it is almost exactly the
      // old --tx2, so --tx2 moved down to keep the ramp three levels deep.
      // --mut is the one surface --tx3 still misses, and no rule pairs them.
      tx3: { bg: 4.9, card: 5.21, chip: 4.55, mut: 3.6, 'input-bg': 5.34 },
    })
  })
})
