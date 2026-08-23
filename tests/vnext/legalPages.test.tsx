import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LEGAL_LINKS } from '../../src/features/landing/landingContent'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { privacyModel, termsModel } from '../../src/vnext/fixtures/legal/content'
import { VNextPublicDocument } from '../../src/vnext/publicDocument/VNextPublicDocument'
import { expectNoAxeViolations } from './vnextAxe'

function allCopy(model: ReturnType<typeof privacyModel>): string {
  return [model.summary, ...model.sections.flatMap((section) => section.paragraphs)].join(' ')
}

describe('public Privacy and Terms', () => {
  it('publishes both policy destinations from the landing legal row', () => {
    expect(LEGAL_LINKS).toEqual([
      { label: 'About & Disclaimer', to: '/about' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ])
  })

  it('keeps privacy content player-independent and honest about optional integrations', () => {
    const model = privacyModel({ supportEmail: null })
    const copy = allCopy(model)

    expect(copy).toContain('when error reporting is enabled')
    expect(copy).toContain('when analytics is configured')
    expect(copy).toContain('only when that channel has actually been enabled and configured')
    expect(copy).toContain('There is no single blanket retention period')
    expect(copy).toContain('does not promise a self-service account-erasure or pseudonymisation workflow')
    expect(copy).toContain(
      'does not claim that an external or qualified UK data-protection review has taken place',
    )
    expect(copy).not.toContain('Google')
  })

  it('does not invent a contact route when none is configured', () => {
    const privacy = privacyModel({ supportEmail: null })
    const terms = termsModel({ supportEmail: null })

    expect(privacy.links.some((link) => link.href.startsWith('mailto:'))).toBe(false)
    expect(terms.links.some((link) => link.href.startsWith('mailto:'))).toBe(false)
    expect(privacy.links).toContainEqual({ label: 'Terms', href: '/terms' })
    expect(terms.links).toContainEqual({ label: 'Privacy', href: '/privacy' })
  })

  it('uses the configured support address without publishing it as policy data', () => {
    expect(privacyModel({ supportEmail: 'help@example.com' }).links).toContainEqual({
      label: 'Privacy and data enquiries',
      href: 'mailto:help@example.com',
    })
    expect(termsModel({ supportEmail: 'help@example.com' }).links).toContainEqual({
      label: 'Support and enquiries',
      href: 'mailto:help@example.com',
    })
  })

  it('states server authority and the existing non-affiliation position in Terms', () => {
    const copy = allCopy(termsModel())
    expect(copy).toContain(
      'The server is the authority for deadlines, locks, accepted predictions, game eligibility, scoring, progression and settlement.',
    )
    expect(copy).toContain('There is no wager, stake or cash prize')
    expect(copy).toContain('Not affiliated with or endorsed by any league or club.')
    expect(copy).not.toContain('non-commercial')
  })

  it.each([
    ['Privacy', privacyModel()],
    ['Terms', termsModel()],
  ] as const)('%s is a single public platform document', (title, model) => {
    const { container } = render(
      <VNextRoot>
        <VNextPublicDocument model={model} />
      </VNextRoot>,
    )

    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
    expect([...container.querySelectorAll('[aria-current]')]).toEqual([])
  })

  it('passes the accessibility scan for both policy documents', async () => {
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextPublicDocument model={privacyModel()} />
      </VNextRoot>,
    )
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextPublicDocument model={termsModel()} />
      </VNextRoot>,
    )
  })
})
