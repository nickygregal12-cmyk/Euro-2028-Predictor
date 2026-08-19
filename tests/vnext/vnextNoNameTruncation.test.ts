import { readFileSync, globSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * NO NAME IN THIS LANE IS EVER CLIPPED, AND NOW SOMETHING CHECKS.
 *
 * ============================ WHY THIS EXISTS ============================
 *
 * Seven screen-level stylesheets say it in capitals — "NO DISPLAY NAME IS EVER
 * CLIPPED" (`leagues.module.css`), "NO CLUB NAME IS CLIPPED ANYWHERE IN THIS
 * FILE" (`matches.module.css`), "A truncated name is the defect"
 * (`playerProfile.module.css`) — and two story files repeat it as an assertion
 * a reviewer is meant to check by eye. It was, nonetheless, false.
 *
 * `typography.module.css` carried a `.truncate` helper — `white-space: nowrap`
 * plus `text-overflow: ellipsis` — and its ONLY three consumers were the three
 * places the doctrine is about:
 *
 *   • `RivalStrip`, a rival's display name;
 *   • `RivalStrip`, that rival's shared league name;
 *   • `LeagueLadder`, a ladder row's player name.
 *
 * A long name in any of them was cut at one line with no second line, no
 * wrapping, and no way for a pointer or a keyboard to recover the rest — the
 * failure mode the surrounding stylesheets each independently refuse. Nothing
 * caught it: the class was declared, the key existed, so the style-class scan
 * was satisfied; axe has no rule for it; and no story rendered a name long
 * enough for the browser suite to notice.
 *
 * ============================ WHAT IT ASSERTS ===========================
 *
 * That the lane's shared typography offers no single-line clipping helper at
 * all. `.clamp2` remains and is what every other name in the lane already uses:
 * it wraps, carries `overflow-wrap: anywhere` so one long word cannot widen a
 * card, and only then clamps.
 *
 * The rule is written against the SHARED module rather than against component
 * source, because that is where the reach was. A local stylesheet that needs a
 * genuine one-line clip for something that is NOT a name — a monospaced id, a
 * URL — can still declare one, and a reviewer will see it in the diff of the
 * file that owns it instead of inheriting it silently from foundations.
 */

const root = resolve(import.meta.dirname, '../..')
const typography = readFileSync(
  resolve(root, 'src/vnext/foundations/typography.module.css'),
  'utf8',
)

/** Declarations, ignoring prose: comments are stripped before matching. */
function declarations(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('vNext refuses to clip a name', () => {
  it('offers no single-line clipping helper in shared typography', () => {
    // `.srOnly` IS THE ONE EXEMPTION, and it is exempt for the opposite reason.
    // It carries `white-space: nowrap` as part of the standard visually-hidden
    // pattern, on a 1px box that is already clipped out of the picture — it
    // cuts nothing a sighted reader can see, and its whole purpose is to give a
    // screen reader the full string. Asserting a blanket ban on `nowrap` failed
    // here on the first run, and correcting the test rather than the helper is
    // the point: the defect was never the property, it was clipping A NAME.
    const rules = declarations(typography).matchAll(/([^{}]+)\{([^{}]*)\}/g)
    const offenders: string[] = []
    for (const [, selectorText, body] of rules) {
      const selector = (selectorText ?? '').trim()
      if (selector === '.srOnly') continue
      if (/text-overflow:\s*(?!clip\b)/.test(body ?? '')) {
        offenders.push(`${selector} declares text-overflow`)
      }
      if (/white-space:\s*nowrap/.test(body ?? '')) {
        offenders.push(`${selector} declares white-space: nowrap`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('still offers the wrapping helper the lane actually uses', () => {
    const css = declarations(typography)
    expect(css).toMatch(/\.clamp2\s*\{/)
    expect(css).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('has no component reaching for a clipping helper that no longer exists', () => {
    // `styles.undefined` renders the literal string "undefined" as a class and
    // nothing throws, so a stale `typography.truncate` would be silent.
    const offenders: string[] = []
    for (const file of globSync('src/vnext/**/*.tsx', { cwd: root })) {
      const source = readFileSync(resolve(root, file), 'utf8')
      if (/typography\.truncate\b/.test(source)) {
        offenders.push(relative(root, file))
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
