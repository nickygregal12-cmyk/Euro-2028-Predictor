import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SeasonLmsPage } from '../../../src/features/season/SeasonLmsPage'
import { createDevSeasonLmsGateway } from '../../../src/dev/seasonLmsGateway'

/**
 * The season Last Man Standing surface, on the states a reviewer cannot
 * conjure from a healthy database.
 *
 * Both assertions here exist because the rendered page contradicted itself in
 * review and the model tests could not have caught it — they check what the
 * model decides, not what the component prints.
 */

const NOW = () => new Date('2026-08-05T12:00:00Z')

describe('the season LMS page', () => {
  it('does not label the player’s own pick as "Used"', async () => {
    // The club IS used — the pick is what consumed it — but printing "Used"
    // beside "Your pick" reads as "unavailable to you", which is the opposite
    // of what it means. Caught by reading the rendered page, not the model.
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('already_picked', NOW)} now={NOW} />)

    const pick = await screen.findByRole('button', { name: /Arsenal/ })
    expect(pick.textContent).toContain('Your pick')
    expect(pick.textContent).not.toContain('Used')
  })

  it('shows a drawn pick as a draw and the player as still in', async () => {
    // Whether a draw eliminates is a stored rule this surface cannot see, so
    // rendering "drew" as an elimination would be wrong in exactly the seasons
    // that configure it differently.
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('drew', NOW)} now={NOW} />)

    await waitFor(() => expect(screen.getByText('Your pick drew.')).toBeTruthy())
    expect(screen.getByText('You are still in.')).toBeTruthy()
    expect(screen.queryByText(/eliminated/i)).toBeNull()
  })

  it('says when picks lock, from an instant the round read always carried', async () => {
    // The surface loaded `locksAt` and threw it away, so a player could see a
    // round was open without being told how long for.
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('healthy', NOW)} now={NOW} />)

    await waitFor(() => expect(screen.getByText(/^Picks lock /)).toBeTruthy())
  })

  it('marks a consumed club as used and unpickable', async () => {
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('used_clubs', NOW)} now={NOW} />)

    const used = await screen.findByRole('button', { name: /Crystal Palace/ })
    expect(used.textContent).toContain('Used')
    expect(used).toHaveProperty('disabled', true)
  })

  it('states the refusal once when the round is locked', async () => {
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('locked', NOW)} now={NOW} />)

    await waitFor(() => expect(screen.getByText('This round is locked.')).toBeTruthy())
    expect(await screen.findByRole('button', { name: /Arsenal/ })).toHaveProperty('disabled', true)
  })

  it('offers nothing, and says why, before the competition launches', async () => {
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('not_launched', NOW)} now={NOW} />)

    await waitFor(() =>
      expect(
        screen.getByText('Last Man Standing has not started for this season yet.'),
      ).toBeTruthy(),
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('leaves the page unchanged when the server refuses the pick', async () => {
    const gateway = createDevSeasonLmsGateway('save_refused', NOW)
    const spy = vi.spyOn(gateway, 'pick')
    render(<SeasonLmsPage gateway={gateway} now={NOW} />)

    const arsenal = await screen.findByRole('button', { name: /Arsenal/ })
    arsenal.click()

    await waitFor(() => expect(spy).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText(/already used that club/i)).toBeTruthy(),
    )
    // Never shown as taken: a pick consumes a club and can eliminate, so it
    // lands only when the server accepts it.
    expect(
      (await screen.findByRole('button', { name: /Arsenal/ })).textContent,
    ).not.toContain('Your pick')
  })
})
