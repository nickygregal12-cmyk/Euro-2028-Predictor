import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { globSync } from 'node:fs'

/**
 * EVERY `text.…` A vNEXT COMPONENT NAMES MUST EXIST IN THE TYPOGRAPHY MODULE.
 *
 * A CSS module resolves an unknown key to `undefined`, and `${text.h2}` in a
 * template literal renders the literal string "undefined" as a class name. It
 * does not throw, it does not warn, and it does not fail a snapshot — the
 * element simply loses its typography and gains a class nobody styled. Two of
 * them were live in this lane: `text.h2` in the Championship's group heading,
 * and `text.h2 ?? text.title` in Account, which reads as though a preferred
 * style existed and always fell through.
 *
 * The scan is over the source rather than the DOM because that is where the
 * mistake is made, and because a rendered `class="undefined"` is invisible to
 * every other gate the repository runs.
 */

const TYPOGRAPHY = join(process.cwd(), 'src', 'vnext', 'foundations', 'typography.module.css')

const declared = new Set(
  [...readFileSync(TYPOGRAPHY, 'utf8').matchAll(/^\.([A-Za-z][\w-]*)/gm)].map(
    (match) => match[1] as string,
  ),
)

const sources = globSync('src/vnext/**/*.{ts,tsx}', { cwd: process.cwd() })
  .map((file) => ({ file, source: readFileSync(join(process.cwd(), file), 'utf8') }))
  .filter((entry) => /from '.*foundations\/typography\.module\.css'/.test(entry.source))

const used = sources.flatMap((entry) =>
  [...entry.source.matchAll(/\btext\.([A-Za-z]\w*)/g)].map((match) => ({
    file: entry.file,
    name: match[1] as string,
  })),
)

describe('the typography module has every class the lane asks it for', () => {
  it('found classes and call sites at all, so the scan cannot pass vacuously', () => {
    expect(declared.size).toBeGreaterThan(10)
    expect(sources.length).toBeGreaterThan(10)
    expect(used.length).toBeGreaterThan(50)
    expect(declared.has('title')).toBe(true)
  })

  it('names no class the stylesheet does not declare', () => {
    const missing = used.filter((entry) => !declared.has(entry.name))
    expect(
      missing,
      missing.map((entry) => `${entry.file}: text.${entry.name}`).join('\n'),
    ).toEqual([])
  })
})
