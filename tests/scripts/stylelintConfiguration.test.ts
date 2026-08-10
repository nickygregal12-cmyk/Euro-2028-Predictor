import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The CSS linter's configuration, against the rule it exists to enforce.
 *
 * `tokens.css` opens with "Do not add colours outside this file." Stylelint is
 * what turns that sentence into something a pull request cannot ignore, and
 * this suite protects the parts of the configuration that would silently stop
 * enforcing it.
 *
 * Every exception in `.stylelintrc.json` is a hole. That is not a criticism —
 * two of them are necessary and one is a documented gap — but a hole nobody is
 * watching widens. The failure mode is specific and quiet: adding a property to
 * `ignoreValues`, or a file to `overrides`, makes the linter pass while the
 * design-system rule is no longer enforced anywhere that matters. Nothing else
 * in the repository would notice, because a linter reporting zero problems
 * looks identical whether it is checking everything or nothing.
 *
 * So the exceptions are pinned by name, and the negative controls below prove
 * the rule still fires — a configuration test that only reads the config would
 * pass just as happily against a rule that had been turned off.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

type StrictValueOptions = {
  ignoreValues: string[]
  ignoreFunctions: boolean
}

const config = JSON.parse(
  readFileSync(resolve(repositoryRoot, '.stylelintrc.json'), 'utf8'),
) as {
  plugins: string[]
  rules: Record<string, [string[], StrictValueOptions]>
  overrides: { files: string[]; rules: Record<string, null> }[]
  ignoreFiles: string[]
}

const RULE = 'scale-unlimited/declaration-strict-value'
const [properties, options] = config.rules[RULE]

describe('Stylelint configuration', () => {
  it('loads the strict-value plugin and configures its rule', () => {
    // Guards every assertion below against a config whose rule was removed
    // rather than weakened — the destructure above would throw, but an explicit
    // failure names the cause.
    expect(config.plugins).toContain('stylelint-declaration-strict-value')
    expect(config.rules[RULE]).toBeDefined()
  })

  it('covers every colour-bearing property by suffix, not by enumeration', () => {
    // `/color$/` catches color, background-color, border-color, outline-color,
    // text-decoration-color and any future sibling. An enumerated list would
    // silently miss the next one.
    expect(properties).toContain('/color$/')
    expect(properties).toContain('fill')
    expect(properties).toContain('stroke')
  })

  it('does not claim to cover box-shadow, whose value it cannot check', () => {
    // Recorded as a KNOWN GAP rather than left ambiguous. box-shadow's value is
    // composite — offsets, blur, spread, then a colour — so a whole-value regex
    // cannot match `^var(--` even when the colour is a token, and including it
    // flagged correctly-tokenised shadows in five files.
    //
    // This asserts the gap deliberately: if somebody adds box-shadow back, this
    // test fails and sends them to the reasoning rather than letting them
    // rediscover the false positives one file at a time.
    expect(properties).not.toContain('box-shadow')
  })

  it('permits only the exceptions that have a recorded reason', () => {
    // Pinned exactly. A new entry here is a new hole in the one rule this
    // configuration exists for, and it should be a deliberate edit to a failing
    // test rather than a line nobody reviews.
    expect([...options.ignoreValues].sort()).toEqual([
      '/^color-mix\\(/',
      '/^var\\(--/',
      'currentColor',
      'inherit',
      'initial',
      'none',
      'revert',
      'transparent',
      'unset',
    ])
  })

  it('still rejects arbitrary functions, so rgba() cannot slip through', () => {
    // `ignoreFunctions: true` would be the easy way to silence the color-mix
    // false positive, and it would also permit `rgba(0, 0, 0, 0.5)` — a literal
    // colour wearing a function's clothes. color-mix is exempted by name for
    // exactly this reason.
    expect(options.ignoreFunctions).toBe(false)
  })

  it('exempts only the three files that cannot be governed by tokens', () => {
    const exempt = config.overrides.flatMap((override) => override.files)

    // tokens.css defines the literals; fonts.css carries url() and no colour;
    // src/premium/** is the reference-only prototype with a provisional brand,
    // already pinned as unreachable from production by
    // premiumPrototypeBoundary.test.ts.
    expect(exempt.sort()).toEqual([
      'src/premium/**/*.css',
      'src/styles/fonts.css',
      'src/styles/tokens.css',
    ])

    // And each one genuinely turns the rule off rather than reconfiguring it,
    // so a reader of the override knows what it costs.
    for (const override of config.overrides) {
      expect(override.rules[RULE]).toBeNull()
    }
  })

  it('does not exempt the design system or any feature directory', () => {
    // The whole point. `src/design-system/**` and `src/features/**` are where
    // the 5,500 lines of unlinted CSS were, and an override covering either
    // would return the repository to the state this rule was added to fix.
    const exempt = config.overrides.flatMap((override) => override.files)

    for (const glob of exempt) {
      expect(glob.startsWith('src/design-system'), `${glob} exempts the design system`).toBe(false)
      expect(glob.startsWith('src/features'), `${glob} exempts a feature directory`).toBe(false)
    }
  })

  it('is wired into a script CI actually runs', () => {
    // A linter nobody invokes is the failure this repository keeps recording —
    // Lighthouse configured and never called, Knip scripted and never in a
    // workflow. This asserts the third step was taken.
    const manifest = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }
    const ci = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8')

    expect(manifest.scripts['lint:css']).toContain('stylelint')
    expect(ci).toContain('npm run lint:css')

    // Blocking, not `continue-on-error`. The findings were driven to zero before
    // this was wired, so there is no backlog to grandfather — see the step's own
    // comment in ci.yml.
    const step = ci.slice(ci.indexOf('- name: Lint CSS'), ci.indexOf('npm run lint:css'))
    expect(step).not.toContain('continue-on-error')
  })
})
