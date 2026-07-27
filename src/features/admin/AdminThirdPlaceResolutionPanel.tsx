import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, ConfirmModal } from '../../design-system'
import {
  clearActualThirdPlaceTie,
  fetchActualThirdPlaceResolutionRevisions,
  fetchActualThirdPlaceResolutionStatus,
  resolveActualThirdPlaceTie,
  type ActualThirdPlaceResolutionRevision,
  type ActualThirdPlaceResolutionStatus,
  type ActualThirdPlaceResolutionTeam,
} from '../../services/supabase/adminThirdPlaceResolution'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import a from './admin.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      workflow: ActualThirdPlaceResolutionStatus
      revisions: ActualThirdPlaceResolutionRevision[]
    }

type PendingAction = 'resolve' | 'clear'

function formatRecordedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function orderedIds(snapshot: Record<string, unknown>): string[] {
  const value = snapshot.orderedTeamIds
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function orderLabel(
  snapshot: Record<string, unknown>,
  teamNames: Map<string, string>,
): string {
  const ids = orderedIds(snapshot)
  if (ids.length === 0) return 'No active order'
  return ids.map((id) => teamNames.get(id) ?? id).join(' → ')
}

function statsLabel(team: ActualThirdPlaceResolutionTeam): string {
  const gd = team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference
  return `${team.points} pts · GD ${gd} · GF ${team.goalsFor} · ${team.wins} win${team.wins === 1 ? '' : 's'}`
}

export function AdminThirdPlaceResolutionPanel({
  tournamentId,
  onChanged,
}: {
  tournamentId: string
  onChanged: () => void
}) {
  const [refreshToken, setRefreshToken] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [order, setOrder] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{
    variant: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    let active = true
    setLoadState({ status: 'loading' })
    Promise.all([
      fetchActualThirdPlaceResolutionStatus(tournamentId),
      fetchActualThirdPlaceResolutionRevisions(tournamentId),
    ])
      .then(([workflow, revisions]) => {
        if (!active) return
        setLoadState({ status: 'ready', workflow, revisions })
        setOrder(
          workflow.orderedTeamIds.length === workflow.teams.length
            ? workflow.orderedTeamIds
            : workflow.teams.map((team) => team.teamId),
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadState({
          status: 'error',
          message: userFacingError(
            error,
            'Could not load the actual third-place resolution workflow.',
          ),
        })
      })

    return () => {
      active = false
    }
  }, [tournamentId, refreshToken])

  const workflow = loadState.status === 'ready' ? loadState.workflow : null
  const revisions = loadState.status === 'ready' ? loadState.revisions : []
  const teamById = useMemo(
    () => new Map((workflow?.teams ?? []).map((team) => [team.teamId, team])),
    [workflow?.teams],
  )
  const teamNames = useMemo(
    () => new Map((workflow?.teams ?? []).map((team) => [team.teamId, team.teamName])),
    [workflow?.teams],
  )

  const orderedTeams = order.flatMap((id) => {
    const team = teamById.get(id)
    return team ? [team] : []
  })

  function move(teamId: string, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(teamId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
    setNotice(null)
  }

  function review(action: PendingAction) {
    const trimmed = reason.trim()
    if (trimmed.length < 5 || trimmed.length > 500) {
      setReasonError('Enter a reason between 5 and 500 characters.')
      return
    }
    if (
      action === 'resolve' &&
      (!workflow || order.length !== workflow.teams.length || orderedTeams.length !== workflow.teams.length)
    ) {
      setNotice({
        variant: 'error',
        message: 'The exact tied team set must be ordered before review.',
      })
      return
    }
    setReasonError(null)
    setPendingAction(action)
  }

  async function applyAction() {
    if (!pendingAction || !workflow) return
    setSubmitting(true)
    setNotice(null)
    try {
      if (pendingAction === 'clear') {
        await clearActualThirdPlaceTie({ tournamentId, reason })
      } else {
        await resolveActualThirdPlaceTie({
          tournamentId,
          orderedTeamIds: order,
          reason,
        })
      }
      const actionLabel =
        pendingAction === 'clear'
          ? 'Resolution cleared'
          : workflow.state === 'resolved'
            ? 'Resolution corrected'
            : 'Resolution saved'
      setPendingAction(null)
      setReason('')
      setNotice({
        variant: 'success',
        message: `${actionLabel}. The actual Round of 16 and audit history have been refreshed.`,
      })
      setRefreshToken((token) => token + 1)
      onChanged()
    } catch (error: unknown) {
      setPendingAction(null)
      setNotice({
        variant: 'error',
        message: userFacingError(
          error,
          'Could not change the third-place resolution. Nothing was changed.',
        ),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={s.card} aria-labelledby="third-place-resolution-heading">
      <div className={a.sectionHeading}>
        <div>
          <span className={s.eyebrow}>Qualification control</span>
          <h2 id="third-place-resolution-heading" className={a.sectionTitle}>
            Best third-place boundary
          </h2>
        </div>
        {workflow?.version ? <span className={a.count}>Revision {workflow.version}</span> : null}
      </div>

      <p className={a.fixtureMeta}>
        The database resolves ordinary ranking criteria automatically. This control
        appears only when an exact tie still crosses the fourth-place qualification
        boundary.
      </p>

      {notice ? <Alert variant={notice.variant}>{notice.message}</Alert> : null}

      {loadState.status === 'loading' ? (
        <p className={a.emptyHistory} role="status">
          Checking actual third-place qualification…
        </p>
      ) : loadState.status === 'error' ? (
        <Alert variant="error">{loadState.message}</Alert>
      ) : workflow?.state === 'not_ready' ? (
        <Alert variant="warning">
          {workflow.message ??
            'Complete and resolve all six group tables before ranking third-placed teams.'}
        </Alert>
      ) : workflow?.state === 'clear' ? (
        <Alert variant="success">
          {workflow.message ??
            'No actual third-place tie crosses the qualification boundary.'}
        </Alert>
      ) : workflow ? (
        <div className={a.tieResolutionBody}>
          <Alert variant={workflow.state === 'resolved' ? 'success' : 'warning'}>
            {workflow.state === 'resolved'
              ? `The current official order is active. ${workflow.qualifyingPlaces} of these ${workflow.blockSize} teams qualify.`
              : `An official order is required. ${workflow.qualifyingPlaces} of these ${workflow.blockSize} teams qualify.`}
          </Alert>

          <ol className={a.tieOrderList} aria-label="Official third-place tie order">
            {orderedTeams.map((team, index) => {
              const qualifies = index < (workflow.qualifyingPlaces ?? 0)
              return (
                <li key={team.teamId}>
                  <span className={a.tiePosition}>{index + 1}</span>
                  <span className={a.tieTeam}>
                    <strong>{team.teamName}</strong>
                    <small>
                      Group {team.groupLetter} · {statsLabel(team)}
                    </small>
                  </span>
                  <span className={qualifies ? a.tieQualifies : a.tieMisses}>
                    {qualifies ? 'Qualifies' : 'Misses out'}
                  </span>
                  <span className={a.tieControls}>
                    <button
                      type="button"
                      disabled={index === 0 || submitting}
                      aria-label={`Move ${team.teamName} up`}
                      onClick={() => move(team.teamId, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === orderedTeams.length - 1 || submitting}
                      aria-label={`Move ${team.teamName} down`}
                      onClick={() => move(team.teamId, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>

          <label className={a.reasonField}>
            <span>
              {workflow.state === 'resolved' ? 'Correction or clear reason' : 'Resolution reason'}
            </span>
            <textarea
              rows={3}
              value={reason}
              disabled={submitting}
              aria-invalid={Boolean(reasonError) || undefined}
              onChange={(event) => {
                setReason(event.target.value)
                setReasonError(null)
                setNotice(null)
              }}
            />
            {reasonError ? <small role="alert">{reasonError}</small> : null}
          </label>

          <div className={a.tieActions}>
            <Button
              variant="primary"
              fullWidth
              disabled={submitting}
              onClick={() => review('resolve')}
            >
              Review {workflow.state === 'resolved' ? 'correction' : 'resolution'}
            </Button>
            {workflow.state === 'resolved' ? (
              <Button
                variant="destructive"
                fullWidth
                disabled={submitting}
                onClick={() => review('clear')}
              >
                Review clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={a.tieHistory}>
        <div className={a.sectionHeading}>
          <div>
            <span className={s.eyebrow}>Audit trail</span>
            <h3 className={a.tieHistoryTitle}>Qualification revisions</h3>
          </div>
          <span className={a.count}>{revisions.length}</span>
        </div>
        {revisions.length === 0 ? (
          <p className={a.emptyHistory}>No qualification revisions yet.</p>
        ) : (
          <ol className={a.revisionList}>
            {revisions.map((revision) => (
              <li key={revision.revision}>
                <div className={a.revisionHeading}>
                  <strong>
                    Revision {revision.revision} · {revision.action}
                  </strong>
                  <time dateTime={revision.recordedAt}>
                    {formatRecordedAt(revision.recordedAt)}
                  </time>
                </div>
                <p>
                  {orderLabel(revision.previousResolution, teamNames)} →{' '}
                  {orderLabel(revision.newResolution, teamNames)}
                </p>
                <blockquote>{revision.reason}</blockquote>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ConfirmModal
        open={Boolean(pendingAction)}
        onClose={() => {
          if (!submitting) setPendingAction(null)
        }}
        onConfirm={applyAction}
        title={
          pendingAction === 'clear'
            ? 'Review: Clear third-place order'
            : workflow?.state === 'resolved'
              ? 'Review: Correct third-place order'
              : 'Review: Resolve third-place order'
        }
        confirmLabel={pendingAction === 'clear' ? 'Clear resolution' : 'Save official order'}
        destructive={pendingAction === 'clear'}
        loading={submitting}
      >
        {pendingAction && workflow ? (
          <div className={a.reviewSummary}>
            {pendingAction === 'clear' ? (
              <p>
                This removes the active official order and returns the actual Round
                of 16 to unresolved until a new decision is saved.
              </p>
            ) : (
              <dl>
                {orderedTeams.map((team, index) => (
                  <div key={team.teamId}>
                    <dt>{index + 1}</dt>
                    <dd>
                      {team.teamName}
                      {index < (workflow.qualifyingPlaces ?? 0) ? ' · qualifies' : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <p>
              <strong>Reason:</strong> {reason.trim()}
            </p>
            <Alert variant="warning">
              The decision replays the actual Round of 16. It will fail without
              changing anything if a played knockout fixture would be rewritten.
            </Alert>
          </div>
        ) : null}
      </ConfirmModal>
    </section>
  )
}
