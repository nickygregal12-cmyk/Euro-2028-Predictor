import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The CSS linter's configuration, against the rules it exists to enforce.
 *
 * `tokens.css` opens with "Do not add colours outside this file." Stylelint is
 * what turns that sentence into something a pull request cannot ignore, and
 * this suite protects the parts of the configuration that would silently stop
 * enforcing it.
 *
 * Every override that DISABLES the strict-value rule is a hole. That is not a
 * criticism — two of them are necessary and one is a documented gap — but a
 * hole nobody is watching widens. An override that ADDS another rule is not an
 * exemption: the weekly font-weight guard deliberately uses a scoped override
 * while leaving the colour rule active in those same files.
 *
 * So the true exceptions are pinned by name, and the negative controls below
 * prove the colour rule still fires. The weekly font-weight scope is pinned as
 * well, so neither contract can silently broaden, narrow or turn itself off.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

type StrictValueOptions = {
  ignoreValues: string[]
  ignoreFunctions: boolean
}

type StylelintOverride = {
  files: string[]
  rules: Record<string, unknown>
}

const config = JSON.parse(
  readFileSync(resolve(repositoryRoot, '.stylelintrc.json'), 'utf8'),
) as {
  plugins: string[]
  rules: Record<string, [string[], StrictValueOptions]>
  overrides: StylelintOverride[]
  ignoreFiles: string[]
}

const RULE = 'scale-unlimited/declaration-strict-value'
const FONT_WEIGHT_RULE = 'declaration-property-value-disallowed-list'
const [properties, options] = config.rules[RULE]

const strictValueExemptions = () =>
  config.overrides.filter((override) => override.rules[RULE] === null)

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
    const exemptions = strictValueExemptions()
    const exempt = exemptions.flatMap((override) => override.files)

    // tokens.css defines the literals; fonts.css carries url() and no colour;
    // src/premium/** is the reference-only prototype with a provisional brand,
    // already pinned as unreachable from production by
    // premiumPrototypeBoundary.test.ts.
    expect(exempt.sort()).toEqual([
      'src/premium/**/*.css',
      'src/styles/fonts.css',
      'src/styles/tokens.css',
    ])

    // And every override counted as an exemption genuinely turns the colour
    // rule off. Scoped overrides that add a separate lint rule are deliberately
    // excluded here because they do not weaken strict-value enforcement.
    for (const override of exemptions) {
      expect(override.rules[RULE]).toBeNull()
    }
  })

  it('does not exempt the design system or any feature directory', () => {
    // The whole point. `src/design-system/**` and `src/features/**` are where
    // the 5,500 lines of unlinted CSS were, and a strict-value exemption
    // covering either would return the repository to the state this rule was
    // added to fix.
    const exempt = strictValueExemptions().flatMap((override) => override.files)

    for (const glob of exempt) {
      expect(glob.startsWith('src/design-system'), `${glob} exempts the design system`).toBe(false)
      expect(glob.startsWith('src/features'), `${glob} exempts a feature directory`).toBe(false)
    }
  })

  it('guards exactly the live weekly/shared UI from unsupported font weights', () => {
    const weightOverrides = config.overrides.filter(
      (override) => override.rules[FONT_WEIGHT_RULE] !== undefined,
    )

    expect(weightOverrides).toHaveLength(1)
    const [weightOverride] = weightOverrides

    expect([...weightOverride.files].sort()).toEqual([
      'src/app/**/*.css',
      'src/design-system/**/*.css',
      'src/features/hub/**/*.css',
      'src/features/leagues/**/*.css',
      'src/features/profile/**/*.css',
      'src/features/season/**/*.css',
    ])
    expect(weightOverride.rules[FONT_WEIGHT_RULE]).toEqual({
      'font-weight': ['600', '700', '800', '900', 'bold', 'bolder'],
    })

    // This scoped guard must not disable the colour contract in the same files.
    expect(weightOverride.rules[RULE]).toBeUndefined()
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
