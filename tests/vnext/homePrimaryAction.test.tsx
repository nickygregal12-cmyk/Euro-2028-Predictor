import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  competitionGameRoute,
  competitionMatchCentreRoute,
  competitionSectionRoute,
} from '../../src/app/weeklyRoutes'
import { homeIntentRoute } from '../../src/app/vnext/homeNavigation'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextHome, type HomeIntent } from '../../src/vnext/home/VNextHome'
import type { HomeModel } from '../../src/vnext/models/home'

function renderHome(
  model: HomeModel,
  onIntent: (intent: HomeIntent) => void,
) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextHome model={model} onIntent={onIntent} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

describe('Home navigation actions', () => {
  it('emits the leagues destination when the banner says Find a league', () => {
    const onIntent = vi.fn()
    renderHome(homeScenarios.newSeason, onIntent)

    fireEvent.click(screen.getByRole('button', { name: 'Find a league' }))

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-leagues' })
  })

  it('emits the predictor destination from the decision hero', () => {
    const onIntent = vi.fn()
    renderHome(homeScenarios.decision, onIntent)

    fireEvent.click(screen.getByRole('button', { name: /Make your prediction/ }))

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-predictor' })
  })

  it('emits the featured fixture when the banner promises Match centre', () => {
    const onIntent = vi.fn()
    const featured = homeScenarios.live.liveMatches.find((match) => match.isFeatured)
    if (featured === undefined) throw new Error('live Home must expose a featured fixture')

    renderHome(homeScenarios.live, onIntent)
    fireEvent.click(screen.getByRole('button', { name: 'Match centre' }))

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-match', matchId: featured.id })
  })

  it('opens the featured card through the same exact-fixture intent', () => {
    const onIntent = vi.fn()
    const featured = homeScenarios.live.liveMatches.find((match) => match.isFeatured)
    if (featured === undefined) throw new Error('live Home must expose a featured fixture')

    renderHome(homeScenarios.live, onIntent)
    fireEvent.click(
      screen.getByRole('button', {
        name: `Match centre for ${featured.home.team.name} versus ${featured.away.team.name}`,
      }),
    )

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-match', matchId: featured.id })
  })

  it('opens a supporting live row through the same exact-fixture intent', () => {
    const onIntent = vi.fn()
    const supportingLive = homeScenarios.live.liveMatches.find((match) => !match.isFeatured)
    if (supportingLive === undefined) throw new Error('live Home must expose a supporting live fixture')

    renderHome(homeScenarios.live, onIntent)
    fireEvent.click(
      screen.getByRole('button', {
        name: `Match centre — ${supportingLive.home.team.name} versus ${supportingLive.away.team.name}`,
      }),
    )

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'open-match',
      matchId: supportingLive.id,
    })
  })

  it('opens the predictor from a supporting fixture that needs a call', () => {
    const onIntent = vi.fn()
    const fixture = homeScenarios.competition.upcomingMatches.find(
      (match) => match.prediction === null,
    )
    if (fixture === undefined) throw new Error('competition Home must expose an open fixture')

    renderHome(homeScenarios.competition, onIntent)
    fireEvent.click(
      screen.getByRole('button', {
        name: `Predict — ${fixture.home.team.name} versus ${fixture.away.team.name}`,
      }),
    )

    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-predictor' })
  })

  it('routes every Home intent through existing application route helpers', () => {
    const context = {
      competitionSlug: 'premier-league',
      seasonSlug: '2027-28',
    }

    expect(homeIntentRoute(context, { kind: 'open-predictor' })).toBe(
      competitionGameRoute(context, 'match-predictor'),
    )
    expect(homeIntentRoute(context, { kind: 'open-leagues' })).toBe(
      competitionSectionRoute(context, 'leagues'),
    )
    expect(homeIntentRoute(context, { kind: 'open-match', matchId: 'fixture-live' })).toBe(
      competitionMatchCentreRoute(context, 'fixture-live'),
    )
  })
})
