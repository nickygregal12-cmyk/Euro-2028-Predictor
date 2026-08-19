import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  useVNextLmsSource,
  type VNextLmsSourceInput,
  type VNextLmsSourceState,
} from '../../src/vnext/integration/lms/useVNextLmsSource'
import type { LmsRoundPage } from '../../src/services/supabase/seasonLms'
import { last } from '../support/indexed'

/**
 * THE ACQUISITION AND WRITE LIFECYCLE FOR LAST MAN STANDING.
 *
 * This is the first vNext surface that WRITES, and the write is the part most
 * likely to be wrong — so it is tested first rather than after, the lesson
 * Stage 9's review taught and Stage 10 applied.
 *
 * WHAT IT HOLDS:
 *
 *   1. THREE WAYS A WRITE CAN NOT SUCCEED, KEPT APART. `PT409` is a conflict
 *      resolved by re-reading; `check_violation` is the server declining on its
 *      own rules; anything else is a fault. Collapsing them puts "try again"
 *      in front of a permission that will never change, or hides a lost race.
 *   2. A SUCCESSFUL PICK RE-READS rather than patching the model, because the
 *      write moves the version, the selection AND what else is eligible.
 *   3. A CONFLICT AND A REFUSAL ALSO RE-READ, because in both cases this page's
 *      view of the round is provably stale.
 *   4. THE GATEWAY SURVIVES RENDERS. It holds the version a write must carry;
 *      rebuilt per render, every save would look like a first one.
 *   5. ONLY THE PLAY CONTEXT FAILS THE WHOLE PAGE.
 *
 * Nothing here touches Supabase; the service modules are mocked at their own
 * boundary.
 */

const server = vi.hoisted(() => {
  const calls = { load: 0, pick: 0 }
  const picked: string[] = []
  /** How many gateways were constructed — one per identity, not per render. */
  let gateways = 0

  const state = {
    contextFails: false,
    loadFails: false,
    /** null | 'conflict' | 'refused' | 'failed' */
    pickFails: null as null | 'conflict' | 'refused' | 'failed',
  }

  function page(): LmsRoundPage {
    return {
      available: true,
      entered: true,
      entryOutcome: 'active',
      round: {
        windowId: 'window-7',
        sequence: 7,
        label: 'Round 7',
        opensAt: '2027-11-10T12:00:00.000Z',
        locksAt: '2099-01-01T00:00:00.000Z',
      },
      fixtures: [
        {
          fixtureId: 'fx-1',
          kickoffAt: null,
          status: 'scheduled',
          home: { teamId: 'team-celtic', name: 'Celtic', used: false },
          away: { teamId: 'team-hearts', name: 'Hearts', used: true },
          score: null,
        },
      ],
      pick: null,
      pickOutcome: null,
    }
  }

  return {
    calls,
    picked,
    state,
    page,
    countGateway() {
      gateways += 1
    },
    gatewayCount() {
      return gateways
    },
    resetGateways() {
      gateways = 0
    },
  }
})

vi.mock('../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({
    load: async (competitionSlug: string, seasonSlug: string) => {
      if (server.state.contextFails) throw new Error('no play context')
      return {
        tournamentId: `${competitionSlug}/${seasonSlug}`,
        competitionName: 'Caledonian Premiership',
        seasonLabel: '2027/28',
      }
    },
  }),
}))

vi.mock('../../src/services/supabase/seasonLms', () => ({
  createSeasonLmsRpcGateway: () => {
    server.countGateway()
    return {
      load: async () => {
        server.calls.load += 1
        if (server.state.loadFails) throw new Error('no round')
        return server.page()
      },
      pick: async (teamId: string) => {
        server.calls.pick += 1
        server.picked.push(teamId)
        if (server.state.pickFails === 'conflict') {
          throw Object.assign(new Error('stale'), { code: 'PT409' })
        }
        if (server.state.pickFails === 'refused') {
          throw Object.assign(new Error('declined'), { code: '23514' })
        }
        if (server.state.pickFails === 'failed') throw new Error('network')
      },
    }
  },
}))

// THE REAL CLASSIFIER'S RULE, restated because the module is mocked wholesale.
vi.mock('../../src/services/supabase/writeConflict', () => ({
  isVersionConflict: (error: unknown) =>
    (error as { code?: unknown } | null)?.code === 'PT409',
}))

function Probe({
  input,
  onState,
}: {
  readonly input: VNextLmsSourceInput
  readonly onState: (state: VNextLmsSourceState) => void
}) {
  onState(useVNextLmsSource(input))
  return null
}

const BASE: VNextLmsSourceInput = {
  userId: 'user-1',
  authLoading: false,
  competitionSlug: 'caledonian-premiership',
  seasonSlug: '2027-28',
  gameName: 'Last Man Standing',
}

function mount(input: VNextLmsSourceInput) {
  const seen: VNextLmsSourceState[] = []
  const view = render(<Probe input={input} onState={(state) => seen.push(state)} />)
  return { seen, unmount: view.unmount }
}

function reset() {
  server.calls.load = 0
  server.calls.pick = 0
  server.picked.length = 0
  server.resetGateways()
  server.state.contextFails = false
  server.state.loadFails = false
  server.state.pickFails = null
}

async function ready(probe: ReturnType<typeof mount>) {
  await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
  const state = last(probe.seen)
  if (state.status !== 'ready') throw new Error('expected ready')
  return state
}

/* ------------------------------------------------------------------ *
 * 1. The write's three failures are three states
 * ------------------------------------------------------------------ */

describe('a write that does not succeed says which kind it was', () => {
  it('reads PT409 as a conflict rather than a fault', async () => {
    reset()
    server.state.pickFails = 'conflict'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('conflict')
    })
  })

  it('reads check_violation as the server declining, not as a fault', async () => {
    reset()
    server.state.pickFails = 'refused'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('refused')
    })
  })

  it('reads anything else as a fault', async () => {
    // The only one where pressing the same button again is sensible.
    reset()
    server.state.pickFails = 'failed'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('failed')
    })
  })

  it('never reports a conflict as a refusal or the other way round', async () => {
    reset()
    server.state.pickFails = 'conflict'
    const first = mount(BASE)
    ;(await ready(first)).pick('team-celtic')
    await waitFor(() => {
      const state = last(first.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('conflict')
    })

    reset()
    server.state.pickFails = 'refused'
    const second = mount(BASE)
    ;(await ready(second)).pick('team-celtic')
    await waitFor(() => {
      const state = last(second.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('refused')
    })
  })
})

/* ------------------------------------------------------------------ *
 * 2–3. Every outcome that changes the truth re-reads
 * ------------------------------------------------------------------ */

describe('the page re-reads whenever the server knows more than it does', () => {
  it('re-reads after a pick lands', async () => {
    // NOT AN OPTIMISTIC PATCH. The write moved the version, the selection and
    // possibly what else is eligible; guessing that here would make this lane a
    // second authority on eligibility.
    reset()
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => expect(server.calls.load).toBe(2))
    expect(server.picked).toEqual(['team-celtic'])
  })

  it('re-reads after a conflict, because retrying would only lose again', async () => {
    reset()
    server.state.pickFails = 'conflict'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => expect(server.calls.load).toBe(2))
    expect(server.calls.pick).toBe(1)
  })

  it('re-reads after a refusal, because this page`s view is stale', async () => {
    reset()
    server.state.pickFails = 'refused'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => expect(server.calls.load).toBe(2))
  })

  it('does not re-read after a plain fault', async () => {
    // Nothing changed on the server, so there is nothing new to read — and a
    // reload would throw away the sentence the player just got.
    reset()
    server.state.pickFails = 'failed'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('failed')
    })
    expect(server.calls.load).toBe(1)
  })
})

/* ------------------------------------------------------------------ *
 * 4. The gateway holds the version
 * ------------------------------------------------------------------ */

describe('the gateway survives renders', () => {
  it('is built once per read rather than once per render', async () => {
    // It remembers the window id and the version its last load reported. Built
    // per render, every save would carry a first-load version.
    reset()
    const probe = mount(BASE)
    await ready(probe)

    expect(server.gatewayCount()).toBe(1)
    expect(probe.seen.length).toBeGreaterThan(1)
  })

  it('submits through the one write, with the id the option carried', async () => {
    reset()
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')
    await waitFor(() => expect(server.calls.pick).toBe(1))
    expect(server.picked).toEqual(['team-celtic'])
  })
})

/* ------------------------------------------------------------------ *
 * 5. The states above the read
 * ------------------------------------------------------------------ */

describe('the states above the read', () => {
  it('fails the page when there is no play context', async () => {
    reset()
    server.state.contextFails = true
    const probe = mount(BASE)
    await waitFor(() => expect(last(probe.seen).status).toBe('failed'))
  })

  it('reports a failed ROUND read inside a ready page', async () => {
    // A failed round is not a failed page: the competition and the game are
    // still known, and the surface says which part is missing.
    reset()
    server.state.loadFails = true
    const probe = mount(BASE)
    const state = await ready(probe)
    expect(state.source.read.kind).toBe('failed')
  })

  it('reports a signed-out reader rather than a failure', () => {
    reset()
    const probe = mount({ ...BASE, userId: null })
    expect(last(probe.seen).status).toBe('signedOut')
    expect(server.calls.load).toBe(0)
  })

  it('reports a missing competition rather than a failure', () => {
    reset()
    const probe = mount({ ...BASE, competitionSlug: undefined })
    expect(last(probe.seen).status).toBe('noCompetition')
  })

  it('waits while auth is resolving', () => {
    reset()
    const probe = mount({ ...BASE, authLoading: true, userId: null })
    expect(last(probe.seen).status).toBe('loading')
  })

  it('writes nothing after unmount', async () => {
    reset()
    const probe = mount(BASE)
    await ready(probe)
    const before = probe.seen.length
    probe.unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(probe.seen.length).toBe(before)
  })

  it('stamps the instant the lock will be judged against', async () => {
    reset()
    const state = await ready(mount(BASE))
    expect(Date.parse(state.source.generatedAt)).not.toBeNaN()
  })
})
