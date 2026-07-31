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
 * ## The table is pinned, not filtered
 *
 * Several pairs are below AA today, and the light theme's `--tx3` is below AA on
 * every surface. Those are recorded rather than quietly excluded: `--tx3` is
 * used in 123 places and choosing a new value for it is a design decision about
 * the palette, not a test fixture. Pinning makes the numbers visible and makes
 * any change to them deliberate. `Button.module.css` already carries a
 * hand-measured note of the same kind — this replaces measuring by hand.
 *
 * What is asserted outright is narrower and is what the code now relies on:
 * `--tx` and `--tx2` clear AA on `--chip` in both themes, because that is the
 * pairing the `/league/:id` fix moved to.
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
    // The control for the arithmetic. axe reported 4.06 for `--tx3` on `--chip`
    // in the dark theme when it failed `/league/:id`; anything else here means
    // the luminance implementation is wrong and every number below is fiction.
    expect(ratio(dark, 'tx3', 'chip')).toBeCloseTo(4.06, 1)
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
      // --tx3 is below AA on --chip and --mut here. Use --tx2 on those surfaces.
      tx3: { bg: 5.47, card: 4.81, chip: 4.07, mut: 3.45, 'input-bg': 4.71 },
    })

    expect(measure(light)).toEqual({
      tx: { bg: 15.83, card: 16.82, chip: 14.7, mut: 11.64, 'input-bg': 17.25 },
      // --tx2 is below AA on --mut in this theme.
      tx2: { bg: 5.2, card: 5.52, chip: 4.83, mut: 3.82, 'input-bg': 5.66 },
      // --tx3 is below AA on every surface in this theme. Recorded, not
      // excused: it is used in 123 places, so raising it is a palette decision
      // for the owner rather than something a test should settle.
      tx3: { bg: 3.35, card: 3.56, chip: 3.11, mut: 2.46, 'input-bg': 3.65 },
    })
  })
})
