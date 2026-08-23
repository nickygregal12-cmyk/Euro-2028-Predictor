import { motion } from 'framer-motion'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { useFeedbackOnLatch } from '../foundations/feedbackContext'
import surfaces from '../foundations/surfaces.module.css'
import text from '../foundations/typography.module.css'
import {
  CREATE_NAME_MAX,
  LMS_LIVES,
  LMS_SAVES,
  type CreateGameKey,
  type CreateGameOption,
  type CreateHost,
  type CreateLmsSetup,
  type CreatePrivatePlayView,
} from '../models/createPrivatePlay'
import { VNextNotice } from '../states/VNextStates'
import styles from './create.module.css'

/**
 * CREATE PRIVATE PLAY — the corridor Stage 9 said it was not building.
 *
 * ============================ THE DEAD END THIS ENDS ====================
 *
 * `VNextLeagues` says, in a comment beside the sentence a player actually
 * reads: *"Stage 9 does not own joining or creating a league, so a button here
 * would be a door onto a corridor that has not been built."* That was the right
 * call at the time and it left the product with a real hole — a player told
 * they are in no private league, and no way from there to be in one. The
 * legacy product has a complete create journey; vNext had none, so the only
 * route to it was out of the new product and into the old one.
 *
 * ============================ IT WRITES NOTHING =========================
 *
 * Every control emits an INTENT. The host performs the create — through
 * `create_game_league`, `create_private_season_lms` or
 * `create_private_season_cup`, whichever the game's own shape requires — and
 * reports back through `commit`. There is no second copy of the creation rules
 * here, no re-validated name, no re-checked lives range and no lock: those
 * belong to the functions and their refusals come back from them.
 *
 * ============================ THE THREE GAMES ARE PEERS =================
 *
 * Same row, same size, same kind of sentence, in the order the Games
 * destination uses. A game that cannot be created carries its reason instead of
 * disappearing — "join Match Predictor in a competition first" is a thing a
 * player can act on, and a missing row is not.
 *
 * ============================ AND A CHAMPIONSHIP IS NOT LAUNCHED HERE ===
 *
 * It is created, and then separately launched: the draw is fixed at whatever
 * field size the organiser launches with and refuses ever after, and launching
 * closes registration. The corridor says so and hands the organiser their
 * invite; launching is a decision they make once their friends are in, on the
 * Championship's own surface.
 */

export type CreateIntent =
  | { readonly kind: 'choose-game'; readonly game: CreateGameKey }
  /** The player is typing an invite code. Not validated here. */
  | { readonly kind: 'join-code'; readonly code: string }
  /** Take that code to `/join/:code`, which owns every answer about it. */
  | { readonly kind: 'join' }
  | { readonly kind: 'choose-host'; readonly hostId: string }
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'lms'; readonly setup: CreateLmsSetup }
  | { readonly kind: 'back' }
  | { readonly kind: 'create' }
  /** Copy the invite the server issued. Never a code this lane composed. */
  | { readonly kind: 'share' }
  | { readonly kind: 'open-created' }
  | { readonly kind: 'leave' }
  | { readonly kind: 'retry' }

export type VNextCreatePrivatePlayProps = {
  readonly view: CreatePrivatePlayView
  readonly onIntent?: ((intent: CreateIntent) => void) | undefined
}

export function VNextCreatePrivatePlay({ view, onIntent }: VNextCreatePrivatePlayProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)

  if (view.kind === 'loading') {
    return (
      <VNextNotice
        destination="games"
        heading="Create private play"
        title="One moment"
        body="Finding the competitions you could build one in."
      />
    )
  }

  if (view.kind === 'unavailable') {
    return (
      <VNextNotice
        destination="games"
        heading="Create private play"
        title="We could not load this"
        body={view.message}
        onRetry={() => onIntent?.({ kind: 'retry' })}
      />
    )
  }

  const model = view.model

  return (
    <VNextShell
      destination="games"
      header={
        <VNextPageHeader
          title="Create private play"
          context="Your own group, in any of the three games"
        />
      }
    >
      <div className={styles.page}>
        <motion.div
          key={model.step}
          variants={rise}
          initial="hidden"
          animate="visible"
          className={styles.body}
        >
          {model.step === 'game' ? (
            <GameChoice model={model} onIntent={onIntent} />
          ) : model.step === 'setup' ? (
            <Setup model={model} onIntent={onIntent} />
          ) : (
            <Created model={model} onIntent={onIntent} />
          )}
        </motion.div>
      </div>
    </VNextShell>
  )
}

/* ========================================================================== */

type Section = {
  readonly model: Extract<CreatePrivatePlayView, { kind: 'ready' }>['model']
  readonly onIntent?: ((intent: CreateIntent) => void) | undefined
}

function GameChoice({ model, onIntent }: Section) {
  return (
    <section className={styles.section} data-vnext-zone="choose-game">
      <p className={`${text.body} ${styles.lead}`}>
        Pick the game your group will play. Each one is its own competition with its own
        table, so you can run more than one.
      </p>

      {model.blocked ? (
        // NOT AN ERROR, AND IT MUST NOT LOOK LIKE ONE. Nothing has failed: there
        // is no open season to build on, or no game joined to rank. Each row
        // below still states its own reason, which is the thing a player can act
        // on.
        <p className={`${text.body} ${styles.blocked}`} data-vnext-zone="blocked">
          There is nothing to build on just now. Each game below says why.
        </p>
      ) : null}

      <ul className={styles.list}>
        {model.games.map((game) => (
          <li key={game.key}>
            <GameRow game={game} onIntent={onIntent} />
          </li>
        ))}
      </ul>

      {/* THE OTHER WAY IN, AND THE COMMONER ONE. Most people reach private play
          because somebody sent them something. It is the same decision as the
          three above — "I have one" or "I am starting one" — so it is on the
          same screen; putting it behind another press makes a player who
          already has a code hunt for the door. */}
      <form
        className={styles.join}
        data-vnext-zone="join"
        onSubmit={(event) => {
          event.preventDefault()
          onIntent?.({ kind: 'join' })
        }}
      >
        <label className={styles.field}>
          <span className={text.label}>Already have an invite?</span>
          <input
            className={styles.input}
            type="text"
            value={model.joinCode}
            autoComplete="off"
            placeholder="Paste the code or the link"
            onChange={(event) => onIntent?.({ kind: 'join-code', code: event.target.value })}
          />
        </label>
        <button
          type="submit"
          className={styles.quiet}
          disabled={model.joinCode.trim().length === 0}
        >
          Open it
        </button>
      </form>

      <button
        type="button"
        className={styles.quiet}
        onClick={() => onIntent?.({ kind: 'leave' })}
      >
        Not now
      </button>
    </section>
  )
}

function GameRow({
  game,
  onIntent,
}: {
  readonly game: CreateGameOption
  readonly onIntent?: ((intent: CreateIntent) => void) | undefined
}) {
  const body = (
    <>
      <span className={`${text.title} ${styles.gameName}`}>{game.name}</span>
      <span className={`${text.body} ${styles.gameBody}`}>{game.description}</span>
      {game.refusal === null ? null : (
        // THE REASON, NOT A DISABLED BUTTON. A control that exists and refuses
        // teaches a player the product is broken; a sentence tells them what to
        // do instead.
        <span className={`${text.micro} ${styles.refusal}`}>{game.refusal}</span>
      )}
    </>
  )

  if (game.refusal !== null) {
    return (
      <div className={`${surfaces.surface} ${styles.gameRow}`} data-vnext-game={game.key}>
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`${surfaces.interactive} ${styles.gameRow}`}
      data-vnext-game={game.key}
      onClick={() => onIntent?.({ kind: 'choose-game', game: game.key })}
    >
      {body}
    </button>
  )
}

/* ========================================================================== */

function Setup({ model, onIntent }: Section) {
  const game = model.chosen
  if (game === null) return null

  const working = model.commit.kind === 'working'
  const ready = model.host !== null && model.name.trim().length > 0

  return (
    <section className={styles.section} data-vnext-zone="setup">
      <p className={`${text.title} ${styles.setupTitle}`}>{game.name}</p>
      <p className={`${text.body} ${styles.lead}`}>{game.description}</p>

      <fieldset className={styles.field}>
        <legend className={text.label}>Which competition</legend>
        <ul className={styles.hostList}>
          {game.hosts.map((host) => (
            <li key={host.id}>
              <HostOption
                host={host}
                chosen={model.host?.id === host.id}
                onChoose={() => onIntent?.({ kind: 'choose-host', hostId: host.id })}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <label className={styles.field}>
        <span className={text.label}>What is it called</span>
        <input
          className={styles.input}
          type="text"
          value={model.name}
          maxLength={CREATE_NAME_MAX}
          // STATED, NOT ENFORCED TWICE. The server owns the policy; this is the
          // number it enforces, said before somebody hits it.
          placeholder="The Sunday Club"
          onChange={(event) => onIntent?.({ kind: 'name', name: event.target.value })}
        />
        <span className={`${text.micro} ${styles.hint}`}>
          Up to {CREATE_NAME_MAX} characters. Your friends will see it.
        </span>
      </label>

      {game.key === 'last-man-standing' ? (
        <LmsRules setup={model.lms} onIntent={onIntent} />
      ) : null}

      {game.key === 'championship' ? (
        // SAID BEFORE THE CONTROL, NOT AFTER IT. Creating and launching are two
        // decisions and the second one is irreversible.
        <p className={`${text.micro} ${styles.hint}`} data-vnext-zone="launch-note">
          You will get an invite straight away. The draw is made when you launch it, and
          launching closes it to anyone who has not joined by then — so launch once your
          friends are in.
        </p>
      ) : null}

      {model.commit.kind === 'failed' ? (
        <p className={`${text.body} ${styles.failed}`} role="alert" data-vnext-zone="refused">
          {model.commit.message}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!ready || working}
          onClick={() => onIntent?.({ kind: 'create' })}
        >
          {working ? 'Creating…' : 'Create it'}
        </button>
        <button
          type="button"
          className={styles.quiet}
          disabled={working}
          onClick={() => onIntent?.({ kind: 'back' })}
        >
          Back
        </button>
      </div>
    </section>
  )
}

function HostOption({
  host,
  chosen,
  onChoose,
}: {
  readonly host: CreateHost
  readonly chosen: boolean
  readonly onChoose: () => void
}) {
  return (
    <button
      type="button"
      className={styles.hostOption}
      aria-pressed={chosen}
      onClick={onChoose}
    >
      <span className={styles.hostName}>{host.competitionName}</span>
      <span className={`${text.micro} ${styles.hostSeason}`}>{host.seasonLabel}</span>
    </button>
  )
}

const DRAWS: readonly { value: CreateLmsSetup['drawsRule']; label: string }[] = [
  { value: 'eliminate', label: 'A draw knocks you out' },
  { value: 'survive', label: 'A draw keeps you in' },
]

const WIPEOUT: readonly { value: CreateLmsSetup['endgameOnWipeout']; label: string }[] = [
  { value: 'play_on', label: 'Replay the round' },
  { value: 'shared_win', label: 'Everyone left shares it' },
  { value: 'reset', label: 'Everyone starts again' },
]

function LmsRules({
  setup,
  onIntent,
}: {
  readonly setup: CreateLmsSetup
  readonly onIntent?: ((intent: CreateIntent) => void) | undefined
}) {
  const change = (over: Partial<CreateLmsSetup>) =>
    onIntent?.({ kind: 'lms', setup: { ...setup, ...over } })

  return (
    <div className={styles.rules} data-vnext-zone="lms-rules">
      <p className={text.label}>Your rules</p>

      <fieldset className={styles.field}>
        <legend className={`${text.micro} ${styles.hint}`}>Lives each</legend>
        <div className={styles.chips}>
          {LMS_LIVES.map((lives) => (
            <button
              key={lives}
              type="button"
              className={styles.chip}
              aria-pressed={setup.lives === lives}
              onClick={() => change({ lives })}
            >
              {lives}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.field}>
        <legend className={`${text.micro} ${styles.hint}`}>Saves each</legend>
        <div className={styles.chips}>
          {LMS_SAVES.map((saves) => (
            <button
              key={saves}
              type="button"
              className={styles.chip}
              aria-pressed={setup.saves === saves}
              onClick={() => change({ saves })}
            >
              {saves}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.field}>
        <legend className={`${text.micro} ${styles.hint}`}>If your club draws</legend>
        <div className={styles.chips}>
          {DRAWS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.chip}
              aria-pressed={setup.drawsRule === option.value}
              onClick={() => change({ drawsRule: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.field}>
        <legend className={`${text.micro} ${styles.hint}`}>If everyone goes out at once</legend>
        <div className={styles.chips}>
          {WIPEOUT.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.chip}
              aria-pressed={setup.endgameOnWipeout === option.value}
              onClick={() => change({ endgameOnWipeout: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/* ========================================================================== */

function Created({ model, onIntent }: Section) {
  const created = model.created

  // A CONTAINER THAT EXISTS NOW AND DID NOT A MOMENT AGO. `success` rather than
  // `important`: this is a completion, and the page states it in words either
  // way — nothing here depends on the device having a motor.
  useFeedbackOnLatch(created !== null, 'success')

  if (created === null) return null

  return (
    <section className={styles.section} data-vnext-zone="created">
      <p className={`${text.title} ${styles.setupTitle}`}>{created.name} is ready</p>
      <p className={`${text.body} ${styles.lead}`}>
        In {created.competitionName}. Send this to whoever you want in it.
      </p>

      {created.inviteCode === null ? (
        // STATED, NOT BLANK. A code that failed to arrive and a container that
        // has none are different facts, and an empty box looks like the first.
        <p className={`${text.body} ${styles.refusal}`} data-vnext-zone="no-code">
          We could not read the invite code just now. It exists — open the competition and
          the organiser panel will show it.
        </p>
      ) : (
        <div className={`${surfaces.sunken} ${styles.invite}`}>
          <span className={styles.code}>{created.inviteCode}</span>
          <button
            type="button"
            className={styles.primary}
            onClick={() => onIntent?.({ kind: 'share' })}
          >
            Copy invite link
          </button>
        </div>
      )}

      {created.awaitsLaunch ? (
        <p className={`${text.micro} ${styles.hint}`} data-vnext-zone="awaits-launch">
          Nobody is drawn yet. Launch it from the Championship once your friends have
          joined — the draw is fixed at that point and it closes to anyone else.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => onIntent?.({ kind: 'open-created' })}
        >
          Open it
        </button>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => onIntent?.({ kind: 'leave' })}
        >
          Done
        </button>
      </div>
    </section>
  )
}
