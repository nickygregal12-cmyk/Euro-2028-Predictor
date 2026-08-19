import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * NO EMOJI IN THE vNEXT UI.
 *
 * `src/design-system/icons.tsx` opens with the rule — *"SVG only — no emoji
 * anywhere in the UI"* — and it was the only thing enforcing it, by convention,
 * in a module the vNext lane is forbidden to import. So the lane drifted: a
 * trophy in the Championship and in Last Man Standing, a stopwatch on the
 * primary action card and a tick in onboarding, each added by a different
 * stage that had no icon to reach for. `DEC-017` predicted exactly that —
 * "where one is otherwise improvised one component at a time" — and this is the
 * gate that stops it recurring now the lane has `foundations/VNextIcon.tsx`.
 *
 * WHAT IS AND IS NOT BANNED. Emoji and pictographs are banned: they render in a
 * different typeface on every platform, carry a colour no token chose, and are
 * announced by their unicode name.
 *
 * GEOMETRIC DATA MARKS ARE NOT. `RankMovementIndicator` draws `▲ ▼ – ★`, and
 * its own docblock defends them: the triangle points the way the rank went, the
 * number says how far, and a screen reader gets a sentence. Those are marks
 * carrying a datum, in one consistent set, not pictures standing in for icons —
 * so they are allowed by name rather than by an accident of which unicode block
 * they fall in.
 */

const ALLOWED_MARKS = new Set(['▲', '▼', '★', '–', '—', '−', '·', '…', '×', '←', '→'])

/** Emoji, pictographs, dingbats and the miscellaneous-symbol blocks. */
function isPictograph(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  return (
    (code >= 0x1f000 && code <= 0x1ffff) || // emoji and pictographs
    (code >= 0x2600 && code <= 0x27bf) || // misc symbols and dingbats
    (code >= 0x2b00 && code <= 0x2bff) || // arrows and geometric extras
    code === 0xfe0f // variation selector-16, which makes a glyph emoji
  )
}

const files = [
  ...globSync('src/vnext/**/*.{ts,tsx}', { cwd: process.cwd() }),
  ...globSync('src/dev/VNext*.tsx', { cwd: process.cwd() }),
]

describe('the vNext lane draws icons, it does not type them', () => {
  it('scans a real set of files, so it cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(80)
  })

  it('contains no emoji or pictograph in any source file', () => {
    const hits: string[] = []
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      const lines = source.split('\n')
      lines.forEach((line, index) => {
        for (const ch of line) {
          if (ALLOWED_MARKS.has(ch)) continue
          if (isPictograph(ch)) {
            hits.push(`${file}:${index + 1} — ${JSON.stringify(ch)}`)
          }
        }
      })
    }
    expect(
      hits,
      `use foundations/VNextIcon.tsx instead:\n${hits.join('\n')}`,
    ).toEqual([])
  })
})
