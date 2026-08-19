import type { LmsFixtureChoice, LmsPickAction, LmsTeamOption } from '../models/lms'
import { formatTime } from '../foundations/format'
import text from '../foundations/typography.module.css'
import styles from './lms.module.css'

/**
 * THE ROUND'S CLUBS, AND THE ONE PLACE A PICK CAN BE STARTED.
 *
 * ============================ A CLUB IS PRESSABLE IFF IT CARRIES AN ID ===
 *
 * The whole rule, in one line: `action.kind === 'pick'` — which is also the
 * only case that HAS a team id to submit. Not "is it used", not "is the round
 * open", not any test this component could get subtly wrong. Everything else
 * renders as text.
 *
 * That is Stage 9's `LeaguePlayerCell` discipline in a game where the stakes
 * are higher: there, a wrong answer opened a stranger's profile; here it would
 * spend a club the player cannot afford to lose.
 *
 * ============================ A SPENT CLUB IS TEXT, NOT A DEAD BUTTON ====
 *
 * It still appears — a player needs to see which clubs are gone and which
 * fixture they were in — but as a marked name rather than a control that
 * refuses. A disabled button advertises something the player cannot have and
 * invites the press anyway; the mark states a fact.
 *
 * The one exception is the club they HOLD, which is marked rather than
 * pressable because re-picking it changes nothing.
 *
 * ============================ ONE PICK, AND IT LOOKS LIKE ONE ============
 *
 * Match Predictor asks for a score on every fixture; this asks for one club out
 * of the whole round. So the fixtures are a LIST OF CHOICES rather than a list
 * of inputs, there is no scoreline anywhere, and the two clubs of a fixture sit
 * either side of a "v" so the unit a player is choosing from reads as a match.
 */

export type LmsPickListProps = {
  readonly choices: readonly LmsFixtureChoice[]
  /**
   * Submit one club. Receives the id from the option's OWN action, so a caller
   * cannot pass an id for a club the model did not mark pickable.
   */
  readonly onPick?: ((teamId: string) => void) | undefined
  /** A write is in flight; every control waits rather than queueing a second. */
  readonly busy?: boolean | undefined
}

export function LmsPickList({ choices, onPick, busy = false }: LmsPickListProps) {
  if (choices.length === 0) {
    return (
      <p className={`${text.body} ${styles.empty}`}>
        This round has no fixtures to pick from yet.
      </p>
    )
  }

  return (
    <ul className={styles.fixtures} data-vnext-zone="pick-list">
      {choices.map((choice) => (
        <li key={choice.key} className={styles.fixture}>
          <p className={`${text.micro} ${styles.kickoff}`}>
            {/* THE INSTANT, FORMATTED — never a countdown, and never compared
                to a clock to decide anything. The round's own state says
                whether a pick is possible. */}
            {choice.kickoffAt === null ? 'Kick-off to be confirmed' : formatTime(choice.kickoffAt)}
          </p>
          <div className={styles.pair}>
            <Option option={choice.home} onPick={onPick} busy={busy} />
            <span className={`${text.micro} ${styles.versus}`} aria-hidden="true">
              v
            </span>
            <Option option={choice.away} onPick={onPick} busy={busy} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Option({
  option,
  onPick,
  busy,
}: {
  readonly option: LmsTeamOption
  readonly onPick?: ((teamId: string) => void) | undefined
  readonly busy: boolean
}) {
  const action = option.action

  if (action.kind === 'pick' && onPick) {
    const teamId = action.teamId
    return (
      <button
        type="button"
        className={`${text.body} ${styles.club} ${styles.pickable}`}
        onClick={() => onPick(teamId)}
        disabled={busy}
      >
        {option.name}
      </button>
    )
  }

  return (
    <span className={`${text.body} ${styles.club}`} data-state={action.kind}>
      {option.name}
      <Mark action={action} />
    </span>
  )
}

/**
 * WHY THIS CLUB IS NOT A CONTROL, IN WORDS.
 *
 * Every state gets a visible mark and not merely a colour — §31's rule, and it
 * matters more here than on a standings table, because the difference between
 * "spent" and "the round is shut" changes what a player does next.
 *
 * `unavailable` says nothing per club: the reason belongs to the ROUND and the
 * page states it once, above. Repeating it on twenty clubs would be twenty
 * copies of one sentence.
 */
function Mark({ action }: { readonly action: LmsPickAction }) {
  if (action.kind === 'chosen') {
    return <span className={styles.chosenMark}>Your pick</span>
  }
  if (action.kind === 'used') {
    return <span className={styles.usedMark}>Used</span>
  }
  // `pick` WITHOUT A HANDLER IS A READ-ONLY RENDER, not a shut club. It happens
  // wherever the page is shown without `onPick` — a preview, a snapshot — and
  // without a mark it looked identical to a locked one, which is the opposite
  // of what it means.
  if (action.kind === 'pick') {
    return <span className={styles.availableMark}>Available</span>
  }
  return null
}
