import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react'
import { Alert, Button, ConfirmModal, EmptyState } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import {
  clearAdminMatchResult,
  confirmAdminMatchResult,
  correctAdminMatchResult,
  fetchAdminMatchResultRevisions,
  fetchAdminMatchResults,
  type AdminMatchResult,
  type AdminResultMethod,
  type AdminResultMutation,
  type AdminResultRevision,
} from '../../services/supabase/adminResults'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  formValuesFromResult,
  validateAdminResultForm,
  type AdminResultAction,
  type AdminResultFormErrors,
  type AdminResultFormValues,
} from './adminResultForm'
import s from '../shared.module.css'
import a from './admin.module.css'

type ResultLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; results: AdminMatchResult[] }

type PendingReview = {
  action: AdminResultAction
  mutation: AdminResultMutation | null
  reason: string
}

const ACTION_LABEL: Record<AdminResultAction, string> = {
  confirm: 'Confirm result',
  correct: 'Correct result',
  clear: 'Clear result',
}

const METHOD_LABEL: Record<AdminResultMethod, string> = {
  regulation: 'Regulation',
  extra_time: 'Extra time',
  penalties: 'Penalties',
}

function resultStatus(result: AdminMatchResult | null): string {
  if (!result || result.state === 'scheduled') return 'Awaiting result'
  if (result.state === 'corrected') return `Corrected · revision ${result.version}`
  return `Confirmed · revision ${result.version}`
}

function snapshotText(snapshot: Record<string, unknown>): string {
  if (snapshot.state === 'scheduled') return 'Scheduled'
  const home90 = snapshot.home90
  const away90 = snapshot.away90
  const method = snapshot.method
  if (typeof home90 !== 'number' || typeof away90 !== 'number') return 'No result'

  if (method === 'penalties') {
    return `${home90}–${away90} after 90 · ${String(snapshot.home120)}–${String(snapshot.away120)} after 120 · ${String(snapshot.homePenalties)}–${String(snapshot.awayPenalties)} pens`
  }
  if (method === 'extra_time') {
    return `${home90}–${away90} after 90 · ${String(snapshot.home120)}–${String(snapshot.away120)} after 120`
  }
  return `${home90}–${away90} after 90`
}

function formatRecordedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function ScoreField({
  label,
  field,
  values,
  errors,
  disabled,
  onChange,
}: {
  label: string
  field:
    | 'home90'
    | 'away90'
    | 'home120'
    | 'away120'
    | 'homePenalties'
    | 'awayPenalties'
  values: AdminResultFormValues
  errors: AdminResultFormErrors
  disabled: boolean
  onChange: (field: keyof AdminResultFormValues, value: string) => void
}) {
  return (
    <label className={a.scoreField}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        max="99"
        step="1"
        value={values[field]}
        disabled={disabled}
        aria-invalid={Boolean(errors[field]) || undefined}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {errors[field] ? <small role="alert">{errors[field]}</small> : null}
    </label>
  )
}

export function AdminResultsPage() {
  const tournament = useTournamentData()
  const [loadState, setLoadState] = useState<ResultLoadState>({
    status: 'loading',
  })
  const [refreshToken, setRefreshToken] = useState(0)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [action, setAction] = useState<AdminResultAction>('confirm')
  const [values, setValues] = useState<AdminResultFormValues>(() =>
    formValuesFromResult(null),
  )
  const [errors, setErrors] = useState<AdminResultFormErrors>({})
  const [revisions, setRevisions] = useState<AdminResultRevision[]>([])
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{
    variant: 'success' | 'error'
    message: string
  } | null>(null)

  const tournamentId =
    tournament.status === 'ready' ? tournament.data.tournament.id : null

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setLoadState((current) =>
      current.status === 'ready' ? current : { status: 'loading' },
    )
    fetchAdminMatchResults(tournamentId)
      .then((results) => {
        if (!active) return
        setLoadState({ status: 'ready', results })
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadState({
          status: 'error',
          message: userFacingError(
            error,
            'Could not load the authoritative result state. Try again.',
          ),
        })
      })
    return () => {
      active = false
    }
  }, [tournamentId, refreshToken])

  const resultByMatchId = useMemo(() => {
    if (loadState.status !== 'ready') return new Map<string, AdminMatchResult>()
    return new Map(loadState.results.map((result) => [result.matchId, result]))
  }, [loadState])

  const matches = tournament.status === 'ready' ? tournament.data.matches : []
  const teams = tournament.status === 'ready' ? tournament.data.teams : []
  const teamNameById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  )

  useEffect(() => {
    if (
      matches.length > 0 &&
      (!selectedMatchId || !matches.some((match) => match.id === selectedMatchId))
    ) {
      const firstAwaiting = matches.find(
        (match) => resultByMatchId.get(match.id)?.state === 'scheduled',
      )
      setSelectedMatchId((firstAwaiting ?? matches[0]).id)
    }
  }, [matches, resultByMatchId, selectedMatchId])

  const selectedMatch =
    matches.find((match) => match.id === selectedMatchId) ?? null
  const selectedResult = selectedMatchId
    ? resultByMatchId.get(selectedMatchId) ?? null
    : null

  useEffect(() => {
    if (!selectedMatch) return
    const nextAction =
      !selectedResult || selectedResult.state === 'scheduled'
        ? 'confirm'
        : 'correct'
    setAction(nextAction)
    setValues(formValuesFromResult(selectedResult))
    setErrors({})
  }, [
    selectedMatch?.id,
    selectedMatch?.round,
    selectedResult?.state,
    selectedResult?.version,
  ])

  useEffect(() => {
    if (!selectedMatchId) {
      setRevisions([])
      return
    }
    let active = true
    setRevisionLoading(true)
    setRevisionError(null)
    fetchAdminMatchResultRevisions(selectedMatchId)
      .then((rows) => {
        if (!active) return
        setRevisions(rows)
        setRevisionLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setRevisions([])
        setRevisionLoading(false)
        setRevisionError(
          userFacingError(error, 'Could not load result revision history.'),
        )
      })
    return () => {
      active = false
    }
  }, [selectedMatchId, refreshToken, selectedResult?.version])

  const summary = useMemo(() => {
    const results = [...resultByMatchId.values()]
    return {
      total: matches.length,
      confirmed: results.filter((result) => result.state !== 'scheduled').length,
      awaiting: matches.filter(
        (match) => resultByMatchId.get(match.id)?.state === 'scheduled',
      ).length,
    }
  }, [matches, resultByMatchId])

  const teamLabel = useCallback(
    (teamId: string | null, source: string) =>
      (teamId ? teamNameById.get(teamId) : null) ?? source,
    [teamNameById],
  )

  function updateValue(field: keyof AdminResultFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }))
  }

  function changeMethod(event: ChangeEvent<HTMLSelectElement>) {
    const method = event.target.value as AdminResultMethod
    setValues((current) => ({
      ...current,
      method,
      ...(method === 'regulation'
        ? {
            home120: '',
            away120: '',
            homePenalties: '',
            awayPenalties: '',
          }
        : method === 'extra_time'
          ? { homePenalties: '', awayPenalties: '' }
          : {}),
    }))
    setErrors({})
  }

  function chooseAction(nextAction: AdminResultAction) {
    setAction(nextAction)
    setErrors({})
    setNotice(null)
    if (selectedMatch) {
      setValues(formValuesFromResult(selectedResult))
    }
  }

  function reviewMutation() {
    if (!selectedMatch) return
    const parsed = validateAdminResultForm({
      action,
      matchId: selectedMatch.id,
      round: selectedMatch.round,
      values,
    })
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setPendingReview({
      action,
      mutation: parsed.mutation,
      reason: parsed.reason,
    })
  }

  async function applyMutation() {
    if (!pendingReview || !selectedMatch) return
    setSubmitting(true)
    setNotice(null)
    try {
      if (pendingReview.action === 'clear') {
        await clearAdminMatchResult(selectedMatch.id, pendingReview.reason)
      } else if (pendingReview.action === 'correct') {
        await correctAdminMatchResult(pendingReview.mutation as AdminResultMutation)
      } else {
        await confirmAdminMatchResult(pendingReview.mutation as AdminResultMutation)
      }
      setPendingReview(null)
      setNotice({
        variant: 'success',
        message: `${ACTION_LABEL[pendingReview.action]} saved. Scores and revision history have been refreshed.`,
      })
      setRefreshToken((token) => token + 1)
      tournament.reload()
    } catch (error: unknown) {
      setPendingReview(null)
      setNotice({
        variant: 'error',
        message: userFacingError(
          error,
          `Could not ${pendingReview.action} this result. Nothing was changed.`,
        ),
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (tournament.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Couldn’t load result administration"
          description={tournament.message}
        />
      </div>
    )
  }

  if (tournament.status !== 'ready') return <div className={s.page} />

  if (loadState.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Couldn’t load authoritative results"
          description={loadState.message}
        />
      </div>
    )
  }

  const resultIds = new Set(
    loadState.status === 'ready'
      ? loadState.results.map((result) => result.matchId)
      : [],
  )
  const completeResultContract =
    loadState.status === 'ready' &&
    resultIds.size === matches.length &&
    matches.every((match) => resultIds.has(match.id))

  if (loadState.status === 'ready' && !completeResultContract) {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Result administration is incomplete"
          description="The authoritative result query did not return every tournament fixture. No result controls are available."
        />
      </div>
    )
  }

  const homeName = selectedMatch
    ? teamLabel(selectedMatch.homeTeamId, selectedMatch.homeSource)
    : ''
  const awayName = selectedMatch
    ? teamLabel(selectedMatch.awayTeamId, selectedMatch.awaySource)
    : ''
  const participantsResolved = Boolean(
    selectedMatch?.homeTeamId && selectedMatch?.awayTeamId,
  )
  const isGroup = selectedMatch?.round === 'group'
  const show120 =
    action !== 'clear' &&
    !isGroup &&
    (values.method === 'extra_time' || values.method === 'penalties')
  const showPenalties =
    action !== 'clear' && !isGroup && values.method === 'penalties'
  const reviewTitle = pendingReview
    ? `Review: ${ACTION_LABEL[pendingReview.action]}`
    : 'Review result'

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Admin control room</span>
        <h1 className={s.title}>Results Centre</h1>
        <p className={a.intro}>
          Confirm official results, correct mistakes and clear invalid results.
          Every write is reviewed first and recorded in the immutable revision
          history.
        </p>
      </div>

      <div className={a.summaryGrid} aria-label="Result status summary">
        <div className={s.card}>
          <span className={s.eyebrow}>Fixtures</span>
          <strong className={a.metric}>{summary.total}</strong>
        </div>
        <div className={s.card}>
          <span className={s.eyebrow}>Confirmed</span>
          <strong className={a.metric}>{summary.confirmed}</strong>
        </div>
        <div className={s.card}>
          <span className={s.eyebrow}>Awaiting result</span>
          <strong className={a.metric}>{summary.awaiting}</strong>
        </div>
      </div>

      {notice ? <Alert variant={notice.variant}>{notice.message}</Alert> : null}

      <div className={a.resultsWorkspace}>
        <section className={`${s.card} ${a.queueCard}`} aria-labelledby="fixture-queue-heading">
          <div className={a.sectionHeading}>
            <div>
              <span className={s.eyebrow}>Tournament</span>
              <h2 id="fixture-queue-heading" className={a.sectionTitle}>
                Fixture queue
              </h2>
            </div>
            <span className={a.count}>{matches.length}</span>
          </div>
          <div className={a.fixtureList}>
            {matches.map((match) => {
              const result = resultByMatchId.get(match.id) ?? null
              const selected = match.id === selectedMatchId
              return (
                <button
                  key={match.id}
                  type="button"
                  className={selected ? a.fixtureButtonSelected : a.fixtureButton}
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedMatchId(match.id)
                    setNotice(null)
                  }}
                >
                  <span>
                    <strong>{match.matchRef}</strong>
                    <small>
                      {teamLabel(match.homeTeamId, match.homeSource)} v{' '}
                      {teamLabel(match.awayTeamId, match.awaySource)}
                    </small>
                  </span>
                  <span className={a.fixtureStatus}>
                    {resultStatus(result)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <div className={a.editorStack}>
          {selectedMatch ? (
            <section className={s.card} aria-labelledby="result-editor-heading">
              <div className={a.editorHeading}>
                <div>
                  <span className={s.eyebrow}>
                    {selectedMatch.matchRef} · {selectedMatch.round.toUpperCase()}
                  </span>
                  <h2 id="result-editor-heading" className={a.fixtureTitle}>
                    {homeName} <span>v</span> {awayName}
                  </h2>
                </div>
                <span
                  className={
                    selectedResult?.state === 'scheduled'
                      ? a.stateAwaiting
                      : a.stateConfirmed
                  }
                >
                  {resultStatus(selectedResult)}
                </span>
              </div>

              {!participantsResolved ? (
                <Alert variant="warning">
                  The participants are unresolved. A result cannot be entered
                  until both authoritative team IDs are populated.
                </Alert>
              ) : null}

              {selectedResult?.state !== 'scheduled' ? (
                <div className={a.actionTabs} role="group" aria-label="Result action">
                  <button
                    type="button"
                    aria-pressed={action === 'correct'}
                    onClick={() => chooseAction('correct')}
                  >
                    Correct
                  </button>
                  <button
                    type="button"
                    aria-pressed={action === 'clear'}
                    onClick={() => chooseAction('clear')}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              {action !== 'clear' ? (
                <>
                  <label className={a.selectField}>
                    <span>Result method</span>
                    <select
                      value={isGroup ? 'regulation' : values.method}
                      disabled={isGroup || submitting}
                      onChange={changeMethod}
                    >
                      <option value="regulation">Regulation</option>
                      <option value="extra_time">Extra time</option>
                      <option value="penalties">Penalties</option>
                    </select>
                  </label>

                  <fieldset className={a.scoreGroup}>
                    <legend>90-minute score</legend>
                    <div className={a.scoreGrid}>
                      <ScoreField
                        label={homeName}
                        field="home90"
                        values={values}
                        errors={errors}
                        disabled={submitting}
                        onChange={updateValue}
                      />
                      <ScoreField
                        label={awayName}
                        field="away90"
                        values={values}
                        errors={errors}
                        disabled={submitting}
                        onChange={updateValue}
                      />
                    </div>
                  </fieldset>

                  {show120 ? (
                    <fieldset className={a.scoreGroup}>
                      <legend>120-minute score</legend>
                      <div className={a.scoreGrid}>
                        <ScoreField
                          label={homeName}
                          field="home120"
                          values={values}
                          errors={errors}
                          disabled={submitting}
                          onChange={updateValue}
                        />
                        <ScoreField
                          label={awayName}
                          field="away120"
                          values={values}
                          errors={errors}
                          disabled={submitting}
                          onChange={updateValue}
                        />
                      </div>
                    </fieldset>
                  ) : null}

                  {showPenalties ? (
                    <fieldset className={a.scoreGroup}>
                      <legend>Penalty shootout</legend>
                      <div className={a.scoreGrid}>
                        <ScoreField
                          label={homeName}
                          field="homePenalties"
                          values={values}
                          errors={errors}
                          disabled={submitting}
                          onChange={updateValue}
                        />
                        <ScoreField
                          label={awayName}
                          field="awayPenalties"
                          values={values}
                          errors={errors}
                          disabled={submitting}
                          onChange={updateValue}
                        />
                      </div>
                    </fieldset>
                  ) : null}
                </>
              ) : (
                <Alert variant="warning">
                  Clearing returns this fixture to “Awaiting result” and
                  recomputes tournament scores. The revision remains visible.
                </Alert>
              )}

              <label className={a.reasonField}>
                <span>
                  {action === 'confirm' ? 'Confirmation note (optional)' : 'Reason'}
                </span>
                <textarea
                  rows={3}
                  value={values.reason}
                  disabled={submitting}
                  aria-invalid={Boolean(errors.reason) || undefined}
                  onChange={(event) => updateValue('reason', event.target.value)}
                />
                {errors.reason ? <small role="alert">{errors.reason}</small> : null}
              </label>

              {errors.form ? <Alert variant="error">{errors.form}</Alert> : null}

              <Button
                variant={action === 'clear' ? 'destructive' : 'primary'}
                fullWidth
                disabled={
                  !participantsResolved ||
                  loadState.status === 'loading' ||
                  revisionLoading ||
                  Boolean(revisionError)
                }
                onClick={reviewMutation}
              >
                Review {ACTION_LABEL[action].toLowerCase()}
              </Button>
            </section>
          ) : null}

          <section className={s.card} aria-labelledby="revision-history-heading">
            <div className={a.sectionHeading}>
              <div>
                <span className={s.eyebrow}>Audit trail</span>
                <h2 id="revision-history-heading" className={a.sectionTitle}>
                  Revision history
                </h2>
              </div>
              <span className={a.count}>{revisions.length}</span>
            </div>
            {revisionError ? <Alert variant="error">{revisionError}</Alert> : null}
            {revisionLoading ? (
              <p className={a.emptyHistory} role="status">
                Loading revision history…
              </p>
            ) : revisions.length === 0 && !revisionError ? (
              <p className={a.emptyHistory}>No result revisions yet.</p>
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
                      {snapshotText(revision.previousResult)} →{' '}
                      {snapshotText(revision.newResult)}
                    </p>
                    {revision.reason ? (
                      <blockquote>{revision.reason}</blockquote>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingReview)}
        onClose={() => {
          if (!submitting) setPendingReview(null)
        }}
        onConfirm={applyMutation}
        title={reviewTitle}
        confirmLabel={pendingReview ? ACTION_LABEL[pendingReview.action] : 'Confirm'}
        destructive={pendingReview?.action === 'clear'}
        loading={submitting}
      >
        {pendingReview && selectedMatch ? (
          <div className={a.reviewSummary}>
            <p>
              <strong>{selectedMatch.matchRef}</strong> · {homeName} v {awayName}
            </p>
            {pendingReview.mutation ? (
              <dl>
                <div>
                  <dt>Method</dt>
                  <dd>{METHOD_LABEL[pendingReview.mutation.method]}</dd>
                </div>
                <div>
                  <dt>90 minutes</dt>
                  <dd>
                    {pendingReview.mutation.home90}–{pendingReview.mutation.away90}
                  </dd>
                </div>
                {pendingReview.mutation.home120 !== null ? (
                  <div>
                    <dt>120 minutes</dt>
                    <dd>
                      {pendingReview.mutation.home120}–
                      {pendingReview.mutation.away120}
                    </dd>
                  </div>
                ) : null}
                {pendingReview.mutation.homePenalties !== null ? (
                  <div>
                    <dt>Penalties</dt>
                    <dd>
                      {pendingReview.mutation.homePenalties}–
                      {pendingReview.mutation.awayPenalties}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p>
                This will remove the current authoritative result and recompute
                tournament scores.
              </p>
            )}
            {pendingReview.reason ? (
              <p>
                <strong>Reason:</strong> {pendingReview.reason}
              </p>
            ) : null}
            <Alert variant="warning">
              This action writes the authoritative result and may change scores,
              ranks and knockout progression.
            </Alert>
          </div>
        ) : null}
      </ConfirmModal>
    </div>
  )
}
