import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The design-system document's token table against `tokens.css`.
 *
 * `tokens.css` opens by naming `docs/design-system.md` as its source of truth
 * and forbidding colours defined anywhere else. The document returns the favour
 * with a table of every token and its value per theme. Nothing checked that the
 * two agreed.
 *
 * They stopped agreeing on 31 July 2026. Three token values were changed and one
 * was added to clear WCAG AA, and the table kept the old numbers through the
 * whole change — including the row for a token that had just been introduced,
 * which simply was not there. The document that a reader consults to learn the
 * palette described a palette that no longer existed, and every gate stayed
 * green because no gate was looking.
 *
 * This is the same shape the accessibility work kept finding: a hand-maintained
 * list asserting something about the code, with no link back to it. The fix is
 * the same one — relate the two and make disagreement fail.
 *
 * Both directions matter. A row whose value has drifted is the stale case; a
 * token in `tokens.css` with no row is the undocumented case, which is how
 * `--gold-strong` would otherwise have entered the palette unannounced.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const tokensCss = readFileSync(resolve(repositoryRoot, 'src/styles/tokens.css'), 'utf8')
const designSystemDoc = readFileSync(resolve(repositoryRoot, 'docs/design-system.md'), 'utf8')

/** Hex-valued custom properties inside one theme block. */
function theme(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(selector)
  if (start === -1) throw new Error(`tokens.css has no ${selector} block`)

  const body = tokensCss.slice(start, tokensCss.indexOf('}', start))
  const values: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    values[name] = value.toUpperCase()
  }
  return values
}

// The opening brace matters — without it the light selector matches the file's
// header comment. `tokenContrast.test.ts` records how that went unnoticed.
const dark = theme(':root,')
const light = theme('[data-theme="light"] {')

/**
 * `| \`--name\` | purpose | \`#dark\` | \`#light\` |` rows from the token table.
 *
 * Only rows carrying two hex values are read, so prose tables elsewhere in the
 * document cannot be mistaken for palette rows.
 */
const documentedTokens = [
  ...designSystemDoc.matchAll(
    /\|\s*`--([a-z0-9-]+)`\s*\|[^|]*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|/g,
  ),
].map((match) => ({
  name: match[1],
  dark: match[2].toUpperCase(),
  light: match[3].toUpperCase(),
}))

describe('design-system token table', () => {
  it('reads both sides, so nothing below compares empty sets', () => {
    // A reformatted table or a renamed theme selector would empty one side and
    // make every assertion below pass by comparing nothing to nothing.
    expect(documentedTokens.length).toBeGreaterThan(10)
    expect(Object.keys(dark).length).toBeGreaterThan(10)
    expect(Object.keys(light).length).toBeGreaterThan(10)
  })

  it('documents each token with the value tokens.css actually defines', () => {
    const drifted = documentedTokens
      .filter((token) => dark[token.name] !== token.dark || light[token.name] !== token.light)
      .map(
        (token) =>
          `--${token.name}: doc says ${token.dark}/${token.light}, ` +
          `tokens.css says ${dark[token.name] ?? 'absent'}/${light[token.name] ?? 'absent'}`,
      )

    expect(
      drifted,
      `the design system document is the stated source of truth for colour, so ` +
        `a row that disagrees with tokens.css is worse than no row:\n${drifted.join('\n')}`,
    ).toEqual([])
  })

  it('documents every token tokens.css defines', () => {
    const undocumented = Object.keys(dark).filter(
      (name) => !documentedTokens.some((token) => token.name === name),
    )

    expect(
      undocumented,
      `these are defined in tokens.css with no row in the design system's token ` +
        `table, so the palette grew without being written down: ${undocumented.join(', ')}`,
    ).toEqual([])
  })

  it('defines every documented token in both themes', () => {
    // The reverse orphan: a row for a token that has been deleted, which reads
    // as available and is not.
    const missing = documentedTokens
      .filter((token) => !dark[token.name] || !light[token.name])
      .map((token) => `--${token.name}`)

    expect(missing, 'documented tokens absent from tokens.css').toEqual([])
  })
})
