import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, StatusBadge } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { useAuth } from '../auth/AuthProvider'
import { fetchMyCup, submitCupPenaltyNumber } from '../../services/supabase/cup'
import type {
  CupDecidedBy,
  CupFixtureResult,
  CupRead,
} from '../../services/supabase/cupModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import g from './games.module.css'

function formatInstant(instant: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(instant))
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; read: CupRead }

const RESULT_COPY: Record<CupFixtureResult, string> = {
  win: 'Won',
  draw: 'Drawn',
  loss: 'Lost',
  walkover_win: 'Won W/O',
  walkover_loss: 'Lost W/O',
  void: 'Void',
}

const DECIDER_COPY: Record<CupDecidedBy, string> = {
  points: '',
  extra_time: ' (AET)',
  penalty_number: ' (P)',
  walkover: ' (W/O)',
  admin_walkover: ' (W/O)',
}

const QUALIFICATION_COPY = {
  winner: 'Group winner',
  runner_up: 'Runner-up',
  wildcard: 'Wildcard',
} as const

function roundName(roundSize: number | null, stage: 'playoff' | 'knockout'): string {
  if (stage === 'playoff') return 'Playoff'
  if (roundSize === 2) return 'Final'
  if (roundSize === 4) return 'Semi-finals'
  if (roundSize === 8) return 'Quarter-finals'
  return roundSize ? `Round of ${roundSize}` : 'Knockout'
}

export function CupPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!tournamentId) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    fetchMyCup(tournamentId)
      .then((read) => {
        if (active) setState({ status: 'ready', read })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'The Predictor Cup is unavailable. Please try again.',
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, reloadKey, tournamentId])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/games')}>
        <ChevronLeftIcon size={16} /> Games
      </button>
      <h1 className={s.title}>Predictor Cup</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn’t load the Predictor Cup">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  const read = state.read

  if (!read.entrant) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          title="You haven’t entered the Predictor Cup"
          description="Enter from the Games hub before the field closes. Your predictions become head-to-head cup ties against other players."
          action={<Button onClick={() => navigate('/games')}>Open the Games hub</Button>}
        />
      </div>
    )
  }

  if (!read.drawCompletedAt) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          title="Waiting for the draw"
          description={
            read.registrationClosesAt
              ? `The field (${read.entrantCount} so far) closes ${formatInstant(read.registrationClosesAt)}. The transparent random draw follows, and your group appears here.`
              : `${read.entrantCount} entrants so far. The draw follows once the field closes, and your group appears here.`
          }
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      {header}

      {read.champion ? (
        <Alert
          variant="success"
          title={
            read.champion.userId === userId
              ? 'You are the Predictor Cup Champion!'
              : `${read.champion.displayName} is the Predictor Cup Champion`
          }
        >
          The Cup is complete. The Golden Predictor award below recognises the
          highest cumulative prediction points, regardless of elimination.
        </Alert>
      ) : null}

      {read.myMember?.qualifiedAs ? (
        <Alert
          variant="success"
          title={`${QUALIFICATION_COPY[read.myMember.qualifiedAs]} — seed ${read.myMember.seed ?? '—'}`}
        >
          You qualified for the knockout bracket
          {read.myMember.groupPosition
            ? ` after finishing ${read.myMember.groupPosition}${read.myMember.groupPosition === 1 ? 'st' : read.myMember.groupPosition === 2 ? 'nd' : read.myMember.groupPosition === 3 ? 'rd' : 'th'} in your group`
            : ''}
          .
        </Alert>
      ) : read.myMember?.groupPosition && read.entrant.outcome === 'eliminated' ? (
        <Alert variant="info" title="Eliminated at the group stage">
          You finished {read.myMember.groupPosition}
          {read.myMember.groupPosition === 3 ? 'rd' : 'th'} in your group. Your
          other games and the Original Predictor continue as normal.
        </Alert>
      ) : null}

      {read.penaltyNumber ? (
        <PenaltyNumberCard
          competitionId={read.competitionId}
          penalty={read.penaltyNumber}
          onSaved={() => setReloadKey((key) => key + 1)}
        />
      ) : null}

      {read.myGroup ? (
        <section className={`${s.card} ${g.gameCard}`}>
          <div className={g.gameHeader}>
            <h2 className={g.gameName}>Group {read.myGroup.ordinal}</h2>
            <StatusBadge variant="submitted" label={`${read.myGroup.size} players`} />
          </div>
          <p className={g.tagline}>
            {read.groupCount} groups · {read.entrantCount} players. Win 3 · draw 1 ·
            loss 0 on prediction-point totals per matchday.
          </p>
          {read.myGroup.standings.length > 0 ? (
            <table className={g.standingsTable}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Player</th>
                  <th scope="col">P</th>
                  <th scope="col">W</th>
                  <th scope="col">D</th>
                  <th scope="col">L</th>
                  <th scope="col">PF</th>
                  <th scope="col">PA</th>
                  <th scope="col">Pts</th>
                </tr>
              </thead>
              <tbody>
                {read.myGroup.standings.map((row) => (
                  <tr key={row.userId} className={row.userId === userId ? g.ownRow : undefined}>
                    <td>{row.position}</td>
                    <td>
                      {row.displayName}
                      {row.userId === userId ? ' (you)' : ''}
                    </td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.draws}</td>
                    <td>{row.losses}</td>
                    <td>{row.pointsFor}</td>
                    <td>{row.pointsAgainst}</td>
                    <td>{row.tablePoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            read.myGroup.members.map((member) => (
              <p key={member.userId} className={g.stateLine}>
                #{member.drawNumber} {member.displayName}
              </p>
            ))
          )}
        </section>
      ) : (
        <Alert variant="error" title="No group assigned">
          The draw is complete but you have no group — contact the admin.
        </Alert>
      )}

      <section className={`${s.card} ${g.gameCard}`}>
        <h2 className={g.gameName}>Your ties</h2>
        {read.myFixtures.length === 0 ? (
          <p className={g.tagline}>No ties scheduled yet.</p>
        ) : (
          read.myFixtures.map((fixture) => (
            <div key={fixture.fixtureId}>
              <p className={g.stateLine}>
                {fixture.stage === 'group'
                  ? `${fixture.windowLabel}${fixture.matchday ? ` (Matchday ${fixture.matchday})` : ''}`
                  : `${roundName(fixture.roundSize, fixture.stage)} · ${fixture.windowLabel}`}{' '}
                — you{' '}
                {fixture.myPoints !== null && fixture.opponentPoints !== null
                  ? `${fixture.myPoints}–${fixture.opponentPoints} `
                  : 'vs '}
                <strong>{fixture.opponent.displayName}</strong>
                {fixture.result ? ` — ${RESULT_COPY[fixture.result]}` : ''}
                {fixture.decidedBy ? DECIDER_COPY[fixture.decidedBy] : ''}
              </p>
              {fixture.status === 'pending' && fixture.windowLocksAt ? (
                <p className={g.deadline}>
                  Predictions lock {formatInstant(fixture.windowLocksAt)}
                </p>
              ) : null}
            </div>
          ))
        )}
        <p className={g.deadline}>
          Group scorelines come from your Original Predictor entry; knockout
          scorelines from the shared knockout form (no jokers, regulation time
          only).
        </p>
      </section>

      {read.bracket && read.bracket.length > 0 ? (
        <section className={`${s.card} ${g.gameCard}`}>
          <h2 className={g.gameName}>Knockout bracket</h2>
          {read.bracket.map((tie) => (
            <p
              key={`${tie.windowSequence}-${tie.bracketSlot}`}
              className={g.stateLine}
            >
              {roundName(tie.roundSize, tie.stage)} {tie.bracketSlot}:{' '}
              <strong>{tie.home.displayName}</strong> v{' '}
              <strong>{tie.away.displayName}</strong>
              {tie.winnerUserId
                ? ` — ${
                    tie.winnerUserId === tie.home.userId
                      ? tie.home.displayName
                      : tie.away.displayName
                  } through${tie.decidedBy ? DECIDER_COPY[tie.decidedBy] : ''}`
                : ` — ${tie.windowLabel}`}
            </p>
          ))}
        </section>
      ) : null}

      {read.goldenPredictor ? (
        <section className={`${s.card} ${g.gameCard}`}>
          <h2 className={g.gameName}>Golden Predictor</h2>
          <p className={g.tagline}>
            Highest cumulative Cup prediction points across every designated
            match — elimination never stops the count.
          </p>
          {read.goldenPredictor.top.map((row) => (
            <p
              key={row.userId}
              className={row.userId === userId ? `${g.stateLine} ${g.ownRow}` : g.stateLine}
            >
              {row.rank}. {row.displayName}
              {row.userId === userId ? ' (you)' : ''} — {row.points} pts
            </p>
          ))}
          {read.goldenPredictor.me &&
          !read.goldenPredictor.top.some((row) => row.userId === userId) ? (
            <p className={g.deadline}>
              Your position: {read.goldenPredictor.me.rank} (
              {read.goldenPredictor.me.points} pts)
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function PenaltyNumberCard(props: {
  competitionId: string
  penalty: NonNullable<CupRead['penaltyNumber']>
  onSaved: () => void
}) {
  const { competitionId, penalty } = props
  const [draft, setDraft] = useState(
    penalty.value === null ? '' : String(penalty.value),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parity = penalty.lane === 'odd' ? 1 : 0
  const parsed = /^\d{1,2}$/.test(draft) ? Number(draft) : null
  const valid = parsed !== null && parsed % 2 === parity

  const save = () => {
    if (!valid || parsed === null) return
    setSaving(true)
    setError(null)
    submitCupPenaltyNumber(competitionId, penalty.windowId, parsed, penalty.version)
      .then(() => props.onSaved())
      .catch((cause) => {
        setError(
          userFacingError(
            cause,
            'Your Penalty Number could not be saved. Please try again.',
          ),
        )
      })
      .finally(() => setSaving(false))
  }

  return (
    <section className={`${s.card} ${g.gameCard}`}>
      <div className={g.gameHeader}>
        <h2 className={g.gameName}>Penalty Number — {penalty.windowLabel}</h2>
        {penalty.value !== null ? (
          <StatusBadge variant="submitted" label={`Saved: ${penalty.value}`} />
        ) : (
          <StatusBadge variant="live" label="Required" />
        )}
      </div>
      <p className={g.tagline}>
        Predict the total regulation-time goals across this round’s real
        matches. Your lane is <strong>{penalty.lane.toUpperCase()}</strong> —
        {penalty.lane === 'odd'
          ? ' an odd number from 1 to 99.'
          : ' an even number from 0 to 98.'}{' '}
        Opposite lanes mean the decider can never tie. It stays hidden from
        your opponent until the round locks.
      </p>
      {penalty.locked ? (
        <p className={g.deadline}>
          Locked at the round’s first kickoff
          {penalty.value === null ? ' — no number was saved.' : '.'}
        </p>
      ) : (
        <>
          <div className={g.gameHeader}>
            <input
              className={g.penaltyInput}
              type="number"
              inputMode="numeric"
              min={parity}
              max={parity === 1 ? 99 : 98}
              step={2}
              value={draft}
              aria-label={`Penalty Number (${penalty.lane} lane)`}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button onClick={save} disabled={!valid || saving}>
              {saving ? 'Saving…' : 'Save number'}
            </Button>
          </div>
          {draft !== '' && !valid ? (
            <p className={g.deadline}>
              Pick {penalty.lane === 'odd' ? 'an odd' : 'an even'} whole number
              in range.
            </p>
          ) : null}
          {penalty.locksAt ? (
            <p className={g.deadline}>Locks {formatInstant(penalty.locksAt)}</p>
          ) : null}
          {error ? (
            <Alert variant="error" title="Couldn’t save your Penalty Number">
              {error}
            </Alert>
          ) : null}
        </>
      )}
    </section>
  )
}
