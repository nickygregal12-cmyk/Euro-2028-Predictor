/**
 * The escaping claim, proved in a DOM rather than by reading the source.
 *
 * "React escapes text children" is true and well known, which is exactly why it
 * is worth one real assertion: the day someone reaches for
 * dangerouslySetInnerHTML to make a link work, this fails.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const FAR_FUTURE = '2099-01-01T00:00:00.000Z'

async function mount(record: unknown) {
  vi.resetModules()
  vi.doMock('../../config/operator-announcement.json', () => ({ default: record }))
  const { OperatorAnnouncement } = await import('../../src/app/OperatorAnnouncement')
  return render(<OperatorAnnouncement />)
}

afterEach(() => {
  vi.doUnmock('../../config/operator-announcement.json')
  vi.resetModules()
})

describe('the banner in a document', () => {
  it('renders nothing at all for the empty record', async () => {
    const { container } = await mount({
      message: null,
      level: null,
      publishedAt: null,
      expiresAt: null,
    })
    // Not "renders an empty alert" -- renders no element. An empty region still
    // takes vertical space and still announces itself to a screen reader.
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a live message once', async () => {
    await mount({
      message: 'Maintenance at 21:00 UTC.',
      level: 'warning',
      publishedAt: '2026-08-24T11:00:00.000Z',
      expiresAt: FAR_FUTURE,
    })
    expect(screen.getAllByText('Maintenance at 21:00 UTC.')).toHaveLength(1)
  })

  it('puts markup on the page as characters, not as elements', async () => {
    const hostile = '<img src=x onerror="boom()"> <script>boom()</script>'
    const { container } = await mount({
      message: hostile,
      level: 'info',
      publishedAt: '2026-08-24T11:00:00.000Z',
      expiresAt: FAR_FUTURE,
    })
    // The characters are on the page...
    expect(container.textContent).toContain(hostile)
    // ...and no element came with them.
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders nothing for an expired record', async () => {
    const { container } = await mount({
      message: 'This should not be on screen.',
      level: 'info',
      publishedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-08-02T00:00:00.000Z',
    })
    expect(container).toBeEmptyDOMElement()
  })
})
