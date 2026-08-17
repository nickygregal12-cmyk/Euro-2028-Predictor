import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeasonMatchPredictorGateway } from '../../../src/dev/seasonMatchPredictorGateway'
import { instantFor } from '../../../src/dev/seasonPreviewFixture'
import { useSeasonMatchPredictor } from '../../../src/features/season/useSeasonMatchPredictor'
import type {
  MatchPredictorCommand,
  MatchPredictorGateway,
  MatchPredictorPage,
} from '../../../src/features/season/matchPredictorModel'
import { VersionConflictError } from '../../../src/services/supabase/writeConflict'

/**
 * THE AUTOMATIC DEADLINE REFRESH MAY NEVER COST A PLAYER A PREDICTION.
 *
 * THE DEFECT THESE TESTS WERE WRITTEN AGAINST. The deadline clock was wired
 * straight to `reload`, which is a RECOVERY command: it runs
 * `SaveController.reset()`, and that clears every key's state, cancels scheduled
 * retries and throws away the COALESCED PENDING write the coordinator is holding
 * behind an in-flight one. Correct for a click — the player is asking to be shown
 * what the server holds — and silently destructive for a timer nobody pressed.
 * The sequence that loses a prediction is four steps long and needs no unusual
 * network:
 *
 *     player enters 1–0     → save A goes on the wire
 *     player types 2–0      → 2–0 is coalesced as pending behind save A
 *     the deadline arrives  → reset(): the pending 2–0 is discarded
 *     save A completes      → the server holds 1–0; 2–0 was never sent
 *
 * WHAT IS HELD HERE. `refreshAfterDeadline` waits on the save authority's own
 * barrier (`waitForSettled`) and re-reads the card only once every key is
 * terminal AND clean. There is no second opinion about save state in the hook —
 * no `inFlight` inspection, no duplicate coordinator, no timeout, no poll — and
 * no local decision about whether a last-second write counted. The server
 * decides that, because the write still goes out.
 *
 * THE SURFACE HALF of the same correction — that the deadline clock reaches this
 * command and never `reload` — is in `tests/vnext/predictorDeadline.test.tsx`.
 *
 * WHY A HAND-BUILT GATEWAY. Every case here is about ORDERING: a save has to be
 * held open across a boundary crossing and released on command. The development
 * fixture gateway's scenarios settle on their own schedule, so its `load` is
 * reused for a real page and its `apply` is replaced by deferred promises this
 * file resolves itself. `load` calls are counted, and that count IS the number of
 * authoritative refreshes.
 */

const BEFORE_LOCK = () => instantFor(1, -180)

type Deferred = {
  command: MatchPredictorCommand
  settle: () => void
  fail: (error?: unknown) => void
}

function controllableGateway() {
  const base = createSeasonMatchPredictorGateway({ scenario: 'healthy', now: BEFORE_LOCK() })
  const writes: Deferred[] = []
  let loads = 0

  const gateway: MatchPredictorGateway = {
    load(matchweek: number): Promise<MatchPredictorPage> {
      loads += 1
      return base.load(matchweek)
    },
    apply(_matchweek: number, command: MatchPredictorCommand): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        writes.push({
          command,
          settle: () => resolve(),
          fail: (error?: unknown) => reject(error ?? new Error('offline')),
        })
      })
    },
  }

  return {
    gateway,
    writes,
    /** How many times the authority has been asked for the card. */
    loadCount: () => loads,
    /** The scorelines that actually reached the gateway, in order. */
    sent: () =>
      writes
        .filter((write) => write.command.kind === 'setPrediction')
        .map((write) => {
          const command = write.command as Extract<
            MatchPredictorCommand,
            { kind: 'setPrediction' }
          >
          const score = command.prediction
          return score === null ? `${command.fixtureId}:cleared` : `${score.home}-${score.away}`
        }),
  }
}

/** Let every already-resolved promise and its continuations run. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function mounted(gateway: MatchPredictorGateway) {
  const view = renderHook(() => useSeasonMatchPredictor(gateway, 1))
  await waitFor(() => expect(view.result.current.status).toBe('ready'))
  return view
}

/* ------------------------------------------------------------------------ *
 * A — nothing is being saved
 * ------------------------------------------------------------------------ */

describe('a boundary crossed with no save underway', () => {
  it('asks the authority once, immediately', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    expect(harness.loadCount()).toBe(1)

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await flush()

    // There is nothing to be unsafe with, so nothing is deferred. This is the
    // ordinary case and it must not have acquired a delay.
    await waitFor(() => expect(harness.loadCount()).toBe(2))
  })

  it('does not ask again for a boundary it has already answered', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await waitFor(() => expect(harness.loadCount()).toBe(2))

    // The clock guards one ask per distinct `lock.at`; this guards the other
    // side of it, so a caller that asked twice cannot produce two reads.
    await flush()
    expect(harness.loadCount()).toBe(2)
  })
})

/* ------------------------------------------------------------------------ *
 * B — a save is on the wire
 * ------------------------------------------------------------------------ */

describe('a boundary crossed while a save is in flight', () => {
  it('leaves the write alone and waits for it to settle', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(1))
    expect(result.current.saveStatus[fixtureId]).toBe('saving')

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await flush()

    // NOT RESET. The write is still on the wire, the status still says so, and
    // the card has not been re-read out from under it.
    expect(harness.loadCount()).toBe(1)
    expect(result.current.saveStatus[fixtureId]).toBe('saving')
    expect(result.current.page!.fixtures[0]!.prediction).toEqual({ home: 1, away: 0 })

    act(() => {
      harness.writes[0]!.settle()
    })

    // And once it has settled, the refresh the deadline asked for happens.
    await waitFor(() => expect(harness.loadCount()).toBe(2))
  })
})

/* ------------------------------------------------------------------------ *
 * C — THE REGRESSION. A newer value queued behind an in-flight one.
 * ------------------------------------------------------------------------ */

describe('a boundary crossed with a newer scoreline coalesced behind an in-flight save', () => {
  it('cannot lose the queued 2–0 behind the in-flight 1–0', async () => {
    /**
     * THIS IS THE TEST THE FINDING ASKED FOR, and it fails against a boundary
     * wired to `reload`: `reset()` drops the pending change, so `sent()` ends as
     * `['1-0']` and the player's last edit is never written anywhere.
     *
     * It asserts the WRITE, not the screen. An optimistic value on screen is not
     * evidence the server took it — that confusion is what would make this class
     * of bug invisible — so what is checked is that 2–0 reached the gateway.
     * Whether the server then accepts it is the server's answer to give; this
     * file never decides that a last-second save was too late.
     */
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(1))

    // The change of mind, while 1–0 is still on the wire. The coordinator holds
    // it as the single latest pending value rather than sending a second write.
    act(() => {
      result.current.setPrediction(fixtureId, { home: 2, away: 0 })
    })
    expect(harness.writes).toHaveLength(1)
    expect(harness.sent()).toEqual(['1-0'])

    // KICKOFF, between the two.
    act(() => {
      result.current.refreshAfterDeadline()
    })
    await flush()
    const loadsAtCrossing = harness.loadCount()

    // The first request settles, exactly as it would have with no deadline.
    act(() => {
      harness.writes[0]!.settle()
    })
    await flush()

    // THE ASSERTION THE OLD WIRING FAILED, and it is deliberately the FIRST one
    // after the crossing so the failure names the actual loss rather than a
    // symptom of it. Against a boundary wired to `reload` this reads `['1-0']`:
    // the pending 2–0 was dropped by `reset()` and never reached the gateway.
    expect(harness.sent()).toEqual(['1-0', '2-0'])

    // And no card was re-read across any of it, so nothing could have replaced
    // the queued value with the older one the server still held.
    expect(loadsAtCrossing).toBe(1)
    expect(harness.loadCount()).toBe(1)

    act(() => {
      harness.writes[1]!.settle()
    })

    // ONE refresh, after the last write — not one per crossing, and not one per
    // settled key. What the re-read then SHOWS is the authority's business: this
    // harness's `apply` persists nothing, so the second load answers with the
    // same untouched fixture page, and asserting a scoreline on it would be
    // asserting the stub rather than the behaviour.
    await waitFor(() => expect(harness.loadCount()).toBe(2))
  })
})

/* ------------------------------------------------------------------------ *
 * D — an automatic retry is waiting in backoff
 * ------------------------------------------------------------------------ */

describe('a boundary crossed while a save waits on its automatic retry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not cancel the retry to get its refresh', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 3, away: 1 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(1))

    // A transient failure. The coordinator schedules a retry and deliberately
    // stays in `saving`, because nothing has gone wrong the player can act on.
    await act(async () => {
      harness.writes[0]!.fail()
      await Promise.resolve()
    })
    expect(result.current.saveStatus[fixtureId]).toBe('saving')

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await flush()
    expect(harness.loadCount()).toBe(1)

    // THE RETRY STILL FIRES. `reset()` would have cleared this timer and the
    // write would simply never have been attempted again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(harness.writes).toHaveLength(2)
    expect(harness.sent()).toEqual(['3-1', '3-1'])
    expect(harness.loadCount()).toBe(1)

    act(() => {
      harness.writes[1]!.settle()
    })
    await waitFor(() => expect(harness.loadCount()).toBe(2))
  })
})

/* ------------------------------------------------------------------------ *
 * E — everything settles, and exactly one refresh happens
 * ------------------------------------------------------------------------ */

describe('a boundary crossed across several saves', () => {
  it('performs exactly one delayed refresh once all of them have settled', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const first = result.current.page!.fixtures[0]!.fixtureId
    const second = result.current.page!.fixtures[1]!.fixtureId

    act(() => {
      result.current.setPrediction(first, { home: 1, away: 1 })
      result.current.setPrediction(second, { home: 0, away: 2 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(2))

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await flush()
    expect(harness.loadCount()).toBe(1)

    // One key settling is not every key settling; a refresh here would re-read
    // the card while the other fixture's write was still on the wire.
    act(() => {
      harness.writes[0]!.settle()
    })
    await flush()
    expect(harness.loadCount()).toBe(1)

    act(() => {
      harness.writes[1]!.settle()
    })
    await waitFor(() => expect(harness.loadCount()).toBe(2))

    // One, and it stays one.
    await flush()
    expect(harness.loadCount()).toBe(2)
  })
})

/* ------------------------------------------------------------------------ *
 * F — the write reaches a terminal ordinary error
 * ------------------------------------------------------------------------ */

describe('a boundary crossed over a save that eventually fails for good', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Fail every attempt until the coordinator gives up and surfaces `error`. */
  async function exhaustRetries(harness: ReturnType<typeof controllableGateway>) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        harness.writes[attempt]!.fail()
        await Promise.resolve()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000)
      })
    }
  }

  it('does not erase the player’s value or their way back from the error', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 4, away: 2 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(1))

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await exhaustRetries(harness)

    await waitFor(() => expect(result.current.saveStatus[fixtureId]).toBe('error'))

    // THE PENDING BOUNDARY REFRESH IS HELD, NOT PERFORMED. Re-reading the card
    // here would replace the player's 4–2 with the server's older row and take
    // the error — and with it the retry control — off the screen while they were
    // looking at it. The state a player has to act on is theirs to keep.
    await flush()
    expect(harness.loadCount()).toBe(1)
    expect(result.current.page!.fixtures[0]!.prediction).toEqual({ home: 4, away: 2 })
    expect(result.current.saveStatus[fixtureId]).toBe('error')

    // AND IT IS STILL WAITING. A manual retry that finally succeeds settles the
    // key cleanly, which is the moment the deferred refresh becomes safe — so
    // the tab left open across kickoff does eventually get its answer, without
    // ever having overwritten anything.
    act(() => {
      result.current.retrySave(fixtureId)
    })
    await waitFor(() => expect(harness.writes).toHaveLength(4))
    act(() => {
      harness.writes[3]!.settle()
    })
    await waitFor(() => expect(harness.loadCount()).toBe(2))
  })
})

/* ------------------------------------------------------------------------ *
 * G — a version conflict
 * ------------------------------------------------------------------------ */

describe('a boundary crossed over a version conflict', () => {
  it('cannot bulldoze the explicit conflict recovery', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 2, away: 2 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(1))

    act(() => {
      result.current.refreshAfterDeadline()
    })
    await act(async () => {
      harness.writes[0]!.fail(new VersionConflictError())
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.saveStatus[fixtureId]).toBe('conflict'))

    // A conflict is a TERMINAL state that says the page is knowingly showing
    // data the server has already changed, and §12.1's recovery for it is an
    // explicit reload the player chooses. A timer quietly performing that
    // reload would resolve a conflict the player never saw.
    await flush()
    expect(harness.loadCount()).toBe(1)
    expect(result.current.presentation!.state).toBe('conflict_requires_refresh')

    // The explicit recovery still works, and still resets — unchanged by any of
    // this, which is the other half of what the finding asked for.
    act(() => {
      result.current.reload()
    })
    await waitFor(() => expect(harness.loadCount()).toBe(2))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.saveStatus[fixtureId]).toBeUndefined()

    // And the boundary request went with it: the player has just asked the
    // authority the same question, so there is not a second read behind it.
    await flush()
    expect(harness.loadCount()).toBe(2)
  })
})

/* ------------------------------------------------------------------------ *
 * The distinction itself
 * ------------------------------------------------------------------------ */

describe('the two re-read commands are not the same command', () => {
  it('keeps `reload` destructive, because a player asking for it means it', async () => {
    const harness = controllableGateway()
    const { result } = await mounted(harness.gateway)
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(harness.writes).toHaveLength(1))
    act(() => {
      result.current.setPrediction(fixtureId, { home: 2, away: 0 })
    })

    // THE MANUAL COMMAND, WITH ITS EXISTING SEMANTICS INTACT. The player has
    // asked to be shown what the server holds; the coordinator is reset, the
    // queued value goes with it, and the card is re-read at once. This
    // correction deliberately did not weaken that to satisfy a timer.
    act(() => {
      result.current.reload()
    })
    await waitFor(() => expect(harness.loadCount()).toBe(2))
    expect(result.current.saveStatus[fixtureId]).toBeUndefined()

    act(() => {
      harness.writes[0]!.settle()
    })
    await flush()
    expect(harness.sent()).toEqual(['1-0'])
  })
})
