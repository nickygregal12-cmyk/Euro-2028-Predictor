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

            {/* YOU, YOUR LEAGUES, EVERYONE — in that order, and never merged.
                `SeasonFixtureLeagues` records why in terms: the reader's own
                prediction, then named private co-members, then the anonymous
                platform-wide cohort. Named league predictions are not a
                consensus and a consensus is not a league, and the ordering is
                the one a reader came for — themselves, then the people they
                actually play with, then everybody. */}
            <YouModule you={model.you} rise={rise} />
            <LeaguesModule leagues={model.leagues} rise={rise} />
            <EveryoneModule everyone={model.everyone} rise={rise} />

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
   */
  const off =
    model.state.kind === 'postponed' ||
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


/* ==========================================================================
   THE THREE SOCIAL SCOPES
   ==========================================================================

   EACH DRAWS ITS OWN ANSWER AND NOTHING ELSE'S. `null` is the host not having
   loaded the module and draws nothing at all; every other case is an answer and
   is said out loud, because on this page silence is indistinguishable from
   "there is nothing".

   NOT ONE OF THEM DECIDES ANYTHING. No points are computed, no reveal is
   inferred from a clock, no cohort is measured. The model carries the
   authorities' answers and these render them.
   ========================================================================== */

function YouModule({
  you,
  rise,
}: {
  readonly you: MatchCentreModel['you']
  readonly rise: ReturnType<typeof useVNextMotion>
}) {
  if (you === null) return null

  return (
    <motion.section
      className={styles.module}
      variants={rise}
      aria-labelledby="vnext-mc-you"
      data-vnext-zone="you"
    >
      <h2 id="vnext-mc-you" className={text.label}>
        You
      </h2>
      {you.kind === 'not-playing' ? (
        // NOT AN ERROR AND NOT AN EMPTY PREDICTION. Telling somebody who never
        // joined that they have no prediction reads as a missed deadline.
        <p className={`${text.body} ${styles.moduleBody}`}>
          You are not playing the Match Predictor in this competition, so this fixture has
          no entry of yours behind it.
        </p>
      ) : you.kind === 'unavailable' ? (
        <p className={`${text.body} ${styles.moduleBody}`}>
          We could not read your entry for this matchweek just now. The fixture and its
          result above are unaffected.
        </p>
      ) : (
        <>
          <p className={`${text.body} ${styles.moduleBody} ${text.numeric}`}>
            {you.prediction === null
              ? 'You left this fixture blank.'
              : `Your prediction: ${you.prediction}`}
          </p>
          {/* THE PROVISIONAL SCORE IS LABELLED AS ONE, ALWAYS. It is a
              provider's current reading and never a settled result, and the
              product's whole live-data honesty rule is that the two are never
              printed as the same thing. */}
          {you.provisional ? (
            <p className={`${text.micro} ${styles.moduleBody}`} data-vnext-zone="provisional">
              Provisional score {you.provisional.score} — not yet the official result.
            </p>
          ) : null}
          <p className={`${text.body} ${styles.moduleBody}`}>{you.explanation}</p>
          {you.jokerNote ? (
            <p className={`${text.micro} ${styles.moduleBody}`} data-vnext-zone="joker">
              {you.jokerNote}
            </p>
          ) : null}
        </>
      )}
    </motion.section>
  )
}

function LeaguesModule({
  leagues,
  rise,
}: {
  readonly leagues: MatchCentreModel['leagues']
  readonly rise: ReturnType<typeof useVNextMotion>
}) {
  if (leagues === null || leagues.length === 0) return null

  return (
    <motion.section
      className={styles.module}
      variants={rise}
      aria-labelledby="vnext-mc-leagues"
      data-vnext-zone="your-leagues"
    >
      <h2 id="vnext-mc-leagues" className={text.label}>
        Your leagues
      </h2>
      {leagues.map((league) => (
        <div key={league.leagueId} className={styles.leagueBlock} data-vnext-league={league.leagueId}>
          <p className={`${text.body} ${styles.leagueName}`}>{league.leagueName ?? 'Your league'}</p>
          {league.kind === 'unavailable' ? (
            // A LEAGUE THAT DID NOT ANSWER NAMES ITSELF, so a failed read is
            // never mistaken for a league nobody predicted in.
            <p className={`${text.micro} ${styles.moduleBody}`}>
              We could not read this league just now.
            </p>
          ) : league.kind === 'hidden' ? (
            // THE SERVER'S OWN `revealed`, and no count. Contract 149 withholds
            // how many members have played before the lock, and printing a
            // number here would leak exactly what it withheld.
            <p className={`${text.micro} ${styles.moduleBody}`}>
              Predictions in this league are hidden until the matchweek locks.
            </p>
          ) : league.kind === 'empty' ? (
            <p className={`${text.micro} ${styles.moduleBody}`}>
              Nobody in this league predicted this fixture.
            </p>
          ) : (
            <ul className={styles.leagueRows}>
              {league.rows.map((row) => (
                <li key={row.playerRef} className={styles.leagueRow}>
                  <span className={styles.leagueMember}>
                    {row.displayName}
                    {row.isSelf ? <span className={text.micro}> (you)</span> : null}
                  </span>
                  <span className={`${styles.leagueScore} ${text.numeric}`}>
                    {row.predictionLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </motion.section>
  )
}

function EveryoneModule({
  everyone,
  rise,
}: {
  readonly everyone: MatchCentreModel['everyone']
  readonly rise: ReturnType<typeof useVNextMotion>
}) {
  if (everyone === null) return null

  return (
    <motion.section
      className={styles.module}
      variants={rise}
      aria-labelledby="vnext-mc-everyone"
      data-vnext-zone="everyone"
    >
      <h2 id="vnext-mc-everyone" className={text.label}>
        Everyone
      </h2>
      {everyone.kind === 'unavailable' ? (
        <p className={`${text.body} ${styles.moduleBody}`}>
          We could not read what everybody predicted just now.
        </p>
      ) : everyone.kind === 'withheld' ? (
        // THE SERVER'S MINIMUM COHORT. Said as a rule rather than as a count,
        // because the count is the thing being protected.
        <p className={`${text.body} ${styles.moduleBody}`}>
          Not enough people have predicted this matchweek yet for an anonymous summary.
        </p>
      ) : everyone.kind === 'empty' ? (
        <p className={`${text.body} ${styles.moduleBody}`}>
          Nobody has predicted this fixture yet.
        </p>
      ) : (
        <>
          <p className={`${text.body} ${styles.moduleBody} ${text.numeric}`}>
            {everyone.homeWinPercentage}% home · {everyone.drawPercentage}% draw ·{' '}
            {everyone.awayWinPercentage}% away
          </p>
          {everyone.popular.length > 0 ? (
            <ul className={styles.leagueRows}>
              {everyone.popular.map((entry) => (
                <li key={entry.label} className={styles.leagueRow}>
                  <span className={`${styles.leagueScore} ${text.numeric}`}>{entry.label}</span>
                  <span className={`${text.micro} ${text.numeric}`}>{entry.percentage}%</span>
                </li>
              ))}
            </ul>
          ) : null}
          {/* THE DENOMINATOR, STATED. A percentage with no cohort behind it is
              a number a reader cannot weigh — the same rule the player
              profile's head-to-head follows about its own window. */}
          <p className={`${text.micro} ${styles.moduleBody} ${text.numeric}`}>
            From {everyone.submittedEntries} predictions for this fixture.
          </p>
        </>
      )}
    </motion.section>
  )
}
