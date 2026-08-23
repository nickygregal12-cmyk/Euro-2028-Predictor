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

function renderAbout(model = workshopAboutModel) {
  return render(
    <VNextRoot>
      <VNextAbout model={model} />
    </VNextRoot>,
  )
}

describe('About & Disclaimer public position', () => {
  it('is one platform page with one main and one h1', () => {
    const { container } = renderAbout()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect([...container.querySelectorAll('[aria-current]')]).toEqual([])
  })

  it('states the supported independence, branding and football-data position', () => {
    const text = renderAbout().container.textContent ?? ''
    expect(text).toContain(
      'is not affiliated with, endorsed by, sponsored by, or connected with any football league, governing body, competition or club',
    )
    expect(text).toContain(
      'trademarks, logos and other third-party intellectual property remain the property of their respective owners',
    )
    expect(text).toContain('does not imply association with or endorsement of')
    expect(text).toContain('independently created club identity treatments')
    expect(text).toContain('not an official record of any football match or competition')
  })

  it('never claims more than the record supports', () => {
    const everyWord = [workshopAboutModel, minimalAboutModel]
      .flatMap((model) => [model.summary, ...model.sections.flatMap((section) => section.paragraphs)])
      .join(' ')
      .toLowerCase()

    for (const phrase of [
      'non-commercial',
      'not for profit',
      'non-profit',
      'official partner',
      'in partnership with',
      'licensed by',
      'approved by',
    ]) {
      expect(everyWord, phrase).not.toContain(phrase)
    }
    for (const provider of ['football-data', 'sportmonks', 'api-sports', 'sportdb']) {
      expect(everyWord, provider).not.toContain(provider)
    }
  })
})

describe('About policy and contact links', () => {
  it('publishes Privacy and Terms even when no support address is configured', () => {
    const { container } = renderAbout(minimalAboutModel)
    const links = container.querySelector('[data-vnext-zone="links"]') as HTMLElement

    expect(within(links).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(within(links).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(within(links).queryByRole('link', { name: /rights and branding/i })).toBeNull()
  })

  it('adds the configured rights contact without inventing one when blank', () => {
    const configured = renderAbout(workshopAboutModel)
    const links = configured.container.querySelector('[data-vnext-zone="links"]') as HTMLElement
    expect(within(links).getByRole('link', { name: /rights and branding/i }).getAttribute('href')).toBe(
      'mailto:hello@example.com',
    )
    configured.unmount()

    const model = aboutModel({ supportEmail: null })
    expect(model.links.some((link) => link.href?.startsWith('mailto:'))).toBe(false)
    expect(model.links).toContainEqual({ label: 'Privacy', href: '/privacy' })
    expect(model.links).toContainEqual({ label: 'Terms', href: '/terms' })
  })
})

describe('the public position remains reachable', () => {
  it('is one press from the foot of every vNext page and uses one sentence', () => {
    const shell = render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextShell destination="home">
            <p>Any page at all</p>
          </VNextShell>
        </VNextShellProvider>
      </VNextRoot>,
    )
    expect(screen.getByRole('button', { name: /about & disclaimer/i })).toBeTruthy()
    expect(shell.container.textContent).toContain(NON_AFFILIATION_SHORT)
    shell.unmount()
    expect(renderAbout().container.textContent).toContain(NON_AFFILIATION_SHORT)
  })

  it('publishes About, Privacy and Terms in the signed-out landing legal row', () => {
    const landing = readFileSync(resolve(process.cwd(), 'src/features/landing/LandingPage.tsx'), 'utf8')
    expect(landing).toContain('LEGAL_LINKS.map')
    expect(landing).toContain('NON_AFFILIATION_SHORT')
    expect(LEGAL_LINKS).toEqual([
      { label: 'About & Disclaimer', to: '/about' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ])
  })

  it('keeps About as a deep-link 200 and not a fifth competition destination', () => {
    const netlify = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')
    expect(netlify).toContain('from = "/about"')

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

describe('About accessibility', () => {
  it('passes with and without a configured contact route', async () => {
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextAbout model={workshopAboutModel} />
      </VNextRoot>,
    )
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextAbout model={minimalAboutModel} />
      </VNextRoot>,
    )
  })
})
