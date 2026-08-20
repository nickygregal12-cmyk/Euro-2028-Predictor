import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { TeamCrest } from '../components/football/TeamCrest'
import { FormRun } from '../components/football/FormRun'
import { fixtureColourStyle } from '../foundations/teamColour'
import {
  formatKickoffLabel,
  formatOrdinal,
  formatScoreline,
  formatShare,
} from '../foundations/format'
import typography from '../foundations/typography.module.css'
import type {
  PredictorActions,
  PredictorEnrichment,
  PredictorFixture,
  PredictorSide,
} from '../models/predictor'
import { FixtureEvidence } from './FixtureEvidence'
import { PredictionState } from './PredictionState'
import { ScoreEntry, useScoreEntry } from './ScoreEntry'
import styles from './predictor.module.css'

/**
 * ONE FIXTURE, AS A DECISION.
 *
 * THE FOOTBALL IS ABOVE THE CONTROLS, IN READING ORDER AND IN EMPHASIS. Both
 * clubs are named in full at a readable step with their colours on the row
 * before a single score box appears, because the question a player is answering
 * is "what will Glenmore do to Strathkelvin" and not "what goes in box one".
 * That is the Sky Bet half of the brief — fixture hierarchy first, controls
 * native to it — and it is why this row does not look like a form.
 *
 * IT IS THE SAME DOM AT EVERY WIDTH, RE-LAID BY ONE GRID. Two compositions, one
 * markup:
 *
 *   narrow  — each club takes its OWN ROW with its stepper at the inline end, so
 *             the controls sit under the thumb and a long club name has the
 *             whole width to wrap into;
 *   wide    — `home | scores | away`, the scoreboard arrangement, with the two
 *             steppers together in the middle where a scoreline belongs.
 *
 * The switch is a container query against the WORKING COLUMN rather than the
 * page, which matters: on a 1440 desktop the column is narrower than the shell
 * because the rail is beside it, and a page-width rule would give the column a
 * composition its own width cannot hold. `src/vnext/AGENTS.md` states the rule
 * and the workshop note records the four times it was learned the hard way.
 *
 * LOCKED IS ABSENT CONTROLS, NOT DISABLED ONES. `editable` is the application's
 * `presentCard(...).editable`, and when it is false there is no input, no
 * stepper and no clear button in the markup at all — the scoreline renders as
 * text. A disabled score box is a control that looks alive and refuses, which is
 * the complaint the repository's own score input records; and a locked matchweek
 * that merely greyed its inputs would still be one keyboard away from a write
 * the server would reject.
 *
 * NO PART OF THIS ROW DECIDES ANYTHING. It reads `editable`, `state`, `verdict`,
 * `consensus` and `save` and draws them. It never compares `kickoff` to a clock,
 * never scores a prediction, and never works out whether a deadline has passed.
 */

export type FixtureDecisionProps = {
  fixture: PredictorFixture
  enrichment: PredictorEnrichment
  /** The instant the model describes. Used for a kickoff LABEL and nothing else. */
  now: string
  actions: PredictorActions
  /**
   * Whether this is the next fixture the player has to decide.
   *
   * ONE ROW AT A TIME GETS THIS, and it is the only editorial emphasis inside the
   * list. Reserving intensity for the moment that deserves it is what keeps the
   * other nine rows scannable; a cinematic treatment on every fixture is not
   * emphasis, it is noise with a gradient.
   */
  nextUp?: boolean
  /** Focus the next fixture that still needs a decision, for typed entry. */
  onAdvanceOut?: (() => void) | undefined
  registerHomeInput?: ((element: HTMLInputElement | null) => void) | undefined
}

export function FixtureDecision({
  fixture,
  enrichment,
  now,
  actions,
  nextUp = false,
  onAdvanceOut,
  registerHomeInput,
}: FixtureDecisionProps) {
  const panelId = useId()
  const titleId = useId()
  const [open, setOpen] = useState(false)

  const entry = useScoreEntry(
    fixture,
    (score) => actions.setPrediction(fixture.id, score),
    () => actions.clearPrediction(fixture.id),
  )

  const fixtureName = `${fixture.home.team.name} versus ${fixture.away.team.name}`

  return (
    <li
      className={styles.fixture}
      data-state={entry.state}
      data-next={nextUp ? '' : undefined}
      data-verdict={fixture.verdict ?? undefined}
      // The two clubs' colours enter from either end as a hairline spine. Team
      // colour is atmosphere here and never state: `foundations/teamColour.ts`
      // holds that rule, and this row's state colours all come from the tokens.
      style={fixtureColourStyle(fixture.home.team, fixture.away.team)}
    >
      <p id={titleId} className={typography.srOnly}>
        {fixtureName}
      </p>

      <div className={styles.fixtureHead}>
        <p className={`${typography.micro} ${styles.kickoff}`}>
          {nextUp ? <span className={styles.nextTag}>Next up</span> : null}
          {fixture.kickoff === null
            ? 'Kickoff to be confirmed'
            : formatKickoffLabel(fixture.kickoff, now)}
        </p>
        <PredictionState
          state={entry.state}
          save={fixture.save}
          onRetry={() => actions.retrySave(fixture.id)}
        />
      </div>

      <div className={styles.fixtureBody}>
        <ClubLine side={fixture.home} place="home" />

        {fixture.editable ? (
          <ScoreEntry
            fixture={fixture}
            entry={entry}
            onAdvanceOut={onAdvanceOut}
            registerHomeInput={registerHomeInput}
          />
        ) : (
          <StandingScore fixture={fixture} />
        )}

        <ClubLine side={fixture.away} place="away" />
      </div>

      {fixture.consensus === null ? null : (
        <ConsensusSnack
          group={fixture.consensus}
          homeName={fixture.home.team.name}
          awayName={fixture.away.team.name}
        />
      )}

      <div className={styles.fixtureFoot}>
        {/* Clearing is offered only where there is something to clear AND the
            application says the card is editable. Both halves matter: the first
            stops an empty fixture carrying a control that would do nothing, the
            second is the lock. */}
        {fixture.editable && fixture.prediction !== null ? (
          <button
            type="button"
            className={styles.textAction}
            /*
             * AN EXPLICIT NAME RATHER THAN A HIDDEN SUFFIX, and the reason is one
             * this repository already learned in `PredictionChip`: adjacent text
             * is announced with no separator, so a visually hidden span that
             * starts with a space loses it and the name runs together as
             * "Clearyour prediction for …". The visible word is the start of the
             * accessible name, so WCAG's label-in-name still holds.
             */
            aria-label={`Clear your prediction for ${fixtureName}`}
            onClick={() => actions.clearPrediction(fixture.id)}
          >
            Clear
          </button>
        ) : null}

        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Form and crowd for ${fixtureName}`}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown
            className={styles.disclosureGlyph}
            aria-hidden="true"
            data-open={open ? '' : undefined}
          />
          Form and crowd
        </button>
      </div>

      <FixtureEvidence
        fixture={fixture}
        enrichment={enrichment}
        open={open}
        panelId={panelId}
      />
    </li>
  )
}

/**
 * THE CROWD, IN ONE LINE YOU CAN READ WITHOUT STOPPING.
 *
 * `71% HOME · 18% DRAW · 11% AWAY` over a hairline split bar. This is information
 * snacking: the whole answer to "which way is everybody going" in a glance, on the
 * row, without opening anything. The FULL treatment — the popular scorelines and
 * whether the player's own pick is among them — stays behind the disclosure, which
 * is where evidence belongs relative to a decision.
 *
 * IT IS NOT ODDS AND IT MUST NEVER READ AS ODDS. No decimal price, no fractional
 * price, no stake, no risk colour, no "market". The unit is a percentage of the
 * football community's own predictions, the words are "home", "draw" and "away",
 * and the two ends of the bar are the two CLUBS' colours rather than a
 * green-to-red risk ramp — which is the same rule the rest of the lane follows:
 * club colour is atmosphere, semantic colour is state, and a crowd split is
 * neither good nor bad.
 *
 * IT ONLY EXISTS WHERE THE SERVER OFFERED A CONSENSUS. `fixture.consensus` is null
 * before the reveal boundary and this renders nothing; no component infers that a
 * lock has passed.
 */
function ConsensusSnack({
  group,
  homeName,
  awayName,
}: {
  group: PredictorFixture['consensus'] & object
  homeName: string
  awayName: string
}) {
  const { homeWinShare, drawShare, awayWinShare } = group

  return (
    <p
      className={styles.snack}
      // One image with one sentence: three separate percentages announced
      // individually is three times the noise for the same fact.
      role="img"
      aria-label={`Community predictions: ${formatShare(homeWinShare)} ${homeName}, ${formatShare(
        drawShare,
      )} draw, ${formatShare(awayWinShare)} ${awayName}, from ${group.sampleSize} predictions`}
    >
      <span className={styles.snackBar} aria-hidden="true">
        <span className={styles.snackHome} style={{ flexGrow: homeWinShare }} />
        <span className={styles.snackDraw} style={{ flexGrow: drawShare }} />
        <span className={styles.snackAway} style={{ flexGrow: awayWinShare }} />
      </span>
      <span className={`${styles.snackText} ${typography.numeric}`} aria-hidden="true">
        <span>{formatShare(homeWinShare)} home</span>
        <span>{formatShare(drawShare)} draw</span>
        <span>{formatShare(awayWinShare)} away</span>
      </span>
    </p>
  )
}

/**
 * One club on the row: its identity, its name in full, and the football that
 * fits inline.
 *
 * THE NAME WRAPS AS FAR AS IT NEEDS TO AND NEVER TRUNCATES, which is Home's fix
 * taken one step further. Home stopped truncating at two lines and then
 * ellipsised; the browser suite caught "Strathallan Caledonian Thistle" clipping
 * at 768, 1024 and 1920, because a scoreboard row gives each club roughly 150px
 * and that name needs three lines. So there is no line clamp here at all:
 * `overflow-wrap: anywhere` stops a single long word pushing the row wide, and the
 * row grows instead. A row that is occasionally three lines tall is worth more
 * than a club called "Strathallan Caledonia…", and with nothing hiding overflow no
 * future composition can reopen the defect.
 *
 * THE FORM RUN AND THE POSITION ARE ON THE ROW AT EVERY WIDTH. `W W D L W` and
 * `4th` are the cheapest football information there is — five glyphs and an
 * ordinal — and they are exactly the kind a player reads without stopping. The
 * premium version of this page is not the sparse one: it is the one where a lot of
 * football coexists because the hierarchy is good enough to carry it. What stays
 * behind the disclosure is the reading, not the glance: the record sentence, the
 * goal difference and the popular scorelines.
 */
function ClubLine({ side, place }: { side: PredictorSide; place: 'home' | 'away' }) {
  return (
    <div className={styles.club} data-side={place}>
      <TeamCrest team={side.team} size="sm" decorative />
      <span className={styles.clubText}>
        <span className={`${typography.body} ${typography.emphasis} ${styles.clubName}`}>
          {side.team.name}
        </span>
        <span className={styles.clubMeta}>
          {side.leaguePosition === null ? null : (
            <span className={typography.micro}>{formatOrdinal(side.leaguePosition)}</span>
          )}
          {side.form.length > 0 ? (
            <span className={styles.inlineForm}>
              <FormRun form={side.form} teamName={side.team.name} />
            </span>
          ) : null}
        </span>
      </span>
    </div>
  )
}

/**
 * The scoreline on a fixture the player can no longer change.
 *
 * LOCKED SHOWS WHAT THEY SAID. SETTLED SHOWS BOTH, LABELLED. A settled fixture
 * prints the official result and the player's prediction beside it, because "you
 * said 2–1, it finished 2–2" is the whole story of a matchweek and a single
 * number cannot tell it. The verdict word comes from the domain rule; no points
 * figure appears here, because the application states none per fixture.
 */
function StandingScore({ fixture }: { fixture: PredictorFixture }) {
  const { prediction, result, verdict } = fixture

  return (
    <span className={styles.entry} data-mode="standing">
      {result === null ? null : (
        <span className={styles.standing} data-role="result">
          <span className={typography.label}>Result</span>
          <span className={`${styles.standingScore} ${typography.numeric}`}>
            {formatScoreline(result.home, result.away)}
          </span>
        </span>
      )}

      <span className={styles.standing} data-role="prediction">
        <span className={typography.label}>You said</span>
        <span className={`${styles.standingScore} ${typography.numeric}`}>
          {prediction === null ? (
            <>
              <span aria-hidden="true">—</span>
              <span className={typography.srOnly}>no prediction</span>
            </>
          ) : (
            formatScoreline(prediction.home, prediction.away)
          )}
        </span>
        {verdict === null ? null : (
          <span className={styles.verdict} data-verdict={verdict}>
            {verdict === 'exact' ? 'Exact score' : verdict === 'result' ? 'Right result' : 'Missed'}
          </span>
        )}
      </span>
    </span>
  )
}
