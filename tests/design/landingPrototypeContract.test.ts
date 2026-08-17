import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The public landing prototype against its own authority.
 *
 * `docs/design/hub-architecture-and-modernisation-plan.md` Appendix E is the
 * owner-approved acquisition design, and `docs/design/hub-landing-prototype.html`
 * is its executable form. A prototype that drifts from the appendix it
 * implements stops being evidence of anything, so the checkable parts of E.3,
 * E.4 and E.7 are pinned here.
 *
 * THE DEFECT THIS FILE EXISTS FOR. The supplied prototype declared its semantic
 * colours once, in the dark `:root`, and the light theme overrode only the brand
 * tokens. Every semantic foreground therefore INHERITED a dark-tuned value onto
 * a light surface: the tick marks, the rank deltas, the "Predictions saved"
 * state and the authentication error rendered between 1.34:1 and 2.24:1, where
 * AA text needs 4.5:1. Dark mode was 6.6–11:1 throughout, so the values were
 * fine exactly where they had been designed and unusable everywhere else — which
 * is why nobody would notice while working in the default theme.
 *
 * The repository already guards this defect class for `--mut` (PR #344, "never a
 * foreground"), and Appendix E.4 makes theme switching a functional requirement
 * of the prototype rather than a nicety. The contrast assertions below are
 * computed, not eyeballed.
 *
 * WORST CASE IS THE DARKEST LIGHT SURFACE, not the lightest — a dark foreground
 * loses contrast as the background darkens. `--danger` gets a further check
 * against the 10% tint it composes for `.auth-error`, which is darker again, and
 * is the case a naive check misses.
 */

const prototype = readFileSync(
  resolve(__dirname, '../../docs/design/hub-landing-prototype.html'),
  'utf8',
)

const darkBlock = at(prototype.split('html[data-theme="light"]'), 0)
const lightBlock = /html\[data-theme="light"\]\{(.*?)\n {4}\}/s.exec(prototype)?.[1] ?? ''

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]),
  )
}

const dark = tokens(darkBlock)
const light = tokens(lightBlock)

function channels(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** `color-mix(in srgb, fg <pct>%, bg)`. */
function mix(fg: string, bg: string, pct: number): string {
  const [fr, fg_, fb] = channels(fg)
  const [br, bg_, bb] = channels(bg)
  const to = (f: number, b: number) =>
    Math.round((f * pct + b * (1 - pct)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(fr, br)}${to(fg_, bg_)}${to(fb, bb)}`
}

const SEMANTIC = ['--success', '--warning', '--live', '--danger'] as const

describe('semantic colours are declared for BOTH themes', () => {
  it.each(SEMANTIC)('%s is restated in the light theme, not inherited', (token) => {
    // The whole defect in one assertion: inheriting these is what produced
    // 1.34:1 text. A light-theme value must exist and must differ from dark.
    expect(light[token], `${token} missing from the light theme`).toBeTruthy()
    expect(light[token]).not.toBe(dark[token])
  })
})

describe('light mode clears WCAG AA on the worst-case surface', () => {
  // --n-3 is surface-2, the darkest surface a semantic foreground sits on, and
  // therefore the hardest for a dark foreground.
  it.each(SEMANTIC)('%s reaches 4.5:1 on the darkest light surface', (token) => {
    expect(contrast(at(light, token), at(light, '--n-3'))).toBeGreaterThanOrEqual(4.5)
  })

  it('the auth error clears on the tint it composes from itself', () => {
    // `.auth-error` background is `color-mix(in srgb, var(--danger) 10%,
    // var(--surface-1))`, which is darker than any plain surface — so a token
    // that passes on --n-3 can still fail here.
    const tint = mix(at(light, '--danger'), at(light, '--n-2'), 0.1)
    expect(contrast(at(light, '--danger'), tint)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('dark mode is not regressed by the light fix', () => {
  it.each(SEMANTIC)('%s still clears 4.5:1 on the dark surface', (token) => {
    expect(contrast(at(dark, token), at(dark, '--n-3'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('Appendix E.4 token discipline', () => {
  it.each([
    ['12-step neutral ramp', /--n-\d+:/g, 12],
    ['separate 4-step border ramp', /--b-\d+:/g, 4],
    ['exactly three component radii', /--r-[a-z]+:/g, 3],
    ['six-step type scale', /--t-\d:/g, 6],
  ] as const)('%s', (_label, pattern, expected) => {
    expect(darkBlock.match(pattern) ?? []).toHaveLength(expected)
  })

  it('keeps three surface levels and the 120/180/240ms motion baseline', () => {
    expect(prototype.match(/--surface-\d:/g) ?? []).toHaveLength(3)
    for (const duration of ['120ms', '180ms', '240ms']) {
      expect(prototype).toContain(duration)
    }
    expect(prototype).toContain('prefers-reduced-motion')
  })

  it('uses 48px desktop and 52px phone data rows with tabular numerals', () => {
    expect(prototype).toMatch(/\.data-row\{height:48px/)
    expect(prototype).toMatch(/\.phone-row\{height:52px/)
    expect(prototype).toContain('font-variant-numeric:tabular-nums')
  })
})

describe('Appendix E.3 content order', () => {
  it('runs hero → proof → how → experience → leagues → games → CTA', () => {
    const body = at(prototype.split('<body>'), 1)
    const markers = [
      'class="hero"',
      'competition-pair',
      'id="how"',
      'id="experience"',
      'id="leagues"',
      'id="games"',
      'final-cta',
    ]
    const positions = markers.map((m) => body.indexOf(m))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('carries no Euro 2028 band, and no Euro anything (EURO-003)', () => {
    // `euro-band` used to sit between games and the final CTA, and the order
    // above pinned it there. ADR 0026 superseded revision 1.5's Euro
    // positioning and EURO-003 requires Euro absent from the weekly platform
    // while its publication state is hidden, so the prototype loses it too —
    // this file exists precisely so the prototype and the appendix cannot
    // disagree with the product about what the page is.
    //
    // The whole document, not just the band: a mention in the hero or the
    // footer breaks the same requirement and leaves no `euro-band` to find.
    expect(prototype.toLowerCase()).not.toContain('euro')
  })
})

describe('Appendix E.7 acceptance checklist', () => {
  it('shows exactly three contextual slots at full desktop scale', () => {
    expect(prototype.match(/class="context-slot"/g) ?? []).toHaveLength(3)
  })

  it('never preselects a competition or game in the sign-up mock', () => {
    // E.6: membership must never be implied. A `checked` attribute in the setup
    // step would silently join somebody to a competition or a game.
    const setup = /<div class="setup" id="setupStep">(.*?)<\/div>\s*<\/div>\s*<\/div>/s.exec(
      prototype,
    )?.[1]
    expect(setup).toBeTruthy()
    expect(setup).not.toContain('checked')
  })

  it('still leads with both domestic competitions, with nothing behind them', () => {
    // E.7 asked for both domestic competitions AHEAD of the Euro band. With the
    // band gone under EURO-003 the ordering half is moot, but the half that
    // still matters is not: both competitions must be on the page and in the
    // order Appendix E names them, which is what the requirement was protecting
    // when it put them first.
    const body = prototype.split('<body>')[1] as string
    const scottish = body.indexOf('Scottish Premiership')
    const premier = body.indexOf('Premier League')

    expect(scottish).toBeGreaterThan(-1)
    expect(premier).toBeGreaterThan(-1)
    expect(scottish).toBeLessThan(premier)
  })

  it('keeps the modal accessible: dialog semantics, focus trap, escape, restoration', () => {
    expect(prototype).toContain('role="dialog"')
    expect(prototype).toContain('aria-modal="true"')
    expect(prototype).toContain("e.key==='Tab'")
    expect(prototype).toContain("e.key==='Escape'")
    expect(prototype).toContain('returnFocus')
  })
})
