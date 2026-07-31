import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The accessibility rules the linter runs, and the ones it does not.
 *
 * `.oxlintrc.json` enables the `jsx-a11y` plugin and switches six of its rules
 * off. Every one of those has a reason written beside it, and every reason is a
 * conflict rather than an inconvenience: two would argue against fixes this
 * repository has already made, and two cannot see text nested inside an element.
 *
 * A disabled list is the easiest control in a codebase to grow. One more rule
 * off is a one-line diff that nobody reviews closely, and the plugin quietly
 * becomes decorative — the same shape as an axe deferral whose reason stopped
 * being true, or a review list keyed too widely. So the list is pinned here:
 * adding a rule to it means editing this file and writing down why.
 *
 * The pin is the point. There is no assertion here that the six are *correct* —
 * that judgement is in the config, next to each rule. What this stops is a
 * seventh appearing without one.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const configSource = readFileSync(resolve(repositoryRoot, '.oxlintrc.json'), 'utf8')

/** JSONC — oxlint accepts comments, and the reasons live in them. */
function withoutComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, '')
}

const config = JSON.parse(withoutComments(configSource)) as {
  plugins?: string[]
  rules?: Record<string, string>
}

/**
 * Rules deliberately off, each with the conflict that justifies it.
 *
 * Kept in the same order as the config so the two read together.
 */
const DISABLED: ReadonlyArray<readonly [rule: string, conflict: string]> = [
  ['jsx-a11y/prefer-tag-over-role', 'the design system builds tables as CSS grids with hand-written ARIA roles'],
  ['jsx-a11y/no-noninteractive-tabindex', 'WCAG 2.1.1 requires the tabIndex it objects to on scrollable regions'],
  ['jsx-a11y/no-static-element-interactions', 'backdrop dismissal, where Escape is the keyboard path'],
  ['jsx-a11y/no-noninteractive-element-interactions', 'backdrop dismissal, where Escape is the keyboard path'],
  ['jsx-a11y/label-has-associated-control', 'cannot see label text nested in child elements'],
  ['jsx-a11y/control-has-associated-label', 'cannot see button text nested in child elements'],
]

describe('accessibility lint configuration', () => {
  it('enables the plugin at all', () => {
    // Without this the file below would be a list of rules switched off inside
    // a plugin that was never switched on.
    expect(config.plugins).toContain('jsx-a11y')
  })

  it('runs `npm run lint` against this configuration', () => {
    // oxlint reads `.oxlintrc.json` from the working directory by default, so
    // the script needs no flag — but if it ever grew one that pointed
    // elsewhere, this file would be describing a config nothing loads.
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }

    expect(packageJson.scripts.lint).toBe('oxlint --deny-warnings')
    expect(packageJson.scripts.lint).not.toMatch(/--config|-c\s/)
  })

  it('switches off exactly the rules recorded here', () => {
    const offInConfig = Object.entries(config.rules ?? {})
      .filter(([, level]) => level === 'off')
      .map(([rule]) => rule)
      .sort()

    expect(
      offInConfig,
      'a rule was switched off without being recorded, or a recorded rule was ' +
        're-enabled — either way this file and .oxlintrc.json disagree',
    ).toEqual(DISABLED.map(([rule]) => rule).sort())
  })

  it('gives every disabled rule a stated conflict', () => {
    for (const [rule, conflict] of DISABLED) {
      expect(conflict.length, `${rule} is disabled without a reason`).toBeGreaterThan(25)
    }
  })

  it('keeps the reasons in the config, where the next reader is', () => {
    // The reasons above are a summary; the argument lives beside each rule.
    // A config stripped of its comments still lints, and still passes every
    // assertion above, while telling a reader nothing.
    for (const [rule] of DISABLED) {
      const name = rule.replace('jsx-a11y/', '')
      expect(
        configSource,
        `.oxlintrc.json disables ${rule} with no comment explaining it`,
      ).toMatch(new RegExp(`//[^\\n]*\\n(?:[^\\n]*\\n)*?\\s*"jsx-a11y/${name}"`))
    }
  })
})
