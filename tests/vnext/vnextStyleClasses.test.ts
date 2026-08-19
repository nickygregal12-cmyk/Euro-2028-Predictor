import { readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { globSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * EVERY `styles.…` A vNEXT COMPONENT NAMES MUST EXIST IN THE MODULE IT CAME
 * FROM.
 *
 * ============================ WHY THIS IS INVISIBLE OTHERWISE ============
 *
 * A CSS module resolves an unknown key to `undefined`, and `${styles.thing}`
 * in a template literal renders the literal string "undefined" as a class
 * name. Nothing throws. Nothing warns. TypeScript cannot help, because the
 * module's type is a string index signature. The element simply loses its
 * styling and gains a class nobody wrote — and every gate in this repository
 * passes: lint, typecheck, the unit suites, the axe scan and the browser
 * suite all agree the markup is fine, because it IS fine. Only the picture is
 * wrong, and only for the one state that reaches that branch.
 *
 * This started as a typography-only scan, written when a review found
 * `text.h2` — a class the typography module has never declared — live in the
 * Championship's group heading. Generalising it to every module found two more
 * on the first run, both in surfaces that had already shipped:
 *
 *   • `styles.heroScore` in the Match Centre, so the HEADLINE SCORE lost its
 *     display font, its weight, its size and its `white-space: nowrap` and
 *     rendered as body text;
 *   • `styles.pickResult` in Last Man Standing, so the one paragraph saying
 *     what a submitted pick did kept the browser's default margins while every
 *     sibling paragraph in that module resets them.
 *
 * ============================ WHY IT READS THE SOURCE ====================
 *
 * The mistake is made in the source and is invisible in the DOM — "undefined"
 * is a perfectly ordinary class name to a renderer. Rendering every component
 * in every state to catch it would be a worse test that covered less.
 *
 * IMPORT LINES ARE STRIPPED FIRST, and that is not incidental: an import path
 * like `'../foundations/typography.module.css'` contains the literal text
 * `typography.module`, which a naive scan reads as a use of a `module` class on
 * an identifier named `typography`. The first version of this scan reported 45
 * false positives for exactly that reason.
 */

const ROOT = process.cwd()

/** Local class selectors, which is what a CSS module exports. */
function declaredClasses(cssPath: string): Set<string> | null {
  try {
    return new Set(
      [...readFileSync(cssPath, 'utf8').matchAll(/\.([A-Za-z_][\w-]*)/g)].map(
        (match) => match[1] as string,
      ),
    )
  } catch {
    return null
  }
}

type Use = { file: string; ident: string; name: string; css: string }

const sources = [
  ...globSync('src/vnext/**/*.{ts,tsx}', { cwd: ROOT }),
  ...globSync('src/dev/**/*.{ts,tsx}', { cwd: ROOT }),
]

const uses: Use[] = []
const missingStylesheets: string[] = []

for (const file of sources) {
  const source = readFileSync(join(ROOT, file), 'utf8')
  // See the header: the import block must go before anything is counted.
  const body = source.replace(/^import[^\n]*\n/gm, '')

  for (const match of source.matchAll(
    /import\s+(\w+)\s+from\s+'([^']+\.module\.css)'/g,
  )) {
    const ident = match[1] as string
    const cssPath = normalize(join(dirname(join(ROOT, file)), match[2] as string))
    const declared = declaredClasses(cssPath)
    if (declared === null) {
      missingStylesheets.push(`${file}: ${match[2]}`)
      continue
    }
    for (const used of new Set(
      [...body.matchAll(new RegExp(`\\b${ident}\\.([A-Za-z_]\\w*)`, 'g'))].map(
        (hit) => hit[1] as string,
      ),
    )) {
      if (!declared.has(used)) {
        uses.push({ file, ident, name: used, css: relative(ROOT, cssPath) })
      }
    }
  }
}

describe('every CSS module class the vNext lane names actually exists', () => {
  it('found modules and call sites at all, so the scan cannot pass vacuously', () => {
    const scanned = sources.filter((file) =>
      readFileSync(join(ROOT, file), 'utf8').includes(".module.css'"),
    )
    expect(scanned.length).toBeGreaterThan(40)
  })

  it('imports no stylesheet that does not exist', () => {
    expect(missingStylesheets, missingStylesheets.join('\n')).toEqual([])
  })

  it('names no class its stylesheet does not declare', () => {
    expect(
      uses,
      uses.map((use) => `${use.file}: ${use.ident}.${use.name} — not in ${use.css}`).join('\n'),
    ).toEqual([])
  })
})
