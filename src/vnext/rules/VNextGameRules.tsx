import { useId, useState } from 'react'
import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  SEASON_PREDICTOR_POINTS,
} from '../../domain/season/scoring'
import { CUP_TIE_MATCH_POINTS } from '../../domain/season/cupTieSettlement'
import text from '../foundations/typography.module.css'
import styles from './rules.module.css'

/**
 * HOW THE GAMES SCORE — one game at a time.
 *
 * ============================ WHY IT TOGGLES INSTEAD OF LISTING =========
 *
 * The production page stacks all three games' rules down one column, and the
 * result is a wall a player has to read past to reach the game they actually
 * play. Scoring is the one explanation somebody opens with a specific question
 * — "what do I get for the right result?" — and an answer they have to hunt
 * for is an answer they take on trust instead.
 *
 * So the games are a SEGMENTED CONTROL and only one set of rules is on screen.
 * The comparison is still possible — it is one press, not a scroll — and the
 * default is the game the caller is already in, so the common case needs no
 * press at all.
 *
 * IT IS A RADIO GROUP, not a custom tablist. Radios give arrow-key movement,
 * grouping and the selected state to a screen reader for free; a hand-rolled
 * `tablist` gives the same behaviour only if every key handler is right.
 *
 * ============================ WHY IT IS A COMPONENT AND NOT A PAGE ======
 *
 * The route matrix ABSORBS `/more/scoring`: "Rules belong beside the game they
 * govern", "reached from a game, not from a directory". So this is a block a
 * game surface places, carrying no shell, no header and no route.
 *
 * ============================ EVERY NUMBER IS THE DOMAIN'S ==============
 *
 * `SEASON_PREDICTOR_POINTS`, `SEASON_JOKERS_PER_SEASON` and
 * `SEASON_JOKERS_PER_HALF` are imported and printed. NOT ONE IS RETYPED, and
 * `src/domain/season/scoring.ts` says why in its own words: the direction
 * "explicitly forbids recreating the rules in presentation code to explain
 * them". A surface with its own `5` beside the authority's still says 5 the day
 * the rule changes.
 *
 * ============================ IT EXPLAINS ONLY WHAT IT KNOWS ============
 *
 * The Match Predictor's scoring and the Championship's table points are domain
 * constants and are stated exactly. Last Man Standing's lives, saves and draws
 * rule are the ORGANISER'S stored settings; where a caller holds those it
 * passes them in, and where it does not, the block says where they are stated
 * rather than printing a default that would be wrong for most competitions.
 *
 * The Championship's SHAPE is the same kind of fact and gets the same
 * treatment. Whether a season ends in a knockout depends on how its rounds
 * divide the calendar — contract 198 exists to compute it, and over 38
 * matchweeks eighteen entrants reach one and nineteen do not — so this block
 * describes both phases as things that may happen and states neither as this
 * competition's plan. The Championship page reads the real answer.
 */

export type RulesGame = 'match-predictor' | 'last-man-standing' | 'championship'

export type VNextGameRulesProps = {
  /**
   * Which game to open on — normally the one the player is already in, so the
   * common question needs no press.
   */
  readonly game?: RulesGame | undefined
  /** Last Man Standing's per-competition settings, where the caller holds them. */
  readonly lmsRules?: {
    readonly lives: number
    readonly saves: number
    readonly drawsRule: string | null
  } | null
}

const GAMES: readonly { readonly id: RulesGame; readonly label: string }[] = [
  { id: 'match-predictor', label: 'Match Predictor' },
  { id: 'last-man-standing', label: 'Last Man Standing' },
  { id: 'championship', label: 'Championship' },
]

export function VNextGameRules({
  game = 'match-predictor',
  lmsRules = null,
}: VNextGameRulesProps) {
  const [shown, setShown] = useState<RulesGame>(game)
  const groupName = useId()

  return (
    <section className={styles.rules} data-vnext-zone="rules" data-game={shown}>
      <h2 className={`${text.micro} ${styles.heading}`}>How it scores</h2>

      {/* A RADIO GROUP, NOT A ROW OF BUTTONS. See the header: this is what gives
          arrow-key movement and a spoken selected state without a key handler
          of this lane's own. */}
      <fieldset className={styles.switcher}>
        <legend className={text.srOnly}>Which game</legend>
        {GAMES.map((entry) => (
          <label key={entry.id} className={styles.choice} data-selected={shown === entry.id}>
            <input
              type="radio"
              name={groupName}
              value={entry.id}
              checked={shown === entry.id}
              onChange={() => setShown(entry.id)}
              className={text.srOnly}
            />
            <span>{entry.label}</span>
          </label>
        ))}
      </fieldset>

      {/* ONE GAME ON SCREEN. `aria-live` is deliberately absent: the change was
          asked for by the person reading, so announcing it interrupts them with
          something they already know. */}
      <div className={styles.panel} data-vnext-zone="rules-panel">
        {shown === 'match-predictor' ? <MatchPredictorRules /> : null}
        {shown === 'last-man-standing' ? <LastManStandingRules rules={lmsRules} /> : null}
        {shown === 'championship' ? <ChampionshipRules /> : null}
      </div>
    </section>
  )
}

function Rule({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    // NAMED IN THE MARKUP so a test can ask whether a rule was STATED rather
    // than whether its word appears — "lives" occurs in the sentence that says
    // where lives are set, which is the opposite of stating one.
    <div className={styles.row} data-vnext-rule={label}>
      <span className={`${text.body} ${styles.label}`}>{label}</span>
      <span className={`${text.body} ${styles.value}`}>{value}</span>
    </div>
  )
}

function MatchPredictorRules() {
  return (
    <>
      <p className={`${text.body} ${styles.lead}`}>
        Predict every scoreline. Each fixture scores on its own.
      </p>
      {/* PRINTED FROM THE AUTHORITY. Neither number is written here. */}
      <Rule label="Exact score" value={`+${SEASON_PREDICTOR_POINTS.exactScore}`} />
      <Rule label="Right result, wrong score" value={`+${SEASON_PREDICTOR_POINTS.correctResult}`} />
      <Rule label="Anything else" value="0" />
      <p className={`${text.micro} ${styles.note}`}>
        {/* THE JOKER DOUBLES THE WHOLE MATCHWEEK, which is where the rule applies
            it. "Doubles your points" per fixture would teach a rule the
            authority does not implement. */}
        A Joker doubles a whole matchweek, not one fixture. You get{' '}
        {SEASON_JOKERS_PER_SEASON} a season, and no more than{' '}
        {SEASON_JOKERS_PER_HALF} in either half.
      </p>
    </>
  )
}

function LastManStandingRules({
  rules,
}: {
  readonly rules: NonNullable<VNextGameRulesProps['lmsRules']> | null
}) {
  return (
    <>
      <p className={`${text.body} ${styles.lead}`}>
        Pick one club a round to win. Use a club once and it is spent for the
        cycle.
      </p>
      {rules === null ? (
        // NOT A DEFAULT. Lives, saves and the draws rule are the organiser's
        // stored settings, and a number printed here without them would be
        // wrong for most competitions.
        <p className={`${text.micro} ${styles.note}`} data-vnext-zone="rules-elsewhere">
          Lives, saves and how draws are treated are set by whoever runs the
          competition, and are shown on its own page.
        </p>
      ) : (
        <>
          <Rule label="Lives" value={String(rules.lives)} />
          <Rule label="Saves" value={String(rules.saves)} />
          {rules.drawsRule === null ? null : (
            // THE ORGANISER'S OWN WORDING, stated and never applied to an
            // outcome by this lane.
            <p className={`${text.micro} ${styles.note}`}>{rules.drawsRule}</p>
          )}
        </>
      )}
    </>
  )
}

function ChampionshipRules() {
  return (
    <>
      <p className={`${text.body} ${styles.lead}`}>
        Play a head-to-head tie every matchweek against one other entrant. The
        Match Predictor points you were scoring anyway decide it — there is
        nothing extra to enter.
      </p>

      {/* PRINTED FROM THE AUTHORITY. `CUP_TIE_MATCH_POINTS` is what
          `cupTieSettlement.ts` awards and what `cupGroupTable.ts` totals; not
          one of these three numbers is written here. */}
      <Rule label="Win a tie" value={`+${CUP_TIE_MATCH_POINTS.win}`} />
      <Rule label="Draw a tie" value={`+${CUP_TIE_MATCH_POINTS.draw}`} />
      <Rule label="Lose a tie" value={`+${CUP_TIE_MATCH_POINTS.loss}`} />

      {/* THE NON-OBVIOUS RULE, AND THE ONE WORTH THE SPACE. A player who has
          just spent a Joker will otherwise expect it to count here. The
          authority is explicit: "Jokers never apply to Cup scoring, so this
          module rejects any fixture points outside the raw scale rather than
          trusting the caller not to have doubled them." */}
      <p className={`${text.micro} ${styles.note}`}>
        A tie is scored on the raw {SEASON_PREDICTOR_POINTS.exactScore} and{' '}
        {SEASON_PREDICTOR_POINTS.correctResult} from each fixture. A Joker
        doubles your matchweek in the Match Predictor and never your tie.
      </p>

      {/* THE THREE DECIDERS, IN THE SETTLEMENT AUTHORITY'S OWN ORDER AND ITS
          OWN WORDS. `TieDecision` is that vocabulary and the Championship page
          prints the same three phrases on a settled tie — so a reader who saw
          "Decided in extra time" there can find out here what it meant. A
          fourth invented step, or a different order, would be this block
          becoming a second settlement rule. */}
      <p className={`${text.body} ${styles.lead}`}>If a knockout tie is level</p>
      <ol className={styles.steps}>
        <li className={text.micro}>
          <strong>Extra time.</strong> Whoever was closer on the scorelines
          themselves goes through.
        </li>
        <li className={text.micro}>
          <strong>The Penalty Number.</strong> Both of you seal a number before
          the round kicks off. Whoever is closest to the total goals scored
          across the round's matches goes through. One of you picks odd and the
          other even, so you can never be equally close.
        </li>
        <li className={text.micro}>
          <strong>A walkover.</strong> Where one of you submitted nothing at
          all, the other goes through.
        </li>
      </ol>

      {/* PROGRESSION, AS THE TABLE AUTHORITY STATES IT. "Points carry through —
          that is what makes the split a continuation of the same competition
          rather than a sorting operation, and why finishing sixth rather than
          seventh matters. Nobody is eliminated." */}
      <p className={`${text.micro} ${styles.note}`}>
        The table runs through the season. Partway through, the field splits
        into two halves and you carry your record with you — nobody is knocked
        out by the split, and where you finish beforehand decides which half you
        are in. Some competitions then end in a knockout; the Championship page
        says whether yours has one.
      </p>
    </>
  )
}
