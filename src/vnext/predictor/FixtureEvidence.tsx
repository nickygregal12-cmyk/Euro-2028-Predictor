import { AnimatePresence, motion } from 'framer-motion'
import { FormRun } from '../components/football/FormRun'
import { ConsensusBar } from '../components/social/ConsensusBar'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import type { PredictorEnrichment, PredictorFixture, PredictorSide } from '../models/predictor'
import styles from './predictor.module.css'

/**
 * THE SUPPORTING FOOTBALL, ONE LAYER DOWN.
 *
 * The hierarchy §10 of the brief asks for is make the prediction first, inspect
 * the evidence second — so none of this is printed permanently on the row. A
 * fixture that showed form, a league position and a crowd split for both clubs
 * at all times would be a research dashboard with a score box in it, and a
 * player working through ten fixtures would scroll past nine screens of numbers
 * to reach the tenth decision.
 *
 * WHAT IS IN HERE IS ONLY WHAT THE APPLICATION ACTUALLY HAS. Recent form and its
 * record come from contract 141 (settled fixtures only, the same for everybody,
 * no provider request); the league position comes from contract 160, applied
 * under the competition's own stored rules server-side; the crowd split comes
 * from contract 130. Head to head is deliberately absent — contract 141
 * addresses it one PAIR at a time, so a matchweek of ten fixtures would be ten
 * more requests, and Stage 6 declined the same N+1 on Home for the same reason.
 *
 * ABSENCE IS SAID, NOT DRAWN AS ZERO. A club that has played nothing has no form
 * and the panel says so in words; a form read that did not answer says something
 * different, because "this club has not played" is football and "we could not
 * read it" is this build. `PredictorEnrichment` is what keeps the two apart.
 *
 * THE CONSENSUS BOUNDARY IS CONSUMED AND NEVER COMPUTED. `fixture.consensus` is
 * null before the server offers one, and this component's only response to null
 * is to draw nothing. It does not know what a lock is, it never compares an
 * instant, and it cannot conclude that a deadline has passed.
 */

export type FixtureEvidenceProps = {
  fixture: PredictorFixture
  enrichment: PredictorEnrichment
  open: boolean
  /** The id the disclosure button points `aria-controls` at. */
  panelId: string
}

export function FixtureEvidence({ fixture, enrichment, open, panelId }: FixtureEvidenceProps) {
  const disclose = useVNextMotion(vnextMotion.disclose)

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          id={panelId}
          className={styles.evidence}
          variants={disclose}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
        >
          {/* The inner element carries the padding. Animating the height of a
              padded box makes the padding animate too, which reads as the
              content squashing rather than the panel opening. */}
          <div className={styles.evidenceBody}>
            <div className={styles.evidenceClubs}>
              <ClubEvidence side={fixture.home} enrichment={enrichment} place="Home" />
              <ClubEvidence side={fixture.away} enrichment={enrichment} place="Away" />
            </div>

            {fixture.consensus ? (
              <ConsensusBar
                group={fixture.consensus}
                homeName={fixture.home.team.name}
                awayName={fixture.away.team.name}
                userScore={fixture.prediction}
              />
            ) : (
              <p className={typography.micro}>
                {/* Two different sentences for two different silences, and
                    neither of them guesses at a lock. */}
                {enrichment.consensus
                  ? 'No crowd split for this fixture.'
                  : 'The crowd’s predictions are not shown for this matchweek.'}
              </p>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ClubEvidence({
  side,
  enrichment,
  place,
}: {
  side: PredictorSide
  enrichment: PredictorEnrichment
  /** "Home" / "Away". Written out, because a column position is not a label. */
  place: string
}) {
  const { team, form, formRecord, leaguePosition } = side

  return (
    <div className={styles.evidenceClub}>
      <p className={typography.label}>{place}</p>
      <p className={`${typography.caption} ${typography.emphasis} ${styles.clubName}`}>
        {team.name}
      </p>

      {leaguePosition === null ? null : (
        <p className={typography.micro}>{formatOrdinal(leaguePosition)} in the table</p>
      )}

      {form.length > 0 ? (
        <FormRun form={form} teamName={team.name} />
      ) : (
        <p className={typography.micro}>
          {enrichment.form ? 'No settled matches yet' : 'Form unavailable'}
        </p>
      )}

      {formRecord ? (
        <p className={typography.micro}>
          {formRecord.record} · {formRecord.goalDifference} goal difference
        </p>
      ) : null}
    </div>
  )
}
