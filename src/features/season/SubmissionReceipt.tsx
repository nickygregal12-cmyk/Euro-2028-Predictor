import { useId } from 'react'
import type { MatchPredictorPage } from './matchPredictorModel'
import styles from './SubmissionReceipt.module.css'

/**
 * `INNOV-017` — what the player has actually submitted, stated plainly.
 *
 * IT CLAIMS ONLY WHAT THE SERVER SAID. Contract 114's card read supplies the
 * card's status and the fixtures the player entered, and that is the whole of
 * what appears here. There is no submission reference and no submitted-at time,
 * because `confirm_season_matchweek_card` returns neither and
 * `get_season_matchweek_card` carries neither: a timestamp taken from the
 * browser's clock would be the DEVICE's opinion of when the server acted, and a
 * reference generated here would be an identifier of nothing.
 *
 * IT DOES NOT SAY "CRYPTOGRAPHICALLY VERIFIED", AND THAT MATTERS MORE THAN THE
 * MISSING FIELDS. The Innovation Lab entry is a commitment scheme; this is not
 * one, and describing an ordinary database write in those terms would be the
 * exact false assurance the guardrail names. The backend dependency —
 * a server-supplied confirmation instant and receipt identifier — is recorded in
 * `docs/product/innovation-lab.md`.
 *
 * IT SEPARATES "SAVED" FROM "CONFIRMED", because the ledger does. A prediction
 * is stored the moment it is saved and banks at the lock either way; confirming
 * is the player saying they meant it, and the copy must not collapse the two.
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
      <p className={styles.note}>
        {confirmed
          ? 'Your card is confirmed. Every prediction above is held by the server, not by this device, and will bank when the matchweek locks. You can still change one until then.'
          : 'Every prediction above is held by the server, not by this device. It will bank when the matchweek locks whether or not you confirm — confirming records that you meant to leave the rest blank.'}
      </p>
    </section>
  )
}
