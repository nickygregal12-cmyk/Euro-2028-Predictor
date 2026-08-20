import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every `var(--token)` in the stylesheets resolves to something that exists.
 *
 * A CSS CUSTOM PROPERTY THAT IS NOT DEFINED FAILS SILENTLY, which is the whole
 * reason this file exists. `border-radius: var(--radius-md)` with no
 * `--radius-md` anywhere is not an error, not a warning and not a build
 * failure — the declaration is simply invalid at computed-value time and the
 * element gets the initial value. A rounded card renders square, a tinted row
 * renders transparent, and nothing anywhere says so.
 *
 * MEASURED RATHER THAN SUPPOSED. When this guard was first run it found five
 * live sites using `--radius-md`, a radius token this design system has never
 * had — the three it has are `--radius-card`, `--radius-input` and
 * `--radius-pill` — plus `--sf`, `--sf2` and `--ln` in a preview harness,
 * which are the shorthand names an earlier palette used for `--card`, `--chip`
 * and `--line`. All eight had been reviewed and merged. `foundationTokens`
 * proves the tokens that exist are coherent; nothing proved a stylesheet asked
 * only for tokens that exist, and those are different facts.
 *
 * A FALLBACK IS NOT A MISS. `var(--x, 8px)` is a deliberate default and is
 * accepted: the author has said what happens when the token is absent.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

/**
 * Custom properties no stylesheet defines, on purpose, because a COMPONENT sets
 * them inline per instance. Listing them by name keeps the guard honest — a
 * typo'd fourth one still fails — and each is checked below against the
 * component that supplies it, so the exemption cannot outlive its reason.
 */
const SET_INLINE: Record<string, string> = {
  '--club-primary': 'src/design-system/ClubIdentity.tsx',
  '--club-secondary': 'src/design-system/ClubIdentity.tsx',
  '--club': 'src/premium/PremiumApp.tsx',
  '--mode-accent': 'src/premium/PremiumApp.tsx',
  '--progress': 'src/premium/PremiumApp.tsx',
  // The vNext workshop's device frames: a width, a height and a display scale
  // set per frame from `workshopViewports`, so they cannot live in a stylesheet.
  '--frame-width': 'src/vnext/workshop/WorkshopCanvas.tsx',
  '--frame-height': 'src/vnext/workshop/WorkshopCanvas.tsx',
  '--frame-scale': 'src/vnext/workshop/WorkshopCanvas.tsx',
  // The public landing page's device frames: the same three facts as the
  // workshop's, for the same reason. A width and a height per variant, set from
  // `previewDevice.ts` by both the real stage and the box that reserves it while
  // the preview is still being fetched — so they cannot live in a stylesheet
  // without one of the two disagreeing with the other.
  '--preview-w': 'src/features/landing/previewDevice.ts',
  '--preview-h': 'src/features/landing/previewDevice.ts',
}

/**
 * Stylesheets belonging to the retired Euro journeys and the premium prototype.
 * They are parked rather than live — `parkedEuroBoundary` and
 * `premiumPrototypeBoundary` prove neither reaches the production bundle — so a
 * broken token in them ships to nobody. They are skipped rather than fixed
 * because editing parked presentation is churn against a tree that returns in
 * January 2028, and because a fix nobody can see is a fix nobody can verify.
 */
const PARKED = ['src/features/predict/', 'src/features/trends/', 'src/features/matches/']

function stylesheets(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) found.push(...stylesheets(path))
    else if (path.endsWith('.css')) found.push(path)
  }
  return found
}

/** Comments hold example and cautionary-tale token names; they define nothing
 *  and reference nothing. */
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, ' ')

const files = stylesheets(resolve(repositoryRoot, 'src'))
const sources = new Map(
  files.map((file) => [file, withoutComments(readFileSync(file, 'utf8'))] as const),
)

const defined = new Set<string>()
for (const css of sources.values()) {
  for (const [, name] of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) if (name) defined.add(name)
}

type Reference = { file: string; token: string }

const references: Reference[] = []
for (const [file, css] of sources) {
  // The trailing group separates `var(--x)` from `var(--x, fallback)`.
  for (const [, token, terminator] of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)) {
    if (terminator === ',') continue
    references.push({ file: relative(repositoryRoot, file), token: token ?? '' })
  }
}

describe('the stylesheets', () => {
  it('reads the whole tree, so the guard is not vacuous', () => {
    expect(files.length).toBeGreaterThan(30)
    expect(references.length).toBeGreaterThan(500)
    expect(defined.has('--radius-card')).toBe(true)
  })

  it('asks for no custom property that nothing defines', () => {
    const missing = references.filter(
      ({ file, token }) =>
        !defined.has(token) &&
        !(token in SET_INLINE) &&
        !PARKED.some((tree) => file.startsWith(tree)),
    )

    expect(
      [...new Set(missing.map(({ file, token }) => `${token} in ${file}`))],
      'these declarations are invalid at computed-value time and fall back to ' +
        'the initial value — a square corner or a transparent background, with ' +
        'no error anywhere',
    ).toEqual([])
  })

  it('keeps each inline exemption tied to the component that sets it', () => {
    // Otherwise the list above outlives its reason: a property whose component
    // stopped setting it is undefined again, and the exemption hides it.
    for (const [token, component] of Object.entries(SET_INLINE)) {
      const source = readFileSync(resolve(repositoryRoot, component), 'utf8')
      expect(source, `${component} no longer sets ${token}`).toContain(`'${token}'`)
    }
  })
})
