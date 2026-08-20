import { beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider'
import { LandingPage } from '../../../src/features/landing/LandingPage'
import { LANDING_SECTION_ORDER } from '../../../src/features/landing/landingContent'

/**
 * The rendered public landing page.
 *
 * `landingContent.test.ts` holds the content model against Appendix E. This
 * holds the things only the rendered page can be wrong about: that the section
 * order in the model actually reaches the DOM, that the conversion actions go to
 * the real auth routes rather than a prototype's mock modal, and that the
 * product previews are announced as pictures instead of read out as the
 * visitor's own competitions, ranks and points.
 *
 * ============================ WHY THE QUERIES ARE SCOPED ==================
 *
 * The page now MOUNTS the product inside its device frames rather than drawing a
 * picture of it, so the document contains the landing page's landmarks AND three
 * inert copies of the product's. In a browser that is not ambiguous: each frame
 * is `role="img"` with `inert`, so its whole subtree is out of the accessibility
 * tree and a reader meets one banner, one main and one contentinfo. jsdom
 * implements neither, so a bare `getByRole('main')` here would be asking the
 * DOM a question the accessibility tree already answers.
 *
 * The queries below therefore address the PAGE's own chrome by id and the
 * devices by `data-preview-*`. `e2e/axe-unauthenticated.spec.ts` is where the
 * accessibility-tree version of the same question is asked, in a real browser,
 * with `inert` and presentational children actually implemented.
 */

/** The landing page's own chrome, as opposed to the product inside the frames. */
function pageOwn(container: HTMLElement, selector: string): HTMLElement[] {
  return [...container.querySelectorAll(selector)].filter(
    (node) => node.closest('[data-preview-variant]') === null,
  ) as HTMLElement[]
}

function renderLanding() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

/**
 * Render, then let the lazily-imported preview arrive.
 *
 * The devices are behind `React.lazy` so the page's headline does not wait on
 * seventy-seven kilobytes of product. Waited for by the thing that proves it
 * arrived — a device in the DOM — rather than by a fixed number of microtask
 * flushes, which is a guess about React's internals that changes with React.
 */
async function renderLandingWithPreview() {
  const rendered = renderLanding()
  await waitFor(
    () => expect(rendered.container.querySelectorAll('[data-preview-variant]')).toHaveLength(3),
    // Generous, because the FIRST resolution in a run is not a network fetch —
    // it is Vite transforming the whole vNext presentation lane. Warmed in
    // `beforeAll` so this is a ceiling rather than the usual wait.
    { timeout: 10_000 },
  )
  return rendered
}

// Pay the transform cost once, outside a case, so no single test's timeout is
// really measuring the module graph.
beforeAll(async () => {
  await import('../../../src/features/landing/ProductPreview')
})

describe('the public landing page', () => {
  it('renders its sections in the authority’s order', () => {
    // The page maps over LANDING_SECTION_ORDER, so this proves the mapping is
    // real rather than that the array is sorted: read the DOM back and compare.
    const { container } = renderLanding()

    const rendered = [...container.querySelectorAll('#main-content > section')].map(
      (el) => el.id,
    )

    expect(rendered).toEqual([...LANDING_SECTION_ORDER])
  })

  it('leads with one proposition and one dominant sign-up action (E.1)', async () => {
    const { container } = await renderLandingWithPreview()

    // The page's own h1, not one of the product's inside a frame. Each device
    // renders a real page and each real page has a heading; only this one is
    // the landing page's proposition.
    const [heading, ...extra] = pageOwn(container, 'h1')
    expect(extra).toHaveLength(0)
    expect(heading?.textContent).toBe('Make every match mean more.')
  })

  it('sends every conversion action to the real auth routes', () => {
    // The prototype's account flow was a modal that sent nothing anywhere. In
    // production the page must hand off to the routes that already own account
    // creation — anything else would be a second sign-up path.
    renderLanding()

    const signUpTargets = screen
      .getAllByRole('link', { name: /create (your )?(free )?(account|league free)/i })
      .map((link) => link.getAttribute('href'))
    const signInTargets = screen
      .getAllByRole('link', { name: /sign in/i })
      .map((link) => link.getAttribute('href'))

    expect(signUpTargets.length).toBeGreaterThan(1)
    expect(new Set(signUpTargets)).toEqual(new Set(['/auth/signup']))
    expect(new Set(signInTargets)).toEqual(new Set(['/auth/login']))
  })

  it('announces the product previews as described pictures, not as data', async () => {
    // role="img" makes an element's descendants presentational, so the invented
    // ranks and points inside are covered by one honest description. Without
    // it, "14th", "176" and "Saturday Night League" are announced exactly as a
    // real standings row would be, to the users least able to see that the
    // surrounding thing is a screenshot.
    const { container } = await renderLandingWithPreview()

    const previews = [...container.querySelectorAll('[data-preview-variant]')]
    // A desktop story, a phone story, and the still league table.
    expect(previews).toHaveLength(3)

    for (const preview of previews) {
      expect(preview.getAttribute('role')).toBe('img')
      expect(preview.getAttribute('aria-label')).toMatch(/^Preview of/)
    }
  })

  it('keeps the invented standings out of the accessible name', async () => {
    // The descriptions describe the shape of the screen — an action, rank,
    // movement — and never assert a number as the visitor's own.
    const { container } = await renderLandingWithPreview()
    const previews = [...container.querySelectorAll('[data-preview-variant]')]
    expect(previews).toHaveLength(3)

    for (const preview of previews) {
      expect(preview.getAttribute('aria-label')).not.toMatch(/\b\d+(st|nd|rd|th)\b|\b\d{3}\b/)
    }
  })

  it('gives the page the landmarks and skip link every route has', async () => {
    // Awaited, so the product's own landmarks really are in the document when
    // the page's are counted. Counting them before the preview arrives would be
    // a test that passes because the thing it guards against is not there yet.
    const { container } = await renderLandingWithPreview()

    expect(pageOwn(container, 'header')).toHaveLength(1)
    expect(pageOwn(container, 'footer')).toHaveLength(1)

    const mains = pageOwn(container, 'main')
    expect(mains).toHaveLength(1)
    const main = mains[0] as HTMLElement
    expect(main.id).toBe('main-content')
    // RouteAccessibility focuses this element by id on navigation; without the
    // tabindex the focus call is a silent no-op and the announcement lands
    // nowhere.
    expect(main.getAttribute('tabindex')).toBe('-1')

    const skips = pageOwn(container, 'a[href="#main-content"]')
    expect(skips).toHaveLength(1)
  })

  it('keeps every product landmark inside an inert picture', async () => {
    // The other half of the note at the top of this file, asserted rather than
    // explained. The product's own `<main>`, `<header>` and navigation are in the
    // document three times over; every one of them is inside a frame that is
    // `role="img"` and `inert`, which is what keeps a reader meeting one of each.
    const { container } = await renderLandingWithPreview()

    let checked = 0
    for (const landmark of container.querySelectorAll('main, header, footer, nav')) {
      const frame = landmark.closest('[data-preview-variant]')
      if (frame === null) continue
      checked += 1
      expect(frame.getAttribute('role')).toBe('img')
      expect((frame.firstElementChild as HTMLElement).hasAttribute('inert')).toBe(true)
    }
    // Not a vacuous pass: the product really did mount, landmarks and all.
    expect(checked).toBeGreaterThan(0)
  })

  it('offers a working theme control (E.4)', () => {
    renderLanding()

    const toggle = screen.getByRole('button', { name: /switch to (light|dark) theme/i })
    expect(toggle).toBeTruthy()
  })

  it('mentions Euro 2028 nowhere at all (EURO-003)', () => {
    // The inverse of what this asserted before. Revision 1.5 gave the page a
    // Euro acquisition band and this pinned its heading and its "separately
    // joined" wording; ADR 0026 superseded that and EURO-003 requires Euro
    // absent from the weekly platform — landing content included — while its
    // publication state is hidden.
    //
    // Asserted over the whole rendered page rather than over the removed
    // section's id, because the section coming back is only one of the ways
    // this regresses: a stray mention in the hero, the games list or the final
    // call to action would violate the same requirement while leaving no
    // `#euro` to look for.
    const { container } = renderLanding()

    expect(document.getElementById('euro')).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/euro/i)
  })
})
