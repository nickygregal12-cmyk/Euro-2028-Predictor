import { useId } from 'react'
import type { SeasonPredictionDna } from '../../services/supabase/seasonPredictionDnaModel'
import {
  compareDna,
  presentPredictionDna,
  type DnaGroup,
  type PredictionDna,
} from './predictionDnaModel'
import { ShareAction } from '../share/ShareAction'
import styles from './PredictionDnaPanel.module.css'

/**
 * `INNOV-002` on a player's season page, over contract 176.
 *
 * IT SITS BESIDE THE SEASON RATHER THAN ON A ROUTE OF ITS OWN. Prediction DNA
 * is a description of the player whose page this already is; a separate
 * destination would be one more thing in the navigation and one more page a
 * player visits once.
 *
 * IT SAYS WHAT IT MEASURED, EVERY TIME, AND THE THREE THINGS IT MEASURED ARE
 * NOT THE SAME POPULATION. Tendencies come from locked predictions, accuracy
 * from played ones, agreement from the smaller set that cleared the cohort. So
 * they are three groups with three denominators on screen rather than one grid
 * of percentages that share a heading and nothing else.
 *
 * A SHORT SAMPLE IS SAID, NOT HIDDEN AND NOT DRESSED UP. The server decides
 * whether a group is sufficient; where it is not, the group still shows its
 * counts and states the shortfall, and the signature word is withheld — a
 * one-word label over four predictions is the claim a player would repeat.
 *
 * A REFUSAL IS THE ROUTE'S TO RENDER, NOT THIS PANEL'S. Contract 176 refuses a
 * caller who shares no private league with the subject, and that is a sentence
 * about permission rather than about data. This panel is given a payload or it
 * is not mounted.
 *
 * COMPARISON ADDS NO DISCLOSURE. The rival's DNA is one the server already
 * handed this caller under contract 151's boundary, and the caller's own is
 * always readable; the comparison prints two figures that are each already on a
 * page the caller may open.
 */

export type PredictionDnaPanelProps = {
  dna: SeasonPredictionDna
  /**
   * INNOV-007. Where a share would go, and what competition to name in it.
   * Supplied only on the player's OWN profile: a share may say what the sharer
   * did and never what somebody else did.
   */
  share?: { competitionName: string; url: string } | null
  /**
   * The viewing player's own DNA, when the page has it and the subject is
   * somebody else. Present, the panel compares; absent, it describes.
   */
  compareWith?: SeasonPredictionDna | null
}

export function PredictionDnaPanel({
  dna: payload,
  compareWith = null,
  share = null,
}: PredictionDnaPanelProps) {
  const headingId = useId()
  const dna = presentPredictionDna(payload)
  const mine = compareWith ? presentPredictionDna(compareWith) : null
  const comparison = mine && !dna.isSelf ? compareDna(mine, dna, dna.playerName) : []

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Prediction DNA
      </h2>

      {!dna.available ? (
        <Unavailable dna={dna} />
      ) : (
        <>
          {dna.signature ? (
            <p className={styles.signature}>
              <span className={styles.signatureWord}>{dna.signature}</span>
              <span className={styles.signatureNote}>
                from {dna.predictions} locked {dna.predictions === 1 ? 'prediction' : 'predictions'}
                {dna.settledPredictions > 0
                  ? `, ${dna.settledPredictions} of them settled`
                  : ', none of them settled yet'}
              </span>
            </p>
          ) : null}

          {dna.groups.map((group) => (
            <Group key={group.key} group={group} />
          ))}

          {dna.clubs.length > 0 ? <Clubs clubs={dna.clubs} /> : null}

          {comparison.length > 0 ? (
            <>
              <h3 className={styles.subheading}>Against you</h3>
              <table className={styles.comparison}>
                <caption className={styles.srOnly}>
                  Your prediction habits beside {dna.playerName}&rsquo;s
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">You</th>
                    <th scope="col">{dna.playerName}</th>
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
            Measured from recorded predictions once each matchweek has locked. It describes how
            scorelines were picked and changes no points, rank or standing.
          </p>

          {/* Own profile only, and the signature never travels without the
              measurement behind it. A withheld signature shares nothing. */}
          {share && dna.isSelf && dna.signature ? (
            <p className={styles.shareRow}>
              <ShareAction
                label="Share your DNA"
                url={share.url}
                subject={{
                  kind: 'prediction_dna',
                  competitionName: share.competitionName,
                  signature: dna.signature,
                  evidence: `${dna.groups[0]?.metrics[0]?.value ?? ''} ${dna.groups[0]?.metrics[0]?.label.toLowerCase() ?? ''} over ${dna.groups[0]?.denominator ?? 0} ${dna.groups[0]?.denominatorNoun ?? 'predictions'}`,
                }}
              />
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function Group({ group }: { group: DnaGroup }) {
  return (
    <>
      <h3 className={styles.subheading}>{group.title}</h3>
      {/* The denominator sits directly under the heading and above the figures,
          so a reader never has to hunt for what a percentage was measured over.
          It is its own element rather than a span inside the heading: a heading
          whose accessible name ends in "40 locked predictions" is read out as
          one run-on phrase. */}
      <p className={styles.groupDenominator}>
        {group.denominator} {group.denominatorNoun}
      </p>
      <dl className={styles.metrics} data-sufficient={group.sufficient ? 'yes' : 'no'}>
        {group.metrics.map((metric) => (
          <div className={styles.metric} key={metric.key}>
            <dt className={styles.metricLabel}>{metric.label}</dt>
            <dd className={styles.metricValue}>{metric.value}</dd>
            <dd className={styles.metricDetail}>{metric.detail}</dd>
          </div>
        ))}
      </dl>
      {group.caution ? <p className={styles.note}>{group.caution}</p> : null}
    </>
  )
}

function Clubs({ clubs }: { clubs: Extract<PredictionDna, { available: true }>['clubs'] }) {
  return (
    <>
      <h3 className={styles.subheading}>By club</h3>
      <table className={styles.comparison}>
        <caption className={styles.srOnly}>
          Predictions by club, most-predicted first
        </caption>
        <thead>
          <tr>
            <th scope="col">Club</th>
            <th scope="col">Backed to win</th>
            <th scope="col">Settled</th>
          </tr>
        </thead>
        <tbody>
          {clubs.map((club) => (
            <tr key={club.teamId}>
              <th scope="row" className={styles.comparisonLabel}>
                {club.name}
              </th>
              <td className={styles.comparisonValue}>{club.backing}</td>
              <td className={styles.comparisonValue}>
                {club.accuracy ?? 'Nothing settled yet'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Unavailable({ dna }: { dna: Extract<PredictionDna, { available: false }> }) {
  if (dna.reason === 'not_entered') {
    return (
      <p className={styles.note}>
        {dna.isSelf
          ? 'You have not entered this season, so there are no predictions to describe.'
          : `${dna.playerName} has not entered this season, so there are no predictions to describe.`}
      </p>
    )
  }
  // Entered, and nothing has locked. Deliberately a different sentence: the
  // predictions exist and the window has not opened on them.
  return (
    <p className={styles.note}>
      {dna.isSelf ? 'Your predictions are' : `${dna.playerName}'s predictions are`} described once
      a matchweek has locked. Nothing has yet.
    </p>
  )
}
