import { useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  GroupTable,
  JokerCounter,
  MatchCard,
  Skeleton,
  TieResolver,
  type MatchTeam,
} from '../../design-system'
import { ChevronLeftIcon, ChevronRightIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildGroupTableRows } from './groupTable'
import { groupContinuation } from './groupContinuation'
import { buildGroupTiePrompt } from './groupTiePrompt'
import { ConflictBanner } from './ConflictBanner'
import { scoreOneMatch } from './matchScoring'
import { venueCountryCode } from './venues'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { formatShortDate, countdownToDate } from '../../app/time'
import s from '../shared.module.css'
import g from './group.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const FINALISE_PATH = '/predict/third-place'

export function GroupPredictorPage() {
  const params = useParams<{ letter: string }>()
  const letter = (params.letter ?? 'A').toUpperCase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cardsRef = useRef<HTMLDivElement>(null)
  const data = useTournamentData()
  const preds = usePredictions()

  const teamsById = useMemo(() => {
    if (data.status !== 'ready') return new Map<string, { name: string }>()
    return new Map(data.data.teams.map((team) => [team.id, team]))
  }, [data])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Group {letter}</h1>
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (data.status !== 'ready' || !preds.ready) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  const group = data.data.groups.find((candidate) => candidate.letter === letter)
  if (!group) {
    return (
      <div className={s.page}>
        <Alert variant="warning" title="Unknown group">
          Group {letter} isn&apos;t part of this tournament.
        </Alert>
      </div>
    )
  }

  const groupTeams = data.data.teams.filter((team) => team.groupId === group.id)
  const groupMatches = data.data.matches
    .filter((match) => match.round === 'group' && match.groupId === group.id)
    .sort(
      (a, b) =>
        (a.matchday ?? 0) - (b.matchday ?? 0) ||
        a.matchRef.localeCompare(b.matchRef),
    )

  const rows = buildGroupTableRows(
    groupTeams,
    groupMatches,
    preds.getPrediction,
    preds.tieResolutions,
  )
  const tiePrompt = buildGroupTiePrompt(
    letter,
    groupTeams,
    groupMatches,
    preds.getPrediction,
    preds.tieResolutions,
  )
  const locked = isEntryLocked(data.data.tournament.lockAt)
  const returnToFinalise = searchParams.get('return') === FINALISE_PATH

  // The primary linear continuation is available only when the group is complete
  // and every same-group tie has an explicit user decision. Arrow navigation stays
  // available for browsing, but it is never mistaken for completion.
  const continuation =
    tiePrompt.complete && tiePrompt.pendingCount === 0
      ? groupContinuation(letter)
      : null

  const index = LETTERS.indexOf(letter)
  const prev = index > 0 ? LETTERS[index - 1] : null
  const next = index < LETTERS.length - 1 ? LETTERS[index + 1] : null

  const teamOf = (id: string | null): MatchTeam => ({
    name: id ? (teamsById.get(id)?.name ?? 'TBC') : 'TBC',
    countryCode: '',
  })

  function reviewScores() {
    cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={s.page}>
      <ConflictBanner />

      {returnToFinalise && (
        <Alert variant="info" title={`Review Group ${letter} scores`}>
          Change any predictions that should affect the standings. Your previous
          manual order is ignored automatically if the tied-team set changes.
        </Alert>
      )}

      <nav className={g.nav} aria-label="Group navigation">
        <button
          type="button"
          className={g.navBtn}
          disabled={!prev}
          aria-label={prev ? `Group ${prev}` : 'No previous group'}
          onClick={() => prev && navigate(`/predict/groups/${prev}`)}
        >
          <ChevronLeftIcon size={20} />
        </button>
        <span className={g.navTitle}>Group {letter}</span>
        <button
          type="button"
          className={g.navBtn}
          disabled={!next}
          aria-label={next ? `Group ${next}` : 'No next group'}
          onClick={() => next && navigate(`/predict/groups/${next}`)}
        >
          <ChevronRightIcon size={20} />
        </button>
      </nav>

      <JokerCounter used={preds.jokerCount} />

      <div ref={cardsRef} className={g.cards}>
        {groupMatches.map((match) => {
          const prediction = preds.getPrediction(match.id)
          // A match with a real result shows the scored card (result hero +
          // points pill, incl. joker variants) regardless of the entry lock.
          const resulted = match.homeScore !== null && match.awayScore !== null
          const matchScore = resulted
            ? scoreOneMatch(prediction, {
                home: match.homeScore as number,
                away: match.awayScore as number,
              })
            : null
          return (
            <MatchCard
              key={match.id}
              state={resulted ? 'scored' : locked ? 'locked' : 'editable'}
              group={letter}
              matchday={match.matchday ?? 1}
              date={formatShortDate(match.matchDate)}
              venue={match.venue}
              venueCountryCode={venueCountryCode(match.venue)}
              home={teamOf(match.homeTeamId)}
              away={teamOf(match.awayTeamId)}
              homeScore={prediction.homeScore}
              awayScore={prediction.awayScore}
              onHomeScoreChange={(value) => preds.setScore(match.id, 'home', value)}
              onAwayScoreChange={(value) => preds.setScore(match.id, 'away', value)}
              saveStatus={preds.getSaveStatus(match.id)}
              onRetrySave={() => preds.retrySave(match.id)}
              countdown={countdownToDate(match.matchDate)}
              result={
                resulted
                  ? {
                      home: match.homeScore as number,
                      away: match.awayScore as number,
                    }
                  : undefined
              }
              score={matchScore ?? undefined}
              jokerState={prediction.joker ? 'on' : 'available'}
              onToggleJoker={() => preds.toggleJoker(match.id)}
              onOpen={() => navigate(`/match/${match.matchRef}`)}
            />
          )
        })}
      </div>

      <div className={g.tableLabel}>Predicted standings</div>
      <GroupTable caption={`Group ${letter} predicted table`} rows={rows} />

      {tiePrompt.ties.length > 0 && (
        <div className={s.stack}>
          <span className={s.eyebrow}>Group decision</span>
          {tiePrompt.ties.map((tie) => (
            <TieResolver
              key={tie.key}
              title={tie.title}
              reason={tie.reason}
              teams={tie.teams}
              resolved={tie.resolved}
              saveStatus={preds.getTieSaveStatus(tie.teams.map((team) => team.id))}
              reviewActions={[
                { label: 'Change scores', onClick: reviewScores },
              ]}
              onResolve={(order) => preds.setTieResolution('group', order)}
            />
          ))}
        </div>
      )}

      <div className={g.continue}>
        {returnToFinalise ? (
          <Button variant="primary" fullWidth onClick={() => navigate(FINALISE_PATH)}>
            Return to Finalise Group Standings
          </Button>
        ) : continuation ? (
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate(continuation.path)}
          >
            {continuation.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
