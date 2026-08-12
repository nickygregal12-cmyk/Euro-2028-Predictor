import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonPredictionDrafts } from '../../../src/features/season/SeasonPredictionDrafts'
import { presentDrafts } from '../../../src/features/season/predictionDraftModel'
import type { PredictionDraft } from '../../../src/services/offline/predictionDraftStore'

/**
 * `INNOV-020` on screen.
 *
 * The strongest assertion here is the absence of a word: nothing this panel can
 * render says submitted, saved or sent, because everything it lists is work the
 * server has not taken. A draft that IS accepted leaves the panel entirely, so
 * there is no success state to mislabel.
 */

const labelFor = (fixtureId: string) =>
  fixtureId === 'fx-1' ? 'Liverpool v Arsenal' : 'Everton v Chelsea'

const view = (drafts: readonly PredictionDraft[], over = {}) =>
  presentDrafts(drafts, { syncing: false, offline: false, lastResult: null, ...over })

const mount = (drafts: readonly PredictionDraft[], over = {}, handlers = {}) => {
  const props = {
    onSync: vi.fn(),
    onRetry: vi.fn(),
    onDiscard: vi.fn(),
    ...handlers,
  }
  render(<SeasonPredictionDrafts drafts={view(drafts, over)} labelFor={labelFor} {...props} />)
  return props
}

describe('SeasonPredictionDrafts', () => {
  it('renders nothing at all with no drafts outstanding', () => {
    const { container } = render(
      <SeasonPredictionDrafts
        drafts={view([])}
        labelFor={labelFor}
        onSync={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('names a pending draft as held on this device and never as submitted', () => {
    mount([{ fixtureId: 'fx-1', prediction: { home: 2, away: 1 } }])
    expect(screen.getByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument()
    expect(screen.getByText('Draft on this device')).toBeInTheDocument()
    expect(screen.getByText('Yours: 2 – 1')).toBeInTheDocument()
    expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\bsaved to\b/i)).not.toBeInTheDocument()
  })

  it('says the device has no connection when it believes that', () => {
    mount([{ fixtureId: 'fx-1', prediction: { home: 2, away: 1 } }], { offline: true })
    expect(screen.getByText(/This device has no connection/)).toBeInTheDocument()
  })

  it('shows both scorelines on a conflict and offers the choice, picking neither', () => {
    const handlers = mount([
      {
        fixtureId: 'fx-1',
        prediction: { home: 1, away: 0 },
        refusal: {
          outcome: 'conflict',
          reason: 'Another device submitted this fixture after this draft was taken',
          stored: { home: 3, away: 3 },
        },
      },
    ])
    expect(screen.getByText('Changed somewhere else')).toBeInTheDocument()
    expect(screen.getByText('Yours: 1 – 0')).toBeInTheDocument()
    expect(screen.getByText('Already saved: 3 – 3')).toBeInTheDocument()
    // The server's own sentence, not a generic one.
    expect(
      screen.getByText('Another device submitted this fixture after this draft was taken'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(handlers.onRetry).toHaveBeenCalledWith('fx-1')
    fireEvent.click(screen.getByRole('button', { name: 'Use the saved one' }))
    expect(handlers.onDiscard).toHaveBeenCalledWith('fx-1')
  })

  it('offers no retry on a locked draft, because no client action reopens a lock', () => {
    mount([
      {
        fixtureId: 'fx-1',
        prediction: { home: 1, away: 0 },
        refusal: { outcome: 'locked', reason: 'This matchweek has locked', stored: null },
      },
    ])
    expect(screen.getByText('Locked before it reached us')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep mine' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('reports what the last attempt did, in both directions', () => {
    mount([{ fixtureId: 'fx-1', prediction: { home: 2, away: 1 } }], {
      lastResult: { accepted: 3, rejected: 1 },
    })
    expect(screen.getByText('Last attempt: 3 accepted, 1 not.')).toBeInTheDocument()
  })

  it('sends on request', () => {
    const handlers = mount([{ fixtureId: 'fx-1', prediction: { home: 2, away: 1 } }])
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }))
    expect(handlers.onSync).toHaveBeenCalledTimes(1)
  })
})
