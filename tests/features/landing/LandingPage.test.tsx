import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider'
import { LandingPage } from '../../../src/features/landing/LandingPage'
import { LANDING_SECTION_ORDER } from '../../../src/features/landing/landingContent'

/**
 * The rendered public landing page.
 *
 * `landingContent.test.ts` holds the content model against Appendix E. This
 * holds the things only the rendered page can be wrong about: that the section
 * order in the model actually reaches the DOM, that the conversion actions go
 * to the real auth routes rather than a prototype's mock modal, and that the
 * two product previews are announced as pictures instead of read out as the
 * visitor's own competitions, ranks and points.
 */

function renderLanding() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('the public landing page', () => {
  it('renders its sections in the authority’s order', () => {
    // The page maps over LANDING_SECTION_ORDER, so this proves the mapping is
    // real rather than that the array is sorted: read the DOM back and compare.
    const { container } = renderLanding()

    const rendered = [...container.querySelectorAll('main > section')].map((el) => el.id)

    expect(rendered).toEqual([...LANDING_SECTION_ORDER])
  })

  it('leads with one proposition and one dominant sign-up action (E.1)', () => {
    renderLanding()

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Make every match mean more.')
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

  it('announces the product previews as described pictures, not as data', () => {
    // role="img" makes an element's descendants presentational, so the invented
    // ranks and points inside are covered by one honest description. Without
    // it, "14th", "176" and "Saturday Night League" are announced exactly as a
    // real standings row would be, to the users least able to see that the
    // surrounding thing is a screenshot.
    renderLanding()

    const previews = screen.getAllByRole('img')
    expect(previews.length).toBeGreaterThanOrEqual(3)

    for (const preview of previews) {
      expect(preview.getAttribute('aria-label')).toMatch(/^Preview of/)
    }
  })

  it('keeps the invented standings out of the accessible name', () => {
    // The descriptions describe the shape of the screen — an action, rank,
    // movement — and never assert a number as the visitor's own.
    renderLanding()

    for (const preview of screen.getAllByRole('img')) {
      expect(preview.getAttribute('aria-label')).not.toMatch(/\b(14th|176|158)\b/)
    }
  })

  it('gives the page the landmarks and skip link every route has', () => {
    renderLanding()

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()

    const main = screen.getByRole('main')
    expect(main.id).toBe('main-content')
    // RouteAccessibility focuses this element by id on navigation; without the
    // tabindex the focus call is a silent no-op and the announcement lands
    // nowhere.
    expect(main.getAttribute('tabindex')).toBe('-1')

    const skip = screen.getByRole('link', { name: /skip to content/i })
    expect(skip.getAttribute('href')).toBe('#main-content')
  })

  it('offers a working theme control (E.4)', () => {
    renderLanding()

    const toggle = screen.getByRole('button', { name: /switch to (light|dark) theme/i })
    expect(toggle).toBeTruthy()
  })

  it('names Euro 2028 as separately joined, below the domestic sections', () => {
    renderLanding()

    const euro = document.getElementById('euro')
    expect(euro).not.toBeNull()
    expect(within(euro as HTMLElement).getByRole('heading', { level: 2 }).textContent).toMatch(
      /Euro 2028/,
    )
    expect(euro?.textContent).toMatch(/separately joined/i)
  })
})
