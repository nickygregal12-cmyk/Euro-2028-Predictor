import { motion } from 'framer-motion'
import type {
  LmsClubResult,
  LmsFieldPanel,
  LmsPageModel,
  LmsRound,
  LmsRules,
  LmsStanding,
} from '../models/lms'
import { lmsChampion, lmsPickableCount, lmsRoundIsOpen } from '../models/lms'
import { VNextTrophyIcon } from '../foundations/VNextIcon'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatKickoffLabel, formatNumber } from '../foundations/format'
import { LmsPickList } from './LmsPickList'
import text from '../foundations/typography.module.css'
import styles from './lms.module.css'

/**
 * vNEXT LAST MAN STANDING — ONE CONSEQUENTIAL PICK.
 *
 * ============================ IT IS NOT MATCH PREDICTOR, AND IT MUST NOT
 * LOOK LIKE IT =============================================================
 *
 * The Stage 11 predicate asks for the survival model to be "visually and
 * interactionally distinct", and the distinction is structural rather than
 * decorative:
 *
 *   • Match Predictor takes a SCORE on EVERY fixture. This page has no numeric
 *     input at all and no scoreline anywhere — a fixture appears only as the
 *     two clubs it offers;
 *   • Match Predictor rewards accuracy incrementally. This spends a club
 *     forever and can end the season, so the used list is permanent furniture
 *     rather than a detail;
 *   • Match Predictor's page is a form. This one is a CHOICE — one press, and
 *     the page's own heading is the player's standing rather than a total.
 *
 * ============================ THE STANDING IS THE HEADLINE, AND IT IS THE
 * SETTLEMENT JOB'S ========================================================
 *
 * "You are still in" is the only thing a player actually wants to know, so it
 * is the first thing on the page. It comes from `standing` and NOTHING ELSE —
 * never from what the picked club did. A club can win while its owner is out.
 *
 * ============================ THE DEADLINE IS SAID, NOT COUNTED ==========
 *
 * `locksAt` is printed as an instant. There is no countdown, because a
 * countdown is a clock the browser owns and this page does not own the
 * deadline — and no component here compares it to anything.
 */

export type LmsIntent = { readonly kind: 'pick'; readonly teamId: string }

export type VNextLmsProps = {
  readonly model: LmsPageModel
  readonly onIntent?: ((intent: LmsIntent) => void) | undefined
  /** Ask the host to read again. Offered beside a read that did not answer. */
  readonly onRetry?: (() => void) | undefined
  /** A write is in flight. Controls wait rather than queueing a second pick. */
  readonly busy?: boolean | undefined
  /** What the last submitted pick did, where it did not simply land. */
  readonly notice?: LmsNotice | undefined
}

/**
 * WHAT THE LAST SUBMITTED PICK DID, WHERE IT DID NOT LAND.
 *
 * `refused` CARRIES ITS SENTENCE rather than selecting one here, because the
 * sentence belongs to the write contract and not to this component.
 * `lmsRefusal` is the repository's map from `save_lms_selection`'s codes to
 * copy, and it distinguishes five rules a player can meet. Choosing the words
 * here would be a second authority over the same RPC.
 */
export type LmsNotice =
  | { readonly kind: 'conflict' }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'failed' }

export function VNextLms({ model, onIntent, onRetry, busy = false, notice }: VNextLmsProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context } = model

  return (
    <VNextShell
      destination="games"
      header={
        <VNextPageHeader
          title="Last Man Standing"
          competition={
            context.seasonLabel
              ? `${context.competitionName} · ${context.seasonLabel}`
              : context.competitionName
          }
          context={context.gameName}
        />
      }
    >
      <div className={styles.page}>
        <StandingBanner standing={model.standing} />

        <Field panel={model.field} hasRound={model.body.kind === 'round'} />

        {notice === undefined ? null : <PickNotice notice={notice} />}

        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Body
            model={model}
            onIntent={onIntent}
            onRetry={onRetry}
            busy={busy}
          />
        </motion.div>

        {model.usedClubNamesInRound.length === 0 ? null : (
          <section className={styles.used} data-vnext-zone="used">
            <h2 className={`${text.micro} ${styles.usedHeading}`}>
              Clubs in this round you have already used
            </h2>
            {/* PERMANENT FURNITURE, NOT A DETAIL. What a player has spent is
                half the game, and it is the thing they forget between rounds.

                THE HEADING STATES ITS BOUND. The model can only name used clubs
                that are PLAYING this round — contract 116 gives the full cycle
                list as ids and club names only for this round's fixtures — so
                "Clubs you have already used" would be a completeness claim the
                read cannot support. See `usedClubNamesInRound`. */}
            <p className={`${text.body} ${styles.usedList}`}>
              {model.usedClubNamesInRound.join(' · ')}
            </p>
          </section>
        )}
      </div>
    </VNextShell>
  )
}

/**
 * WHERE THE PLAYER STANDS, IN ONE SENTENCE, AT THE TOP.
 *
 * The words are per standing and there is no default: an unrecognised value
 * would be a contract this build does not know, and saying "you are still in"
 * to somebody who is out is the worst sentence this page could produce.
 */
const STANDING_COPY: Record<LmsStanding, string> = {
  active: 'You are still in.',
  qualified: 'You are still in.',
  survived: 'You survived the last round.',
  eliminated: 'You have been eliminated.',
  champion: 'You are the last one standing.',
}

function StandingBanner({ standing }: { readonly standing: LmsStanding | null }) {
  if (standing === null) return null

  return (
    <p
      className={`${text.title} ${styles.standing}`}
      data-vnext-zone="standing"
      data-standing={standing}
    >
      {/* A WORD, NOT A COLOUR. §31, and it is the whole page's headline. */}
      {STANDING_COPY[standing]}
      {lmsChampion(standing) ? <VNextTrophyIcon className={styles.trophy} /> : null}
    </p>
  )
}

/* ==========================================================================
   THE FIELD — how many are left, and the rules they are left under
   ========================================================================== */

/**
 * THE POOL, AND IT IS THE ATMOSPHERE OF THE ROUND.
 *
 * "83 still in" is what makes a survival game feel like one, and it is the fact
 * Match Predictor has no equivalent of: a score-entry form has no shrinking
 * field. It sits under the standing because the order of the page is who you
 * are, then who is left, then what you must do.
 *
 * THREE FIGURES, THREE SENTENCES, NO ARITHMETIC. Contract 164 counts
 * `remaining` and `eliminated` from `outcome` and a NULL outcome is in neither,
 * so `entrants` need not equal their sum. Each is printed as the server stated
 * it and none is computed from the others — which is also why they are not
 * phrased as "83 of 120", a form that reads as a fraction of a whole and would
 * be quietly wrong.
 */
function Field({
  panel,
  hasRound,
}: {
  readonly panel: LmsFieldPanel
  readonly hasRound: boolean
}) {
  if (panel.kind === 'not-counted') {
    // The BODY already says why there is nothing to count — not offered, or not
    // entered. Saying it again here in different words would be a second
    // sentence about one fact.
    return null
  }

  if (panel.kind === 'unavailable') {
    /* NO RETRY BUTTON. The pool is context; the round is the thing a player
     * came for, and it is still on screen. A second retry control beside a
     * working page would invite a re-read of everything to fix an aside. */
    return (
      <p className={`${text.micro} ${styles.fieldMissing}`} role="status">
        We could not load how many players are left.
      </p>
    )
  }

  const { counts } = panel

  return (
    <section className={styles.field} data-vnext-zone="field">
      <p className={`${text.body} ${styles.fieldCounts}`}>
        <span className={styles.fieldRemaining}>
          {formatNumber(counts.remaining)} still in
        </span>
        <span aria-hidden="true" className={styles.fieldSeparator}>
          ·
        </span>
        <span>{formatNumber(counts.eliminated)} out</span>
        <span aria-hidden="true" className={styles.fieldSeparator}>
          ·
        </span>
        <span>{formatNumber(counts.entrants)} entered</span>
      </p>

      {/* THE WITHHELD-COUNT SENTENCE NEEDS A ROUND TO BE WITHHELD BY. "Stays
          hidden until picks close" is nonsense between rounds and to a
          champion, where there are no picks to close. */}
      {hasRound ? <Picked picked={counts.picked} /> : null}
      {panel.rules === null ? null : <Rules rules={panel.rules} />}
    </section>
  )
}

/**
 * HOW MANY RIVALS HAVE COMMITTED — AND THE FACT THAT IT IS WITHHELD.
 *
 * NULL IS A SENTENCE, NOT A BLANK. Contract 164 hides this figure until the
 * round locks, because knowing how many have already picked is live strategic
 * information when the clubs are a depleting resource. Rendering `picked ?? 0`
 * would print "0 have picked" to every player before the lock — a confident
 * claim about rivals the server deliberately refused to make.
 *
 * So the withholding is SAID. A player who can see the number after the lock
 * and nothing before it should be told which of those two they are looking at.
 */
function Picked({ picked }: { readonly picked: number | null }) {
  if (picked === null) {
    return (
      <p className={`${text.micro} ${styles.fieldPicked}`}>
        How many players have picked stays hidden until picks close.
      </p>
    )
  }

  return (
    <p className={`${text.micro} ${styles.fieldPicked}`}>
      {picked === 1
        ? '1 player picked in this round'
        : `${formatNumber(picked)} players picked in this round`}
    </p>
  )
}

/**
 * THE ORGANISER'S RULES, STATED AND NEVER RUN.
 *
 * `lmsRoundModel.ts` refuses to say whether a draw eliminates because it is "a
 * stored rule this surface cannot see". Contract 164 lets this page SEE it, and
 * that permission extends exactly as far as printing it. Nothing here reads
 * `drawsRule` beside a drawn pick to produce a verdict — that is the settlement
 * job's, and a browser running the rule would be wrong in precisely the seasons
 * configured differently from its guess.
 *
 * ABSENT RULES RENDER NOTHING AT ALL, one level up: an organiser who wrote no
 * setup has not chosen "0 lives", and printing zeroes would describe a harsher
 * game than the real one.
 */
function Rules({ rules }: { readonly rules: LmsRules }) {
  return (
    <p className={`${text.micro} ${styles.fieldRules}`} data-vnext-zone="rules">
      {rules.lives === 1 ? '1 life' : `${formatNumber(rules.lives)} lives`}
      {' · '}
      {rules.saves === 0
        ? 'no saves'
        : rules.saves === 1
          ? '1 save'
          : `${formatNumber(rules.saves)} saves`}
      {rules.drawsRule === null ? null : ` · ${rules.drawsRule}`}
    </p>
  )
}

/**
 * WHAT THE LAST SUBMITTED PICK DID, WHERE IT DID NOT LAND.
 *
 * Three different sentences, because they are three different situations and
 * only one of them is answered by pressing again. A conflict and a refusal have
 * already triggered a re-read, so the page beneath this notice is the fresh
 * one — which is why neither offers a button.
 */
function PickNotice({ notice }: { readonly notice: LmsNotice }) {
  const copy =
    notice.kind === 'conflict'
      ? 'Your pick was changed somewhere else, so we have reloaded this round. Check it still says what you want.'
      : notice.kind === 'refused'
        ? // THE SERVER'S OWN RULE, IN THE REPOSITORY'S OWN WORDS. Not a generic
          // "that was refused": "you have already used that club" and "you have
          // been eliminated" send a player to different places, and the whole
          // reason `lmsRefusal` exists is that flattening them is worse than
          // useless. The page adds only that it has reloaded.
          `${notice.reason} This round has been reloaded.`
        : // NOTE WHAT THIS MAY SAY, AND ONLY THIS. "Nothing has changed" is a
          // claim about the server, and it is only safe for a FAULT — a write
          // that never landed. It was once shown for refusals too, where both
          // halves were false and the invited retry could never succeed.
          'We could not save that pick. Nothing has changed, so you can try again.'

  return (
    <p className={`${text.body} ${styles.notice}`} role="status" data-notice={notice.kind}>
      {copy}
    </p>
  )
}

function Body({
  model,
  onIntent,
  onRetry,
  busy,
}: {
  readonly model: LmsPageModel
  readonly onIntent?: ((intent: LmsIntent) => void) | undefined
  readonly onRetry?: (() => void) | undefined
  readonly busy: boolean
}) {
  const body = model.body

  if (body.kind === 'unavailable') {
    return (
      <div className={styles.unavailable}>
        <p className={text.body} role="status">
          We could not load this round just now.
        </p>
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (body.kind === 'not-offered') {
    /* ABOUT THE COMPETITION. Not "no round yet" — this season does not run the
     * game at all, and telling somebody to come back would be a lie. */
    return (
      <p className={`${text.body} ${styles.empty}`}>
        This competition season does not run Last Man Standing.
      </p>
    )
  }

  if (body.kind === 'not-entered') {
    /* ABOUT THE PLAYER, and it is an ordinary answer: the game is opt-in. No
     * join button, because Stage 11 does not own entry — a control here would
     * be a door onto a corridor that has not been built. */
    return (
      <p className={`${text.body} ${styles.empty}`}>
        You are not entered in Last Man Standing for this season.
      </p>
    )
  }

  if (body.kind === 'no-round') {
    return (
      <p className={`${text.body} ${styles.empty}`}>
        There is no round to play right now.
      </p>
    )
  }

  return (
    <RoundBody
      round={body.round}
      pick={body.pick}
      now={model.generatedAt}
      onIntent={onIntent}
      busy={busy}
    />
  )
}

/**
 * WHEN PICKS CLOSE, OR CLOSED, OR OPEN — THREE STATES AND THREE SENTENCES.
 *
 * SAID, NOT COUNTED. There is no countdown: the browser does not own this
 * deadline and a ticking number implies it does.
 *
 * AND "NOT OPEN YET" IS NOT "CLOSED". An earlier version had two branches —
 * open, or else closed — so a round that had not started announced "Picks
 * closed 11:00", telling a player they had missed a deadline that has not
 * arrived. `e2e/vnext-lms.spec.ts` caught it; no unit test could, because the
 * markup was perfectly well-formed and merely untrue.
 */
function Deadline({ round, now }: { readonly round: LmsRound; readonly now: string }) {
  // A DAY, NOT JUST A CLOCK. `formatTime` gives "11:00" and nothing else, and
  // an LMS deadline is routinely days away — so "Picks close 11:00" read on a
  // Tuesday for a Saturday lock is the worst ambiguity this product can
  // produce, on the one page where missing a deadline costs a season. The
  // surface it replaces prints "Sat 15 Nov · 11:00", and every other vNext
  // surface already uses a day-bearing label.
  //
  // `formatKickoffLabel` TAKES THE INSTANT AS AN ARGUMENT — "Today 11:00",
  // "Tomorrow 11:00", "Sat 11:00" — so this reads no clock. The instant is the
  // model's own `generatedAt`, the same one the state was judged against, so
  // the words and the state can never be relative to different moments.
  const words =
    round.locksAt === null
      ? // NO DEADLINE IS THE HEADLINE, whatever else is true. An unscheduled
        // window announcing "Picks open 12:00" would imply picking becomes
        // possible; the fact a player needs is that no closing time exists yet.
        'No deadline set yet'
      : round.state === 'not-open'
        ? round.opensAt === null
          ? 'This round has not opened yet'
          : `Picks open ${formatKickoffLabel(round.opensAt, now)}`
        : round.state === 'open'
          ? `Picks close ${formatKickoffLabel(round.locksAt, now)}`
          : `Picks closed ${formatKickoffLabel(round.locksAt, now)}`

  return <p className={`${text.micro} ${styles.deadline}`}>{words}</p>
}

/**
 * HOW MANY CLUBS ARE LEFT, AND IT MATTERS MOST WHEN IT IS ONE.
 *
 * A separate component only so the singular is impossible to get wrong: "1
 * clubs still available" is the sentence a player reads in the round where the
 * count is the whole warning.
 */
function Remaining({ count }: { readonly count: number }) {
  return (
    <p className={`${text.micro} ${styles.remaining}`}>
      {count === 0
        ? 'No clubs left for you to pick in this round'
        : `${formatNumber(count)} ${count === 1 ? 'club' : 'clubs'} still available to you`}
    </p>
  )
}

/**
 * WHAT THE PICKED CLUB DID — CARRIED, NEVER READ AS A VERDICT.
 *
 * The stage's binding pair is `wonButEliminated` and `lostButAlive`, and until
 * this component existed those two worlds were IDENTICAL on screen apart from
 * the standing banner: `LmsPick.result` was mapped, fixtured and tested, and
 * then never rendered. So the rule the whole stage is about — a club winning is
 * not a player surviving — was provable in the mapper and invisible on the
 * page, and the surface it replaces said more than it did.
 *
 * The copy is `lmsRoundModel.ts`'s, because that is where the rule lives. Note
 * `drew` says what happened and NOT what follows: whether a draw eliminates is
 * a stored rule this surface may state (from contract 164) and never apply.
 */
const RESULT_COPY: Record<LmsClubResult, string> = {
  won: 'Your pick won.',
  lost: 'Your pick lost.',
  drew: 'Your pick drew.',
  postponed: 'Your pick has no result yet — a round without one never eliminates.',
}

function PickResult({ result }: { readonly result: LmsClubResult }) {
  return (
    <p className={`${text.body} ${styles.pickResult}`} data-vnext-zone="pick-result">
      {RESULT_COPY[result]}
    </p>
  )
}

function RoundBody({
  round,
  pick,
  now,
  onIntent,
  busy,
}: {
  readonly round: LmsRound
  readonly pick: { readonly clubName: string; readonly result: LmsClubResult | null } | null
  readonly now: string
  readonly onIntent?: ((intent: LmsIntent) => void) | undefined
  readonly busy: boolean
}) {
  const open = lmsRoundIsOpen(round)
  const pickName = pick?.clubName ?? null

  // WHETHER THIS PLAYER CAN PICK, WHICH IS NOT THE SAME AS THE ROUND BEING
  // OPEN. Elimination blocks the PLAYER and leaves the round open, so gating
  // the prompt on `open` alone invited an eliminated player to "pick one club
  // to win" and then told them no clubs were left — directly under a banner
  // reading "You have been eliminated."
  const canPick = open && lmsPickableCount(round) > 0

  return (
    <section className={styles.round} data-vnext-zone="round" data-state={round.state}>
      <div className={styles.roundHead}>
        <h2 className={`${text.title} ${styles.roundLabel}`}>{round.label}</h2>
        <Deadline round={round} now={now} />
      </div>

      {pickName === null ? (
        canPick ? (
          <p className={`${text.body} ${styles.prompt}`}>
            {/* THE WHOLE GAME, IN ONE LINE. */}
            Pick one club to win. You cannot use it again.
          </p>
        ) : null
      ) : (
        <>
          <p className={`${text.body} ${styles.prompt}`} data-vnext-zone="your-pick">
            You picked <strong>{pickName}</strong>.
          </p>
          {pick?.result == null ? null : <PickResult result={pick.result} />}
        </>
      )}

      <LmsPickList
        choices={round.choices}
        onPick={
          onIntent && open ? (teamId) => onIntent({ kind: 'pick', teamId }) : undefined
        }
        busy={busy}
      />

      {canPick ? <Remaining count={lmsPickableCount(round)} /> : null}
    </section>
  )
}
