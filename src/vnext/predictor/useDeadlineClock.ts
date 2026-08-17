import { useCallback, useEffect, useRef, useState } from 'react'
import type { PredictorLock } from '../models/predictor'

/**
 * THE ONE PLACE THE PREDICTOR IS ALLOWED TO NOTICE THAT TIME PASSES.
 *
 * WHAT WENT WRONG WITHOUT IT. `PredictorModel.generatedAt` is stamped once, where
 * the connected model is built, and that model is rebuilt only when its React
 * inputs change. So a player who opened the card and then did nothing kept a
 * countdown frozen at the instant they arrived — "Locks in 1 hr 45 min", still,
 * an hour later. Worse, nothing asked the application for a fresh answer when
 * wall-clock time crossed the deadline, so a tab left open across kickoff went on
 * drawing the last authoritative `open` state until something else happened to
 * trigger a read.
 *
 * THE DISTINCTION THIS HOOK EXISTS TO PRESERVE. Browser time may make an
 * already-authoritative deadline visually current, and it may decide that it is
 * time to ASK the authority again. It may never answer. Nothing here produces
 * `locked`, `closed`, non-editability, a Joker refusal, a settlement or a
 * consensus reveal, and it does not so much as look at `editable`: those are the
 * application's, they arrive on the model, and the only thing this file can do
 * about a passed deadline is call `refreshAfterDeadline` and draw whatever comes
 * back — including WHEN that refresh is safe to perform, which is the
 * application's answer too and not a delay invented here. There is
 * deliberately no `if (Date.now() >= lockAt)` anywhere in the predictor lane, and
 * `tests/vnext/predictorDeadline.test.tsx` holds that by advancing the clock
 * across a lock and asserting that `editable`, `lock.kind`, the Joker and every
 * score control are exactly what they were.
 *
 * AN AUTHORITATIVE INSTANT ADVANCED BY OBSERVED ELAPSED TIME, which is the whole
 * mechanism. `generatedAt` is the anchor and `Date.now()` supplies only the
 * OFFSET since that anchor was taken, so:
 *
 *   - the first render of a model is byte-identical to what it was before this
 *     hook existed — no time has elapsed yet — which is what keeps a
 *     deterministic story, a Storybook screenshot and a browser measurement worth
 *     anything;
 *   - the display instant is a real instant derived from a real one, never a
 *     wall-clock reading substituted for the model's;
 *   - the clamp at zero means a device clock corrected backwards can slow the
 *     countdown but can never rewind the page behind the instant the application
 *     described.
 *
 * `PredictorModel` IS NOT MUTATED TO FAKE A REBUILD. Pretending the server had
 * re-answered every minute would mean recomputing everything the mapper derives
 * from `generatedAt` — `lock.urgency` above all — from a clock in the browser,
 * which is exactly the authority this lane must not manufacture. So the model
 * stays the authoritative answer and this is a separate presentation value beside
 * it. The visible consequence is deliberate and worth stating: a card that was
 * `soon` when it was built keeps its `soon` toning until the application rebuilds
 * it, because how loudly the page shouts is a decision the model owns
 * (`src/vnext/AGENTS.md`: "read `urgency`, not a deadline against a clock"). The
 * countdown is formatting over two supplied values, which has always been
 * allowed, and it is the number a player actually reads.
 *
 * ONE MECHANISM FOR THE WHOLE PAGE. `VNextMatchPredictor` calls this once and
 * passes the result down, so the masthead's deadline chip, the brief's countdown
 * and every kickoff label on the list are measured against the SAME instant and
 * cannot drift into disagreeing about which day a Saturday lunchtime kickoff is
 * on. An interval per component would guarantee that drift eventually.
 *
 * IDENTITY SAFETY IS THE REMOUNT'S, NOT A COMPARISON'S. Everything here lives in
 * one component's effects, and `VNextPredictorScreen` already gives the component
 * that owns the card a `key` of the request identity — so a change of account,
 * competition, season or matchweek unmounts this hook, clears its interval and
 * drops its listeners before the new predictor mounts its own. A timer armed for
 * one player's matchweek has nothing left to call.
 */

/**
 * HOW OFTEN THE DISPLAY INSTANT IS RE-READ.
 *
 * A quarter of the countdown's own smallest unit. `formatCountdown` speaks in
 * whole minutes, so a per-second interval would re-render the page sixty times to
 * change the text once — the churn §5A of the correction warns about, and on a
 * page holding ten live score inputs the last thing worth spending. A flat minute
 * is the other mistake: the interval is not aligned to the minute boundary, so
 * the displayed minute could sit a full minute behind the real one and the
 * boundary re-read could be a minute late. Fifteen seconds bounds both the
 * visible lag and the reload latency to a quarter of a minute, at four renders a
 * minute, and both bounds are invisible to a player.
 *
 * It is not the mechanism's only wake-up: a tab returning to the foreground
 * re-reads immediately, because a throttled interval cannot be relied on to have
 * fired at all.
 */
const DISPLAY_REFRESH_MS = 15_000

/**
 * The authoritative instant, and the observed instant it was taken at.
 *
 * Two numbers rather than one, because the offset has to be measured against
 * something that cannot be confused with the model's own clock.
 */
type Anchor = {
  readonly generatedAt: string
  readonly authoritative: number
  readonly observed: number
}

function anchorFor(generatedAt: string): Anchor {
  return { generatedAt, authoritative: Date.parse(generatedAt), observed: Date.now() }
}

/**
 * The instant to draw the page against, now.
 *
 * An unparseable `generatedAt` is handed back untouched rather than replaced with
 * a clock reading: a model whose own instant cannot be read is not a model to
 * invent a better instant for, and every formatter downstream already treats it
 * as no answer.
 */
function displayInstant(anchor: Anchor): string {
  if (!Number.isFinite(anchor.authoritative)) return anchor.generatedAt
  const elapsed = Math.max(0, Date.now() - anchor.observed)
  return new Date(anchor.authoritative + elapsed).toISOString()
}

export type DeadlineClockOptions = {
  /** The authoritative instant the model describes. The anchor, and nothing else. */
  readonly generatedAt: string
  /**
   * The application's resolved lock. Read for `kind` and `at` only — to know
   * whether there is an authoritative boundary worth watching, and where it is.
   */
  readonly lock: PredictorLock
  /**
   * ASK THE AUTHORITY AGAIN. `PredictorActions.refreshAfterDeadline`, which is
   * `useSeasonMatchPredictor`'s SAVE-SAFE re-read, so the answer to "is this
   * matchweek still open" comes back from the server that owns it.
   *
   * DELIBERATELY NOT `reload`. That control is a recovery command: it resets the
   * save controller, which cancels scheduled retries and discards the newer
   * value the coordinator is holding behind an in-flight one. A player who
   * changed 1–0 to 2–0 a second before kickoff would have had 2–0 dropped by a
   * timer. What happens while a write is unsettled is the application's to
   * decide and it decides it there; this file only says when to ask.
   */
  readonly onBoundaryReached: () => void
}

export function useDeadlineClock({
  generatedAt,
  lock,
  onBoundaryReached,
}: DeadlineClockOptions): string {
  const anchorRef = useRef<Anchor | null>(null)
  const [displayNow, setDisplayNow] = useState(generatedAt)

  /**
   * RE-ANCHORED WHEN THE APPLICATION ANSWERS AGAIN, AND ONLY THEN.
   *
   * A new `generatedAt` is a new authoritative model, and the display instant
   * restarts from it rather than carrying forward an offset earned against the
   * previous one — otherwise two clocks would compound. Adjusting state during
   * the render that changed the input is React's own pattern for exactly this,
   * and it matters here: an effect would run after a render that had already
   * painted the new model against the old model's advanced instant.
   */
  if (anchorRef.current === null || anchorRef.current.generatedAt !== generatedAt) {
    anchorRef.current = anchorFor(generatedAt)
    if (displayNow !== generatedAt) setDisplayNow(generatedAt)
  }

  const refresh = useCallback(() => {
    const anchor = anchorRef.current
    if (anchor !== null) setDisplayNow(displayInstant(anchor))
  }, [])

  /**
   * THE TICK, AND THE TWO LIFECYCLE SIGNALS THAT DO NOT TRUST IT.
   *
   * Browsers throttle timers hard in a background tab — to once a minute, and in
   * a frozen tab not at all — so a design that relied on an interval callback
   * firing near the deadline would simply not fire for the player who left the
   * card open in another tab over kickoff. A tab coming back to the foreground
   * therefore re-reads the clock itself, which both catches the countdown up and
   * hands the boundary check below a current instant to compare.
   *
   * `visibilitychange` and `focus` both fire on many returns and a re-read is
   * idempotent, so they are not deduplicated — the second one computes the same
   * instant as the first and React bails out of an identical state. No listener
   * outlives the component: this is where the identity guarantee is actually
   * kept, because the screen's `key` unmounts this hook on a change of account,
   * competition, season or matchweek.
   *
   * `window`/`document` rather than a dependency. The correction adds none, and
   * two browser events do not need one.
   */
  useEffect(() => {
    const interval = window.setInterval(refresh, DISPLAY_REFRESH_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  /**
   * The callback in a ref, so a caller that rebuilds its `actions` object cannot
   * restart the boundary watch and re-ask a question it has already asked.
   */
  const boundaryHandler = useRef(onBoundaryReached)
  boundaryHandler.current = onBoundaryReached

  /**
   * WHICH BOUNDARY HAS ALREADY BEEN ASKED ABOUT — the whole loop prevention, and
   * one slot is enough.
   *
   * The refresh is requested at most once per DISTINCT authoritative boundary. If
   * the reload comes back still open — because of a server rule, changed fixture
   * data, a lock the domain resolves differently, clock skew, or any other
   * legitimate reason — the instant on the new model is the same string, this
   * matches it, and nothing is asked again. The watch re-arms only when the
   * AUTHORITY supplies a different `lock.at`, which is the authority deciding
   * that there is a new deadline to watch rather than the browser deciding it is
   * owed a fresh answer.
   *
   * ONE ASK, EVEN WHEN THE ANSWER IS DEFERRED. `refreshAfterDeadline` may hold
   * the request until every save is settled, so a boundary can be marked here
   * well before the card is re-read. Asking a second time would not make it
   * arrive sooner — the application is already holding exactly one request, and
   * releases it itself.
   */
  const refreshedFor = useRef<string | null>(null)

  useEffect(() => {
    // Only an OPEN card with a resolved instant has a boundary at all. A closed,
    // settled or fail-closed card has an outcome, and asking again on a timer
    // would be polling for one.
    if (lock.kind !== 'open' || lock.at === null) return
    if (refreshedFor.current === lock.at) return

    const boundary = Date.parse(lock.at)
    const shown = Date.parse(displayNow)
    if (!Number.isFinite(boundary) || !Number.isFinite(shown)) return
    if (shown < boundary) return

    // The ONE thing browser time is allowed to conclude: it is time to ask.
    refreshedFor.current = lock.at
    boundaryHandler.current()
  }, [displayNow, lock.kind, lock.at])

  return displayNow
}
