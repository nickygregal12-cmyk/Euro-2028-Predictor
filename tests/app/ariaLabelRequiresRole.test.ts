import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * `aria-label` only on elements allowed to carry a name.
 *
 * A `div` or `span` with no `role` has the implicit *generic* role, and ARIA
 * prohibits a name on generic. The attribute is not a harmless extra: the label
 * reaches nobody, and whatever it was describing is announced as unlabelled
 * content or not at all. axe reports it as `aria-prohibited-attr`, serious,
 * WCAG 2.0 A (4.1.2).
 *
 * Found twice, a day apart, in places no scan had looked. `LeagueTable`'s
 * movement arrows shipped as `<span aria-label="Up">▲</span>` — 54 nodes, fixed
 * on 31 July 2026. Then the first scan of `/h2h/:rivalId` and `/admin/results`
 * found the same shape again in four more components. A pattern that recurs
 * across unrelated files is a rule the codebase needs stated, not a series of
 * individual mistakes.
 *
 * The fix is always a role that permits a name — usually `role="group"` — never
 * deleting the label, because the label is the part someone meant.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

function componentFiles(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...componentFiles(full))
      continue
    }
    if (entry.name.endsWith('.tsx')) found.push(relative(repositoryRoot, full))
  }
  return found
}

/**
 * Opening `<div>`/`<span>` tags carrying `aria-label` but no `role`.
 *
 * Matched across newlines, because a multi-line JSX tag is exactly where the two
 * attributes drift far enough apart to stop looking like a pair.
 */
const OPENING_TAG = /<(div|span)(\s[^>]*?)?>/gs

function unroledLabels(source: string): string[] {
  return [...source.matchAll(OPENING_TAG)]
    .map((match) => at(match, 0))
    .filter((tag) => /\saria-label[=\s]/.test(tag) && !/\srole[=\s]/.test(tag))
    .map((tag) => tag.replace(/\s+/g, ' ').slice(0, 90))
}

/**
 * Known exceptions, each with the reason it is not fixed here.
 *
 * `H2HPage.tsx` carries `<div className={s.card} aria-label="Loading rank
 * history">`, which is the same defect. It is left alone because the Stage C1
 * branch has that file open, and a one-line accessibility fix is not worth a
 * conflict in a migration. It renders only while the panel is loading, so no
 * scan reaches it today. Remove this entry once that branch lands.
 */
const ALLOWED: ReadonlyArray<readonly [file: string, reason: string]> = [
  ['src/features/h2h/H2HPage.tsx', 'owned by the in-flight Stage C1 branch; loading-state only'],
]

const allowedFiles = ALLOWED.map(([file]) => file)

describe('aria-label is only used where a role permits it', () => {
  const files = componentFiles(resolve(repositoryRoot, 'src'))

  it('finds components to inspect, so the sweep is not vacuous', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('recognises the shape it is looking for', () => {
    // The detector's own control. Every assertion below passes when this
    // returns nothing, which a changed JSX idiom would cause.
    expect(unroledLabels('<div className={x} aria-label="Legend">')).toHaveLength(1)
    expect(unroledLabels('<div role="group" aria-label="Legend">')).toHaveLength(0)
    expect(unroledLabels('<span aria-hidden="true">▲</span>')).toHaveLength(0)
    // Multi-line tags are the case that hides the pairing from a reader.
    expect(unroledLabels('<div\n  className={x}\n  aria-label="Legend"\n>')).toHaveLength(1)
    expect(unroledLabels('<div\n  role="group"\n  aria-label="Legend"\n>')).toHaveLength(0)
  })

  it('leaves no div or span naming itself without a role', () => {
    const offenders = files
      .filter((file) => !allowedFiles.includes(file))
      .flatMap((file) =>
        unroledLabels(readFileSync(resolve(repositoryRoot, file), 'utf8')).map(
          (tag) => `${file}: ${tag}`,
        ),
      )

    expect(
      offenders,
      `ARIA prohibits a name on the generic role, so these labels reach nobody. ` +
        `Add a role that permits one — usually role="group" — rather than ` +
        `deleting the label:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('keeps the exception list honest', () => {
    for (const [file, reason] of ALLOWED) {
      // A stale exception is worse than none: it reads as a considered decision
      // while protecting a file that no longer has the problem.
      expect(files, `${file} is excepted but no longer exists`).toContain(file)
      expect(
        unroledLabels(readFileSync(resolve(repositoryRoot, file), 'utf8')).length,
        `${file} is excepted but is now clean — delete the entry`,
      ).toBeGreaterThan(0)
      expect(reason.length, `${file} is excepted without a reason`).toBeGreaterThan(20)
    }
  })
})
