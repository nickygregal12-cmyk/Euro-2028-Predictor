import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SeasonLmsRegistration } from '../../../src/features/season/SeasonLmsRegistration'
import { SeasonLmsPage } from '../../../src/features/season/SeasonLmsPage'
import { createDevSeasonLmsRegistrationGateway } from '../../../src/dev/seasonLmsRegistrationGateway'
import { createDevSeasonLmsGateway } from '../../../src/dev/seasonLmsGateway'

const NOW = () => new Date('2027-01-14T12:00:00Z')

describe('the season LMS registration panel', () => {
  it('offers a join when the window is open', async () => {
    render(<SeasonLmsRegistration gateway={createDevSeasonLmsRegistrationGateway('open')} />)

    await waitFor(() => expect(screen.getByText('Join Last Man Standing')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy()
  })

  it('renders nothing once entered, leaving membership to the round surface', async () => {
    const { container } = render(
      <SeasonLmsRegistration gateway={createDevSeasonLmsRegistrationGateway('entered')} />,
    )

    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })

  it('explains a closed window instead of hiding the panel', async () => {
    render(<SeasonLmsRegistration gateway={createDevSeasonLmsRegistrationGateway('closed')} />)

    await waitFor(() => expect(screen.getByText('Registration has closed')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })

  it('says a window has not opened, without offering a join', async () => {
    render(<SeasonLmsRegistration gateway={createDevSeasonLmsRegistrationGateway('not_open')} />)

    await waitFor(() => expect(screen.getByText('Registration has not opened')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })

  it('renders a load failure as a failure with a retry, never a closed window', async () => {
    render(<SeasonLmsRegistration gateway={createDevSeasonLmsRegistrationGateway('load_failed')} />)

    await waitFor(() =>
      expect(screen.getByText('We could not load registration')).toBeTruthy(),
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText('Registration has closed')).toBeNull()
  })

  it('joins, then tells the round surface to reload', async () => {
    const onJoined = vi.fn()
    render(
      <SeasonLmsRegistration
        gateway={createDevSeasonLmsRegistrationGateway('open')}
        onJoined={onJoined}
      />,
    )

    const join = await screen.findByRole('button', { name: 'Join' })
    join.click()

    await waitFor(() => expect(onJoined).toHaveBeenCalled())
  })

  it('keeps the refusal visible after the reload that follows it', async () => {
    // The reload clears the error, so the sentence has to survive it — the
    // player would otherwise get no explanation at all.
    render(
      <SeasonLmsRegistration gateway={createDevSeasonLmsRegistrationGateway('join_refused')} />,
    )

    const join = await screen.findByRole('button', { name: 'Join' })
    join.click()

    await waitFor(() =>
      expect(screen.getByText('You cannot join this competition right now.')).toBeTruthy(),
    )
    // Claims none of the five rules that share the code.
    expect(screen.queryByText(/eliminated/i)).toBeNull()
  })
})

describe('the season LMS page with registration', () => {
  it('turns the dead "join to make a pick" refusal into an actual join', async () => {
    // The refusal named an action the interface did not offer; the control now
    // sits beside it.
    render(
      <SeasonLmsPage
        gateway={createDevSeasonLmsGateway('not_entered', NOW)}
        now={NOW}
        registration={createDevSeasonLmsRegistrationGateway('open')}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Join Last Man Standing to make a pick.')).toBeTruthy(),
    )
    expect(await screen.findByRole('button', { name: 'Join' })).toBeTruthy()
  })

  it('behaves exactly as before when the caller supplies no registration', async () => {
    render(<SeasonLmsPage gateway={createDevSeasonLmsGateway('not_entered', NOW)} now={NOW} />)

    await waitFor(() =>
      expect(screen.getByText('Join Last Man Standing to make a pick.')).toBeTruthy(),
    )
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })

  it('offers registration even when there is no round to play yet', async () => {
    render(
      <SeasonLmsPage
        gateway={createDevSeasonLmsGateway('not_launched', NOW)}
        now={NOW}
        registration={createDevSeasonLmsRegistrationGateway('open')}
      />,
    )

    await waitFor(() => expect(screen.getByText('No round to play')).toBeTruthy())
    expect(await screen.findByRole('button', { name: 'Join' })).toBeTruthy()
  })
})
