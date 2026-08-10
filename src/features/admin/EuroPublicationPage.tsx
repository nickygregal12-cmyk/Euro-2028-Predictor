import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton, TextInput } from '../../design-system'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  fetchEuroPublicationState,
  transitionEuroPublicationState,
} from '../../services/supabase/euroPublication'
import {
  nextEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../../services/supabase/euroPublicationModel'
import {
  euroPublicationRefusal,
  euroPublicationStateSummary,
} from './euroPublicationAdminModel'
import styles from './adminPanels.module.css'

/**
 * `/admin/euro` — the Euro 2028 publication state, and the one control that
 * moves it (`EURO-002`, ADR 0026).
 *
 * WHY IT EXISTS. Contract 143 built the whole authority — a default-`hidden`
 * singleton, a bounded read, an owner-only adjacent transition and append-only
 * history — and granted `admin_transition_euro_publication_state` to
 * `authenticated`. Measured against `src/`, nothing called it. PR #627 then
 * taught the route boundary to CONSUME the state, so the weekly application
 * now refuses player-facing Euro routes while hidden and has no way to stop
 * refusing them. The tournament could be hidden and could not be published.
 *
 * That is the seventh instance of this repository's most-repeated defect — an
 * authority that exists, is correct, and is unreachable from a browser — and it
 * is a worse instance than most, because the only remaining way to publish was
 * to run SQL by hand against a hosted database, which the project's own
 * boundaries forbid. Publication is meant to be "an operational act with a
 * recorded approval" (ADR 0026); an act nobody can perform is not one.
 *
 * IT IS NOT A SECOND PUBLICATION RULE. The server owns who may act, which step
 * is legal, whether the expected state still holds, that a reason was given and
 * the history row. This page reads the state, offers the ONE adjacent step the
 * lifecycle allows, sends what the operator typed, and reports the server's
 * answer. Every refusal below is the server's, reported rather than predicted —
 * including an empty reason, which is sent and refused rather than blocked, so
 * no rule about publication lives in a browser.
 *
 * WHY AN ADMIN SURFACE MAY NAME EURO AT ALL WHILE `EURO-001` HIDES IT. The
 * requirement hides Euro from the WEEKLY PLATFORM'S PLAYER AND PUBLIC surfaces.
 * `/admin/results` is already the recorded precedent — `TournamentJourney`
 * exempts it by name, because a hidden tournament still has to be prepared
 * before its owner can publish it — and this is the same exemption for the act
 * of publishing itself. `euroAbsentFromPublicSurfaces` holds the public
 * artefacts and this page is not one of them.
 *
 * IT RELOADS AFTER A SUCCESSFUL WRITE rather than trusting the row it was
 * handed. The RPC does return the new state, and using it would still be one
 * copy of the truth — but a re-read also proves the write landed where the
 * route guard reads from, which is the fact an operator actually wants after
 * publishing a tournament.
 */

type StateView =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; snapshot: EuroPublicationSnapshot }

export type EuroPublicationPageProps = {
  /** Injectable so the surface is proven without a Supabase client. */
  readState?: () => Promise<EuroPublicationSnapshot>
  transition?: typeof transitionEuroPublicationState
}

function formatInstant(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  // UTC, spelled out. An operator comparing this against a hosted read or a
  // history row needs the same instant they will see there, not a local one.
  return `${at.toISOString().replace('T', ' ').slice(0, 19)} UTC`
}

export function EuroPublicationPage({
  readState = fetchEuroPublicationState,
  transition = transitionEuroPublicationState,
}: EuroPublicationPageProps = {}) {
  const [view, setView] = useState<StateView>({ status: 'loading' })
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  )
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setView({ status: 'loading' })
    readState()
      .then((snapshot) => {
        if (active) setView({ status: 'ready', snapshot })
      })
      .catch((error: unknown) => {
        if (active) {
          setView({
            status: 'failed',
            // A failed read is not "hidden". The route guard already fails
            // closed on it; this page must not turn the same failure into a
            // publication control over a state it could not read.
            message: euroPublicationRefusal(error, userFacingError(error)),
          })
        }
      })
    return () => {
      active = false
    }
  }, [readState, reload])

  const snapshot = view.status === 'ready' ? view.snapshot : null
  const next = snapshot ? nextEuroPublicationState(snapshot.state) : null

  const advance = useCallback(async () => {
    if (!snapshot || !next) return
    setBusy(true)
    setNotice(null)
    try {
      await transition({
        expectedState: snapshot.state,
        nextState: next,
        reason,
      })
      setNotice({
        tone: 'success',
        text: `Euro 2028 moved from ${snapshot.state} to ${next}.`,
      })
      setReason('')
      setReload((n) => n + 1)
    } catch (error: unknown) {
      setNotice({
        tone: 'warning',
        text: euroPublicationRefusal(error, userFacingError(error)),
      })
    } finally {
      setBusy(false)
    }
  }, [next, reason, snapshot, transition])

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="euro-publication-heading">
        <h1 className={styles.heading} id="euro-publication-heading">
          Euro 2028 publication
        </h1>
        <p className={styles.caption}>
          One server-owned state decides whether Euro 2028 exists for a player.
          It starts hidden, moves one step at a time and never moves back. Every
          change is recorded with the reason you give.
        </p>
      </section>

      {notice ? (
        <Alert variant={notice.tone === 'success' ? 'success' : 'warning'}>{notice.text}</Alert>
      ) : null}

      <section className={styles.panel} aria-labelledby="euro-publication-state-heading">
        <h2 className={styles.heading} id="euro-publication-state-heading">
          Current state
        </h2>

        {view.status === 'loading' ? (
          <>
            <Skeleton height="3rem" />
            <span className={styles.srOnly}>Reading the publication state</span>
          </>
        ) : null}

        {view.status === 'failed' ? (
          <Alert variant="warning">
            {view.message} No publication control is offered until the state can
            be read.
          </Alert>
        ) : null}

        {snapshot ? (
          <>
            <dl className={styles.readiness}>
              <div className={styles.figure}>
                <dt>State</dt>
                <dd>{snapshot.state}</dd>
              </div>
              <div className={styles.figure}>
                <dt>Last changed</dt>
                <dd>{formatInstant(snapshot.changedAt)}</dd>
              </div>
            </dl>
            <p className={styles.caption}>{euroPublicationStateSummary(snapshot.state)}</p>
          </>
        ) : null}
      </section>

      {snapshot ? (
        <section className={styles.panel} aria-labelledby="euro-publication-advance-heading">
          <h2 className={styles.heading} id="euro-publication-advance-heading">
            Advance the lifecycle
          </h2>

          {next ? (
            <>
              <p className={styles.caption}>
                {snapshot.state === 'hidden'
                  ? 'Moving to prelaunch makes Euro 2028 reachable in this environment. It cannot be moved back.'
                  : `The only step available from ${snapshot.state} is ${next}. It cannot be moved back.`}
              </p>
              <fieldset className={styles.controls}>
                <legend className={styles.srOnly}>
                  Advance Euro 2028 from {snapshot.state} to {next}
                </legend>
                <span className={styles.reason}>
                  <TextInput
                    label="Reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={busy}
                  />
                </span>
                {/* The reason is sent as given, including absent. The server
                    refuses a transition without one and says so; refusing here
                    first would be this page holding an opinion about the rule,
                    which is the line `/admin/season` already draws. */}
                <Button variant="primary" onClick={advance} loading={busy}>
                  Advance to {next}
                </Button>
              </fieldset>
            </>
          ) : (
            <p className={styles.caption}>
              {snapshot.state} is the end of the lifecycle. There is no further
              state to advance to.
            </p>
          )}
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="euro-publication-gaps-heading">
        <h2 className={styles.heading} id="euro-publication-gaps-heading">
          Not offered here, and why
        </h2>
        <p className={styles.caption}>
          There is no control to move the state backwards, because the server
          permits none. A published tournament is unpublished by a decision with
          its own record, not by a button that quietly reverses one.
        </p>
        <p className={styles.caption}>
          The transition history is written and is append-only, and no browser
          read exposes it. This page shows the current state and when it last
          changed — which is what the bounded read returns — rather than the
          list of who changed it and why.
        </p>
      </section>
    </div>
  )
}
