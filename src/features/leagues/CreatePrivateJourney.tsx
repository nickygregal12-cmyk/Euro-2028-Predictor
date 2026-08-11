import { useId, useState } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { userFacingError } from '../../shared/errors/userFacingError'
import { leagueCapacityError } from './leagueErrors'
import { InvitePanel } from './InvitePanel'
import type { CreatedGameLeague } from '../../services/supabase/gameLeagues'
import {
  DEFAULT_LMS_SETUP,
  LMS_LIVES_OPTIONS,
  LMS_SAVES_OPTIONS,
  type CreatedPrivateCompetition,
  type CupLaunchResult,
  type PrivateLmsSetup,
} from '../../services/supabase/privateCompetitionsModel'
import type { CreateJourney, CreateJourneyGame, CreateJourneyHost } from './createJourneyModel'
import styles from './createJourney.module.css'

/**
 * Create private play, in any of the three weekly games: choose game → set it
 * up → review → create and share.
 *
 * WHAT IT REPLACES. `CreateLeagueJourney`, which offered Match Predictor and
 * explained to the player that the other two games had no private version to
 * create. That was true and is not any more: contracts 153 and 154 build both.
 * The dead-end screens are gone with the reason for them.
 *
 * THE FOUR STEPS ARE THE FOUR REAL DECISIONS. Which game, where and under what
 * rules, a look before committing, then the code — because a private
 * competition with no members is not one, so the last step is the invite rather
 * than a confirmation the player has to leave in order to act on.
 *
 * ONLY THE SELECTED GAME'S FIELDS ARE SHOWN. A Match Predictor league takes a
 * name; a Last Man Standing takes lives, saves, what a draw does and what
 * happens if everyone goes out; a Championship takes a name and is launched
 * separately. Showing all of them at once and disabling the irrelevant ones
 * would make every organiser read rules that do not apply to them.
 *
 * THE BROWSER DOES NOT SECOND-GUESS THE SERVER. The one client-side check is
 * that a name has been typed at all, because a control that submits nothing is
 * a bug rather than a rule. The lives and saves options are the ranges
 * `season_lms_setups` constrains, offered as choices — not re-validated, so the
 * day the server widens one, this widens with it rather than refusing.
 *
 * A CHAMPIONSHIP IS CREATED AND THEN LAUNCHED, and the interface never blurs
 * them. The draw is fixed at whatever field size the organiser launches with
 * and refuses ever after, and launching closes registration so a later joiner
 * cannot hold a membership into a fixture list without them. That is said in
 * words before the control, not after it.
 */

export type CreatePrivateJourneyProps = {
  journey: CreateJourney
  createLeague: (gameCompetitionId: string, name: string) => Promise<CreatedGameLeague>
  createLms: (
    tournamentId: string,
    name: string,
    setup: PrivateLmsSetup,
  ) => Promise<CreatedPrivateCompetition>
  createCup: (tournamentId: string, name: string) => Promise<CreatedPrivateCompetition>
  launchCup: (competitionId: string) => Promise<CupLaunchResult>
  /** Where a finished LEAGUE can be opened, when the caller has a route. */
  onOpen?: (league: CreatedGameLeague) => void
  onCancel: () => void
}

type Step = 'game' | 'setup' | 'review' | 'created'

type Created =
  | { kind: 'league'; league: CreatedGameLeague }
  | { kind: 'lms'; competition: CreatedPrivateCompetition }
  | { kind: 'cup'; competition: CreatedPrivateCompetition }

const NAME_MAX = 40

const DRAWS_OPTIONS: readonly { value: PrivateLmsSetup['drawsRule']; label: string }[] = [
  { value: 'eliminate', label: 'A draw eliminates you' },
  { value: 'survive', label: 'A draw survives' },
]

const WIPEOUT_OPTIONS: readonly { value: PrivateLmsSetup['endgameOnWipeout']; label: string }[] = [
  { value: 'play_on', label: 'Play on — the round is replayed' },
  { value: 'shared_win', label: 'Everyone still standing shares the win' },
  { value: 'reset', label: 'Start again with everyone back in' },
]

export function CreatePrivateJourney({
  journey,
  createLeague,
  createLms,
  createCup,
  launchCup,
  onOpen,
  onCancel,
}: CreatePrivateJourneyProps) {
  const headingId = useId()
  const [game, setGame] = useState<CreateJourneyGame | null>(null)
  const [step, setStep] = useState<Step>('game')
  const [host, setHost] = useState<CreateJourneyHost | null>(null)
  const [name, setName] = useState('')
  const [setup, setSetup] = useState<PrivateLmsSetup>(DEFAULT_LMS_SETUP)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  async function submit() {
    if (host === null || game === null) return
    setSubmitting(true)
    setError(null)
    try {
      if (game.setup === 'league') {
        if (!host.gameCompetitionId) throw new Error('That competition is not playable yet.')
        setCreated({ kind: 'league', league: await createLeague(host.gameCompetitionId, name.trim()) })
      } else if (game.setup === 'lms') {
        setCreated({
          kind: 'lms',
          competition: await createLms(host.tournamentId, name.trim(), setup),
        })
      } else {
        setCreated({
          kind: 'cup',
          competition: await createCup(host.tournamentId, name.trim()),
        })
      }
      setStep('created')
    } catch (thrown) {
      setError(
        leagueCapacityError(thrown) ??
          userFacingError(thrown, 'That could not be created. Try again.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'created' && created) {
    return (
      <CreatedStep
        created={created}
        game={game}
        host={host}
        launchCup={launchCup}
        onOpen={onOpen}
        onDone={onCancel}
        headingId={headingId}
      />
    )
  }

  const totalSteps = 3

  return (
    <section className={styles.journey} aria-labelledby={headingId}>
      <h2 className={styles.title} id={headingId}>
        Create private play
      </h2>
      <p className={styles.steps} aria-hidden="true">
        {step === 'game' ? `Step 1 of ${totalSteps} · Choose a game` : null}
        {step === 'setup' ? `Step 2 of ${totalSteps} · Set it up` : null}
        {step === 'review' ? `Step 3 of ${totalSteps} · Review` : null}
      </p>

      {step === 'game' ? (
        <>
          <p className={styles.lead}>
            Private play is one game inside one competition. Choose the game it should be.
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
                      setHost(
                        option.hosts.length === 1 ? (option.hosts[0] as CreateJourneyHost) : null,
                      )
                      setSetup(DEFAULT_LMS_SETUP)
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
                  key={option.tournamentId + (option.gameCompetitionId ?? '')}
                  type="button"
                  className={`${styles.host} ${
                    host?.tournamentId === option.tournamentId ? styles.hostOn : ''
                  }`}
                  aria-pressed={host?.tournamentId === option.tournamentId}
                  onClick={() => setHost(option)}
                >
                  <span className={styles.hostName}>{option.competitionName}</span>
                  <span className={styles.hostSeason}>{option.seasonLabel}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.only}>
              In {host?.competitionName} {host?.seasonLabel}, the one competition available for{' '}
              {game.name}.
            </p>
          )}

          <TextInput
            label={game.setup === 'league' ? 'League name' : 'Competition name'}
            value={name}
            maxLength={NAME_MAX}
            placeholder={
              game.setup === 'lms' ? 'e.g. Sunday Survivors' : 'e.g. The Office Sweepstake'
            }
            onChange={(event) => setName(event.target.value)}
          />

          {game.setup === 'lms' ? (
            <LmsSetupFields setup={setup} onChange={setSetup} />
          ) : null}

          {error ? (
            <Alert variant="error" title="That was not created">
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
            Check this before it is created — private play belongs to the game and competition it
            was made in.
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
            {game.setup === 'lms' ? (
              <>
                <div className={styles.reviewRow}>
                  <dt className={styles.reviewLabel}>Lives</dt>
                  <dd className={styles.reviewValue}>
                    {setup.lives === 0 ? 'None — one wrong pick and you are out' : setup.lives}
                  </dd>
                </div>
                <div className={styles.reviewRow}>
                  <dt className={styles.reviewLabel}>Saves</dt>
                  <dd className={styles.reviewValue}>{setup.saves === 0 ? 'None' : setup.saves}</dd>
                </div>
                <div className={styles.reviewRow}>
                  <dt className={styles.reviewLabel}>A draw</dt>
                  <dd className={styles.reviewValue}>
                    {DRAWS_OPTIONS.find((option) => option.value === setup.drawsRule)?.label}
                  </dd>
                </div>
                <div className={styles.reviewRow}>
                  <dt className={styles.reviewLabel}>If everyone goes out</dt>
                  <dd className={styles.reviewValue}>
                    {
                      WIPEOUT_OPTIONS.find((option) => option.value === setup.endgameOnWipeout)
                        ?.label
                    }
                  </dd>
                </div>
              </>
            ) : null}
          </dl>

          {game.setup === 'league' ? (
            // The one thing that surprises people: an invite code is not a way
            // into the game. It is the server's rule, stated before they share
            // it rather than after a friend is turned away.
            <p className={styles.note}>
              Anyone you invite needs to have joined {game.name} in {host.competitionName} before
              they can join the league.
            </p>
          ) : (
            <p className={styles.note}>
              Anyone with the code can join this competition directly — they do not need to have
              joined anything else first.
            </p>
          )}

          {game.setup === 'cup' ? (
            <p className={styles.note}>
              Nothing is drawn yet. You launch it once everyone has joined, and the draw is fixed
              at whatever the field is then.
            </p>
          ) : null}

          {error ? (
            <Alert variant="error" title="That was not created">
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

type LmsSetupFieldsProps = {
  setup: PrivateLmsSetup
  onChange: (setup: PrivateLmsSetup) => void
}

/**
 * The organiser's rules, and only the organiser's.
 *
 * ADR 0013 makes a private competition's rules its organiser's, which is why
 * contract 127 refuses to write the public Classic setup for one. These are the
 * four the server accepts, offered as the ranges `season_lms_setups` already
 * constrains. The calendar is deliberately absent: it comes from the same
 * generator the public competition uses, because a private competition is
 * played over the same real football and a second calendar authority is how two
 * competitions start disagreeing about when a round locks.
 */
function LmsSetupFields({ setup, onChange }: LmsSetupFieldsProps) {
  return (
    <>
      <div className={styles.group} role="group" aria-label="Lives">
        <h3 className={styles.groupTitle}>Lives</h3>
        <p className={styles.only}>How many wrong picks an entrant can survive.</p>
        <div className={styles.chips}>
          {LMS_LIVES_OPTIONS.map((lives) => (
            <button
              key={lives}
              type="button"
              className={`${styles.chip} ${setup.lives === lives ? styles.chipOn : ''}`}
              aria-pressed={setup.lives === lives}
              onClick={() => onChange({ ...setup, lives })}
            >
              {lives === 0 ? 'None' : lives}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group} role="group" aria-label="Saves">
        <h3 className={styles.groupTitle}>Saves</h3>
        <p className={styles.only}>How many times an entrant can change a pick after making it.</p>
        <div className={styles.chips}>
          {LMS_SAVES_OPTIONS.map((saves) => (
            <button
              key={saves}
              type="button"
              className={`${styles.chip} ${setup.saves === saves ? styles.chipOn : ''}`}
              aria-pressed={setup.saves === saves}
              onClick={() => onChange({ ...setup, saves })}
            >
              {saves === 0 ? 'None' : saves}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group} role="group" aria-label="A draw">
        <h3 className={styles.groupTitle}>A draw</h3>
        <div className={styles.chips}>
          {DRAWS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.chip} ${setup.drawsRule === option.value ? styles.chipOn : ''}`}
              aria-pressed={setup.drawsRule === option.value}
              onClick={() => onChange({ ...setup, drawsRule: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group} role="group" aria-label="If everyone goes out">
        <h3 className={styles.groupTitle}>If everyone goes out</h3>
        <p className={styles.only}>
          Every entrant can be eliminated in the same round. A private competition has to say what
          happens then.
        </p>
        <div className={styles.chips}>
          {WIPEOUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.chip} ${
                setup.endgameOnWipeout === option.value ? styles.chipOn : ''
              }`}
              aria-pressed={setup.endgameOnWipeout === option.value}
              onClick={() => onChange({ ...setup, endgameOnWipeout: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

type CreatedStepProps = {
  created: Created
  game: CreateJourneyGame | null
  host: CreateJourneyHost | null
  launchCup: (competitionId: string) => Promise<CupLaunchResult>
  onOpen?: (league: CreatedGameLeague) => void
  onDone: () => void
  headingId: string
}

/**
 * It exists — here is the code, and for a Championship, here is the launch.
 *
 * THE CHAMPIONSHIP WAITING ROOM STARTS HERE. An organiser who has just created
 * one is exactly the person who needs the launch control, and sending them away
 * to find it later would be the dead end this journey exists to remove. It is
 * the same call from either place; contract 111 owns the format and its own
 * idempotence, so pressing it twice is safe and pressing it early is the only
 * thing that cannot be undone — which is why it says so first.
 */
function CreatedStep({
  created,
  game,
  host,
  launchCup,
  onOpen,
  onDone,
  headingId,
}: CreatedStepProps) {
  const [launching, setLaunching] = useState(false)
  const [launch, setLaunch] = useState<CupLaunchResult | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const name = created.kind === 'league' ? created.league.name : created.competition.name
  const code =
    created.kind === 'league' ? created.league.inviteCode : created.competition.inviteCode

  async function doLaunch() {
    if (created.kind !== 'cup') return
    setLaunching(true)
    setLaunchError(null)
    try {
      setLaunch(await launchCup(created.competition.competitionId))
    } catch (thrown) {
      setLaunchError(userFacingError(thrown, 'The competition could not be launched.'))
    } finally {
      setLaunching(false)
    }
  }

  return (
    <section className={styles.journey} aria-labelledby={headingId}>
      <h2 className={styles.title} id={headingId}>
        {name} is ready
      </h2>

      {created.kind === 'league' ? (
        <p className={styles.lead}>
          You are in it. Share the code and anyone who has joined {game?.name} in{' '}
          {host?.competitionName} can join the table.
        </p>
      ) : (
        <p className={styles.lead}>
          You are in it. Share the code — anyone who has it can join directly.
        </p>
      )}

      {created.kind === 'lms' && created.competition.outcome === 'no_schedulable_round' ? (
        // Said plainly rather than hidden behind a success screen: the
        // competition exists and there is no round left in the season to play
        // it over. An organiser inviting friends to nothing is the outcome this
        // sentence prevents.
        <Alert variant="warning" title="There is no round left this season">
          It was created and it has a code, but this season has no matchweek left that a round
          could be played in. It will have nothing to play until a new season opens.
        </Alert>
      ) : null}

      <InvitePanel leagueName={name} code={code} mode="full" />

      {created.kind === 'cup' ? (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Launch it when the field is complete</h3>
          <p className={styles.only}>
            Launching makes the draw and the whole fixture list, and closes the competition to new
            entrants. It cannot be undone, so do it once everyone has joined.
          </p>

          {launch?.outcome === 'launched' ? (
            <Alert variant="success" title="It is drawn">
              {launch.entrants} entrants, {launch.leagueRounds} rounds and {launch.fixtures}{' '}
              fixtures. The competition is closed to new entrants.
            </Alert>
          ) : null}

          {launch?.outcome === 'already_launched' ? (
            <Alert variant="info" title="Already drawn">
              This competition has already been launched.
            </Alert>
          ) : null}

          {launch?.outcome === 'no_viable_format' ? (
            // The field is too small or the calendar too short. Not an error —
            // the organiser can invite more people and press it again.
            <Alert variant="warning" title="Not enough to draw yet">
              There are {launch.entrants} entrants, which is not enough to make a fixture list.
              Invite more players and launch again.
            </Alert>
          ) : null}

          {launch?.outcome === 'refused' || launch?.outcome === 'unknown' ? (
            <Alert variant="warning" title="It was not launched">
              The server did not launch this competition. Nothing has changed.
            </Alert>
          ) : null}

          {launchError ? (
            <Alert variant="error" title="It was not launched">
              {launchError}
            </Alert>
          ) : null}

          {launch?.outcome !== 'launched' && launch?.outcome !== 'already_launched' ? (
            <Button variant="primary" loading={launching} onClick={doLaunch}>
              Launch the Championship
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        {onOpen && created.kind === 'league' ? (
          <Button variant="primary" onClick={() => onOpen(created.league)}>
            Open the league
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </section>
  )
}
