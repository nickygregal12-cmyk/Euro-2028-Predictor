import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Which stylesheets still hold a value the foundations replaced.
 *
 * `foundationTokens.test.ts` proves the tokens are a coherent system. It says
 * nothing about whether anything USES them, and for a while nothing did — the
 * execution authority still claimed "nothing in production consumes the new
 * tokens" after four PRs had adopted the type scale, because no control related
 * the two. This is that control.
 *
 * It is a ratchet rather than a sweep. Every literal below is either replaced
 * or listed here with the reason it cannot be, so the list is a work queue and
 * an omission fails rather than passing quietly. A NEW literal in a stylesheet
 * that is not on the list is what this exists to catch.
 */

const repositoryRoot = process.cwd()

/**
 * The reference prototype is excluded wholesale.
 *
 * `src/premium/**` is unreachable from the application and classified as a
 * visual reference, not production code (see the modernisation execution
 * authority). Holding it to the production token system would be asking a
 * prototype to be the thing it was built to be compared against.
 */
const stylesheets = globSync('src/**/*.css', { cwd: repositoryRoot })
  .filter((path) => !path.startsWith('src/premium/'))
  .map((path) => ({ path, source: readFileSync(resolve(repositoryRoot, path), 'utf8') }))

/**
 * Stylesheets allowed to set `z-index` from a literal, each with its reason.
 *
 * The `--z-*` scale orders the layers of the APPLICATION. Two siblings inside
 * one component that must paint in a fixed order are not application layers:
 * putting them on the scale would claim they were, and collapsing both onto
 * `--z-content` would erase the only relationship they exist to express.
 */
const Z_INDEX_EXCLUSIONS: ReadonlyArray<readonly [file: string, reason: string]> = [
  [
    'src/design-system/Masthead.module.css',
    'local 0/1 pair between the decoration and the text painted over it, not an application layer',
  ],
  [
    'src/features/predict/hub.module.css',
    'local stacking of a step chip against the connector line it sits on',
  ],
  [
    'src/vnext/components/football/TeamCrest.module.css',
    'local 0/1 pair between the shirt collar drawn by ::after and the club code painted over it',
  ],
]

/**
 * Stylesheets allowed to set `font-size` from a literal, each with its reason.
 *
 * Genuinely off-scale by design, and says so in place — crest monograms that
 * must fit inside a fixed crest, and a movement triangle whose size is an icon
 * dimension that happens to be spelled `font-size`. The DEV harnesses (
 * `ComponentsPreview`, `SeasonPreview`, `SeasonLeaderboardPreview`) were the
 * other kind — chrome around the gallery, not product surface — and have since
 * been adopted onto the six-step scale, closing the last item the guard named.
 */
const FONT_SIZE_EXCLUSIONS: ReadonlyArray<readonly [file: string, reason: string]> = [
  [
    'src/design-system/ClubIdentity.module.css',
    'crest monograms sized to fit their crest — a mark that leaves its crest is worse than an unnamed size',
  ],
  [
    'src/design-system/LeagueTable.module.css',
    'a movement triangle: an icon dimension expressed as font-size, and the six steps govern text',
  ],
]

function filesHolding(pattern: RegExp): string[] {
  return stylesheets
    .filter(({ source }) =>
      source
        .split('\n')
        .some((line) => pattern.test(line) && !line.trimStart().startsWith('*')),
    )
    .map(({ path }) => path)
}

describe('foundation token adoption', () => {
  it('finds the stylesheets to check, so the sweep is not vacuous', () => {
    // A changed glob, a moved directory or a build that stops emitting CSS
    // would empty this and make every assertion below pass by checking nothing.
    expect(stylesheets.length).toBeGreaterThan(40)
    expect(stylesheets.some(({ path }) => path.includes('design-system'))).toBe(true)
  })

  it('draws every application layer from the stacking scale', () => {
    const literals = filesHolding(/z-index:\s*-?\d/)
    const allowed = Z_INDEX_EXCLUSIONS.map(([file]) => file)
    const unaccounted = literals.filter((file) => !allowed.includes(file))

    expect(
      unaccounted,
      `these stylesheets set z-index from a literal rather than the --z-* scale, ` +
        `and are not listed as local stacking: ${unaccounted.join(', ')}`,
    ).toEqual([])
  })

  it('draws every text size from the six-step scale', () => {
    // `font-size: 0` is a hiding technique rather than a size, and `var(...)`
    // is the adopted form — neither is a literal step.
    const literals = filesHolding(/font-size:\s*(?!0;)\d*\.?\d+(px|rem|em)/)
    const allowed = FONT_SIZE_EXCLUSIONS.map(([file]) => file)
    const unaccounted = literals.filter((file) => !allowed.includes(file))

    expect(
      unaccounted,
      `these stylesheets set font-size from a literal rather than --fs-*: ` +
        `${unaccounted.join(', ')}`,
    ).toEqual([])
  })

  it('keeps both exclusion lists honest — nothing listed has been cleaned up', () => {
    // An exclusion for a file that no longer holds a literal makes the
    // remaining work look larger than it is, which is how a work queue turns
    // into a permanent exemption nobody revisits.
    const zStale = Z_INDEX_EXCLUSIONS.map(([file]) => file).filter(
      (file) => !filesHolding(/z-index:\s*-?\d/).includes(file),
    )
    const fsStale = FONT_SIZE_EXCLUSIONS.map(([file]) => file).filter(
      (file) => !filesHolding(/font-size:\s*(?!0;)\d*\.?\d+(px|rem|em)/).includes(file),
    )

    expect(zStale, 'z-index exclusions that no longer hold a literal').toEqual([])
    expect(fsStale, 'font-size exclusions that no longer hold a literal').toEqual([])
  })

  it('gives every exclusion a reason', () => {
    for (const [file, reason] of [...Z_INDEX_EXCLUSIONS, ...FONT_SIZE_EXCLUSIONS]) {
      expect(reason.length, `${file} is excluded without a reason`).toBeGreaterThan(20)
    }
  })

  it('routes every transition through the motion tokens', () => {
    // The four durations describe entering, leaving and changing state. A
    // looping spinner, shimmer or pulse is none of those, and forcing a 1.4s
    // ambient loop onto a 240ms token would be adoption for its own sake — so
    // this checks the transitions rather than the animations. ProgressBar's
    // width fill was the last one still timed from a literal (0.3s); it now
    // uses --duration-sheet, so this list is empty rather than naming one file.
    const rawTransitions = stylesheets.filter(({ path, source }) =>
      source
        .split('\n')
        .some(
          (line) =>
            /transition:[^;]*\d+m?s/.test(line) &&
            !line.includes('var(--duration') &&
            !path.endsWith('tokens.css'),
        ),
    )

    expect(
      rawTransitions.map(({ path }) => path),
      'transitions timed from a literal rather than --duration-*',
    ).toEqual([])
  })
})
