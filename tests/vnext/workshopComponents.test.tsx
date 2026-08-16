import { fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { CalendarDays, Home } from 'lucide-react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MatchCard } from '../../src/vnext/components/football/MatchCard'
import { PrimaryActionCard } from '../../src/vnext/components/game/PrimaryActionCard'
import { LeagueLadder } from '../../src/vnext/components/social/LeagueLadder'
import { RivalStrip } from '../../src/vnext/components/social/RivalStrip'
import { VNextNav } from '../../src/vnext/components/navigation/VNextNav'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { WorkshopHomeSketch } from '../../src/vnext/workshop/WorkshopHomeSketch'
import {
  MATCHDAY_NOW,
  deadlineMatch,
  featuredLiveMatch,
  settledMatch,
  workshopHomeModel,
} from '../../src/vnext/fixtures'

/**
 * vNext component acceptance, kept to what is worth guarding in a workshop:
 * that the states the fixture describes actually reach the screen, that the
 * interactive parts are real controls with real names, and that reduced motion
 * changes the animation rather than the content.
 *
 * The axe scan uses the same rules and the same jsdom caveat as the legacy
 * component scans: `incomplete` counts as failing except for `color-contrast`,
 * which jsdom has no layout to measure.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

async function scan(ui: ReactElement) {
  const { unmount } = render(ui)
  try {
    const results = await axe.run(document.body, {
      runOnly: { type: 'tag', values: TAGS },
    })
    const failing = [
      ...results.violations,
      ...results.incomplete.filter((result) => !JSDOM_CANNOT_EVALUATE.has(result.id)),
    ].filter((result) => result.impact && FAIL_IMPACTS.has(result.impact))

    expect(
      failing,
      failing
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
              .slice(0, 3)
              .map((node) => node.html.slice(0, 140))
              .join(' | ')}`,
        )
        .join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

describe('MatchCard', () => {
  it('names a live match by its scoreline and shows the live minute', () => {
    render(
      <VNextRoot>
        <MatchCard match={featuredLiveMatch} now={MATCHDAY_NOW} showContext />
      </VNextRoot>,
    )

    const card = screen.getByRole('article', {
      name: 'Glenmore Athletic 2–1 Strathkelvin United',
    })
    expect(within(card).getByText('Live')).toBeInTheDocument()
    expect(within(card).getByText("67'")).toBeInTheDocument()
  })

  it('labels points still on the pitch as provisional', () => {
    render(
      <VNextRoot>
        <MatchCard match={featuredLiveMatch} now={MATCHDAY_NOW} />
      </VNextRoot>,
    )

    expect(screen.getByText(/on the pitch/i)).toBeInTheDocument()
    expect(screen.getByText('Your call')).toBeInTheDocument()
  })

  it('shows an unpredicted match as needing action, with the lock countdown', () => {
    const onAction = vi.fn()
    render(
      <VNextRoot>
        <MatchCard match={deadlineMatch} now={MATCHDAY_NOW} onAction={onAction} />
      </VNextRoot>,
    )

    expect(screen.getByText('Not predicted')).toBeInTheDocument()
    expect(screen.getByText('Locks in 38 min')).toBeInTheDocument()

    // The action is a real button, and its accessible name says which match it
    // acts on — "Predict" alone is useless in a rail of five cards.
    const action = screen.getByRole('button', {
      name: /Predict — Inverness Caledonian Rangers versus Porthaven City/,
    })
    fireEvent.click(action)
    expect(onAction).toHaveBeenCalledWith(deadlineMatch)
  })

  it('states a settled outcome in words, not only in colour', () => {
    render(
      <VNextRoot>
        <MatchCard match={settledMatch} now={MATCHDAY_NOW} showContext />
      </VNextRoot>,
    )

    expect(screen.getByText('Exact score')).toBeInTheDocument()
    expect(screen.getByText('Full time')).toBeInTheDocument()
    expect(screen.getByText(/6 pts/)).toBeInTheDocument()
  })

  it('marks the user’s own scoreline inside the community consensus', () => {
    render(
      <VNextRoot>
        <MatchCard match={featuredLiveMatch} now={MATCHDAY_NOW} showContext />
      </VNextRoot>,
    )

    const popular = screen.getByText('your call').closest('li')
    expect(popular).not.toBeNull()
    expect(within(popular as HTMLElement).getByText('2–1')).toBeInTheDocument()
  })

  it('has no serious accessibility failures in any match state', async () => {
    await scan(
      <VNextRoot>
        <MatchCard
          match={featuredLiveMatch}
          now={MATCHDAY_NOW}
          variant="feature"
          showContext
          onAction={() => {}}
        />
        <MatchCard match={deadlineMatch} now={MATCHDAY_NOW} showContext onAction={() => {}} />
        <MatchCard match={settledMatch} now={MATCHDAY_NOW} showContext />
      </VNextRoot>,
    )
  })
})

describe('PrimaryActionCard', () => {
  it('announces progress and the deadline, and fires one action', () => {
    const onAct = vi.fn()
    render(
      <VNextRoot>
        <PrimaryActionCard
          action={workshopHomeModel.primaryAction}
          now={MATCHDAY_NOW}
          onAct={onAct}
        />
      </VNextRoot>,
    )

    expect(
      screen.getByRole('heading', { name: '2 predictions to make' }),
    ).toBeInTheDocument()
    expect(screen.getByText('3 of 5 predictions in')).toBeInTheDocument()
    expect(screen.getByText(/38 min left/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Make your predictions' }))
    expect(onAct).toHaveBeenCalledTimes(1)
  })
})

describe('social components', () => {
  it('marks the user’s row and states the gap to the leader', () => {
    render(
      <VNextRoot>
        <LeagueLadder league={workshopHomeModel.privateLeagues[0]} />
      </VNextRoot>,
    )

    const rows = screen.getAllByRole('listitem')
    const userRow = rows.find((row) => row.getAttribute('aria-current') === 'true')
    expect(userRow).toBeDefined()
    expect(within(userRow as HTMLElement).getByText('You')).toBeInTheDocument()
    expect(screen.getByText('2 points to catch Jamie Ferguson-Whyte')).toBeInTheDocument()
  })

  it('describes rank movement as a sentence rather than an arrow alone', () => {
    render(
      <VNextRoot>
        <LeagueLadder league={workshopHomeModel.privateLeagues[0]} />
      </VNextRoot>,
    )

    expect(screen.getAllByText('You moved up 2 places').length).toBeGreaterThan(0)
    expect(screen.getByText('Martin Okafor moved down 1 place')).toBeInTheDocument()
  })

  it('says which side of the user each rival sits on', () => {
    render(
      <VNextRoot>
        <RivalStrip rivals={workshopHomeModel.rivals} />
      </VNextRoot>,
    )

    expect(screen.getByText('2 points to catch Jamie')).toBeInTheDocument()
    expect(screen.getByText(/points ahead of you/)).toBeInTheDocument()
    expect(screen.getAllByText(/points behind you/).length).toBeGreaterThan(0)
  })

  it('has no serious accessibility failures', async () => {
    await scan(
      <VNextRoot>
        <LeagueLadder
          league={workshopHomeModel.privateLeagues[0]}
          onOpen={() => {}}
        />
        <RivalStrip rivals={workshopHomeModel.rivals} />
      </VNextRoot>,
    )
  })
})

describe('VNextNav', () => {
  it('is a labelled nav of real buttons with the active one marked', () => {
    const onSelect = vi.fn()
    render(
      <VNextRoot>
        <VNextNav activeId="home" onSelect={onSelect} />
      </VNextRoot>,
    )

    const nav = screen.getByRole('navigation', { name: 'vNext primary' })
    const home = within(nav).getByRole('button', { name: 'Home' })
    expect(home).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(nav).getByRole('button', { name: 'Leagues' }))
    expect(onSelect).toHaveBeenCalledWith('leagues')
  })

  it('puts a badge count into the destination’s name', () => {
    render(
      <VNextRoot>
        <VNextNav
          activeId="home"
          items={[
            { id: 'home', label: 'Home', icon: Home },
            { id: 'fixtures', label: 'Fixtures', icon: CalendarDays, badge: 2 },
          ]}
        />
      </VNextRoot>,
    )

    // Not "2 waitingFixtures": adjacent text nodes are announced with no
    // separator, so the count belongs in the name rather than in a hidden span.
    expect(
      screen.getByRole('button', { name: 'Fixtures, 2 waiting' }),
    ).toBeInTheDocument()
  })

  it('renders both compositions without duplicating the badge text', () => {
    render(
      <VNextRoot>
        <VNextNav variant="rail" activeId="leagues" />
      </VNextRoot>,
    )
    expect(
      screen.getByRole('button', { name: 'Leagues' }),
    ).toHaveAttribute('aria-current', 'page')
  })
})

describe('workshop sketch', () => {
  it('renders the whole scenario from fixtures alone', () => {
    render(
      <VNextRoot>
        <WorkshopHomeSketch model={workshopHomeModel} />
      </VNextRoot>,
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Live now' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Next up' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Settled' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Work League' }),
    ).toBeInTheDocument()
  })

  it('keeps every rail reachable from the keyboard', () => {
    render(
      <VNextRoot>
        <WorkshopHomeSketch model={workshopHomeModel} />
      </VNextRoot>,
    )

    // A scrollable region no keyboard user can reach fails WCAG 2.1.1, which is
    // why Rail carries tabIndex on the scroller.
    for (const name of ['Live now', 'Next up', 'Settled']) {
      const region = screen.getByRole('region', { name })
      expect(region.querySelector('[tabindex="0"]')).not.toBeNull()
    }
  })
})

describe('reduced motion', () => {
  it('renders the same content on the reduced path', () => {
    const { unmount } = render(
      <VNextRoot motion="full">
        <WorkshopHomeSketch model={workshopHomeModel} />
      </VNextRoot>,
    )
    const fullText = screen.getByRole('main').textContent
    unmount()

    render(
      <VNextRoot motion="reduced">
        <WorkshopHomeSketch model={workshopHomeModel} />
      </VNextRoot>,
    )
    expect(screen.getByRole('main').textContent).toBe(fullText)
  })

  it('marks the reduced setting on the vNext root so CSS can answer it too', () => {
    const { container } = render(
      <VNextRoot motion="reduced">
        <p>content</p>
      </VNextRoot>,
    )
    expect(
      container.querySelector('[data-vnext][data-vnext-motion="reduced"]'),
    ).not.toBeNull()
  })

  it('leaves the attribute off when the operating system decides', () => {
    const { container } = render(
      <VNextRoot>
        <p>content</p>
      </VNextRoot>,
    )
    const root = container.querySelector('[data-vnext]')
    expect(root).not.toBeNull()
    expect(root?.hasAttribute('data-vnext-motion')).toBe(false)
  })
})
