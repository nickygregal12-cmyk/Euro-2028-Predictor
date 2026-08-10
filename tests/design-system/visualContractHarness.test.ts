import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sectionAnchor } from '../../src/dev/sectionAnchor'

/**
 * The visual contract harness, against the properties that make a screenshot
 * baseline mean anything.
 *
 * A screenshot suite fails in a characteristic way: it goes flaky, someone
 * raises the tolerance or adds a retry, and from then on it holds nothing while
 * still reporting green. Every assertion here guards one of the decisions that
 * prevents that, so relaxing one is a visible edit rather than a quiet one.
 *
 * The suite now runs on every pull request that can move a pixel. It could not
 * before, because baselines have to be rendered on the runner that will compare
 * them and none existed; the bootstrap has since run and its images are
 * committed, so the assertions below check the live contract rather than the
 * conditions for starting it.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const config = read('playwright.visual.config.ts')
const spec = read('e2e/visual-gallery.spec.ts')
const workflow = read('.github/workflows/visual-contracts.yml')
const gallery = read('src/dev/ComponentsPreview.tsx')

/** The spec's own curated list, read rather than restated. */
const sections = [
  ...(spec.match(/const SECTIONS = \[([\s\S]*?)\] as const/)?.[1] ?? '').matchAll(
    /'([a-z0-9-]+)'/g,
  ),
].map((match) => match[1] as string)
/** The sections declared but not yet rendered on the comparison runner. */
const awaitingBaseline = [
  ...(
    spec.match(/export const AWAITING_BASELINE: readonly string\[\] = \[([\s\S]*?)\]/)?.[1] ?? ''
  ).matchAll(/'([a-z0-9-]+)'/g),
].map((match) => match[1] as string)
const galleryStyles = read('src/dev/ComponentsPreview.module.css')

describe('the section anchor', () => {
  it('turns a title into a stable slug', () => {
    expect(sectionAnchor('Button')).toBe('button')
    expect(sectionAnchor('PageShell + BottomNav')).toBe('pageshell-bottomnav')
    expect(sectionAnchor('MatchCard — editable')).toBe('matchcard-editable')
    expect(sectionAnchor('State — offline (banner, preserved state, only safe actions)')).toBe(
      'state-offline-banner-preserved-state-only-safe-actions',
    )
  })

  it('never leaves a leading or trailing separator', () => {
    // `"— Locked —"` would otherwise slug to `-locked-`, and a prefix selector
    // written the obvious way would not match it.
    expect(sectionAnchor('— Locked —')).toBe('locked')
    expect(sectionAnchor('  Toast  ')).toBe('toast')
  })
})

describe('every anchor the spec names exists in the gallery', () => {
  /** The `data-section^="..."` prefixes the visual spec addresses. */
  const referenced = [...spec.matchAll(/^\s+'([a-z0-9-]+)',$/gm)].map((match) => match[1])

  /** Every section the gallery declares, slugged the way the component does. */
  const declared = [...gallery.matchAll(/<Section title="([^"]+)"/g)].map((match) =>
    sectionAnchor(match[1]),
  )

  it('parses both sides, so the comparison is not vacuous', () => {
    expect(referenced.length).toBeGreaterThan(10)
    expect(declared.length).toBeGreaterThan(50)
  })

  it('matches every referenced prefix to a real section', () => {
    const orphaned = referenced.filter(
      (prefix) => !declared.some((anchor) => anchor.startsWith(prefix)),
    )

    expect(
      orphaned,
      `the visual spec photographs these anchors and no gallery section has them: ` +
        `${orphaned.join(', ')}`,
    ).toEqual([])
  })

  it('keeps each prefix unambiguous within a panel', () => {
    // `.first()` picks one when a prefix matches several, which would silently
    // photograph whichever section happens to be earlier in the file.
    for (const prefix of referenced) {
      const matches = declared.filter((anchor) => anchor.startsWith(prefix))
      expect(matches.length, `"${prefix}" matches ${matches.length} sections: ${matches}`).toBe(1)
    }
  })
})

describe('the harness is pinned against variation', () => {
  it('pins the gallery width rather than following the viewport', () => {
    // The panels are normally `flex: 1 1 340px`. A baseline taken from that is
    // a photograph of a window size.
    expect(galleryStyles).toMatch(/\[data-preview-width='phone'\][^}]*width: 390px/s)
    expect(galleryStyles).toMatch(/\[data-preview-width='desktop'\][^}]*width: 1280px/s)
    // Without clearing the 420px cap the desktop anchor is silently a phone.
    expect(galleryStyles).toMatch(/\[data-preview-width='desktop'\][^}]*max-width: none/s)
    expect(spec).toMatch(/width=\$\{width\}/)
  })

  it('freezes animation and resampling', () => {
    expect(config).toMatch(/animations: 'disabled'/)
    expect(config).toMatch(/deviceScaleFactor: 1/)
    expect(config).toMatch(/scale: 'css'/)
  })

  it('waits for the webfonts that reflow text', () => {
    expect(spec).toMatch(/document\.fonts\.ready/)
  })

  it('does not retry a failing screenshot', () => {
    // Retrying a pixel comparison until it passes is how a visual contract
    // becomes decorative.
    expect(config).toMatch(/retries: 0/)
  })

  it('keeps the tolerance tight enough to catch a structural change', () => {
    const ratio = Number(config.match(/maxDiffPixelRatio: ([\d.]+)/)?.[1])
    expect(Number.isFinite(ratio), 'no maxDiffPixelRatio is declared').toBe(true)
    // Enough for anti-aliasing along text and curves; far below a moved
    // element, a changed colour or a different size.
    expect(ratio).toBeLessThanOrEqual(0.01)
  })
})

describe('the CI bootstrap', () => {
  it('compares every pull request against committed baselines', () => {
    // This assertion used to say the opposite: no `pull_request` trigger, because
    // one added before the bootstrap run would redden every pull request and the
    // usual fix for that is to weaken the suite. The bootstrap has now run, so
    // the guard flips — a comparison suite nothing triggers holds nothing.
    expect(workflow).toMatch(/workflow_dispatch:/)
    expect(workflow).toMatch(/^on:[\s\S]*?\n\s{2}pull_request:/m)
  })

  it('has the baselines that trigger depends on', () => {
    // The pair is the contract: the trigger without the images is a red suite on
    // every pull request, and deleting the images is how someone would silence
    // it. Counted rather than merely present, because one stray PNG would
    // satisfy an existence check while the rest went unphotographed.
    //
    // DERIVED FROM THE SPEC, NOT PINNED. This assertion used to hard-code 13
    // sections and 52 images, and adding four sections to the spec left it
    // passing on the old count with the new sections unphotographed — which is
    // precisely the drift the paragraph above claims to prevent. The expected
    // number now comes from the spec's own list, so a section added without a
    // baseline fails here rather than in a red pull request later.
    const baselines = readdirSync(resolve(repositoryRoot, 'e2e/visual-baselines')).filter((file) =>
      file.endsWith('.png'),
    )
    expect(sections.length, 'the SECTIONS list could not be read from the spec').toBeGreaterThan(
      10,
    )
    // Sections awaiting their first render on the comparison runner are
    // excluded — see AWAITING_BASELINE in the spec — and the assertion below
    // makes that exclusion expire.
    const photographed = sections.filter((section) => !awaitingBaseline.includes(section))
    expect(baselines.length).toBe(photographed.length * 4)
    for (const width of ['phone', 'desktop']) {
      for (const theme of ['light', 'dark']) {
        expect(
          baselines.filter((file) => file.endsWith(`-${width}-${theme}.png`)).length,
          `no ${width}/${theme} baselines`,
        ).toBe(photographed.length)
      }
    }
    // Named, not merely counted: the right total with a missing image and a
    // stray one would balance out.
    for (const section of photographed) {
      for (const width of ['phone', 'desktop']) {
        for (const theme of ['light', 'dark']) {
          expect(
            baselines,
            `no baseline for ${section} at ${width}/${theme}`,
          ).toContain(`${section}-${width}-${theme}.png`)
        }
      }
    }
  })

  it('lets a pending baseline expire rather than persist', () => {
    // AWAITING_BASELINE is a note that a dispatch is outstanding, not a way to
    // opt a section out of the suite. Once the runner has produced its images
    // the entry is stale, and a stale entry would silently stop counting a
    // section that IS photographed — so it fails here until it is removed.
    const baselines = readdirSync(resolve(repositoryRoot, 'e2e/visual-baselines'))
    for (const section of awaitingBaseline) {
      expect(
        baselines,
        `${section} has baselines now — remove it from AWAITING_BASELINE`,
      ).not.toContain(`${section}-desktop-dark.png`)
      // And a name that is not in SECTIONS at all is a typo that would exempt
      // nothing while looking like it did.
      expect(sections, `${section} is not in SECTIONS`).toContain(section)
    }
  })

  it('renders baselines on the runner that will compare them', () => {
    expect(workflow).toMatch(/--update-snapshots/)
    expect(workflow).toMatch(/upload-artifact/)
  })

  it('never lets a re-render land on the default branch unreviewed', () => {
    // Baselines decide what CI enforces. A workflow that can push them straight
    // to the default branch is one that eventually will.
    expect(workflow).toMatch(/commit_baselines/)
    expect(workflow).toMatch(/default_branch/)
  })

  it('is absent from the suites that gate a merge', () => {
    // "Runs it" means executes it, not mentions it: a workflow may legitimately
    // name the config in a `paths:` filter. The first version of this assertion
    // banned the string outright and then failed on exactly that — an
    // over-broad guard that forbids something harmless teaches people to work
    // around guards.
    for (const path of ['.github/workflows/ci.yml', '.github/workflows/browser-e2e.yml']) {
      expect(read(path), `${path} runs the visual config`).not.toMatch(
        /--config=playwright\.visual\.config/,
      )
    }
  })

  it('is excluded from the default config, which sweeps up every spec in e2e/', () => {
    // THE ASSERTION ABOVE WAS NOT ENOUGH, and this is the one that was
    // missing. `playwright.config.ts` declares `testDir: './e2e'` with no
    // `testMatch`, so it collects every spec in the directory — including this
    // one. Checking that the workflows do not name the visual *config* said
    // nothing about the visual *spec* being picked up by a different config,
    // and it was: the merge-gating browser suite ran 104 screenshot
    // comparisons with no baselines and failed every one of them.
    const defaultConfig = read('playwright.config.ts')
    expect(defaultConfig).toMatch(/testIgnore:[\s\S]*?'visual-gallery\.spec\.ts'/)
  })

  it('is not collected by any config other than its own', () => {
    // Stated as a property rather than as two examples, so a fourth config
    // added later cannot quietly collect it. The auth and production configs
    // use explicit `testMatch` lists; naming the visual spec in one would put
    // it back into a gating run.
    for (const path of ['playwright.auth.config.ts', 'playwright.production.config.ts']) {
      expect(read(path), `${path} collects the visual spec`).not.toMatch(/visual-gallery/)
    }
  })
})
