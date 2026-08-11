import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonCupGroupStage } from '../../../src/features/season/SeasonCupGroupStage'
import { mapSeasonCupGroupStage } from '../../../src/services/supabase/seasonCupGroupStageModel'

/**
 * The Championship group stage (contract 167).
 *
 * THE DEFECT THIS AVOIDS is assuming the first group in the array is the
 * caller's. On a multi-group draw it is somebody else's table, and a player who
 * opens their Championship to see where they stand would be shown a group they
 * are not in — with no indication that is what happened.
 *
 * The rest is the same ordering property the league table has: rank is the
 * standings authority's and is printed as sent, never recomputed from the array.
 */

function row(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    user_id: 'a',
    display_name: 'Alex',
    is_me: false,
    table_points: 9,
    points_for: 24,
    points_against: 11,
    window_points: 3,
    exacts: 2,
    corrects: 5,
    ...overrides,
  }
}

const TWO_GROUPS = {
  available: true,
  entered: true,
  competition: { id: 'c1', name: 'Office Cup', season_name: 'Premier League 2026/27' },
  group_count: 2,
  my_group_ordinal: 2,
  matchdays: 6,
  groups: [
    {
      group_id: 'g1',
      ordinal: 1,
      size: 2,
      is_my_group: false,
      rows: [row({ user_id: 'a', display_name: 'Alex' })],
    },
    {
      group_id: 'g2',
      ordinal: 2,
      size: 2,
      is_my_group: true,
      rows: [
        row({ rank: 2, user_id: 'me', display_name: 'You', is_me: true, table_points: 4 }),
        row({ rank: 1, user_id: 'sam', display_name: 'Sam', table_points: 7 }),
      ],
    },
  ],
}

function renderStage(payload: Record<string, unknown>) {
  render(
    <SeasonCupGroupStage read={vi.fn(async () => mapSeasonCupGroupStage(payload))} />,
  )
}

describe('a multi-group Championship', () => {
  it('opens the caller’s own group, not the first one in the array', async () => {
    renderStage(TWO_GROUPS)

    // Group 2 is the caller's and group 1 comes first in the payload.
    const panel = await screen.findByRole('tabpanel')
    expect(within(panel).getByText(/Group 2 — your group/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/Group 2/)
  })

  it('lets the player reach the other groups without leaving', async () => {
    renderStage(TWO_GROUPS)
    await screen.findByRole('tabpanel')

    fireEvent.click(screen.getByRole('tab', { name: /Group 1/ }))

    expect(within(screen.getByRole('tabpanel')).getByText(/Group 1/)).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
  })

  it('prints the standings authority’s rank rather than the array order', async () => {
    renderStage(TWO_GROUPS)
    const panel = await screen.findByRole('tabpanel')

    const ranks = within(panel)
      .getAllByRole('row')
      .slice(1)
      .map((tr) => within(tr).getAllByRole('cell')[0]?.textContent)
    expect(ranks).toEqual(['2', '1'])
  })

  it('says how many groups and matchdays there are', async () => {
    renderStage(TWO_GROUPS)

    expect(await screen.findByText(/2 groups · 6 matchdays/)).toBeInTheDocument()
  })
})

describe('a single-group Championship', () => {
  it('shows no tab strip, because a tablist of one decides nothing', async () => {
    renderStage({
      ...TWO_GROUPS,
      group_count: 1,
      my_group_ordinal: 1,
      groups: [{ ...TWO_GROUPS.groups[1], ordinal: 1, is_my_group: true }],
    })

    await screen.findByRole('table')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })
})

describe('the states that are not a table', () => {
  it('names the competition when the caller is not entered', async () => {
    renderStage({
      available: true,
      entered: false,
      competition: { id: 'c1', name: 'Office Cup', season_name: 'Premier League 2026/27' },
    })

    // "You are not in this one" is actionable; an unnamed empty bracket is not.
    expect(await screen.findByText(/You are not in Office Cup/)).toBeInTheDocument()
  })

  it('says an undrawn Championship is undrawn rather than showing nothing', async () => {
    renderStage({ ...TWO_GROUPS, group_count: 0, my_group_ordinal: null, groups: [] })

    expect(await screen.findByText(/has not been drawn yet/)).toBeInTheDocument()
  })

  it('says so when the caller holds no group on a drawn field', async () => {
    renderStage({ ...TWO_GROUPS, my_group_ordinal: null })

    expect(await screen.findByText(/you hold no group/)).toBeInTheDocument()
  })

  it('reports a failed read as a failure, never as an undrawn competition', async () => {
    render(
      <SeasonCupGroupStage
        read={vi.fn(async () => {
          throw new Error('network')
        })}
      />,
    )

    expect(await screen.findByText(/could not load the group stage/i)).toBeInTheDocument()
    expect(screen.queryByText(/has not been drawn yet/)).toBeNull()
  })
})
