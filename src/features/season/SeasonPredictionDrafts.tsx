import { useId } from 'react'
import { Button } from '../../design-system'
import type { DraftFixtureView, DraftsView } from './predictionDraftModel'
import styles from './SeasonPredictionDrafts.module.css'

/**
 * `INNOV-020` — the drafts this device is holding, and what the server said.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING TO SAY. A player with a connection
 * and no outstanding work never sees it. The normal online path is unchanged
 * and this is a strip that appears when something needs the player's attention
 * — not a synchronisation dashboard bolted to the top of a prediction screen.
 *
 * THE WORD "SUBMITTED" APPEARS NOWHERE, AND CANNOT. Everything listed here is
 * work the server has NOT accepted; the moment it accepts a draft, that draft
 * leaves this panel entirely. There is no state in the model that means saved,
 * so there is no way for this component to print one.
 *
 * A CONFLICT SHOWS BOTH SCORELINES AND ASKS. Contract 177 returns the stored
 * one beside the drafted one for exactly this reason, and neither this
 * component nor the model behind it picks a winner. "Keep mine" reloads the
 * card first — the version the server refused is stale by definition, and
 * resubmitting it unchanged would conflict again for ever.
 *
 * A LOCKED DRAFT OFFERS ONLY DISCARD. Retrying is not a thing that can
 * succeed: the matchweek's lock has passed and no client action reopens it.
 * Offering a retry that the server will refuse is a dead control with extra
 * steps.
 */

export type SeasonPredictionDraftsProps = {
  drafts: DraftsView
  /** Fixture names for the rows, from the card the page already loaded. */
  labelFor: (fixtureId: string) => string
  onSync: () => void
  onRetry: (fixtureId: string) => void
  onDiscard: (fixtureId: string) => void
}

const scoreLabel = (score: { home: number; away: number } | null): string =>
  score === null ? 'no prediction' : `${score.home} – ${score.away}`

export function SeasonPredictionDrafts({
  drafts,
  labelFor,
  onSync,
  onRetry,
  onDiscard,
}: SeasonPredictionDraftsProps) {
  const headingId = useId()

  if (drafts.fixtures.length === 0) return null

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-offline={drafts.offline}>
      <h2 className={styles.heading} id={headingId}>
        Saved on this device
      </h2>

      <p className={styles.lede}>
        {drafts.pending > 0
          ? `${drafts.pending} ${drafts.pending === 1 ? 'prediction is' : 'predictions are'} held on this device and not yet with us.`
          : 'Nothing is waiting to be sent.'}
        {drafts.blocked > 0
          ? ` ${drafts.blocked} ${drafts.blocked === 1 ? 'needs' : 'need'} your decision.`
          : ''}
        {drafts.offline ? ' This device has no connection.' : ''}
      </p>

      <ul className={styles.rows}>
        {drafts.fixtures.map((fixture) => (
          <Row
            key={fixture.fixtureId}
            fixture={fixture}
            label={labelFor(fixture.fixtureId)}
            onRetry={onRetry}
            onDiscard={onDiscard}
          />
        ))}
      </ul>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={onSync}
          // The control is offered whenever there is something to send. A
          // device that believes it is offline is often wrong, and a player who
          // taps it and is told nothing happened is better served than one
          // looking at a control that will not respond.
          disabled={drafts.syncing || drafts.pending === 0}
        >
          {drafts.syncing ? 'Sending…' : 'Send now'}
        </Button>
        {drafts.lastResult ? (
          <span className={styles.note}>
            Last attempt: {drafts.lastResult.accepted} accepted, {drafts.lastResult.rejected} not.
          </span>
        ) : null}
      </div>
    </section>
  )
}

function Row({
  fixture,
  label,
  onRetry,
  onDiscard,
}: {
  fixture: DraftFixtureView
  label: string
  onRetry: (fixtureId: string) => void
  onDiscard: (fixtureId: string) => void
}) {
  return (
    <li className={styles.row} data-state={fixture.state}>
      <span className={styles.fixture}>{label}</span>
      <span className={styles.state}>{STATE_LABEL[fixture.state]}</span>
      <span className={styles.score}>Yours: {scoreLabel(fixture.prediction)}</span>

      {fixture.refusal ? (
        <>
          {/* The server's own sentence, never replaced with a generic one. */}
          <span className={styles.reason}>
            {fixture.refusal.reason ?? 'The server did not accept this prediction.'}
          </span>
          {fixture.refusal.stored ? (
            <span className={styles.score}>
              Already saved: {scoreLabel(fixture.refusal.stored)}
            </span>
          ) : null}
          <span className={styles.rowActions}>
            {fixture.refusal.outcome === 'locked' ? null : (
              <Button variant="secondary" onClick={() => onRetry(fixture.fixtureId)}>
                Keep mine
              </Button>
            )}
            <Button
              // Destructive because it is: discarding is the one action here
              // that loses a prediction the player typed.
              variant="destructive"
              onClick={() => onDiscard(fixture.fixtureId)}
            >
              {fixture.refusal.outcome === 'conflict' ? 'Use the saved one' : 'Discard'}
            </Button>
          </span>
        </>
      ) : null}
    </li>
  )
}

const STATE_LABEL: Record<DraftFixtureView['state'], string> = {
  draft: 'Draft on this device',
  syncing: 'Sending',
  locked: 'Locked before it reached us',
  conflict: 'Changed somewhere else',
  failed: 'Not accepted',
}
