import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { globSync } from 'node:fs'
import { at } from '../support/indexed'

/**
 * `--mut` is a surface. It may not be used as a text colour.
 *
 * The token matrix in `tokenContrast.test.ts` measures three text tokens against
 * five surfaces, and `--mut` is one of the five. Used as a foreground it is a
 * surface against a surface: `--mut` on `--card` measures **1.39:1** and on
 * `--bg` **1.58:1**, against a 4.5:1 minimum. Not a near miss — barely visible.
 *
 * `LeagueTable` did exactly this in five rules, so its position numbers, its
 * played/goal-difference values, its column headers, its split divider and its
 * zone legend all rendered at 1.39:1. It shipped that way because nothing was
 * in a position to notice:
 *
 *   - the browser scan visits declared routes, and `LeagueTable` is not on one
 *     yet — it was built ahead of the season surfaces that will use it;
 *   - the jsdom component gallery renders it, but jsdom computes no colours, so
 *     axe skips `color-contrast` there entirely;
 *   - `cssTokenPairings.test.ts` sweeps `background` and `color` declared in the
 *     *same rule*, and these rules declare only `color` — the surface they land
 *     on comes from an ancestor.
 *
 * Three contrast controls, and the pairing fell between all of them. This closes
 * that gap from the other side: rather than trying to work out what surface a
 * rule sits on, it forbids the one token that cannot be a foreground anywhere.
 *
 * The single exception is an inactive control. WCAG 1.4.3 exempts those, and
 * `TieResolver`'s `.moveBtn:disabled` uses `--mut` deliberately to read as
 * unavailable.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

const styleSheets = globSync('src/**/*.css', { cwd: repositoryRoot }).sort()

/** `color: var(--mut)` declarations, with the selector they sit under. */
function mutedForegrounds(): { file: string; selector: string; line: number }[] {
  const found: { file: string; selector: string; line: number }[] = []

  for (const file of styleSheets) {
    const lines = readFileSync(resolve(repositoryRoot, file), 'utf8').split('\n')
    let selector = '(none)'

    lines.forEach((line, index) => {
      // Track the most recent selector. Good enough for this codebase's flat
      // CSS modules, and a nested rule would still name its own selector here.
      const opening = line.match(/^([^{}]+)\{\s*$/)
      if (opening) selector = at(opening, 1).trim()

      // `border-color`/`outline-color` are not foregrounds; require a boundary.
      if (/(^|[^-])color:\s*var\(--mut\)/.test(line)) {
        found.push({ file, selector, line: index + 1 })
      }
    })
  }

  return found
}

describe('the muted surface token is never a foreground', () => {
  it('reads the stylesheets, so the sweep is not vacuous', () => {
    // A changed glob or a moved directory would otherwise make the assertion
    // below pass by examining nothing at all.
    expect(styleSheets.length).toBeGreaterThan(30)
    expect(styleSheets.some((file) => file.includes('LeagueTable'))).toBe(true)
  })

  it('finds `color: var(--mut)` where it exists', () => {
    // Positive control for the matcher itself. `TieResolver` is the one
    // legitimate use, so if this returns nothing the regex has stopped working
    // and the assertion below is enforcing nothing.
    const all = mutedForegrounds()
    expect(all.length).toBeGreaterThan(0)
    expect(all.some((use) => use.file.includes('TieResolver'))).toBe(true)
  })

  it('allows it only on an inactive control', () => {
    const offenders = mutedForegrounds()
      .filter((use) => !use.selector.includes(':disabled'))
      .map((use) => `${use.file}:${use.line} — ${use.selector}`)

    expect(
      offenders,
      '`--mut` is a surface token: as a foreground it measures 1.39:1 on --card ' +
        'and 1.58:1 on --bg, against a 4.5:1 minimum. Use --tx3 for supporting ' +
        `text. Only a :disabled control may use it:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
