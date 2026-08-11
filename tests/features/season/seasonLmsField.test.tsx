import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonLmsField } from '../../../src/features/season/SeasonLmsField'
import { mapSeasonLmsField } from '../../../src/services/supabase/seasonLmsFieldModel'

/**
 * The Last Man Standing field, as it is rendered (contract 164).
 *
 * ONE PROPERTY MATTERS MORE THAN THE REST: a rival's detail is CONCEALED before
 * the round locks, and concealment must not render as a value. A dash reads as
 * "nothing", a blank reads as "has not picked" and a zero where lives should be
 * is a claim about how boldly somebody can afford to play — with the clubs
 * running out, each of those is an advantage handed to whoever reads it.
 *
 * The rest is about the five states being distinguishable in WORDS, so the
 * difference between surviving and being out survives a monochrome screenshot.
 */

function entrant(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'sam',
    display_name: 'Sam',
    is_me: false,
    outcome: 'active',
    still_in: true,
    lives_remaining: null,
    saves_remaining: null,
    has_picked: null,
    pick: null,
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    entered: true,
    my_outcome: 'active',
    round: {
      window_id: 'w1',
      sequence: 4,
      label: 'Round 4',
      locks_at: '2026-09-05T11:30:00Z',
      revealed: false,
      settled: false,
    },
    rules: { lives: 1, saves: 1, draws_rule: 'eliminate', endgame_scope: 'private' },
    field: { entrants: 3, remaining: 2, eliminated: 1, picked: null },
    entrants: [
      entrant({
        user_id: 'me',
        display_name: 'You',
        is_me: true,
        lives_remaining: 1,
        saves_remaining: 1,
        has_picked: true,
        pick: { team_id: 't1', team_name: 'Arsenal', outcome: null },
      }),
      entrant(),
      entrant({ user_id: 'alex', display_name: 'Alex', outcome: 'eliminated', still_in: false }),
    ],
    ...overrides,
  }
}

function renderField(overrides: Record<string, unknown> = {}) {
  const read = vi.fn(async () => mapSeasonLmsField(payload(overrides)))
  render(<SeasonLmsField read={read} />)
  return read
}

describe('the field before the round locks', () => {
  it('says a rival’s detail is hidden rather than printing a value for it', async () => {
    renderField()

    expect(await screen.findByRole('heading', { name: 'The field' })).toBeInTheDocument()
    expect(screen.getAllByText('Hidden until the round locks').length).toBeGreaterThan(0)
    // Not a zero where a rival's lives should be, and no "No pick yet" either:
    // both would be claims the server refused to make.
    expect(screen.queryByText('0 lives')).toBeNull()
    expect(screen.queryByText('No pick yet')).toBeNull()
  })

  it('shows the caller their own pick, because it is theirs', async () => {
    renderField()

    expect(await screen.findByText('Arsenal')).toBeInTheDocument()
    expect(screen.getByText('1 life · 1 save')).toBeInTheDocument()
  })

  it('does not print how many have picked before the reveal', async () => {
    renderField()

    await screen.findByRole('heading', { name: 'The field' })
    // No Picked stat card at all. The other three are present, so the absence
    // is the reveal rule rather than a failed render.
    expect(screen.queryByText('Picked')).toBeNull()
    expect(screen.getAllByText('Still in').length).toBeGreaterThan(0)
    expect(screen.getByText('Entrants')).toBeInTheDocument()
  })

  it('explains why picks are hidden, in the player’s terms', async () => {
    renderField()

    expect(await screen.findByText(/clubs running out/)).toBeInTheDocument()
  })
})

describe('the field once the round is revealed', () => {
  const revealed = {
    round: {
      window_id: 'w1',
      sequence: 4,
      label: 'Round 4',
      locks_at: '2026-09-05T11:30:00Z',
      revealed: true,
      settled: false,
    },
    field: { entrants: 3, remaining: 2, eliminated: 1, picked: 2 },
    entrants: [
      entrant({
        user_id: 'me',
        display_name: 'You',
        is_me: true,
        lives_remaining: 1,
        has_picked: true,
        pick: { team_id: 't1', team_name: 'Arsenal', outcome: 'survived' },
      }),
      entrant({
        lives_remaining: 0,
        saves_remaining: 0,
        has_picked: true,
        pick: { team_id: 't2', team_name: 'Chelsea', outcome: null },
      }),
    ],
  }

  it('shows every pick, and a zero that is now a real answer', async () => {
    renderField(revealed)

    expect(await screen.findByText('Chelsea')).toBeInTheDocument()
    expect(screen.getByText('0 lives · 0 saves')).toBeInTheDocument()
    expect(screen.queryByText('Hidden until the round locks')).toBeNull()
  })

  it('reports the settlement authority’s verdict and waits for it otherwise', async () => {
    renderField(revealed)

    expect(await screen.findByText('Survived')).toBeInTheDocument()
    // Chelsea's fixture is not played, so there is no verdict to print.
    expect(screen.getByText('Still in · awaiting the result')).toBeInTheDocument()
  })

  it('counts how many have picked once that is no longer an advantage', async () => {
    renderField(revealed)

    expect(await screen.findByText('Picked')).toBeInTheDocument()
  })
})

describe('the states, in words', () => {
  it('names elimination rather than relying on colour', async () => {
    renderField()

    expect(await screen.findByText('Eliminated')).toBeInTheDocument()
  })

  it('renders nothing at all for a season that runs no Last Man Standing', async () => {
    const { container } = render(
      <SeasonLmsField read={vi.fn(async () => mapSeasonLmsField({ available: false }))} />,
    )

    // Awaited, because the panel shows its heading while the read is in flight
    // and the assertion is about where it lands.
    await vi.waitFor(() => expect(container.textContent).toBe(''))
  })

  it('invites a player who is not in the competition, rather than showing an empty field', async () => {
    render(
      <SeasonLmsField
        read={vi.fn(async () => mapSeasonLmsField({ available: true, entered: false }))}
      />,
    )

    expect(await screen.findByText(/Join this competition/)).toBeInTheDocument()
  })

  it('reports a failed read as a failure, never as an empty field', async () => {
    render(
      <SeasonLmsField
        read={vi.fn(async () => {
          throw new Error('network')
        })}
      />,
    )

    expect(await screen.findByText(/could not load the field/i)).toBeInTheDocument()
  })
})
