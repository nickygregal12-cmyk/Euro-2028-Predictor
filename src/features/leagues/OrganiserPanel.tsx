import { useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from '../../design-system'
import { userFacingError } from '../../shared/errors/userFacingError'
import { InvitePanel } from './InvitePanel'
import type {
  OrganisedCompetition,
  OrganisedCompetitionSummary,
} from '../../services/supabase/organisedCompetitionsModel'
import type { CupLaunchResult } from '../../services/supabase/privateCompetitionsModel'
import type { PrivateCupLaunchReadiness } from '../../services/supabase/privateCompetitionDiscovery'
import styles from './OrganiserPanel.module.css'

/**
 * What an organiser can see about a competition they made.
 *
 * Contract 165 still owns the entrant read and still grants no power over
 * another entrant. Contract 179 adds one different lifecycle ability for a
 * Predictor Championship organiser: return later and launch their own field.
 * Launch readiness is read from the server and never reconstructed here.
 */

export type OrganiserPanelProps = {
  list: () => Promise<readonly OrganisedCompetitionSummary[]>
  open: (competitionId: string) => Promise<OrganisedCompetition | null>
  readCupLaunch?: (competitionId: string) => Promise<PrivateCupLaunchReadiness | null>
  launchCup?: (competitionId: string) => Promise<CupLaunchResult>
  onCompetitionChanged?: () => void
}

type ListState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; competitions: readonly OrganisedCompetitionSummary[] }

export function OrganiserPanel({
  list,
  open,
  readCupLaunch,
  launchCup,
  onCompetitionChanged,
}: OrganiserPanelProps) {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    list()
      .then((competitions) => {
        if (active) setState({ status: 'ready', competitions })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [list])

  if (state.status === 'loading') return <Skeleton lines={3} />

  if (state.status === 'failed') {
    return (
      <Alert variant="warning" title="We could not check what you organise">
        This is a failed read, not an empty list.
      </Alert>
    )
  }

  if (state.competitions.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="organiser-heading">
      <h2 className={styles.heading} id="organiser-heading">
        Competitions you organise
      </h2>
      <ul className={styles.list}>
        {state.competitions.map((competition) => (
          <li key={competition.id} className={styles.item}>
            <button
              type="button"
              className={styles.summary}
              aria-expanded={openId === competition.id}
              onClick={() => setOpenId(openId === competition.id ? null : competition.id)}
            >
              <span className={styles.name}>{competition.name}</span>
              <span className={styles.meta}>
                {competition.seasonName ?? ''}
                {competition.completedAt ? ' · finished' : ''}
                {competition.registrationClosesAt ? ' · closed to new entrants' : ''}
              </span>
            </button>
            {openId === competition.id ? (
              <Detail
                competitionId={competition.id}
                open={open}
                readCupLaunch={readCupLaunch}
                launchCup={launchCup}
                onCompetitionChanged={onCompetitionChanged}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Detail({
  competitionId,
  open,
  readCupLaunch,
  launchCup,
  onCompetitionChanged,
}: {
  competitionId: string
  open: (competitionId: string) => Promise<OrganisedCompetition | null>
  readCupLaunch?: (competitionId: string) => Promise<PrivateCupLaunchReadiness | null>
  launchCup?: (competitionId: string) => Promise<CupLaunchResult>
  onCompetitionChanged?: () => void
}) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'failed' } | { status: 'ready'; view: OrganisedCompetition | null }
  >({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    open(competitionId)
      .then((view) => {
        if (active) setState({ status: 'ready', view })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [competitionId, open])

  if (state.status === 'loading') return <Skeleton lines={3} />
  if (state.status === 'failed') {
    return (
      <Alert variant="warning" title="We could not open this competition">
        Try again in a moment.
      </Alert>
    )
  }
  if (!state.view) {
    return (
      <Alert variant="warning" title="You do not organise this competition">
        Only its organiser can see its entrants.
      </Alert>
    )
  }

  const { view } = state

  return (
    <div className={styles.detail}>
      {view.competition.inviteCode ? (
        <InvitePanel
          leagueName={view.competition.name}
          code={view.competition.inviteCode}
          mode="full"
        />
      ) : null}

      {view.competition.gameKey === 'predictor_cup' && readCupLaunch && launchCup ? (
        <CupLaunchControl
          competitionId={competitionId}
          read={readCupLaunch}
          launch={launchCup}
          onChanged={onCompetitionChanged}
        />
      ) : null}

      <p className={styles.counts}>
        {view.counts.entrants} {view.counts.entrants === 1 ? 'entrant' : 'entrants'} ·{' '}
        {view.counts.remaining} still in · {view.counts.eliminated} out
        {view.counts.left > 0 ? ` · ${view.counts.left} left` : ''}
        {view.currentRound && view.counts.awaitingPick !== null
          ? ` · ${view.counts.awaitingPick} yet to pick`
          : ''}
      </p>

      <ul className={styles.entrants}>
        {view.entrants.map((entrant) => (
          <li key={entrant.userId} className={styles.entrant}>
            <span className={styles.entrantName}>{entrant.displayName}</span>
            <span className={styles.entrantState}>
              {entrant.stillIn ? 'Still in' : 'Eliminated'}
              {entrant.hasPickedCurrentRound === true ? ' · picked' : ''}
              {entrant.hasPickedCurrentRound === false ? ' · not picked yet' : ''}
              {entrant.membershipStatus && entrant.membershipStatus !== 'active'
                ? ` · ${entrant.membershipStatus}`
                : ''}
            </span>
          </li>
        ))}
      </ul>

      {view.organiserCommandsAvailable.length === 0 ? (
        <p className={styles.note}>
          You can see who is in and who has picked. You cannot see what anyone picked before the
          round locks, and you cannot remove an entrant — organising a competition is not authority
          over the people in it.
        </p>
      ) : (
        <ul className={styles.commands}>
          {view.organiserCommandsAvailable.map((command) => (
            <li key={command}>{command}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

type LaunchState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; readiness: PrivateCupLaunchReadiness | null }

function CupLaunchControl({
  competitionId,
  read,
  launch,
  onChanged,
}: {
  competitionId: string
  read: (competitionId: string) => Promise<PrivateCupLaunchReadiness | null>
  launch: (competitionId: string) => Promise<CupLaunchResult>
  onChanged?: () => void
}) {
  const [state, setState] = useState<LaunchState>({ status: 'loading' })
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    read(competitionId)
      .then((readiness) => {
        if (active) setState({ status: 'ready', readiness })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [competitionId, read])

  async function doLaunch() {
    setLaunching(true)
    setLaunchError(null)
    try {
      const result = await launch(competitionId)
      if (result.outcome === 'launched' || result.outcome === 'already_launched') {
        setState({ status: 'ready', readiness: await read(competitionId) })
        onChanged?.()
        return
      }
      if (result.outcome === 'no_viable_format') {
        setLaunchError(result.reason ?? 'The field is not launchable yet.')
      } else if (result.outcome === 'refused') {
        setLaunchError(result.reason ?? 'The server refused to launch this Championship.')
      } else {
        setLaunchError(result.reason ?? 'The launch result was not recognised by this build.')
      }
    } catch (thrown) {
      setLaunchError(userFacingError(thrown, 'The competition could not be launched.'))
    } finally {
      setLaunching(false)
    }
  }

  if (state.status === 'loading') return <Skeleton lines={2} />
  if (state.status === 'failed') {
    return (
      <Alert variant="warning" title="We could not check launch readiness">
        The Championship has not been changed. Try opening it again.
      </Alert>
    )
  }

  const readiness = state.readiness
  if (!readiness) return null

  if (readiness.launched) {
    return (
      <Alert variant="success" title="Championship launched">
        The field is fixed and registration is closed.
      </Alert>
    )
  }

  return (
    <div className={styles.detail}>
      <h3>Launch the Championship</h3>
      <p className={styles.note}>
        {readiness.entrants} {readiness.entrants === 1 ? 'entrant' : 'entrants'} currently in the
        field. Launching fixes the draw and closes registration to new entrants. It cannot be undone.
      </p>

      {!readiness.canLaunch ? (
        <p className={styles.note}>{launchBlocker(readiness)}</p>
      ) : (
        <Button variant="primary" loading={launching} onClick={() => void doLaunch()}>
          Launch the Championship
        </Button>
      )}

      {launchError ? (
        <Alert variant="error" title="The Championship was not launched">
          {launchError}
        </Alert>
      ) : null}
    </div>
  )
}

function launchBlocker(readiness: PrivateCupLaunchReadiness): string {
  switch (readiness.blockedReason) {
    case 'field_needs_administered_draw':
      return 'This field is large enough to need an administrator-managed draw.'
    case 'already_completed':
      return 'This Championship has already finished.'
    case 'already_launched':
      return 'This Championship has already been launched.'
    case 'not_the_organiser':
      return 'Only the organiser can launch this Championship.'
    case 'no_viable_format':
      return 'The field or remaining calendar is not large enough for a viable format yet.'
    default:
      return readiness.remainingRounds > 0
        ? 'The server says this Championship is not ready to launch yet.'
        : 'There are no remaining matchweeks available for a Championship draw.'
  }
}
