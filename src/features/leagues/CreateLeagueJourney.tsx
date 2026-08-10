import { useId, useState } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { userFacingError } from '../../shared/errors/userFacingError'
import { leagueCapacityError } from './leagueErrors'
import { InvitePanel } from './InvitePanel'
import type { CreatedGameLeague } from '../../services/supabase/gameLeagues'
import type { CreateJourney, CreateJourneyGame, CreateJourneyHost } from './createJourneyModel'
import styles from './createJourney.module.css'

/**
 * Create a private league: choose game → set it up → review → create and share.
 *
 * THE FOUR STEPS ARE THE FOUR REAL DECISIONS, not a wizard for its own sake.
 * `create_game_league` takes exactly two arguments — a `game_competition_id`
 * and a name — but the id encodes both which game and which competition, and a
 * player on a twenty-competition platform has to be asked. Review exists
 * because the answer is not editable afterwards: a league belongs to the game
 * it was created in for good.
 *
 * ONLY WHAT THE SERVER CAN COMPLETE IS OFFERED. The game step lists all three
 * games and lets the player choose the one that works; the other two say why
 * they cannot be created rather than accepting a name and failing on submit.
 * That refusal is derived in `createJourneyModel` from the function's own
 * precondition, so it cannot drift into optimism.
 *
 * THE BROWSER DOES NOT SECOND-GUESS THE SERVER. The one client-side check is
 * that a name has been typed at all, because a control that submits nothing is
 * a bug rather than a rule. Length, capacity, membership and code allocation
 * are the function's, and its message is what the player is shown.
 *
 * THE CREATED MOMENT IS THE INVITE MOMENT. A league with no members is not a
 * league, so the last step is the code and the share sheet rather than a
 * confirmation the player has to leave in order to act on.
 */

export type CreateLeagueJourneyProps = {
  journey: CreateJourney
  create: (gameCompetitionId: string, name: string) => Promise<CreatedGameLeague>
  /** Where the finished league can be opened, when the caller has a route. */
  onOpen?: (league: CreatedGameLeague) => void
  onCancel: () => void
}

type Step = 'game' | 'setup' | 'review' | 'created'

const NAME_MAX = 40

export function CreateLeagueJourney({
  journey,
  create,
  onOpen,
  onCancel,
}: CreateLeagueJourneyProps) {
  const headingId = useId()
  // THE GAME STEP IS ALWAYS SHOWN, even though only one game can be created
  // today. Skipping it would save a press and hide the only place the other
  // two games are explained — and "why can I not make a Last Man Standing
  // league?" is the question this screen exists to answer.
  const [game, setGame] = useState<CreateJourneyGame | null>(null)
  const [step, setStep] = useState<Step>('game')
  const [host, setHost] = useState<CreateJourneyHost | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedGameLeague | null>(null)

  async function submit() {
    if (host === null) return
    setSubmitting(true)
    setError(null)
    try {
      const league = await create(host.gameCompetitionId, name.trim())
      setCreated(league)
      setStep('created')
    } catch (thrown) {
      setError(
        leagueCapacityError(thrown) ??
          userFacingError(thrown, 'Could not create the league. Try again.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'created' && created) {
    return (
      <section className={styles.journey} aria-labelledby={headingId}>
        <h2 className={styles.title} id={headingId}>
          {created.name} is ready
        </h2>
        <p className={styles.lead}>
          You are in it. Share the code and anyone who has joined {game?.name} in{' '}
          {host?.competitionName} can join the table.
        </p>
        <InvitePanel leagueName={created.name} code={created.inviteCode} mode="full" />
        <div className={styles.actions}>
          {onOpen ? (
            <Button variant="primary" onClick={() => onOpen(created)}>
              Open the league
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onCancel}>
            Done
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.journey} aria-labelledby={headingId}>
      <h2 className={styles.title} id={headingId}>
        Create a private league
      </h2>
      <p className={styles.steps} aria-hidden="true">
        {step === 'game' ? 'Step 1 of 3 · Choose a game' : null}
        {step === 'setup' ? 'Step 2 of 3 · Set it up' : null}
        {step === 'review' ? 'Step 3 of 3 · Review' : null}
      </p>

      {step === 'game' ? (
        <>
          <p className={styles.lead}>
            A private league ranks one game inside one competition. Choose the game it should
            rank.
          </p>
          <ul className={styles.gameList}>
            {journey.games.map((option) => (
              <li key={option.gameKey}>
                {option.refusal === null ? (
                  <button
                    type="button"
                    className={styles.game}
                    onClick={() => {
                      setGame(option)
                      setHost(option.hosts.length === 1 ? (option.hosts[0] as CreateJourneyHost) : null)
                      setStep('setup')
                    }}
                  >
                    <span className={styles.gameName}>{option.name}</span>
                    <span className={styles.gameDescription}>{option.description}</span>
                  </button>
                ) : (
                  // Explained, never a disabled control to hover over.
                  <p className={styles.gameRefused}>
                    <span className={styles.gameName}>{option.name}</span>
                    <span className={styles.gameDescription}>{option.refusal}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}

      {step === 'setup' && game ? (
        <>
          <p className={styles.lead}>
            {game.name} — {game.description}
          </p>

          {game.hosts.length > 1 ? (
            <div className={styles.group} role="group" aria-label="Which competition">
              <h3 className={styles.groupTitle}>Which competition</h3>
              {game.hosts.map((option) => (
                <button
                  key={option.gameCompetitionId}
                  type="button"
                  className={`${styles.host} ${
                    host?.gameCompetitionId === option.gameCompetitionId ? styles.hostOn : ''
                  }`}
                  aria-pressed={host?.gameCompetitionId === option.gameCompetitionId}
                  onClick={() => setHost(option)}
                >
                  <span className={styles.hostName}>{option.competitionName}</span>
                  <span className={styles.hostSeason}>{option.seasonLabel}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.only}>
              In {host?.competitionName} {host?.seasonLabel}, the one competition you play{' '}
              {game.name} in.
            </p>
          )}

          <TextInput
            label="League name"
            value={name}
            maxLength={NAME_MAX}
            placeholder="e.g. The Office Sweepstake"
            onChange={(event) => setName(event.target.value)}
          />

          {error ? (
            <Alert variant="error" title="The league was not created">
              {error}
            </Alert>
          ) : null}

          <div className={styles.actions}>
            <Button
              variant="primary"
              // The only browser-side condition: something to submit. Every
              // other rule belongs to the function and speaks for itself.
              disabled={host === null || name.trim().length === 0}
              onClick={() => setStep('review')}
            >
              Review
            </Button>
            <Button variant="secondary" onClick={() => setStep('game')}>
              Back
            </Button>
          </div>
        </>
      ) : null}

      {step === 'review' && game && host ? (
        <>
          <p className={styles.lead}>
            Check this before it is created — a league belongs to the game and competition it was
            made in.
          </p>
          <dl className={styles.review}>
            <div className={styles.reviewRow}>
              <dt className={styles.reviewLabel}>Name</dt>
              <dd className={styles.reviewValue}>{name.trim()}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt className={styles.reviewLabel}>Game</dt>
              <dd className={styles.reviewValue}>{game.name}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt className={styles.reviewLabel}>Competition</dt>
              <dd className={styles.reviewValue}>
                {host.competitionName} {host.seasonLabel}
              </dd>
            </div>
          </dl>
          {/* The one thing that surprises people: an invite code is not a way
              into the game. It is the server's rule, stated before they share
              it rather than after a friend is turned away. */}
          <p className={styles.note}>
            Anyone you invite needs to have joined {game.name} in {host.competitionName} before
            they can join the league.
          </p>

          {error ? (
            <Alert variant="error" title="The league was not created">
              {error}
            </Alert>
          ) : null}

          <div className={styles.actions}>
            <Button variant="primary" loading={submitting} onClick={submit}>
              Create and share
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => setStep('setup')}>
              Back
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
