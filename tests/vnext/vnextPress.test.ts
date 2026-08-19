import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ONE TACTILE RESPONSE, APPLIED ONCE, AND REDUCED MOTION KEEPS IT.
 *
 * ============================ WHAT WAS MISSING ==========================
 *
 * `PrimaryActionCard` shipped the right treatment for ONE control — a 0.99
 * press, and under reduced motion a colour change INSTEAD of the movement
 * rather than the movement made instant. Every other control in the lane had
 * hover depth and a focus ring and nothing at all under a finger: nav buttons,
 * prediction actions, score controls, the Last Man Standing club list, Join,
 * Follow, Unfollow, league and player rows, retry controls, every primary CTA.
 *
 * ============================ AND WHY IT IS A RULE, NOT A COMPONENT =====
 *
 * Nineteen modules each adding their own `:active` is nineteen chances to pick
 * a different number, and the surfaces most likely to be missed are the ones
 * added next. One rule under `[data-vnext]` covers the lane including whatever
 * is written after it, which is the property worth having.
 */

const tokens = readFileSync(
  resolve(process.cwd(), 'src/vnext/foundations/tokens.css'),
  'utf8',
)

/** The press block, isolated from the rest of the stylesheet. */
const pressBlock = tokens.slice(tokens.indexOf('PRESS — the'))

describe('every vNext control answers a press', () => {
  it('presses buttons, button-roled elements and disclosure summaries', () => {
    expect(pressBlock).toMatch(
      /\[data-vnext\] :is\(button, \[role='button'\], summary\)[^{]*:active\s*\{\s*transform: scale\(0\.99\);/,
    )
  })

  it('is felt rather than watched', () => {
    // A press is a confirmation that the finger landed, not an event. Anything
    // below 0.95 reads as the control being squashed.
    const scales = [...pressBlock.matchAll(/transform: scale\((0\.\d+)\)/g)].map((match) =>
      Number(match[1]),
    )
    expect(scales.length).toBeGreaterThan(0)
    for (const scale of scales) {
      expect(scale).toBeGreaterThanOrEqual(0.98)
      expect(scale).toBeLessThan(1)
    }
  })

  it('never responds to a press it will not honour', () => {
    // A disabled control that moves under a finger is the interface lying.
    // `aria-disabled` counts: some controls stay focusable on purpose.
    for (const match of pressBlock.matchAll(/^\[data-vnext[^\n]*:active[^\n]*$/gm)) {
      expect(match[0]).toContain(':not(:disabled)')
      expect(match[0]).toContain(":not([aria-disabled='true'])")
    }
  })

  it('eases the release and never the press', () => {
    // The transition is on the resting state, so the response is immediate and
    // only the release is eased. A control that animated BEFORE acting would be
    // a control that felt slower for looking nicer.
    expect(pressBlock).toMatch(
      /\[data-vnext\] :is\(button, \[role='button'\], summary\) \{\s*transition: transform var\(--vnext-duration-instant\)/,
    )
  })
})

describe('reduced motion keeps the feedback and drops the travel', () => {
  it('covers the system preference', () => {
    const media = pressBlock.slice(pressBlock.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(media).toContain('transform: none')
    expect(media).toContain('background-color: var(--vnext-surface-interactive-hover)')
  })

  it('covers the workshop’s own override, so a reviewer can compare both', () => {
    const override = pressBlock.slice(pressBlock.indexOf("[data-vnext-motion='reduced']"))
    expect(override).toContain('transform: none')
    expect(override).toContain('background-color: var(--vnext-surface-interactive-hover)')
  })

  it('never reduces motion to no feedback at all', () => {
    // The rule the whole lane follows: the reduced variant is the same state
    // change without travel, never the state change removed. Every `transform:
    // none` in this block is paired with a colour that still changes.
    const reducedRules = pressBlock
      .split('}')
      .filter((rule) => rule.includes('transform: none'))
    expect(reducedRules.length).toBeGreaterThanOrEqual(2)
    for (const rule of reducedRules) {
      expect(rule).toContain('background-color')
    }
  })
})

function cssFilesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...cssFilesUnder(path))
    else if (entry.endsWith('.css')) out.push(path)
  }
  return out
}

describe('the vocabulary does not grow a second press', () => {
  it('keeps every module-level press at the lane’s own value', () => {
    // A module is allowed its own `:active` — `PrimaryActionCard` has one, and
    // a control with a genuinely different job may need one. What it may not do
    // is pick a different NUMBER, because two presses at two depths in one
    // product is the drift this rule exists to stop.
    const offenders: string[] = []
    for (const file of cssFilesUnder(resolve(process.cwd(), 'src/vnext'))) {
      if (file.endsWith('foundations/tokens.css')) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/:active\s*\{[^}]*transform: scale\((0\.\d+)\)/g)) {
        if (Number(match[1]) !== 0.99) offenders.push(`${file} -> ${match[1]}`)
      }
    }
    expect(
      offenders.map((entry) => entry.replace(`${process.cwd()}/`, '')),
      'a vNext module presses at a different depth than the lane does',
    ).toEqual([])
  })
})
