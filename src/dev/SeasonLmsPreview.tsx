import { useMemo, useState } from 'react'
import { SeasonLmsPage } from '../features/season/SeasonLmsPage'
import { createDevSeasonLmsGateway, type LmsScenario } from './seasonLmsGateway'
import {
  createDevSeasonLmsRegistrationGateway,
  type RegistrationScenario,
} from './seasonLmsRegistrationGateway'
import styles from './SeasonMatchPredictorPreview.module.css'

/**
 * DEV harness for the season Last Man Standing round.
 *
 * Shares the Match Predictor harness's stylesheet rather than copying it: the
 * two are the same object — controls above, dark and light panels below.
 *
 * The scenario that matters most is `drew`. Whether a draw eliminates is a
 * stored rule this surface cannot see, so the correct rendering is "your pick
 * drew" beside "you are still in" — never an elimination. It is a state a real
 * season produces rarely and a reviewer should be able to see on demand.
 */

const SCENARIOS: readonly { id: LmsScenario; label: string; hint: string }[] = [
  { id: 'healthy', label: 'Healthy', hint: 'Open round, no pick yet' },
  { id: 'already_picked', label: 'Picked', hint: 'A pick is in, and can be changed' },
  { id: 'drew', label: 'Drew', hint: 'Pick drew — must NOT read as elimination' },
  { id: 'used_clubs', label: 'Used clubs', hint: 'Consumed clubs shown and disabled' },
  { id: 'locked', label: 'Locked', hint: 'The round locked an hour ago' },
  { id: 'eliminated', label: 'Eliminated', hint: 'Read-only, the server said so' },
  { id: 'not_entered', label: 'Not entered', hint: 'Sees the round, cannot pick' },
  { id: 'not_launched', label: 'Not launched', hint: 'No competition for this season' },
  { id: 'save_refused', label: 'Save refused', hint: 'The server refuses a reused club' },
  { id: 'version_conflict', label: 'Conflict', hint: 'Changed on another device' },
]

/**
 * Registration is a SEPARATE axis rather than more round scenarios, because it
 * is a separate read: the round comes from contract 116 and registration from
 * the games hub, and the pairing that matters most — "not entered" beside an
 * open window — is only reachable by setting the two independently.
 */
const REGISTRATION: readonly { id: RegistrationScenario | 'none'; label: string; hint: string }[] =
  [
    { id: 'none', label: 'No panel', hint: 'Caller supplies no competition' },
    { id: 'open', label: 'Open', hint: 'Joinable, with a deadline' },
    { id: 'open_no_deadline', label: 'Open, no deadline', hint: 'No closing instant recorded' },
    { id: 'not_open', label: 'Not open', hint: 'Registration opens later' },
    { id: 'closed', label: 'Closed', hint: 'Arrived too late — says so' },
    { id: 'finished', label: 'Finished', hint: 'The competition is over' },
    { id: 'entered', label: 'Entered', hint: 'Panel hides; the round states it' },
    { id: 'join_refused', label: 'Join refused', hint: 'Ambiguous 55000 — claims no reason' },
    { id: 'load_failed', label: 'Load failed', hint: 'A failure, not a closed window' },
  ]

export function SeasonLmsPreview() {
  const [scenario, setScenario] = useState<LmsScenario>('healthy')
  const [registration, setRegistration] = useState<RegistrationScenario | 'none'>('open')
  const gateway = useMemo(() => createDevSeasonLmsGateway(scenario), [scenario])
  const registrationGateway = useMemo(
    () =>
      registration === 'none'
        ? undefined
        : createDevSeasonLmsRegistrationGateway(registration),
    [registration],
  )
  const now = useMemo(() => () => new Date(), [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Season Last Man Standing — /dev/season-lms</h1>
        <p className={styles.sub}>
          The contract-116 payload shape, synthetic data. Survival is the server&rsquo;s verdict;
          this surface shows what the pick did and what the player is, separately.
        </p>
      </header>

      <div className={styles.controls}>
        <fieldset className={styles.group}>
          <legend>Scenario</legend>
          {SCENARIOS.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name="scenario"
                checked={scenario === option.id}
                onChange={() => setScenario(option.id)}
              />
              <span>
                {option.label} <em>{option.hint}</em>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Registration</legend>
          {REGISTRATION.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name="registration"
                checked={registration === option.id}
                onChange={() => setRegistration(option.id)}
              />
              <span>
                {option.label} <em>{option.hint}</em>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.themes}>
        <section data-theme="dark" className={styles.panel}>
          <div className={styles.panelTag}>Dark</div>
          <SeasonLmsPage gateway={gateway} now={now} registration={registrationGateway} />
        </section>
        <section data-theme="light" className={styles.panel}>
          <div className={styles.panelTag}>Light</div>
          <SeasonLmsPage gateway={gateway} now={now} registration={registrationGateway} />
        </section>
      </div>
    </div>
  )
}
