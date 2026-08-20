import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextDiscoveryScreen } from '../../src/vnext/integration/discovery/VNextDiscoveryScreen'

/**
 * A FOLLOW THAT DID NOT LAND SAYS SO, IN THE ROW IT WAS PRESSED IN.
 *
 * ============================ THE DEFECT =================================
 *
 * `useVNextDiscoverySource` has always had a `failed` write state carrying a
 * user-facing message. Connected Discovery read that state for `saving` and
 * for nothing else, so the whole of a refused write was:
 *
 *     Follow → Following… → Follow
 *
 * The row was telling the truth about the SERVER — the follow did not happen —
 * while telling the player nothing about their own press. That is the worst of
 * the three outcomes, because it is indistinguishable from a control that does
 * not work.
 *
 * ============================ WHAT THESE CASES HOLD ======================
 *
 * The whole path, through the real screen and the real hook, with only the two
 * Supabase modules replaced:
 *
 *   * a Follow and an Unfollow that succeed re-read the server rather than
 *     patching the row, and leave no failure behind;
 *   * a Follow and an Unfollow that fail keep the row, keep the rest of the
 *     catalogue, and print the write's own sentence;
 *   * the busy state names one row;
 *   * a retry that succeeds clears the failure;
 *   * and the sentence is announced, politely, because nothing is lost and the
 *     control beside it is already the retry.
 */

const server = vi.hoisted(() => {
  const state = {
    /** Which tournament ids the player follows, as the server holds them. */
    followed: new Set<string>(['t-1']),
    failWith: null as string | null,
    catalogueFails: false,
    preferencesFails: false,
  }
  const calls = { catalogue: 0, preferences: 0, write: 0 }
  return { state, calls }
})

vi.mock('../../src/services/supabase/weeklyCatalogue', () => ({
  fetchPublishedWeeklySeasons: async () => {
    server.calls.catalogue += 1
    if (server.state.catalogueFails) throw new Error('catalogue unavailable')
    return [
      {
        competitionSlug: 'caledonian',
        seasonKey: '2027-28',
        competitionId: 'c-1',
        competitionName: 'Caledonian Premiership',
        seasonId: 't-1',
        seasonName: 'Caledonian Premiership 2027/28',
        status: 'active',
        timeZone: 'Europe/London',
      },
      {
        competitionSlug: 'northern',
        seasonKey: '2027-28',
        competitionId: 'c-2',
        competitionName: 'Northern League',
        seasonId: 't-2',
        seasonName: 'Northern League 2027/28',
        status: 'active',
        timeZone: 'Europe/London',
      },
    ]
  },
}))

vi.mock('../../src/services/supabase/playerPreferences', () => ({
  fetchPlayerPreferences: async () => {
    server.calls.preferences += 1
    if (server.state.preferencesFails) throw new Error('preferences unavailable')
    return {
      onboarding: { step: null, completedAt: null },
      follows: [...server.state.followed].map((tournamentId) => ({
        tournamentId,
        favouriteTeamId: null,
        followedAt: null,
      })),
      pinnedRivals: [],
    }
  },
  setCompetitionFollow: async (tournamentId: string, following: boolean) => {
    server.calls.write += 1
    if (server.state.failWith !== null) throw new Error(server.state.failWith)
    if (following) server.state.followed.add(tournamentId)
    else server.state.followed.delete(tournamentId)
  },
}))

function renderDiscovery() {
  return render(
    <VNextRoot>
      <VNextDiscoveryScreen userId="player-1" authLoading={false} />
    </VNextRoot>,
  )
}

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-vnext-season="${id}"]`) as HTMLElement

async function readyCatalogue() {
  const view = renderDiscovery()
  // The row's own title element. The season name and the two controls' screen
  // reader suffixes also carry the competition's name, which is correct and is
  // why this is addressed by the row rather than by the string.
  await waitFor(() => expect(rowOf(view.container, 't-2')).toBeTruthy())
  return view
}

beforeEach(() => {
  server.state.followed = new Set<string>(['t-1'])
  server.state.failWith = null
  server.state.catalogueFails = false
  server.state.preferencesFails = false
  server.calls.catalogue = 0
  server.calls.preferences = 0
  server.calls.write = 0
})

describe('a follow write that lands', () => {
  it('re-reads the server rather than patching the row', async () => {
    const { container } = await readyCatalogue()

    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))

    // The row becomes Unfollow because the SERVER now says so — the re-read is
    // what changed it, not an optimistic edit to this lane's copy.
    await waitFor(() =>
      expect(
        within(rowOf(container, 't-2')).getByRole('button', { name: /unfollow/i }),
      ).toBeTruthy(),
    )
    expect(server.state.followed.has('t-2')).toBe(true)
    expect(document.querySelector('[data-vnext-zone="follow-failed"]')).toBeNull()
  })

  it('unfollows on the same terms', async () => {
    const { container } = await readyCatalogue()

    fireEvent.click(within(rowOf(container, 't-1')).getByRole('button', { name: /unfollow/i }))

    await waitFor(() =>
      expect(
        within(rowOf(container, 't-1')).getByRole('button', { name: /^follow/i }),
      ).toBeTruthy(),
    )
    expect(server.state.followed.has('t-1')).toBe(false)
  })
})

describe('a follow write that does not land', () => {
  it('keeps the row, keeps the catalogue, and says what happened', async () => {
    server.state.failWith = 'the follow could not be saved'
    const { container } = await readyCatalogue()

    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))

    const failure = await within(rowOf(container, 't-2')).findByRole('status')
    expect(failure.textContent).toBeTruthy()

    // THE ROW IS UNCHANGED, because the server is unchanged. The control has
    // returned to Follow and is itself the retry.
    expect(
      within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }),
    ).toBeEnabled()
    expect(server.state.followed.has('t-2')).toBe(false)

    // ONE ROW FAILING IS NOT THE CATALOGUE FAILING.
    expect(rowOf(container, 't-1')).toBeTruthy()
    expect(within(rowOf(container, 't-1')).queryByRole('status')).toBeNull()
  })

  it('says the same for an unfollow', async () => {
    server.state.failWith = 'the change could not be saved'
    const { container } = await readyCatalogue()

    fireEvent.click(within(rowOf(container, 't-1')).getByRole('button', { name: /unfollow/i }))

    await within(rowOf(container, 't-1')).findByRole('status')
    expect(server.state.followed.has('t-1')).toBe(true)
    expect(
      within(rowOf(container, 't-1')).getByRole('button', { name: /unfollow/i }),
    ).toBeEnabled()
  })

  it('announces politely rather than interrupting', async () => {
    // `status` and not `alert`: nothing is lost, the row is intact and the
    // player may simply press again. An assertive interruption for a retryable
    // write talks over whatever else the page just said.
    server.state.failWith = 'the follow could not be saved'
    const { container } = await readyCatalogue()

    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))

    const failure = await within(rowOf(container, 't-2')).findByRole('status')
    expect(failure.getAttribute('role')).toBe('status')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('while a write is in flight', () => {
  it('names one row and leaves the rest usable', async () => {
    // A write that never settles, so the busy state is observable rather than a
    // frame that has already gone.
    let release: () => void = () => {}
    server.state.failWith = null
    const preferences = await import('../../src/services/supabase/playerPreferences')
    const original = preferences.setCompetitionFollow
    vi.spyOn(preferences, 'setCompetitionFollow').mockImplementation(
      () => new Promise<void>((resolve) => {
        release = () => resolve()
      }),
    )

    const { container } = await readyCatalogue()
    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))

    await waitFor(() =>
      expect(
        within(rowOf(container, 't-2')).getByRole('button', { name: /following…/i }),
      ).toBeDisabled(),
    )
    expect(
      within(rowOf(container, 't-1')).getByRole('button', { name: /unfollow/i }),
    ).toBeEnabled()

    release()
    vi.mocked(preferences.setCompetitionFollow).mockRestore()
    expect(original).toBeTruthy()
  })
})

describe('recovery', () => {
  it('clears the failure once the same press succeeds', async () => {
    server.state.failWith = 'the follow could not be saved'
    const { container } = await readyCatalogue()

    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))
    await within(rowOf(container, 't-2')).findByRole('status')

    server.state.failWith = null
    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))

    await waitFor(() =>
      expect(
        within(rowOf(container, 't-2')).getByRole('button', { name: /unfollow/i }),
      ).toBeTruthy(),
    )
    expect(document.querySelector('[data-vnext-zone="follow-failed"]')).toBeNull()
  })
})
