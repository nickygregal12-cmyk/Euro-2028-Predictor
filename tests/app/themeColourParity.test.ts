import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { documentHeadTags } from '../../src/app/site/documentMetadata'
import { THEME_COLOUR } from '../../src/app/site/siteIcons'
import { sitePublicMetadata } from '../../src/app/site/sitePublicMetadata'
import { webAppManifest } from '../../src/app/site/webAppManifest'

/**
 * The browser chrome, the installed window and the page are the same colour.
 *
 * WHY THIS TEST EXISTS RATHER THAN A COMMENT ASKING PEOPLE TO REMEMBER. There
 * were two copies of these hexes — one in the `theme-color` metas and one in
 * `ThemeProvider`, which rewrites those metas when a player switches theme —
 * and each carried a comment saying to keep it in step with `--bg` in
 * `tokens.css`. Both said `#0A1128`. `--bg` has resolved through
 * `--surface-page` to `--n-1` since the neutral ramp landed, which is a
 * different colour, so the status bar on a phone had been a shade off the page
 * beneath it. A manifest needs the same value a third time, as the colour of an
 * installed application's window and of the screen behind its first paint, so
 * the copy is now singular and this reads the stylesheet rather than trusting
 * anybody's memory.
 */

const tokens = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

/**
 * `--n-1` under one theme selector.
 *
 * The ramp declares the token twice, once for dark and once for light, and the
 * dark block comes first. Slicing at the light SELECTOR is what keeps the two
 * apart without parsing CSS — anchored to the start of a line, because the
 * file's own header comment mentions the selector before it uses it.
 */
function neutralOne(theme: 'dark' | 'light'): string {
  const lightAt = tokens.search(/^\[data-theme="light"\]/m)
  expect(lightAt).toBeGreaterThan(0)
  const block = theme === 'dark' ? tokens.slice(0, lightAt) : tokens.slice(lightAt)
  const match = block.match(/--n-1:\s*(#[0-9A-Fa-f]{6})/)
  expect(match).not.toBeNull()
  return match![1]!.toUpperCase()
}

describe('one theme colour, read from the stylesheet that owns it', () => {
  it('matches the page background in both themes', () => {
    expect(THEME_COLOUR.dark.toUpperCase()).toBe(neutralOne('dark'))
    expect(THEME_COLOUR.light.toUpperCase()).toBe(neutralOne('light'))
  })

  it('is what the document head publishes', () => {
    const tags = documentHeadTags(sitePublicMetadata('hub')).join('\n')
    expect(tags).toContain(
      `<meta name="theme-color" content="${THEME_COLOUR.dark}" media="(prefers-color-scheme: dark)" />`,
    )
    expect(tags).toContain(
      `<meta name="theme-color" content="${THEME_COLOUR.light}" media="(prefers-color-scheme: light)" />`,
    )
  })

  it('is what the installed application is painted in', () => {
    const manifest = webAppManifest(sitePublicMetadata('hub'))
    expect(manifest.theme_color).toBe(THEME_COLOUR.dark)
    // The launch screen uses the dark value in both themes on purpose: it is
    // shown before the application can read the player's stored choice, and a
    // light flash before a dark interface is worse than a consistent dark one.
    expect(manifest.background_color).toBe(THEME_COLOUR.dark)
  })
})
