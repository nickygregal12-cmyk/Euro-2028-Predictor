import { readFileSync } from 'node:fs'
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
 * The suite itself cannot run in CI yet, and that is deliberate — baselines have
 * to be rendered on the runner that will compare them. This is what can be
 * checked before that bootstrap happens.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const config = read('playwright.visual.config.ts')
const spec = read('e2e/visual-gallery.spec.ts')
const workflow = read('.github/workflows/visual-contracts.yml')
const gallery = read('src/dev/ComponentsPreview.tsx')
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
  it('cannot compare before baselines exist', () => {
    // A `pull_request` trigger added before the bootstrap run would redden
    // every pull request, and the usual fix for that is to weaken the suite.
    expect(workflow).toMatch(/workflow_dispatch:/)
    expect(workflow, 'the visual suite runs on pull requests before its baselines exist').not.toMatch(
      /^on:[\s\S]*?\n\s{2}pull_request:/m,
    )
  })

  it('renders baselines on the runner that will compare them', () => {
    expect(workflow).toMatch(/--update-snapshots/)
    expect(workflow).toMatch(/upload-artifact/)
  })

  it('is absent from the suites that gate a merge', () => {
    // The visual config must not be swept into the existing runs, which have
    // no baselines and would fail.
    for (const path of ['.github/workflows/ci.yml', '.github/workflows/browser-e2e.yml']) {
      expect(read(path), `${path} runs the visual config`).not.toMatch(/playwright\.visual\.config/)
    }
  })
})
