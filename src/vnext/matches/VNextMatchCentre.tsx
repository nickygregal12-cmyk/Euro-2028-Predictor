import { motion } from 'framer-motion'
import type {
  MatchCentreModel,
  MatchCentreSide,
  MatchPredictionBadge,
} from '../models/matches'
import { matchCentreModules } from '../models/matches'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { TeamCrest } from '../components/football/TeamCrest'
import { FormRun } from '../components/football/FormRun'
import { fixtureColourStyle } from '../foundations/teamColour'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatScoreline } from '../foundations/format'
import { MatchScoreMark, MatchStateMark } from './MatchState'
import text from '../foundations/typography.module.css'
import styles from './matchCentre.module.css'

export type MatchCentreIntent =
  | { readonly kind: 'back' }
  | { readonly kind: 'link'; readonly link: MatchCentreModel['links'][number]['kind'] }

export type VNextMatchCentreProps = {
  readonly model: MatchCentreModel
  readonly onIntent?: ((intent: MatchCentreIntent) => void) | undefined
}

/**
 * vNEXT MATCH CENTRE — WHAT IS HAPPENING IN THIS MATCH?
 *
 * ============================ IT IS A FOOTBALL SURFACE ====================
 *
 * Not a prediction form. §15 is explicit and the composition holds it: the
 * football — who is playing, what the state is, what it means in the
 * competition — is the page, and the player's own prediction is one status
 * block below it with a LINK to the Match Predictor beside it. There is no
 * score entry here, no joker, no submission and no lock, because those belong
 * to a game and this page is about a match.
 *
 * ============================ TRUTHFUL TIERS ==============================
 *
 *   TIER 1  identity, clubs, kickoff, state, score, competition context.
 *           Always present. This page cannot be drawn without it.
 *   TIER 2  the competition's table, both form runs, this season's meetings.
 *           Each from a DIFFERENT read that may fail alone, and each rendered
 *           only where its data genuinely arrived.
 *   TIER 3  lineups, an event timeline, statistics, injuries, the referee, the
 *           venue, broadcast. NONE of these exists anywhere in this platform,
 *           and not one of them is drawn as an empty module, a "coming soon" or
 *           a row of zeroes. `matchCentreModules(model)` is the single answer to
 *           what renders, so no section decides for itself.
 *
 * Building a possession bar with no possession data would make this page look
 * finished and make the product a liar. The gap is recorded in
 * `docs/product/vnext-matches.md` § "Backend gaps" instead.
 *
 * ============================ THE LIVE RULE, AGAIN ========================
 *
 * Nothing here reads a clock. A live match without a minute says "Live" and
 * gives the score as provisional with the instant it was observed at; it does
 * not count minutes from kickoff, and a postponed fixture draws no live
 * furniture at all.
 */
export function VNextMatchCentre({ model, onIntent }: VNextMatchCentreProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)
  const modules = matchCentreModules(model)

  return (
    <VNextShell
      destination="matches"
      competitionColours={model.competition.colours}
      header={
        <VNextPageHeader
          // THE PAGE'S ONE `<h1>` IS THE MATCH ITSELF. A Match Centre whose
          // heading says "Match Centre" is a page named after its own file:
          // the reader came here for one fixture and the heading should be it.
          title={`${model.home.team.name} v ${model.away.team.name}`}
          competition={
            model.competition.seasonLabel
              ? `${model.competition.name} · ${model.competition.seasonLabel}`
              : model.competition.name
          }
          context={[model.stage.label, model.dayLabel].filter(Boolean).join(' · ')}
        />
      }
    >
      {/* THE CLUB COLOURS SIT ON THE PAGE'S OWN PLAIN ELEMENT and the hero
          inherits them. Framer's `MotionStyle` cannot accept a `CSSProperties`
          carrying custom properties under `exactOptionalPropertyTypes`, and
          the repository's idiom is already "colour arrives on a plain element"
          — `VNextShell` puts the competition palette on its own `<div>`. */}
      <div
        className={styles.page}
        data-vnext-match-state={model.state.kind}
        style={fixtureColourStyle(model.home.team, model.away.team)}
      >
        <motion.section
          className={styles.hero}
          data-vnext-zone="match-hero"
          variants={rise}
          initial="hidden"
          animate="visible"
          aria-label="The match"
        >
          {/* ONE SENTENCE FOR THE WHOLE SCOREBOARD. The visible hero is three
              columns of separate nodes, and name computation would join them
              into "Glenmore Athletic2–1Strathkelvin United" — §31's exact
              counter-example. The sentence is the model's. */}
          <p className={text.srOnly}>{model.accessibleSummary}</p>

          <div className={styles.heroBoard} aria-hidden="true">
            <HeroSide side={model.home} align="start" />

            <div className={styles.heroCentre}>
              <MatchScoreMark
                state={model.state}
                kickoffLabel={model.kickoffLabel}
                size="hero"
              />
              <MatchStateMark state={model.state} />
              {model.state.kind === 'finished' && model.state.aggregate ? (
                <p className={`${text.micro} ${styles.heroNote}`}>
                  {model.state.aggregate.label}
                </p>
              ) : null}
            </div>

            <HeroSide side={model.away} align="end" />
          </div>

          <MatchWhen model={model} />
        </motion.section>

        <motion.div
          className={styles.body}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <div className={styles.main} data-vnext-zone="match-main">
            {modules.form ? (
              <motion.section className={styles.module} variants={rise} aria-labelledby="vnext-mc-form">
                <h2 id="vnext-mc-form" className={text.label}>
                  Recent form
                </h2>
                <div className={styles.formPair}>
                  <FormSide side={model.home} />
                  <FormSide side={model.away} />
                </div>
              </motion.section>
            ) : null}

            {modules.headToHead && model.headToHead ? (
              <motion.section className={styles.module} variants={rise} aria-labelledby="vnext-mc-h2h">
                <h2 id="vnext-mc-h2h" className={text.label}>
                  This season&rsquo;s meetings
                </h2>
                {model.headToHead.meetings.length === 0 ? (
                  // A REAL ANSWER, not an absent module. "They have not met this
                  // season" is worth saying; a heading over nothing is not.
                  <p className={`${text.body} ${styles.moduleBody}`}>
                    {model.home.team.name} and {model.away.team.name} have not met yet this
                    season.
                  </p>
                ) : (
                  <>
                    <p className={`${text.body} ${styles.moduleBody}`}>
                      {model.headToHead.played} played · {model.headToHead.homeWins}{' '}
                      {model.home.team.name} · {model.headToHead.draws} drawn ·{' '}
                      {model.headToHead.awayWins} {model.away.team.name}
                    </p>
                    <ul className={styles.meetings}>
                      {model.headToHead.meetings.map((meeting) => (
                        <li key={meeting.fixtureId} className={styles.meeting}>
                          <span className={styles.meetingLabel}>{meeting.label}</span>
                          <span className={`${styles.meetingScore} ${text.numeric}`}>
                            {formatScoreline(meeting.score.home, meeting.score.away)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </motion.section>
            ) : null}

            {model.prediction ? <PredictionBlock badge={model.prediction} /> : null}

            {model.links.length > 0 ? (
              <motion.nav className={styles.links} variants={rise} aria-label="Related">
                {model.links.map((link) => (
                  <button
                    key={link.kind}
                    type="button"
                    className={styles.link}
                    onClick={() => onIntent?.({ kind: 'link', link: link.kind })}
                  >
                    {link.label}
                  </button>
                ))}
              </motion.nav>
            ) : null}
          </div>

          <div className={styles.aside} data-vnext-zone="match-context">
            {modules.table && model.table ? (
              <motion.section className={styles.module} variants={rise} aria-labelledby="vnext-mc-table">
                <h2 id="vnext-mc-table" className={text.label}>
                  In the table
                </h2>
                {/* A REAL `<table>`, WITH REAL SEMANTICS. §31 asks for it and a
                    grid of divs is exactly what a screen-reader user cannot
                    navigate. It is short by design — the rows around these two
                    clubs — because a Match Centre is not the standings page. */}
                <table className={styles.table}>
                  <caption className={text.srOnly}>
                    {model.competition.name} table around {model.home.team.name} and{' '}
                    {model.away.team.name}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.tableNarrow}>
                        <span aria-hidden="true">#</span>
                        <span className={text.srOnly}>Position</span>
                      </th>
                      <th scope="col">Club</th>
                      <th scope="col" className={styles.tableNarrow}>
                        <span aria-hidden="true">P</span>
                        <span className={text.srOnly}>Played</span>
                      </th>
                      <th scope="col" className={styles.tableNarrow}>
                        <span aria-hidden="true">GD</span>
                        <span className={text.srOnly}>Goal difference</span>
                      </th>
                      <th scope="col" className={styles.tableNarrow}>
                        <span aria-hidden="true">Pts</span>
                        <span className={text.srOnly}>Points</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.table.rows.map((row) => (
                      <tr
                        key={row.teamId}
                        className={row.isInThisMatch ? styles.tableHighlight : undefined}
                      >
                        <td className={`${styles.tableNarrow} ${text.numeric}`}>{row.position}</td>
                        <th scope="row" className={styles.tableClub}>
                          {row.teamName}
                        </th>
                        <td className={`${styles.tableNarrow} ${text.numeric}`}>{row.played}</td>
                        <td className={`${styles.tableNarrow} ${text.numeric}`}>
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </td>
                        <td className={`${styles.tableNarrow} ${text.numeric}`}>{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {model.table.provenanceLabel ? (
                  // A table of a season with matches outstanding is a real table
                  // of an incomplete season. Saying so is what stops it reading
                  // as final.
                  <p className={`${text.micro} ${styles.moduleNote}`}>
                    {model.table.provenanceLabel}
                    {model.table.provisional ? ' · still being played' : ''}
                  </p>
                ) : null}
              </motion.section>
            ) : null}

            {model.unavailable.length > 0 ? (
              <p className={`${text.micro} ${styles.moduleNote}`}>
                Not available for this match: {model.unavailable.join(', ')}.
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>
    </VNextShell>
  )
}

/** One club in the hero. Identity loud, context quiet. */
function HeroSide({
  side,
  align,
}: {
  readonly side: MatchCentreSide
  readonly align: 'start' | 'end'
}) {
  return (
    <div className={`${styles.heroSide} ${align === 'end' ? styles.heroSideEnd : ''}`}>
      <TeamCrest team={side.team} size="lg" decorative />
      <p className={`${text.title} ${styles.heroName}`}>{side.team.name}</p>
      {side.tablePosition === null ? null : (
        <p className={`${text.micro} ${styles.heroMeta}`}>
          {side.tablePosition}
          {ordinalSuffix(side.tablePosition)}
          {side.tablePoints === null ? '' : ` · ${side.tablePoints} pts`}
        </p>
      )}
    </div>
  )
}

function FormSide({ side }: { readonly side: MatchCentreSide }) {
  return (
    <div className={styles.formSide}>
      <p className={`${text.micro} ${styles.formName}`}>{side.team.name}</p>
      {side.form.length === 0 ? (
        <p className={`${text.micro} ${styles.moduleNote}`}>No settled matches yet</p>
      ) : (
        // `FormRun` carries the whole run as ONE image with a sentence label —
        // "won, drew, lost" rather than five loose letters — which is §22's
        // requirement that a form string be explained rather than spelled.
        <FormRun form={side.form} teamName={side.team.name} />
      )}
    </div>
  )
}

/**
 * WHEN AND WHERE, AND ONLY WHAT IS TRUE.
 *
 * The venue, the referee and the broadcast are absent from every read on this
 * platform, so this block carries the kickoff, the stage and — for a live or
 * recently-observed match — WHEN THE PROVIDER LAST REPORTED. That last one is
 * the freshness contract: the instant comes from the server's own observation
 * record, never from when this component rendered, and it is FORMATTED BY THE
 * MAPPER in the viewer's own zone so this page cannot show a kickoff on one
 * clock and an observation on another.
 */
function MatchWhen({ model }: { readonly model: MatchCentreModel }) {
  const observation =
    model.state.kind === 'live' || model.state.kind === 'awaitingResult'
      ? model.state.observation
      : null

  const note =
    model.state.kind === 'postponed' ||
    model.state.kind === 'abandoned' ||
    model.state.kind === 'void'
      ? model.state.note
      : null

  /**
   * A FIXTURE THAT WILL NOT BE PLAYED STILL HAS A SLOT, AND IT IS SAID AS ONE.
   *
   * "Saturday 21 August · 15:00" beside "Postponed" reads as a kick-off that is
   * still going to happen. "Was due Saturday 21 August, 15:00" says the same
   * fact and cannot be misread — and the fact is worth keeping, because the
   * original slot is how a reader recognises which fixture this is.
   *
   * CONTRACT 206 QUALIFIES IT: a postponed fixture that has been given a new
   * date is showing that date, and "Was due Tue 18 August, 19:45" about an
   * evening still to come is simply false. The mark beside it already says the
   * match is off and when it is now due, so the line reverts to plain.
   */
  const off =
    (model.state.kind === 'postponed' && !model.state.rescheduled) ||
    model.state.kind === 'abandoned' ||
    model.state.kind === 'void'

  const when = [model.dayLabel, model.kickoffLabel].filter(Boolean).join(', ')

  return (
    <div className={styles.when}>
      <p className={`${text.micro} ${styles.whenLine}`}>
        {off
          ? [when ? `Was due ${when}` : null, model.stage.label].filter(Boolean).join(' · ')
          : [model.dayLabel, model.kickoffLabel, model.stage.label].filter(Boolean).join(' · ')}
      </p>
      {/* IT SAYS WHAT THE PROVIDER ACTUALLY SENT.
          A provider reporting a match in play before a goal has a state and no
          numbers — real information, and `score: null` is how the read carries
          it. Announcing "provisional score observed at 15:41" there would claim
          a score that does not exist, directly under a hero that is printing
          the KICKOFF TIME because there is nothing else to print. Two different
          sentences, because they are two different facts. */}
      {observation ? (
        <p className={`${text.micro} ${styles.whenLine}`}>
          {observation.score === null
            ? 'No score reported yet'
            : 'Provisional score'}
          {observation.observedAtLabel === null
            ? null
            : ` · provider last reported at ${observation.observedAtLabel}`}
        </p>
      ) : null}
      {note ? <p className={`${text.micro} ${styles.whenNote}`}>{note}</p> : null}
    </div>
  )
}

/**
 * THE PLAYER'S OWN SIDE OF THE MATCH — a status, and a way to the game.
 *
 * IT IS BELOW THE FOOTBALL AND NEVER ABOVE IT. §15's line, and the composition
 * enforces it by position: a Match Centre that opened with a prediction form
 * would be a Match Predictor with a scoreboard on top.
 */
function PredictionBlock({ badge }: { readonly badge: MatchPredictionBadge }) {
  const body =
    badge.kind === 'needed'
      ? 'You have not predicted this match yet.'
      : badge.kind === 'settled'
        ? `You predicted ${formatScoreline(badge.score.home, badge.score.away)} — ${
            badge.outcomeLabel
          }${badge.points === null ? '' : `, ${badge.points} points`}.`
        : `You predicted ${formatScoreline(badge.score.home, badge.score.away)}${
            badge.kind === 'locked' ? ', and it is locked in' : ''
          }.`

  return (
    <section className={styles.module} aria-labelledby="vnext-mc-you">
      <h2 id="vnext-mc-you" className={text.label}>
        Your prediction
      </h2>
      <p className={`${text.body} ${styles.moduleBody}`}>{body}</p>
    </section>
  )
}

function ordinalSuffix(value: number): string {
  const lastTwo = Math.abs(value) % 100
  if (lastTwo >= 11 && lastTwo <= 13) return 'th'
  switch (Math.abs(value) % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

