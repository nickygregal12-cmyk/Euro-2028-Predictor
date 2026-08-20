import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextAbout } from '../../src/vnext/about/VNextAbout'
import { VNextShell } from '../../src/vnext/app/VNextShell'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { shellScenarios } from '../../src/vnext/fixtures'
import {
  aboutModel,
  minimalAboutModel,
  workshopAboutModel,
} from '../../src/vnext/fixtures/about/content'
import { NON_AFFILIATION_SHORT } from '../../src/vnext/models/about'
import { LEGAL_LINKS } from '../../src/features/landing/landingContent'

/**
 * ABOUT & DISCLAIMER — the position, and the places it is reachable from.
 *
 * ============================ WHAT IT IS FOR ============================
 *
 * ADR 0017 asks for *"an unambiguous non-affiliation statement in the footer
 * and terms"* and the product published neither. These cases hold the claim
 * itself, the two places it appears, and — the part most worth guarding — that
 * the page never says anything the record does not support.
 */

function renderAbout(model = workshopAboutModel) {
  return render(
    <VNextRoot>
      <VNextAbout model={model} />
    </VNextRoot>,
  )
}

describe('the page states the position', () => {
  it('is one page with one main and one h1', () => {
    renderAbout()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('lights no destination, because About belongs to the platform', () => {
    // The four destinations are the ACTIVE COMPETITION's. A platform page that
    // lit one would be telling a reader they are inside a competition.
    const { container } = renderAbout()
    expect([...container.querySelectorAll('[aria-current]')]).toEqual([])
  })

  it('says it is unofficial and not endorsed, in those words', () => {
    const { container } = renderAbout()
    const text = container.textContent ?? ''
    expect(text).toContain(
      'is not affiliated with, endorsed by, sponsored by, or connected with any football league, governing body, competition or club',
    )
  })

  it('says whose the trademarks are and what their use does not imply', () => {
    const text = renderAbout().container.textContent ?? ''
    expect(text).toContain(
      'trademarks, logos and other third-party intellectual property remain the property of their respective owners',
    )
    expect(text).toContain('does not imply association with or endorsement of')
    expect(text).toContain('does not claim ownership of third-party football brands or trademarks')
  })

  it('explains the club identity treatments without needing a badge mode', () => {
    const text = renderAbout().container.textContent ?? ''
    expect(text).toContain('independently created club identity treatments')
    // TRUE WHETHER BADGES ARE ON OR OFF. Two versions of a legal position that
    // differ by build flag would be two positions, and nobody would know which
    // one a reader saw.
    expect(text).toContain('only displayed where an appropriate authorised source is configured')
  })
})

describe('it never claims more than the record supports', () => {
  const everyWord = [workshopAboutModel, minimalAboutModel]
    .flatMap((model) => [model.summary, ...model.sections.flatMap((s) => s.paragraphs)])
    .join(' ')
    .toLowerCase()

  it('never says "non-commercial"', () => {
    // ADR 0015: "Revenue is intended, from sources other than the act of
    // competing" — a premium tier, sponsorship, white-label licensing. The word
    // would become false the first time a subscription exists, and a disclaimer
    // that has been quietly falsified is worth less than none.
    expect(everyWord).not.toContain('non-commercial')
    expect(everyWord).not.toContain('not for profit')
    expect(everyWord).not.toContain('non-profit')
  })

  it('never implies an official relationship anywhere on the page', () => {
    for (const phrase of [
      'official partner',
      'in partnership with',
      'licensed by',
      'approved by',
      'endorsed by any football',
    ]) {
      expect(everyWord, phrase).not.toContain(phrase)
    }
  })

  it('never says a provider grants a licence', () => {
    // Every configured provider disclaims the rights to the images it serves —
    // the 8 August 2026 provider capability audit. Naming one as a licensor
    // would assert a licence that does not exist.
    for (const provider of ['football-data', 'sportmonks', 'api-sports', 'sportdb']) {
      expect(everyWord, provider).not.toContain(provider)
    }
  })

  it('does not present itself as an official record of any match', () => {
    const text = renderAbout().container.textContent ?? ''
    expect(text).toContain('not an official record of any football match or competition')
  })
})

describe('the links are only as real as their destinations', () => {
  it('draws no link for a policy that does not exist yet', () => {
    // A legal link that answers Not Found reads as a document that exists and
    // was withheld, which is worse than an absent one.
    const { container } = renderAbout(minimalAboutModel)
    const links = container.querySelector('[data-vnext-zone="links"]')
    expect(links).toBeNull()
  })

  it('draws the contact route where a deployment configured one', () => {
    const { container } = renderAbout(workshopAboutModel)
    const links = container.querySelector('[data-vnext-zone="links"]') as HTMLElement
    expect(within(links).getByRole('link', { name: /rights and branding/i }).getAttribute('href')).toBe(
      'mailto:hello@example.com',
    )
  })

  it('draws Privacy and Terms the moment they are given an address', () => {
    // The shape is ready; only the value is missing. Proving that here means
    // publishing them is a one-line change rather than a page change.
    const withPolicies = {
      ...workshopAboutModel,
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
      ],
    }
    const { container } = renderAbout(withPolicies)
    const links = container.querySelector('[data-vnext-zone="links"]') as HTMLElement
    expect(within(links).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(within(links).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
  })

  it('builds no mailto from an unconfigured address', () => {
    const model = aboutModel({ supportEmail: null })
    expect(model.links.every((link) => link.href === null)).toBe(true)
  })
})

describe('the position is reachable from everywhere it needs to be', () => {
  it('is one press from the foot of every vNext page', () => {
    render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextShell destination="home">
            <p>Any page at all</p>
          </VNextShell>
        </VNextShellProvider>
      </VNextRoot>,
    )
    expect(screen.getByRole('button', { name: /about & disclaimer/i })).toBeTruthy()
  })

  it('carries the same sentence in the shell footer as on the page', () => {
    // One fact, one wording. A product that states its non-affiliation two
    // slightly different ways has stated it badly.
    const shell = render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextShell destination="home">
            <p>Any page at all</p>
          </VNextShell>
        </VNextShellProvider>
      </VNextRoot>,
    )
    expect(shell.container.textContent).toContain(NON_AFFILIATION_SHORT)
    shell.unmount()

    expect(renderAbout().container.textContent).toContain(NON_AFFILIATION_SHORT)
  })

  it('is in the public landing footer, for the reader who has not signed up', () => {
    const landing = readFileSync(
      resolve(process.cwd(), 'src/features/landing/LandingPage.tsx'),
      'utf8',
    )
    // The route now comes from the landing page's own legal-link declaration
    // rather than being written into the footer's JSX, so Privacy and Terms can
    // join it the moment they exist. The address is asserted where it is
    // declared; the footer is asserted to render what is declared.
    expect(landing).toContain('LEGAL_LINKS.map')
    expect(landing).toContain('NON_AFFILIATION_SHORT')
    expect(
      LEGAL_LINKS.find((link) => link.label === 'About & Disclaimer')?.to,
      'the public footer no longer routes to the About page',
    ).toBe('/about')
  })

  it('answers 200 as a deep link rather than a rendered 404', () => {
    const netlify = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')
    expect(netlify).toContain('from = "/about"')
  })

  it('is not a fifth destination', () => {
    // Four is the most that clears a 44px target across a 375px bar, and the
    // four belong to the active competition. About is the platform's.
    const { container } = render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextShell destination="home">
            <p>Any page at all</p>
          </VNextShell>
        </VNextShellProvider>
      </VNextRoot>,
    )
    const bar = container.querySelector('[data-vnext-shell-zone="navbar"]') as HTMLElement
    expect(within(bar).queryByText(/about/i)).toBeNull()
  })
})

describe('the page is accessible in both themes', () => {
  it('passes the scan', async () => {
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextAbout model={workshopAboutModel} />
      </VNextRoot>,
    )
  })

  it('passes the scan with no policy links at all', async () => {
    // The state a real deployment is in today: no Privacy, no Terms, no
    // configured contact address. It must still be a complete page.
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextAbout model={minimalAboutModel} />
      </VNextRoot>,
    )
  })
})
