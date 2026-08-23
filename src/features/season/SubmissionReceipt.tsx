import { useId } from 'react'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import type { MatchPredictorPage } from './matchPredictorModel'
import styles from './SubmissionReceipt.module.css'

/**
 * `INNOV-017` — what the player has actually submitted, stated plainly.
 *
 * IT CLAIMS ONLY WHAT THE SERVER SAID. Contract 214 adds the confirmation
 * instant and compact reference to the existing card authority. Neither is
 * generated from the browser clock and neither is a client-side receipt id.
 * During the repository/hosted rollout gap they can be absent even when an
 * older database reports `card_status = confirmed`; in that case the card may
 * say it is confirmed but this component invents no evidence line.
 *
 * IT DOES NOT SAY "CRYPTOGRAPHICALLY VERIFIED", AND THAT MATTERS MORE THAN THE
 * REFERENCE. The reference is a human support/checking aid derived from the
 * existing card id and confirmation instant. It is not a commitment scheme and
 * does not turn an ordinary database write into cryptographic proof.
 *
 * IT SEPARATES "SAVED" FROM "CONFIRMED", because the ledger does. A prediction
 * is stored the moment it is saved and banks at the lock either way; confirming
 * is the player saying they meant it, and the copy must not collapse the two.
 * Contract 214 also means a later material prediction or Joker change returns
 * the card to provisional, so this receipt cannot describe an older card as the
 * one currently on screen.
 *
 * IT APPEARS ONLY WHERE THERE IS SOMETHING TO CONFIRM. A matchweek with no
 * prediction on it gets no receipt, because there is nothing to receipt.
 */

export type SubmissionReceiptProps = {
  card: MatchPredictorPage
}

export function SubmissionReceipt({ card }: SubmissionReceiptProps) {
  const headingId = useId()
  const entered = card.fixtures.filter((fixture) => fixture.prediction !== null).length
  const total = card.fixtures.length

  if (entered === 0) return null

  const confirmed = card.cardStatus === 'confirmed'
  const confirmedWhen = confirmed ? formatKickoffWithDay(card.confirmedAt ?? null) : null
  const confirmationReference = confirmed ? (card.confirmationReference ?? null) : null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 className={styles.heading} id={headingId}>
        {confirmed ? 'Predictions submitted' : 'Saved on the server'}
      </h3>
      <p className={styles.line}>
        Matchweek {card.matchweek.number} · {entered} of {total}{' '}
        {total === 1 ? 'fixture' : 'fixtures'} entered
        {card.joker.playedHere ? ' · Joker played' : ''}
      </p>
      {confirmed && confirmedWhen && confirmationReference ? (
        <p className={styles.line}>
          Confirmed {confirmedWhen} · Ref {confirmationReference}
        </p>
      ) : null}
      <p className={styles.note}>
        {confirmed
          ? 'Your current card is confirmed. Every prediction above is held by the server, not by this device, and will bank when the matchweek locks. A later change returns the card to saved until you confirm it again.'
          : 'Every prediction above is held by the server, not by this device. It will bank when the matchweek locks whether or not you confirm — confirming records that you meant to leave the rest blank.'}
      </p>
    </section>
  )
}
