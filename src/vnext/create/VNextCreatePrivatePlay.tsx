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
 * CREATE PRIVATE PLAY.
 *
 * Every control emits an intent. The integration host owns writes, authoritative
 * rereads and routing; this presentation never invents a create rule or a
 * destination. The three games remain peers and a game that cannot be created
 * keeps its row with the server-backed reason.
 */
export type CreateIntent =
  | { readonly kind: 'choose-game'; readonly game: CreateGameKey }
  | { readonly kind: 'join-code'; readonly code: string }
  | { readonly kind: 'join' }
  | { readonly kind: 'choose-host'; readonly hostId: string }
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'lms'; readonly setup: CreateLmsSetup }
  | { readonly kind: 'review' }
  | { readonly kind: 'back' }
  | { readonly kind: 'create' }
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
          ) : model.step === 'review' ? (
            <Review model={model} onIntent={onIntent} />
          ) : (
            <Created model={model} onIntent={onIntent} />
          )}
        </motion.div>
      </div>
    </VNextShell>
  )
}

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

      <button type="button" className={styles.quiet} onClick={() => onIntent?.({ kind: 'leave' })}>
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

function Setup({ model, onIntent }: Section) {
  const game = model.chosen
  if (game === null) return null

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
          placeholder="The Sunday Club"
          onChange={(event) => onIntent?.({ kind: 'name', name: event.target.value })}
        />
        <span className={`${text.micro} ${styles.hint}`}>
          Up to {CREATE_NAME_MAX} characters. Your friends will see it.
        </span>
      </label>

      {game.key === 'last-man-standing' ? <LmsRules setup={model.lms} onIntent={onIntent} /> : null}

      {game.key === 'championship' ? (
        <p className={`${text.micro} ${styles.hint}`} data-vnext-zone="launch-note">
          You will get an invite straight away. The draw is made when you launch it, and
          launching closes it to anyone who has not joined by then — so launch once your
          friends are in.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!ready}
          onClick={() => onIntent?.({ kind: 'review' })}
        >
          Review
        </button>
        <button type="button" className={styles.quiet} onClick={() => onIntent?.({ kind: 'back' })}>
          Back
        </button>
      </div>
    </section>
  )
}

function Review({ model, onIntent }: Section) {
  const game = model.chosen
  const host = model.host
  if (game === null || host === null) return null

  const working = model.commit.kind === 'working'
  const drawRule = DRAWS.find((option) => option.value === model.lms.drawsRule)?.label
  const wipeoutRule = WIPEOUT.find(
    (option) => option.value === model.lms.endgameOnWipeout,
  )?.label

  return (
    <section className={styles.section} data-vnext-zone="review">
      <p className={`${text.title} ${styles.setupTitle}`}>Review {model.name.trim()}</p>
      <p className={`${text.body} ${styles.lead}`}>
        {game.name} · {host.competitionName} {host.seasonLabel}
      </p>

      {game.key === 'last-man-standing' ? (
        <div className={styles.rules} data-vnext-zone="review-lms-rules">
          <p className={text.label}>Your rules</p>
          <p className={`${text.body} ${styles.hint}`}>
            {model.lms.lives} {model.lms.lives === 1 ? 'life' : 'lives'} · {model.lms.saves}{' '}
            {model.lms.saves === 1 ? 'save' : 'saves'}
          </p>
          <p className={`${text.body} ${styles.hint}`}>{drawRule}</p>
          <p className={`${text.body} ${styles.hint}`}>{wipeoutRule}</p>
        </div>
      ) : null}

      {game.key === 'championship' ? (
        <p className={`${text.micro} ${styles.hint}`} data-vnext-zone="review-launch-note">
          Creating this does not make the draw. Share the invite first; launch only when your field
          is complete, because launch fixes the draw and closes registration.
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
          disabled={working}
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
          Edit
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
    <button type="button" className={styles.hostOption} aria-pressed={chosen} onClick={onChoose}>
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

function Created({ model, onIntent }: Section) {
  const created = model.created
  useFeedbackOnLatch(created !== null, 'success')

  if (created === null) return null

  return (
    <section className={styles.section} data-vnext-zone="created">
      <p className={`${text.title} ${styles.setupTitle}`}>{created.name} is ready</p>
      <p className={`${text.body} ${styles.lead}`}>
        In {created.competitionName}. Send this to whoever you want in it.
      </p>

      {created.inviteCode === null ? (
        <p className={`${text.body} ${styles.refusal}`} data-vnext-zone="no-code">
          We could not read the invite code just now. Open your private-play list to read the
          organiser state again.
        </p>
      ) : (
        <div className={`${surfaces.sunken} ${styles.invite}`}>
          <span className={styles.code}>{created.inviteCode}</span>
          <button type="button" className={styles.primary} onClick={() => onIntent?.({ kind: 'share' })}>
            Copy invite link
          </button>
        </div>
      )}

      {created.awaitsLaunch ? (
        <p className={`${text.micro} ${styles.hint}`} data-vnext-zone="awaits-launch">
          Nobody is drawn yet. Launch it from the Championship once your friends have joined — the
          draw is fixed at that point and it closes to anyone else.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => onIntent?.({ kind: 'open-created' })}>
          Open it
        </button>
        <button type="button" className={styles.quiet} onClick={() => onIntent?.({ kind: 'leave' })}>
          Done
        </button>
      </div>
    </section>
  )
}