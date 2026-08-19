import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  useVNextChampionshipSource,
  type VNextChampionshipSourceInput,
  type VNextChampionshipSourceState,
} from '../../src/vnext/integration/championship/useVNextChampionshipSource'
import { last } from '../support/indexed'

/**
 * THE ACQUISITION LIFECYCLE FOR THE PREDICTOR CHAMPIONSHIP.
 *
 * WHAT IT HOLDS:
 *
 *   1. A FAILED BRACKET READ IS A PANEL OUTCOME, NOT A DEAD PAGE. Only the
 *      play context can fail the whole surface.
 *   2. A RE-READ KEEPS THE PAGE IT IS REFRESHING. Stage 11 shipped the
 *      opposite and blanked the surface on its primary interaction; the mocked
 *      read here is deliberately slow, because the defect is invisible when
 *      everything resolves in a microtask.
 *   3. ONE READ PER VISIT, and a different competition genuinely reloads.
 */

const server = vi.hoisted(() => {
  const calls = { context: 0, bracket: 0, submit: 0 }
  const state = {
    contextFails: false,
    bracketFails: false,
    delayMs: 0,
    /** null | a SQLSTATE the write should raise. */
    submitFails: null as string | null,
  }
  return { calls, state }
})

vi.mock('../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({
    load: async (competitionSlug: string, seasonSlug: string) => {
      server.calls.context += 1
      if (server.state.contextFails) throw new Error('no play context')
      return {
        tournamentId: `${competitionSlug}/${seasonSlug}`,
        competitionName: 'Caledonian Premiership',
        seasonLabel: '2027/28',
      }
    },
  }),
}))

vi.mock('../../src/services/supabase/seasonCupBracket', () => ({
  fetchSeasonCupBracket: async () => {
    if (server.state.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, server.state.delayMs))
    }
    server.calls.bracket += 1
    if (server.state.bracketFails) throw new Error('no bracket')
    // A live tie with a Penalty Number, so the write has a window to aim at.
    return {
      entered: true,
      serverNow: '2027-05-01T12:00:00.000Z',
      format: { kind: 'groups', producesKnockout: true, groupStageLastSequence: 20 },
      qualification: { drawn: true, qualifiers: 4, yourSeed: 1, youQualified: true },
      myTie: {
        fixtureId: 'fx-1',
        stage: 'knockout' as const,
        roundSize: 4,
        bracketSlot: 1,
        windowSequence: 21,
        windowLabel: 'Semi-finals',
        isHome: true,
        opponent: { userId: 'u-2', displayName: 'Bo' },
        locksAt: null,
      },
      penaltyNumber: {
        windowId: 'w-1',
        windowLabel: 'Semi-finals',
        lane: 'odd' as const,
        submitted: false,
        value: null,
        version: 3,
        locksAt: '2027-05-02T14:00:00.000Z',
        locked: false,
        open: true,
      },
      myTies: [],
      bracket: [],
      champion: null,
    }
  },
}))

vi.mock('../../src/services/supabase/cup', () => ({
  submitCupPenaltyNumber: async () => {
    server.calls.submit += 1
    if (server.state.submitFails !== null) {
      throw Object.assign(new Error('declined'), { code: server.state.submitFails })
    }
  },
}))

function Probe({
  input,
  onState,
}: {
  readonly input: VNextChampionshipSourceInput
  readonly onState: (state: VNextChampionshipSourceState) => void
}) {
  onState(useVNextChampionshipSource(input))
  return null
}

const BASE: VNextChampionshipSourceInput = {
  userId: 'user-1',
  authLoading: false,
  competitionSlug: 'caledonian-premiership',
  seasonSlug: '2027-28',
  championshipId: 'cup-1',
  gameName: 'Predictor Championship',
}

function mount(input: VNextChampionshipSourceInput) {
  const seen: VNextChampionshipSourceState[] = []
  const view = render(<Probe input={input} onState={(state) => seen.push(state)} />)
  return {
    seen,
    unmount: view.unmount,
    /** Change the input on the SAME mounted probe. See the identity test. */
    to(next: VNextChampionshipSourceInput) {
      view.rerender(<Probe input={next} onState={(state) => seen.push(state)} />)
    },
  }
}

function reset() {
  server.calls.context = 0
  server.calls.bracket = 0
  server.calls.submit = 0
  server.state.contextFails = false
  server.state.bracketFails = false
  server.state.delayMs = 0
  server.state.submitFails = null
}

async function ready(probe: ReturnType<typeof mount>) {
  await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
  const state = last(probe.seen)
  if (state.status !== 'ready') throw new Error('expected ready')
  return state
}

describe('a failed bracket read is a panel outcome, not a dead page', () => {
  it('still reaches ready when the bracket read throws', async () => {
    reset()
    server.state.bracketFails = true
    const probe = mount(BASE)
    const state = await ready(probe)
    expect(state.source.bracket.kind).toBe('failed')
    probe.unmount()
  })

  it('fails the whole page only when the play context does', async () => {
    reset()
    server.state.contextFails = true
    const probe = mount(BASE)
    await waitFor(() => expect(last(probe.seen).status).toBe('failed'))
    probe.unmount()
  })
})

describe('a re-read keeps the page it is refreshing', () => {
  it('never returns to loading on a retry of the same competition', async () => {
    reset()
    server.state.delayMs = 5
    const probe = mount(BASE)
    const state = await ready(probe)
    state.retry()

    await waitFor(() => expect(server.calls.bracket).toBe(2))
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))

    const trail: string[] = []
    for (const seen of probe.seen) {
      if (trail[trail.length - 1] !== seen.status) trail.push(seen.status)
    }
    expect(trail.filter((status) => status === 'loading')).toHaveLength(1)
    probe.unmount()
  })

  it('announces the refresh rather than pretending to be idle', async () => {
    reset()
    server.state.delayMs = 5
    const probe = mount(BASE)
    ;(await ready(probe)).retry()
    await waitFor(() => expect(server.calls.bracket).toBe(2))
    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.refreshing).toBe(false)
    })
    // Over the whole trail: `refreshing` is true for a render or two and a
    // `waitFor` on the latest state can arrive after it has gone.
    expect(
      probe.seen.some((state) => state.status === 'ready' && state.refreshing),
    ).toBe(true)
    probe.unmount()
  })

  /**
   * THE IDENTITY MUST INCLUDE WHICH CHAMPIONSHIP.
   *
   * NOTE THIS RE-RENDERS THE SAME PROBE rather than mounting a second one. An
   * earlier version of this test unmounted and remounted, which shows
   * `loading` whatever the identity contains — so it passed with
   * `championshipId` removed from the identity entirely, which is the defect
   * it was written to catch. A fresh mount proves nothing about identity.
   *
   * The defect it now pins: switching instance while mounted would keep the
   * PREVIOUS Championship's bracket on screen, because the payload is kept for
   * a matching identity.
   */
  it('reloads when the Championship instance changes under a mounted page', async () => {
    reset()
    server.state.delayMs = 5
    const probe = mount(BASE)
    await ready(probe)
    const seenBefore = probe.seen.length

    probe.to({ ...BASE, championshipId: 'cup-2' })

    // It must drop to loading — the payload on screen is about another
    // competition — and then read again.
    await waitFor(() =>
      expect(probe.seen.slice(seenBefore).some((state) => state.status === 'loading')).toBe(true),
    )
    await waitFor(() => expect(server.calls.bracket).toBe(2))
    probe.unmount()
  })

  it('does NOT reload when nothing about the request changed', async () => {
    reset()
    server.state.delayMs = 5
    const probe = mount(BASE)
    await ready(probe)
    probe.to({ ...BASE })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(server.calls.bracket).toBe(1)
    probe.unmount()
  })
})

describe('the states above the read', () => {
  it('reads one context and one bracket per visit', async () => {
    reset()
    const probe = mount(BASE)
    await ready(probe)
    expect(server.calls.context).toBe(1)
    expect(server.calls.bracket).toBe(1)
    probe.unmount()
  })

  it('asks for nothing at all while auth is resolving', async () => {
    reset()
    const probe = mount({ ...BASE, authLoading: true })
    expect(last(probe.seen).status).toBe('loading')
    expect(server.calls.context).toBe(0)
    probe.unmount()
  })

  it('says signed out rather than failed', async () => {
    reset()
    const probe = mount({ ...BASE, userId: null })
    expect(last(probe.seen).status).toBe('signedOut')
    expect(server.calls.context).toBe(0)
    probe.unmount()
  })

  it('says no competition when no Championship instance was named', async () => {
    reset()
    const probe = mount({ ...BASE, championshipId: undefined })
    expect(last(probe.seen).status).toBe('noCompetition')
    expect(server.calls.context).toBe(0)
    probe.unmount()
  })
})

/**
 * THE ONE WRITE.
 *
 * Its refusal taxonomy is `championshipRefusal.ts`'s and its conflict
 * classifier is `writeConflict.ts`'s — both shared, neither restated in the
 * hook. Stage 11 shipped a hook matching one SQLSTATE out of five while a
 * complete map sat beside the write, so these tests exercise the SHARED map
 * through the hook rather than a copy of it.
 */
describe('the Penalty Number write', () => {
  it('submits against the window id the READ supplied', async () => {
    reset()
    const probe = mount(BASE)
    const state = await ready(probe)
    if (state.status !== 'ready') throw new Error('expected ready')
    state.submitPenaltyNumber(7)
    await waitFor(() => expect(server.calls.submit).toBe(1))
    probe.unmount()
  })

  it('re-reads after a submission that landed', async () => {
    reset()
    const probe = mount(BASE)
    ;(await ready(probe)).submitPenaltyNumber(7)
    await waitFor(() => expect(server.calls.bracket).toBe(2))
    probe.unmount()
  })

  it.each([
    ['55000', 'the round is not taking submissions'],
    ['check_violation', 'the number is not allowed in this lane'],
    ['no_data_found', 'no tie in this round'],
  ])('classifies %s as a refusal and re-reads (%s)', async (code) => {
    reset()
    server.state.submitFails = code
    const probe = mount(BASE)
    ;(await ready(probe)).submitPenaltyNumber(7)

    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.penaltyNumber.kind).toBe('refused')
    })
    // A refusal means the view is stale, so it re-reads rather than arguing.
    await waitFor(() => expect(server.calls.bracket).toBe(2))
    probe.unmount()
  })

  it('carries the refusal’s own sentence rather than a generic one', async () => {
    reset()
    server.state.submitFails = '55000'
    const probe = mount(BASE)
    ;(await ready(probe)).submitPenaltyNumber(7)
    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      if (state.penaltyNumber.kind !== 'refused') throw new Error('expected a refusal')
      expect(state.penaltyNumber.message).toMatch(/not taking Penalty Numbers/i)
    })
    probe.unmount()
  })

  it('reads PT409 as a conflict rather than a refusal, and re-reads', async () => {
    reset()
    server.state.submitFails = 'PT409'
    const probe = mount(BASE)
    ;(await ready(probe)).submitPenaltyNumber(7)
    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.penaltyNumber.kind).toBe('conflict')
    })
    await waitFor(() => expect(server.calls.bracket).toBe(2))
    probe.unmount()
  })

  it('leaves the page alone on a fault, because nothing changed', async () => {
    reset()
    server.state.submitFails = '08006'
    const probe = mount(BASE)
    ;(await ready(probe)).submitPenaltyNumber(7)
    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.penaltyNumber.kind).toBe('failed')
    })
    // No re-read: a fault means the server did not act.
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(server.calls.bracket).toBe(1)
    probe.unmount()
  })

  /**
   * NO WINDOW, NO WRITE — AND NO ERROR EITHER.
   *
   * An earlier version of this test asserted only that no call was made, which
   * a mutation removing the guard ALSO satisfies: without it the code reaches
   * `pn.windowId`, throws, and is caught into `failed` — no call, test green,
   * defect shipped. What actually distinguishes them is the STATE. Submitting
   * with nothing to submit against is a no-op, not a fault to show the reader.
   */
  it('submits nothing, and reports nothing, when the round offers no Penalty Number', async () => {
    reset()
    server.state.bracketFails = true
    const probe = mount(BASE)
    const state = await ready(probe)
    if (state.status !== 'ready') throw new Error('expected ready')
    state.submitPenaltyNumber(7)
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(server.calls.submit).toBe(0)
    const after = last(probe.seen)
    if (after.status !== 'ready') throw new Error('expected ready')
    expect(after.penaltyNumber.kind).toBe('idle')
    probe.unmount()
  })
})
