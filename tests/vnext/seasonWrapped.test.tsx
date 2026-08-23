import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextSeasonWrapped } from '../../src/vnext/wrapped/VNextSeasonWrapped'
import {
  shellScenarios,
  wrappedScenarioNames,
  wrappedScenarioPremises,
  wrappedScenarios,
} from '../../src/vnext/fixtures'
import { buildWrappedModel } from '../../src/vnext/integration/wrapped/buildWrappedModel'
import type { SeasonWrappedModel } from '../../src/vnext/models/wrapped'
import type { WrappedSource } from '../../src/vnext/integration/wrapped/wrappedSource'
import { expectNoAxeViolations } from './vnextAxe'

/**
 * SEASON WRAPPED — the archive, read at last.
 *
 * Contract 156 has written an immutable end-of-season row since `MIG-UI-08`
 * and nothing has ever rendered it. What makes this surface worth having is
 * that its numbers CANNOT move, so the rules held here are all about not
 * inventing one that can:
 *
 *   • no percentile, ever. `rank` and `fieldSize` are both on the page and
 *     dividing them would be trivial; it is the one figure that would change
 *     the day somebody changed a formula, on the one page that promises not to;
 *   • a figure the archive did not state is OMITTED, not zeroed;
 *   • "still going" and "could not read" are different pages, because they send
 *     a player to different places.
 */

function renderWrapped(model: SeasonWrappedModel, onRetry?: () => void) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextSeasonWrapped model={model} {...(onRetry ? { onRetry } : {})} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function source(overrides: Partial<WrappedSource> = {}): WrappedSource {
  return {
    generatedAt: '2028-05-28T09:00:00.000Z',
    competitionName: 'Test League',
    seasonLabel: '2027/28',
    playerName: 'Aisha Kaur',
    wrapped: {
      finalised: true,
      season: { points: 418, rank: 1102, fieldSize: 12490, matchweeksPlayed: 36 },
      bestMatchweek: { ordinal: 27, points: 24 },
      accuracy: { fixturesPredicted: 342, exactScores: 71, correctOutcomes: 168 },
      jokersPlayed: 4,
      finalisedAt: '2028-05-26T18:40:00.000Z',
    },
    ...overrides,
  }
}

describe('every world renders and is reachable', () => {
  it.each(wrappedScenarioNames)('%s', (name) => {
    // The premise is what a reviewer is told the board is FOR; a world with no
    // stated premise is one nobody can review.
    expect(wrappedScenarioPremises[name].length).toBeGreaterThan(20)

    const { container } = renderWrapped(wrappedScenarios[name])
    expect(container.querySelector('[data-vnext] main')).not.toBeNull()
  })

  it.each(wrappedScenarioNames)('%s has no accessibility violations', async (name) => {
    await expectNoAxeViolations(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextSeasonWrapped model={wrappedScenarios[name]} />
        </VNextShellProvider>
      </VNextRoot>,
    )
  })
})

describe('a finished season', () => {
  it('states what the archive stored', () => {
    renderWrapped(wrappedScenarios.played)

    expect(screen.getByText('418')).toBeInTheDocument()
    expect(screen.getByText('1,102nd')).toBeInTheDocument()
    expect(screen.getByText('of 12,490')).toBeInTheDocument()
    expect(screen.getByText(/24/)).toBeInTheDocument()
  })

  it('says the record does not change', () => {
    renderWrapped(wrappedScenarios.played)

    // The difference between this page and the standings, said out loud.
    expect(screen.getByText(/does not change/i)).toBeInTheDocument()
  })

  it('never prints a percentile', () => {
    const { container } = renderWrapped(wrappedScenarios.played)
    const text = container.textContent ?? ''

    // The two accuracy shares are contract-sanctioned and are shares of the
    // player's OWN calls — which is why each one says so beside it. A
    // percentile would be a share of the FIELD, and 1102 of 12490 is 8.8%: a
    // number nothing here may print, however easy it would be to divide.
    expect(text).not.toMatch(/percentile|top \d+%|8\.8%/)
    for (const share of screen.getAllByText(/% of your calls/)) {
      expect(share).toBeInTheDocument()
    }
    expect(screen.getAllByText(/% of your calls/)).toHaveLength(2)
  })
})

describe('a figure the archive did not state', () => {
  it('is omitted rather than zeroed', () => {
    renderWrapped(wrappedScenarios.unranked)

    expect(screen.queryByText('Finished')).toBeNull()
    expect(screen.queryByText(/unranked/i)).toBeNull()
    expect(screen.queryByText('0th')).toBeNull()
    // Everything else survives.
    expect(screen.getByText('418')).toBeInTheDocument()
  })
})

describe('a season nobody played', () => {
  it('is a sentence rather than a grid of zeros', () => {
    renderWrapped(wrappedScenarios.neverPlayed)

    expect(screen.getByText(/never put a scoreline in/i)).toBeInTheDocument()
    expect(screen.queryByText('Points')).toBeNull()
    expect(screen.queryByText('Exact scores')).toBeNull()
  })
})

describe('the two answers that are not a season', () => {
  it('tells a player mid-season that their season is still going', () => {
    renderWrapped(wrappedScenarios.pending, () => {})

    expect(screen.getByText(/still going/i)).toBeInTheDocument()
    // Nothing to retry about a season that has not ended.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('apologises for a read that did not answer, and offers a way out', () => {
    renderWrapped(wrappedScenarios.unavailable, () => {})

    expect(screen.getByText(/could not read/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('the mapper', () => {
  it('copies the archive across without adjusting anything', () => {
    const model = buildWrappedModel(source())
    const body = model.body

    expect(body.kind).toBe('wrapped')
    if (body.kind !== 'wrapped') return
    expect(body.result.season).toEqual({
      points: 418,
      rank: 1102,
      fieldSize: 12490,
      matchweeksPlayed: 36,
    })
    expect(body.result.best).toEqual({ ordinal: 27, points: 24 })
    expect(body.result.jokersPlayed).toBe(4)
  })

  it('divides the two shares the contract sanctions, and nothing else', () => {
    const model = buildWrappedModel(source())
    if (model.body.kind !== 'wrapped') throw new Error('expected a wrapped season')

    expect(model.body.result.accuracy.exactShare).toBeCloseTo(71 / 342, 10)
    expect(model.body.result.accuracy.correctShare).toBeCloseTo(168 / 342, 10)
  })

  it('answers pending for a season that has not ended', () => {
    // NOT an absence. The archive said so, and a player mid-season must not be
    // told something went wrong.
    expect(buildWrappedModel(source({ wrapped: { finalised: false } })).body.kind).toBe(
      'pending',
    )
  })

  it('answers unavailable only when the read did not land', () => {
    expect(buildWrappedModel(source({ wrapped: null })).body.kind).toBe('unavailable')
  })

  it('prints no share for a season nobody played', () => {
    const model = buildWrappedModel(
      source({
        wrapped: {
          finalised: true,
          season: { points: 0, rank: null, fieldSize: null, matchweeksPlayed: 0 },
          bestMatchweek: null,
          accuracy: { fixturesPredicted: 0, exactScores: 0, correctOutcomes: 0 },
          jokersPlayed: 0,
          finalisedAt: null,
        },
      }),
    )
    if (model.body.kind !== 'wrapped') throw new Error('expected a wrapped season')

    // `NaN%` and a confident `0%` are both worse than nothing.
    expect(model.body.result.accuracy.exactShare).toBeNull()
    expect(model.body.result.accuracy.correctShare).toBeNull()
  })
})
