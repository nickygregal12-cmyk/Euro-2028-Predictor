import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type {
  SeasonPlayContext,
  SeasonPlayContextGateway,
} from '../../../src/features/season/seasonPlayContextModel'
import { useSeasonPlayContext } from '../../../src/features/season/useSeasonPlayContext'

/**
 * The hook that turns two URL slugs into a season.
 *
 * ONE PROPERTY MATTERS MORE THAN THE REST and it is the reason this file
 * exists: a response that arrives after the address changed must be discarded.
 * Every subsequent read and every write on this surface takes its season id
 * from here, so a stale response does not merely show the wrong page — it makes
 * the player enter predictions into the competition they navigated away from,
 * with the new season's name above them. The test below drives exactly that
 * race: the first season's load is left pending, the address changes, and the
 * first response is then resolved.
 */

function context(over: Partial<SeasonPlayContext> = {}): SeasonPlayContext {
  return {
    tournamentId: 'pl',
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    timeZone: 'Europe/London',
    status: 'draft',
    matchweek: 1,
    matchweekCount: 38,
    locksAt: null,
    ...over,
  }
}

function Probe({
  gateway,
  slug,
  seasonKey,
}: {
  gateway: SeasonPlayContextGateway
  slug: string | undefined
  seasonKey: string | undefined
}) {
  const state = useSeasonPlayContext(gateway, slug, seasonKey)
  return (
    <div>
      <span data-testid="kind">{state.kind}</span>
      <span data-testid="season">
        {state.kind === 'ready' || state.kind === 'season_over'
          ? state.context.tournamentId
          : '—'}
      </span>
    </div>
  )
}

describe('useSeasonPlayContext', () => {
  it('resolves the season the address names', async () => {
    const gateway: SeasonPlayContextGateway = {
      load: async (slug, seasonKey) => context({ tournamentId: `${slug}:${seasonKey}` }),
    }

    render(<Probe gateway={gateway} slug="premier-league" seasonKey="2026-27" />)

    await waitFor(() =>
      expect(screen.getByTestId('season')).toHaveTextContent('premier-league:2026-27'),
    )
  })

  it('discards a response that arrives after the address changed', async () => {
    const pending = new Map<string, (value: SeasonPlayContext) => void>()
    const gateway: SeasonPlayContextGateway = {
      load: (slug) =>
        new Promise<SeasonPlayContext>((resolve) => {
          pending.set(slug, resolve)
        }),
    }

    function Switcher() {
      const [slug, setSlug] = useState('premier-league')
      return (
        <div>
          <button onClick={() => setSlug('scottish-premiership')}>switch</button>
          <Probe gateway={gateway} slug={slug} seasonKey="2026-27" />
        </div>
      )
    }

    render(<Switcher />)
    await waitFor(() => expect(pending.has('premier-league')).toBe(true))

    screen.getByRole('button', { name: 'switch' }).click()
    await waitFor(() => expect(pending.has('scottish-premiership')).toBe(true))

    // The abandoned season answers first. Nothing may come of it.
    pending.get('premier-league')?.(context({ tournamentId: 'premier-league' }))
    await Promise.resolve()
    expect(screen.getByTestId('kind')).toHaveTextContent('loading')

    pending.get('scottish-premiership')?.(context({ tournamentId: 'scottish-premiership' }))
    await waitFor(() =>
      expect(screen.getByTestId('season')).toHaveTextContent('scottish-premiership'),
    )
  })

  it('refuses a missing parameter without calling the read', async () => {
    let calls = 0
    const gateway: SeasonPlayContextGateway = {
      load: async () => {
        calls += 1
        return context()
      },
    }

    render(<Probe gateway={gateway} slug={undefined} seasonKey="2026-27" />)

    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('unavailable'))
    expect(calls).toBe(0)
  })

  it('surfaces a failed read as unavailable rather than staying on the skeleton', async () => {
    const gateway: SeasonPlayContextGateway = {
      load: async () => {
        throw new Error('FetchError: network request failed')
      },
    }

    render(<Probe gateway={gateway} slug="premier-league" seasonKey="2026-27" />)

    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('unavailable'))
  })
})
