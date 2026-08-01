import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrast of the token pairings the stylesheets actually declare.
 *
 * `tokenContrast.test.ts` measures the palette — which colours may sit on which.
 * This asks the next question: which pairings does the CSS put on screen?
 *
 * The browser scans answer that too, but only for states a route renders. Both
 * `.jokerBurned` rules found here — `background: var(--chip); color: var(--tx3)`
 * at 4.07:1 dark and 3.11:1 light — sit on `/matches` and `/match/:matchRef`,
 * routes that were scanned and passing, because a burned joker is a state the
 * fixtures never produce. A stylesheet declares the pairing whether or not a
 * test happens to render it, so reading the stylesheet finds it either way.
 *
 * ## Deliberately only same-rule pairings
 *
 * A rule that sets both `background` and `color` from tokens is unambiguous: the
 * text is on that background. Resolving inherited backgrounds across selectors
 * would need the cascade and the DOM, and guessing at it produces false alarms —
 * an earlier by-proximity heuristic flagged `ThirdPlaceTable`'s `.outText` and
 * `GroupTable`'s, where `--mut` belongs to a sibling bar and the text is on
 * `--card` at 4.81:1, which is fine.
 *
 * So this catches the high-confidence half and says so. `GoldenBootPicker`'s
 * `.chipTeam`, which inherits `--chip` from its parent, was found by reading and
 * is not caught here. The browser scans remain the backstop for the rest.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const tokensCss = readFileSync(resolve(repositoryRoot, 'src/styles/tokens.css'), 'utf8')

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

// The opening brace matters: without it the light selector matches the header
// comment. `tokenContrast.test.ts` records how that went unnoticed.
const THEMES = { dark: theme(':root,'), light: theme('[data-theme="light"] {') }

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
  return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
}

const AA_NORMAL_TEXT = 4.5

function styleSheets(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...styleSheets(full))
      continue
    }
    if (entry.name.endsWith('.css')) found.push(relative(repositoryRoot, full))
  }
  return found
}

type Pairing = { rule: string; text: string; surface: string }

/**
 * Rules declaring both a token background and a token colour.
 *
 * Comments are blanked first. The selector is whatever precedes `{` since the
 * last `}`, so a comment above a rule would otherwise become part of its name —
 * and these names are the keys the review list is matched on.
 */
function pairingsIn(css: string): Pairing[] {
  const pairings: Pairing[] = []
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

  for (const [, selector, body] of withoutComments.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const surface = /background(?:-color)?:\s*var\(--([a-z0-9-]+)\)/.exec(body)?.[1]
    const text = /(?:^|[;\s])color:\s*var\(--([a-z0-9-]+)\)/.exec(body)?.[1]
    if (surface && text) pairings.push({ rule: selector.trim().replace(/\s+/g, ' '), text, surface })
  }

  return pairings
}

/**
 * Pairings that fail the 4.5:1 check but are not being changed, each with the
 * verdict and why.
 *
 * The list is empty. It held fourteen entries until the palette was raised on
 * 31 July 2026 — nine joker pills, a decorative icon, two disabled-button rules
 * and two icon containers — and every one of them now passes rather than being
 * excused:
 *
 *  - The nine gold pills moved to `--gold-strong`, a token added for gold text
 *    on `--gold-tint`. `--gold` itself is untouched, so the joker identity and
 *    `--gold-contrast` on top of it are exactly as they were.
 *  - `EmptyState`'s icon and the disabled buttons were never defects — non-text
 *    and inactive controls have lower bars — but the raised `--tx3` and `--tx2`
 *    clear the text threshold anyway, so the exemptions are no longer needed.
 *
 * What remains is two icon containers, and their verdict is a correction. They
 * were recorded as "live-data cyan — needs a palette decision", which read them
 * as text. `.globe` holds a `<GlobeIcon>` and nothing else, so WCAG 1.4.11's
 * 3:1 applies and 4.09:1 clears it. `--cyn` needed no change; the entry needed
 * reading properly.
 */
const REVIEWED: ReadonlyArray<readonly [where: string, verdict: string]> = [
  [
    'src/features/league/leaderboard.module.css .globe',
    'icon container — holds only <GlobeIcon>, so 1.4.11 asks 3:1 and 4.09 clears it',
  ],
  [
    'src/features/leagues/hub.module.css .globe',
    'icon container — holds only <GlobeIcon>, so 1.4.11 asks 3:1 and 4.09 clears it',
  ],
]

const reviewedRules = REVIEWED.map(([where]) => where)

describe('CSS token pairings meet AA', () => {
  const sheets = styleSheets(resolve(repositoryRoot, 'src'))
  const declared = sheets.flatMap((sheet) =>
    pairingsIn(readFileSync(resolve(repositoryRoot, sheet), 'utf8')).map((pairing) => ({
      ...pairing,
      sheet,
    })),
  )

  it('finds pairings to measure, so the sweep is not vacuous', () => {
    expect(sheets.length).toBeGreaterThan(20)
    expect(declared.length).toBeGreaterThan(5)
  })

  it('recognises a pairing and ignores a rule that sets only one side', () => {
    // The parser's own control: every assertion below passes when it returns
    // nothing, which a changed idiom — a shorthand `background`, a colour
    // written literally — would cause.
    expect(pairingsIn('.a { background: var(--chip); color: var(--tx3); }')).toEqual([
      { rule: '.a', text: 'tx3', surface: 'chip' },
    ])
    expect(pairingsIn('.a { color: var(--tx3); }')).toEqual([])
    expect(pairingsIn('.a { background: var(--chip); }')).toEqual([])
    // `border-color` is not the text colour and must not be read as one.
    expect(pairingsIn('.a { background: var(--chip); border-color: var(--tx3); }')).toEqual([])
  })

  /** Every declared pairing that misses 4.5:1 in either theme. */
  const belowAa = declared.flatMap(({ sheet, rule, text, surface }) =>
    (['dark', 'light'] as const)
      .filter((name) => {
        const tokens = THEMES[name]
        // Semantic and one-off colours are outside the measured palette.
        if (!tokens[text] || !tokens[surface]) return false
        return contrast(tokens[text], tokens[surface]) < AA_NORMAL_TEXT
      })
      .map((name) => ({
        pairing: `--${text} on --${surface}`,
        where: `${sheet} ${rule}`,
        ratio: contrast(THEMES[name][text], THEMES[name][surface]),
        theme: name,
      })),
  )

  it('puts no text on a background it cannot be read against', () => {
    const unreviewed = belowAa
      .filter((entry) => !reviewedRules.includes(entry.where))
      .map((entry) => `${entry.where}: ${entry.pairing} is ${entry.ratio}:1 in the ${entry.theme} theme`)

    expect(
      unreviewed,
      `these rules declare text on a background it fails AA against, whether or ` +
        `not a route scan renders the state. Fix it, or add it to REVIEWED with ` +
        `the reason it is acceptable:\n${unreviewed.join('\n')}`,
    ).toEqual([])
  })

  it('keeps the reviewed list honest', () => {
    // A reviewed entry that now passes is a decision nobody needs to keep
    // reading, and it would hide the next rule that reintroduces the pairing.
    const stale = reviewedRules.filter((where) => !belowAa.some((entry) => entry.where === where))

    expect(stale, 'reviewed rules that no longer fail — delete them').toEqual([])

    for (const [where, verdict] of REVIEWED) {
      expect(verdict.length, `${where} is reviewed without a reason`).toBeGreaterThan(25)
    }
  })
})
