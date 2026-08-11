import { useId } from 'react'
import type { SeasonPlayerProfile } from '../../services/supabase/seasonPlayerProfileModel'
import {
  MINIMUM_SAMPLE,
  compareDna,
  presentPredictionDna,
  type PredictionDna,
} from './predictionDnaModel'
import { ShareAction } from '../share/ShareAction'
import styles from './PredictionDnaPanel.module.css'

/**
 * `INNOV-002` on the player's own season page.
 *
 * IT SITS BESIDE THE SEASON RATHER THAN ON A ROUTE OF ITS OWN. Prediction DNA
 * is a description of the player whose page this already is; a separate
 * destination would be one more thing in the navigation and one more page a
 * player visits once.
 *
 * IT SAYS WHAT IT MEASURED, EVERY TIME. Each figure carries its denominator,
 * and the signature word is printed beside the number it came from — never on
 * its own, because a word without its measurement is the personality claim the
 * guardrails exclude.
 *
 * AN INSUFFICIENT SAMPLE IS AN ANSWER. It says how many predictions there are
 * and how many are needed, which is the same shape the consensus panel uses for
 * a short cohort, rather than quoting a percentage over four matches.
 *
 * COMPARISON IS OPTIONAL AND ADDS NO DISCLOSURE. The other player's profile is
 * one the server already handed this caller under contract 151's boundary; this
 * panel derives shares from it and reveals nothing the page was not already
 * showing.
 */

export type PredictionDnaPanelProps = {
  profile: SeasonPlayerProfile
  /**
   * INNOV-007. Where a share would go, and what competition to name in it.
   * Supplied only on the player's OWN profile: a share may say what the sharer
   * did and never what somebody else did.
   */
  share?: { competitionName: string; url: string } | null
  /**
   * The viewing player's own profile, when the page has it and the subject is
   * somebody else. Present, the panel compares; absent, it describes.
   */
  compareWith?: SeasonPlayerProfile | null
}

export function PredictionDnaPanel({
  profile,
  compareWith = null,
  share = null,
}: PredictionDnaPanelProps) {
  const headingId = useId()
  const dna = presentPredictionDna(profile)
  const mine = compareWith ? presentPredictionDna(compareWith) : null
  const comparison =
    mine && !profile.player.isSelf ? compareDna(mine, dna, profile.player.displayName) : []

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Prediction DNA
      </h2>

      {!dna.available ? (
        <Unavailable dna={dna} isSelf={profile.player.isSelf} />
      ) : (
        <>
          <p className={styles.signature}>
            <span className={styles.signatureWord}>{dna.signature}</span>
            <span className={styles.signatureNote}>
              from {dna.predictions} predictions across {dna.matchweeks}{' '}
              {dna.matchweeks === 1 ? 'matchweek' : 'matchweeks'}
            </span>
          </p>

          <dl className={styles.metrics}>
            {dna.metrics.map((metric) => (
              <div className={styles.metric} key={metric.key}>
                <dt className={styles.metricLabel}>{metric.label}</dt>
                <dd className={styles.metricValue}>{metric.value}</dd>
                <dd className={styles.metricDetail}>{metric.detail}</dd>
              </div>
            ))}
          </dl>

          {comparison.length > 0 ? (
            <>
              <h3 className={styles.subheading}>Against you</h3>
              <table className={styles.comparison}>
                <caption className={styles.srOnly}>
                  Your prediction habits beside {profile.player.displayName}&rsquo;s
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">You</th>
                    <th scope="col">{profile.player.displayName}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((line) => (
                    <tr key={line.key}>
                      <th scope="row" className={styles.comparisonLabel}>
                        {line.label}
                        {line.difference ? (
                          <span className={styles.comparisonNote}>{line.difference}</span>
                        ) : null}
                      </th>
                      <td className={styles.comparisonValue}>{line.mine}</td>
                      <td className={styles.comparisonValue}>{line.theirs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <p className={styles.footnote}>
            Measured from recorded predictions only. It describes how scorelines were picked and
            changes no points, rank or standing.
          </p>

          {/* Own profile only, and the signature never travels without the
              measurement behind it. */}
          {share && profile.player.isSelf ? (
            <p className={styles.shareRow}>
              <ShareAction
                label="Share your DNA"
                url={share.url}
                subject={{
                  kind: 'prediction_dna',
                  competitionName: share.competitionName,
                  signature: dna.signature,
                  evidence: `${dna.metrics[0]?.value ?? ''} ${dna.metrics[0]?.label.toLowerCase() ?? ''} over ${dna.predictions} predictions`,
                }}
              />
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function Unavailable({
  dna,
  isSelf,
}: {
  dna: Extract<PredictionDna, { available: false }>
  isSelf: boolean
}) {
  if (dna.reason === 'not_entered') {
    return (
      <p className={styles.note}>
        {isSelf
          ? 'You have not entered this season, so there are no predictions to describe.'
          : 'This player has not entered this season, so there are no predictions to describe.'}
      </p>
    )
  }
  return (
    <p className={styles.note}>
      {dna.predictions === 1 ? '1 prediction so far' : `${dna.predictions} predictions so far`}.
      Habits are shown once there are {MINIMUM_SAMPLE}.
    </p>
  )
}
