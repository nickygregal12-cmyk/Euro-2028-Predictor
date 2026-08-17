import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

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
  const literal: Record<string, string> = {}
  const alias: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    // Both groups are mandatory in the pattern, so an absent one means the
    // regex stopped matching what it claims to rather than a token to skip.
    if (name === undefined || value === undefined) {
      throw new Error(`tokens.css declaration in ${selector} did not parse`)
    }
    const hex = /^#[0-9A-Fa-f]{6}$/.exec(value.trim())?.[0]
    if (hex !== undefined) literal[name] = hex
    else {
      const reference = /^var\(--([a-z0-9-]+)\)$/.exec(value.trim())?.[1]
      if (reference !== undefined) alias[name] = reference
    }
  }

  // Aliases resolve transitively, because the palette is now two layers deep:
  // `--card` points at `--surface-raised`, which points at `--n-3`. Resolving
  // only one hop would leave `--card` unmeasurable and every pairing that used
  // it silently absent from the table — the failure mode this guard exists to
  // prevent. A cycle would spin here, so the walk is bounded and a token that
  // never lands on a literal is simply left out rather than guessed at.
  const values: Record<string, string> = { ...literal }
  for (const [name, target] of Object.entries(alias)) {
    let current = target
    for (let hop = 0; hop < 8 && !literal[current]; hop += 1) {
      current = alias[current] ?? current
    }
    const resolved = literal[current]
    if (resolved !== undefined) values[name] = resolved
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
  return Number(contrast(at(tokens, text), at(tokens, surface)).toFixed(2))
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

    // Re-pinned when the legacy names were repointed onto the target ramp.
    // Every number here either rose or held, with ONE exception worth naming
    // rather than burying: dark --tx3 on --card fell from 5.34 to 5.14. That
    // is the same tertiary step this repository has had to remediate twice, so
    // it is the one to watch — but 5.14 is further above the 4.5 floor than
    // the 4.51 --tx3 was rescued to in July, and its worst pairing, --chip,
    // improved from 4.51 to 4.53. The trade is a slightly smaller margin on
    // one surface for a larger margin on the one that actually failed.
    expect(measure(dark)).toEqual({
      tx: { bg: 17.98, card: 15.12, chip: 13.35, mut: 10.97, 'input-bg': 15 },
      tx2: { bg: 8.76, card: 7.36, chip: 6.5, mut: 5.34, 'input-bg': 7.3 },
      // Still clears AA everywhere except --mut, which no rule pairs it with
      // for text, and which is not a ramp step (see tokens.css).
      tx3: { bg: 6.11, card: 5.14, chip: 4.53, mut: 3.73, 'input-bg': 5.09 },
    })

    expect(measure(light)).toEqual({
      // --card and --input-bg measure identically because the light theme's
      // raised surface IS #FFFFFF: a light theme elevates by going lighter
      // than the page, which no step of a ramp anchored at the page can
      // express. tokens.css records that as a deliberate exception.
      tx: { bg: 16.9, card: 18.58, chip: 15.59, mut: 12.54, 'input-bg': 18.58 },
      tx2: { bg: 8.66, card: 9.52, chip: 7.99, mut: 6.43, 'input-bg': 9.52 },
      // Every light pairing improved. --tx3 on --mut rose from 3.6 to 4.41 and
      // is still under the 4.5 floor — closer, not fixed. No rule pairs them
      // for text, which is why it is recorded rather than blocking.
      tx3: { bg: 5.95, card: 6.54, chip: 5.49, mut: 4.41, 'input-bg': 6.54 },
    })
  })
})
