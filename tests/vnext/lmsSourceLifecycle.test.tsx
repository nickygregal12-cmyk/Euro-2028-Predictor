import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  useVNextLmsSource,
  type VNextLmsSourceInput,
  type VNextLmsSourceState,
} from '../../src/vnext/integration/lms/useVNextLmsSource'
import type { LmsRoundPage } from '../../src/services/supabase/seasonLms'
import type { SeasonLmsField } from '../../src/services/supabase/seasonLmsField'
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
  const calls = { load: 0, pick: 0, field: 0 }
  const picked: string[] = []
  /** How many gateways were constructed — one per identity, not per render. */
  let gateways = 0

  const state = {
    contextFails: false,
    loadFails: false,
    fieldFails: false,
    /** Real latency, so a transient `loading` is observable at all. */
    loadDelayMs: 0,
    /** null, a SQLSTATE the RPC really raises, or a plain fault. */
    pickFails: null as null | 'conflict' | 'failed' | '23514' | '23505' | '55000' | '42501' | '02000',
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

  function field(): SeasonLmsField {
    return {
      available: true,
      entered: true,
      myOutcome: 'active',
      round: {
        windowId: 'window-7',
        sequence: 7,
        label: 'Round 7',
        opensAt: '2027-11-10T12:00:00.000Z',
        locksAt: '2099-01-01T00:00:00.000Z',
        settlesAt: null,
        revealed: false,
        settled: false,
      },
      rules: { lives: 1, saves: 0, drawsRule: 'A draw counts as a loss', endgameScope: null },
      field: { entrants: 120, remaining: 83, eliminated: 33, picked: null },
      entrants: [],
    }
  }

  return {
    calls,
    picked,
    state,
    page,
    field,
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

vi.mock('../../src/services/supabase/seasonLms', async () => ({
  // THE REAL REFUSAL CLASSIFIER, not a restatement of it.
  //
  // The hook reaches it through the gateway module, so a wholesale mock of that
  // module would silently remove it — and the symptom is not a failing import
  // but every write hanging in `saving`. Pulling the actual `lmsRefusal` module
  // in is safe (it imports only `userFacingError`, no Supabase) and means this
  // suite exercises the shipped code-to-sentence map rather than a copy of it
  // that could agree with a broken hook.
  ...(await vi.importActual<Record<string, unknown>>(
    '../../src/features/season/lmsRefusal',
  )),
  createSeasonLmsRpcGateway: () => {
    server.countGateway()
    return {
      load: async () => {
        if (server.state.loadDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, server.state.loadDelayMs))
        }
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
        if (server.state.pickFails === 'failed') throw new Error('network')
        if (server.state.pickFails !== null) {
          throw Object.assign(new Error('declined'), { code: server.state.pickFails })
        }
      },
    }
  },
}))

vi.mock('../../src/services/supabase/seasonLmsField', () => ({
  fetchSeasonLmsField: async () => {
    server.calls.field += 1
    if (server.state.fieldFails) throw new Error('no field')
    return server.field()
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
  server.calls.field = 0
  server.state.contextFails = false
  server.state.loadFails = false
  server.state.fieldFails = false
  server.state.loadDelayMs = 0
  server.state.pickFails = null
}

async function ready(probe: ReturnType<typeof mount>) {
  await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
  const state = last(probe.seen)
  if (state.status !== 'ready') throw new Error('expected ready')
  return state
}

/* ------------------------------------------------------------------ *
 * 0. Two reads, and neither may withhold the other
 * ------------------------------------------------------------------ */

/**
 * THE TWO READS ARE ISSUED TOGETHER AND CATCH SEPARATELY.
 *
 * The failure this guards against is a `Promise.all` over UNGUARDED promises:
 * it rejects on the first rejection and throws away the other answer even when
 * that answer had already arrived. On this page that would mean a field read
 * falling over and taking with it the round a player came to act on — the one
 * outcome the whole two-union design exists to prevent.
 */
describe('the round and the field are read together and fail apart', () => {
  it('issues exactly two reads per visit, and no more', async () => {
    reset()
    const probe = mount(BASE)
    await ready(probe)
    expect(server.calls.load).toBe(1)
    expect(server.calls.field).toBe(1)
    probe.unmount()
  })

  it('still reaches ready with a round when the field read throws', async () => {
    reset()
    server.state.fieldFails = true
    const probe = mount(BASE)
    const state = await ready(probe)
    expect(state.source.read.kind).toBe('ok')
    expect(state.source.field.kind).toBe('failed')
    probe.unmount()
  })

  it('still reaches ready with a field when the round read throws', async () => {
    reset()
    server.state.loadFails = true
    const probe = mount(BASE)
    const state = await ready(probe)
    expect(state.source.read.kind).toBe('failed')
    // THE POINT: the field arrived and was kept. A page that discarded it on
    // the round's failure would go blank where it could still say "83 still in".
    expect(state.source.field.kind).toBe('ok')
    probe.unmount()
  })

  it('is still ready when BOTH reads throw, because neither is the page', async () => {
    reset()
    server.state.loadFails = true
    server.state.fieldFails = true
    const probe = mount(BASE)
    const state = await ready(probe)
    expect(state.source.read.kind).toBe('failed')
    expect(state.source.field.kind).toBe('failed')
    // `failed` is reserved for the PLAY CONTEXT, which is the only read whose
    // absence means there is no page to draw at all.
    expect(state.status).toBe('ready')
    probe.unmount()
  })
})

/**
 * A PICK MUST NOT BLANK THE PAGE IT WAS MADE ON.
 *
 * The re-read after a landed pick used to clear the hook's state, so the screen
 * dropped to a skeleton — standing, pool, round, used list and the competition
 * shell all replaced by grey bars — and then rebuilt itself. It was invisible
 * to this suite because the mocked gateway resolves in a microtask and React
 * coalesces the commit, so the observed trail was `loading -> ready` either
 * way. **The mocked load below is deliberately slow for that reason.**
 */
describe('a re-read keeps the page it is refreshing', () => {
  it('never returns to loading after a pick lands', async () => {
    reset()
    server.state.loadDelayMs = 5
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => expect(server.calls.load).toBe(2))
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))

    const trail: string[] = []
    for (const seen of probe.seen) {
      if (trail[trail.length - 1] !== seen.status) trail.push(seen.status)
    }
    // ONE loading, at the start. A second would be the skeleton flash.
    expect(trail.filter((status) => status === 'loading')).toHaveLength(1)
    probe.unmount()
  })

  it('says it is refreshing while it does so, rather than pretending to be idle', async () => {
    reset()
    server.state.loadDelayMs = 5
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => expect(server.calls.load).toBe(2))
    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.refreshing).toBe(false)
    })

    // OVER THE WHOLE TRAIL, not the latest state: `refreshing` is true for the
    // duration of the re-read, which is one or two renders, and a `waitFor` on
    // the last state can easily arrive after it has gone.
    const sawRefreshing = probe.seen.some(
      (state) => state.status === 'ready' && state.refreshing,
    )
    // The page stays `ready` AND admits a read is in flight, so a surface can
    // announce it without having anything torn out from under the reader.
    expect(sawRefreshing, 'the re-read was never announced').toBe(true)
    expect(probe.seen.every((state) => state.status === 'ready' || state.status === 'loading')).toBe(
      true,
    )
    probe.unmount()
  })

  it('does clear to loading when the identity genuinely changes', async () => {
    reset()
    server.state.loadDelayMs = 5
    const probe = mount(BASE)
    await ready(probe)
    probe.unmount()

    // A different season is a different round; keeping the old one on screen
    // would show somebody the wrong competition's clubs.
    const other = mount({ ...BASE, seasonSlug: '2028-29' })
    await ready(other)
    expect(other.seen.some((state) => state.status === 'loading')).toBe(true)
    other.unmount()
  })
})

/**
 * EVERY REFUSAL `save_lms_selection` CAN RAISE, NOT JUST THE ONE.
 *
 * The hook once carried its own classifier and it knew a single code, `23514`.
 * Reading the migration shows the RPC raises FIVE:
 *
 *   23505 unique_violation      the club is already spent this cycle
 *   55000                       the entrant has been eliminated
 *   42501 insufficient_privilege not an entrant / not authenticated
 *   02000 no_data_found         the window is not a live LMS round
 *   23514 check_violation       from the row trigger: locked, or no club
 *
 * Four of them fell through to `failed`, whose sentence is "Nothing has
 * changed, so you can try again." Both halves were false — the used-list HAD
 * moved — and the retry could never succeed. The likeliest refusal on this
 * surface, picking a club already used, was one of the four.
 *
 * The lane no longer classifies these itself; `isLmsRefusal` does, from the
 * same map that supplies the sentence. This table is the regression guard.
 */
describe('every rule the server can refuse on is a refusal, not a fault', () => {
  const codes = [
    { code: '23505' as const, says: /already used that club/i },
    { code: '55000' as const, says: /been eliminated/i },
    { code: '42501' as const, says: /join last man standing/i },
    { code: '02000' as const, says: /no longer available/i },
    { code: '23514' as const, says: /choose a club/i },
  ]

  it.each(codes)('classifies $code as refused and re-reads', async ({ code, says }) => {
    reset()
    server.state.pickFails = code
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('refused')
    })

    const state = last(probe.seen)
    if (state.status !== 'ready' || state.picking.kind !== 'refused') {
      throw new Error('expected a refusal')
    }
    // IT CARRIES THE RULE'S OWN SENTENCE, so the page never has to guess which.
    expect(state.picking.reason).toMatch(says)
    // AND IT RE-READS, because this page's view of the round is now stale.
    await waitFor(() => expect(server.calls.load).toBe(2))
    probe.unmount()
  })

  it('still calls a network fault a fault, and does not re-read', async () => {
    reset()
    server.state.pickFails = 'failed'
    const probe = mount(BASE)
    ;(await ready(probe)).pick('team-celtic')

    await waitFor(() => {
      const state = last(probe.seen)
      if (state.status !== 'ready') throw new Error('expected ready')
      expect(state.picking.kind).toBe('failed')
    })
    // NOTHING CHANGED, so the page may say so and the retry is honest.
    expect(server.calls.load).toBe(1)
    probe.unmount()
  })
})

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
    server.state.pickFails = '23514'
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
    server.state.pickFails = '23514'
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
    server.state.pickFails = '23514'
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
