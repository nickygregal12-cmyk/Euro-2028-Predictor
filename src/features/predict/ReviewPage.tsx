import { useEffect, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, ConfirmModal, Skeleton, TeamFlag } from '../../design-system'
import {
  AlertIcon,
  BallIcon,
  CardsIcon,
  CheckIcon,
  LockIcon,
  TrophyIcon,
  type IconProps,
} from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { computeHubStatus } from './hubStatus'
import { buildBracketPipeline } from '../bracket/bracketPipeline'
import { ChampionCard } from '../bracket'
import { sumGroupGoals } from '../../domain/tournament/groupGoals'
import {
  GOLDEN_BOOT_POINTS,
  TOTAL_GOALS_BANDS,
} from '../../domain/tournament/scoringConfig'
import { GoldenBootPicker, type GoldenBootPlayer } from './GoldenBootPicker'
import { searchPlayers } from '../../services/supabase/bonus'
import { daysUntil, formatLongDate } from '../../app/time'
import s from '../shared.module.css'
import r from './review.module.css'
import a from './awards.module.css'

const GOALS_MAX_POINTS = TOTAL_GOALS_BANDS[0].points // 40 (exact)
const SQUADS_PENDING =
  'Player search available once squads are confirmed — closer to the tournament.'

type CheckState = 'done' | 'attention' | 'todo'

export function ReviewPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()

  // Golden-boot search state (hooks must run before any early return).
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GoldenBootPlayer[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<GoldenBootPlayer | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  useEffect(() => {
    const q = query.trim()
    if (!q || !tournamentId) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchPlayers(tournamentId, q)
        .then((players) =>
          setResults(players.map((p) => ({ id: p.id, name: p.name }))),
        )
        .catch(() => setResults([])) // squads/table not present yet → empty
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, tournamentId])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Review and submit</h1>
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (data.status !== 'ready' || !preds.ready) {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <h1 className={s.title}>Review and submit</h1>
        </div>
        <div className={s.card}>
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  const status = computeHubStatus(
    data.data,
    preds.getPrediction,
    preds.jokerCount,
    preds.tieResolutions,
    preds.bracketProgression,
  )
  const bracket = buildBracketPipeline(
    data.data,
    preds.getPrediction,
    preds.tieResolutions,
    preds.bracketProgression,
  )

  const groupMatches = data.data.matches.filter((m) => m.round === 'group')
  const goals = sumGroupGoals(groupMatches.map((m) => preds.getPrediction(m.id)))

  const startsOn = data.data.tournament.startsOn
  const days = startsOn ? daysUntil(startsOn) : null
  const deadlineText = startsOn ? formatLongDate(startsOn) : 'tournament kickoff'

  // --- Checklist rows (one source of truth: the hub status pipeline) ---
  type Row = {
    label: string
    Icon: ComponentType<IconProps>
    state: CheckState
    detail: string
    route: string
    blocker: boolean
  }
  const rows: Row[] = [
    {
      label: 'Groups A–F',
      Icon: BallIcon,
      state: status.groups.complete ? 'done' : 'todo',
      detail: `${status.groups.predicted} of ${status.groups.total} matches predicted`,
      route: '/predict/groups/A',
      blocker: !status.groups.complete,
    },
    {
      label: 'Best third-placed teams',
      Icon: TrophyIcon,
      state:
        status.thirdPlace.state === 'settled'
          ? 'done'
          : status.thirdPlace.state === 'ties'
            ? 'attention'
            : 'todo',
      detail:
        status.thirdPlace.state === 'settled'
          ? 'Settled'
          : status.thirdPlace.state === 'ties'
            ? `${status.thirdPlace.tieCount} tie${status.thirdPlace.tieCount === 1 ? '' : 's'} need your call`
            : 'Predict all groups first',
      route: '/predict/third-place',
      blocker: status.thirdPlace.state !== 'settled',
    },
    {
      label: 'Knockout bracket',
      Icon: TrophyIcon,
      state: status.bracket.picked === status.bracket.total ? 'done' : 'todo',
      detail: `${status.bracket.picked} of ${status.bracket.total} winners picked`,
      route: '/predict/bracket',
      blocker: status.bracket.picked !== status.bracket.total,
    },
    {
      label: 'Jokers',
      Icon: CardsIcon,
      state: status.jokers.placed === status.jokers.total ? 'done' : 'todo',
      detail: `${status.jokers.placed} of ${status.jokers.total} placed · optional`,
      route: '/predict/jokers',
      blocker: false, // jokers are optional — never block submission
    },
  ]
  const blockers = rows.filter((row) => row.blocker).length
  const submitted = preds.submittedAt !== null

  const finalTie = bracket.rounds.find((round) => round.key === 'FINAL')?.ties[0]

  function chooseGoldenBoot(player: GoldenBootPlayer) {
    setSelected(player)
    setQuery('')
    setResults([])
    preds.setGoldenBoot(player.id)
  }

  function clearGoldenBoot() {
    setSelected(null)
    preds.setGoldenBoot(null)
  }

  async function doSubmit() {
    setSubmitError(null)
    const result = await preds.submit()
    setConfirmOpen(false)
    if (!result.ok) setSubmitError(result.message ?? 'Submission failed. Please try again.')
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Predict</span>
        <h1 className={s.title}>Review and submit</h1>
      </div>
      <div className={r.blocked}>
        <LockIcon size={13} className={r.iconMuted} />
        <span className={s.sub}>
          {days !== null && days > 0
            ? `Locks at kickoff — in ${days} day${days === 1 ? '' : 's'} (${deadlineText})`
            : `Locks at kickoff (${deadlineText})`}
        </span>
      </div>

      {/* 1. Checklist */}
      <div className={s.card}>
        <span className={s.eyebrow}>Your entry</span>
        <div className={r.checklist}>
          {rows.map((row) => (
            <div key={row.label} className={r.checkRow}>
              <span className={r.checkIcon}>
                <CheckRowIcon state={row.state} Base={row.Icon} />
              </span>
              <span className={r.checkBody}>
                <span className={r.checkTitle}>{row.label}</span>
                <span
                  className={`${r.checkDetail} ${row.state === 'attention' ? r.checkDetailAttention : ''}`}
                >
                  {row.detail}
                </span>
              </span>
              {row.blocker && (
                <button type="button" className={r.fix} onClick={() => navigate(row.route)}>
                  Fix ›
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Your tournament */}
      {bracket.champion && (
        <div className={s.card}>
          <div className={r.eyebrowRow}>
            <span className={s.eyebrow}>Your tournament</span>
            <button type="button" className={r.rowLink} onClick={() => navigate('/predict/bracket')}>
              Full bracket ›
            </button>
          </div>
          <ChampionCard name={bracket.champion.name} countryCode={bracket.champion.countryCode} />
          {finalTie && finalTie.home.kind === 'team' && finalTie.away.kind === 'team' && (
            <div className={r.finalLine}>
              <span className={r.finalTeam}>
                <TeamFlag countryCode={finalTie.home.countryCode} label={finalTie.home.name} size="venue" />
                {finalTie.home.name}
              </span>
              <span className={r.finalV}>v</span>
              <span className={r.finalTeam}>
                {finalTie.away.name}
                <TeamFlag countryCode={finalTie.away.countryCode} label={finalTie.away.name} size="venue" />
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. Awards */}
      <div className={s.card}>
        <span className={s.eyebrow}>Awards</span>
        <GoldenBootPicker
          points={GOLDEN_BOOT_POINTS}
          query={query}
          onQueryChange={setQuery}
          results={results}
          selected={selected}
          onSelect={chooseGoldenBoot}
          onClear={clearGoldenBoot}
          emptyNote={SQUADS_PENDING}
          loading={searching}
        />
        <div className={a.goals}>
          <div className={a.goalsTop}>
            <span className={s.sub}>Group-stage goals</span>
            <span className={a.points}>up to {GOALS_MAX_POINTS} pts</span>
          </div>
          <span className={a.goalsNum}>{goals.total}</span>
          <span className={a.goalsCaption}>Calculated from your 36 predicted scores</span>
        </div>
      </div>

      {/* 4. Submit / submitted */}
      {submitError && (
        <Alert variant="error" title="Couldn't submit">
          {submitError}
        </Alert>
      )}

      {submitted ? (
        <div className={r.banner}>
          <span className={r.bannerHead}>
            <CheckIcon size={18} className={r.bannerIcon} /> Entry submitted
          </span>
          <p className={r.bannerSub}>
            You&apos;re in. Editable until {deadlineText} — change anything up to kickoff and it saves
            automatically; your entry stays submitted.
          </p>
          <Button variant="secondary" onClick={() => {}} disabled>
            Share (coming soon)
          </Button>
        </div>
      ) : blockers > 0 ? (
        <div>
          <Button variant="primary" fullWidth disabled>
            <span className={r.blocked}>
              <LockIcon size={15} /> Fix {blockers} item{blockers === 1 ? '' : 's'} to submit
            </span>
          </Button>
          <p className={r.submitCaption}>Complete the checklist above to submit.</p>
        </div>
      ) : (
        <div>
          <Button
            variant="primary"
            fullWidth
            loading={preds.submitting}
            onClick={() => setConfirmOpen(true)}
          >
            Submit entry
          </Button>
          <p className={r.submitCaption}>
            You can still edit everything after submitting, right up to kickoff.
          </p>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
        title="Submit your entry?"
        confirmLabel="Submit entry"
        cancelLabel="Not yet"
        loading={preds.submitting}
      >
        You&apos;re about to submit your predictions. You can still edit them right up to kickoff —
        submitting just locks you in as ready.
      </ConfirmModal>
    </div>
  )
}

function CheckRowIcon({ state, Base }: { state: CheckState; Base: ComponentType<IconProps> }) {
  if (state === 'done') return <CheckIcon size={17} className={r.iconDone} />
  if (state === 'attention') return <AlertIcon size={17} className={r.iconAttention} />
  return <Base size={17} className={r.iconMuted} />
}
