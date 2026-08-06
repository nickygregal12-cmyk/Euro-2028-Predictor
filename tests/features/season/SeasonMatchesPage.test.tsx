import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonMatchesPage } from '../../../src/features/season/SeasonMatchesPage'
import type { SeasonMatchesGateway } from '../../../src/features/season/matchesModel'
import type {
  SeasonFixture,
  SeasonMatchweekFixtures,
} from '../../../src/services/supabase/seasonFixtures'

function fixture(overrides: Partial<SeasonFixture> = {}): SeasonFixture {
  return {
    id: 'fixture-1',
    kickoffAt: '2026-08-08T14:00:00+00:00',
    status: 'scheduled',
    homeName: 'Dundee',
    awayName: 'Aberdeen',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

function matchweek(number: number, fixtures: SeasonFixture[]): SeasonMatchweekFixtures {
  return { matchweek: number, matchweekCount: 38, fixtures }
}

function gatewayFor(
  answer: (matchweek: number) => SeasonMatchweekFixtures | Error,
): SeasonMatchesGateway {
  return {
    load: vi.fn(async (number: number) => {
      const result = answer(number)
      if (result instanceof Error) throw result
      return result
    }),
  }
}

function renderPage(gateway: SeasonMatchesGateway, openAt = 2) {
  render(<SeasonMatchesPage gateway={gateway} timeZone="Europe/London" openAt={openAt} />)
}

describe('the competition matches surface', () => {
  it('shows the real fixtures for the matchweek it opens at', async () => {
    const gateway = gatewayFor(() =>
      matchweek(2, [
        fixture({ id: 'a', homeName: 'Rangers', awayName: 'Hibernian' }),
        fixture({ id: 'b', homeName: 'Kilmarnock', awayName: 'Celtic' }),
      ]),
    )
    renderPage(gateway)

    expect(await screen.findByText('Rangers')).toBeTruthy()
    expect(screen.getByText('Hibernian')).toBeTruthy()
    expect(screen.getByText('Celtic')).toBeTruthy()
    expect(gateway.load).toHaveBeenCalledWith(2)
  })

  it('opens at the matchweek it was given, not at the first of the season', async () => {
    const gateway = gatewayFor((number) => matchweek(number, [fixture()]))
    renderPage(gateway, 17)

    expect(await screen.findByText('Matchweek 17 of 38')).toBeTruthy()
  })

  it('steps to the next matchweek and reads it from the server', async () => {
    const gateway = gatewayFor((number) =>
      matchweek(number, [fixture({ homeName: `Home ${number}` })]),
    )
    renderPage(gateway)

    await screen.findByText('Home 2')
    fireEvent.click(screen.getByRole('button', { name: 'Next matchweek' }))

    expect(await screen.findByText('Home 3')).toBeTruthy()
    expect(await screen.findByText('Matchweek 3 of 38')).toBeTruthy()
  })

  it('cannot step past either end of the season', async () => {
    const first = gatewayFor(() => matchweek(1, [fixture()]))
    renderPage(first, 1)

    await screen.findByText('Matchweek 1 of 38')
    expect(
      (screen.getByRole('button', { name: 'Previous matchweek' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('explains a blank score column rather than leaving it looking broken', async () => {
    // Every season fixture in development is `scheduled`, because nothing can
    // record a season result yet. That renders every score blank, which is
    // honest and looks like a fault unless it is said out loud.
    renderPage(gatewayFor(() => matchweek(2, [fixture(), fixture({ id: 'b' })])))

    expect(await screen.findByText(/No results yet for this matchweek/)).toBeTruthy()
  })

  it('shows a confirmed result as a scoreline', async () => {
    renderPage(
      gatewayFor(() =>
        matchweek(2, [fixture({ status: 'played', homeScore: 2, awayScore: 1 })]),
      ),
    )

    expect(await screen.findByText('2 - 1')).toBeTruthy()
  })

  it('shows a failed read as a failure, never as an empty fixture list', async () => {
    renderPage(gatewayFor(() => new Error('offline')))

    expect(await screen.findByText('We could not load these fixtures')).toBeTruthy()
    expect(screen.queryByText('No fixtures in this matchweek')).toBeNull()
  })

  it('says a matchweek has no fixtures rather than rendering a bare list', async () => {
    renderPage(gatewayFor(() => matchweek(2, [])))

    expect(await screen.findByText('No fixtures in this matchweek')).toBeTruthy()
  })

  it('keeps the outgoing matchweek on screen while the next one loads', async () => {
    // Replacing a readable list with a skeleton on every tap makes the stepper
    // feel broken on a slow connection.
    // Held on an object rather than in a `let`: assigning inside the promise
    // executor is invisible to control-flow analysis, which then narrows a
    // local to `never` at the call below.
    const gate: { release: (() => void) | null } = { release: null }
    const gateway: SeasonMatchesGateway = {
      load: vi.fn(async (number: number) => {
        if (number === 3) {
          await new Promise<void>((resolve) => {
            gate.release = resolve
          })
        }
        return matchweek(number, [fixture({ homeName: `Home ${number}` })])
      }),
    }
    renderPage(gateway)

    await screen.findByText('Home 2')
    fireEvent.click(screen.getByRole('button', { name: 'Next matchweek' }))

    // Still showing matchweek 2 while 3 is in flight.
    await waitFor(() => expect(gateway.load).toHaveBeenCalledWith(3))
    expect(screen.getByText('Home 2')).toBeTruthy()

    gate.release?.()
    expect(await screen.findByText('Home 3')).toBeTruthy()
  })

  it('announces the matchweek it landed on', async () => {
    // A screen-reader user stepping through matchweeks needs to hear where
    // they are; the arrows say only "next" and "previous".
    renderPage(gatewayFor((number) => matchweek(number, [fixture()])))

    const live = await screen.findByText('Matchweek 2 of 38')
    expect(live.getAttribute('aria-live')).toBe('polite')
  })

  it('shows no prediction, because that belongs to the game and not to the fixtures', async () => {
    // §7.3 separates Matches from Play. The decoder drops the prediction, so
    // there is nothing here that could render one.
    renderPage(gatewayFor(() => matchweek(2, [fixture()])))

    await screen.findByText('Dundee')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
