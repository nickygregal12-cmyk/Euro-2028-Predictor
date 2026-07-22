import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  GroupTable,
  JokerCounter,
  MatchCard,
  Skeleton,
  type MatchTeam,
} from '../../design-system'
import { ChevronLeftIcon, ChevronRightIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildGroupTableRows } from './groupTable'
import { isGroupComplete, groupContinuation } from './groupContinuation'
import { ConflictBanner } from './ConflictBanner'
import { scoreOneMatch } from './matchScoring'
import { venueCountryCode } from './venues'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { formatShortDate, countdownToDate } from '../../app/time'
import s from '../shared.module.css'
import g from './group.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function GroupPredictorPage() {
  const params = useParams<{ letter: string }>()
  const letter = (params.letter ?? 'A').toUpperCase()
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()

  const teamsById = useMemo(() => {
    if (data.status !== 'ready') return new Map<string, { name: string }>()
    return new Map(data.data.teams.map((t) => [t.id, t]))
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

  const group = data.data.groups.find((gr) => gr.letter === letter)
  if (!group) {
    return (
      <div className={s.page}>
        <Alert variant="warning" title="Unknown group">
          Group {letter} isn&apos;t part of this tournament.
        </Alert>
      </div>
    )
  }

  const groupTeams = data.data.teams.filter((t) => t.groupId === group.id)
  const groupMatches = data.data.matches
    .filter((m) => m.round === 'group' && m.groupId === group.id)
    .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0) || a.matchRef.localeCompare(b.matchRef))

  const rows = buildGroupTableRows(groupTeams, groupMatches, preds.getPrediction)
  const locked = isEntryLocked(data.data.tournament.lockAt)

  // Continuation CTA: once every match in this group has a predicted score, offer
  // the next stage of the linear entry flow (A–E → next group, F → best thirds).
  // Shown in every state as pure navigation — browsing continuity costs nothing.
  const continuation = isGroupComplete(groupMatches, preds.getPrediction)
    ? groupContinuation(letter)
    : null

  const index = LETTERS.indexOf(letter)
  const prev = index > 0 ? LETTERS[index - 1] : null
  const next = index < LETTERS.length - 1 ? LETTERS[index + 1] : null

  const teamOf = (id: string | null): MatchTeam => ({
    name: id ? (teamsById.get(id)?.name ?? 'TBC') : 'TBC',
    countryCode: '',
  })

  return (
    <div className={s.page}>
      <ConflictBanner />
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

      <div className={g.cards}>
        {groupMatches.map((m) => {
          const pred = preds.getPrediction(m.id)
          // A match with a real result shows the scored card (result hero +
          // points pill, incl. joker variants) regardless of the entry lock —
          // results only arrive after kickoff. Points come from the domain
          // scorer, the same rules as the stored score_events.
          const resulted = m.homeScore !== null && m.awayScore !== null
          const matchScore = resulted
            ? scoreOneMatch(pred, { home: m.homeScore as number, away: m.awayScore as number })
            : null
          return (
            <MatchCard
              key={m.id}
              state={resulted ? 'scored' : locked ? 'locked' : 'editable'}
              group={letter}
              matchday={m.matchday ?? 1}
              date={formatShortDate(m.matchDate)}
              venue={m.venue}
              venueCountryCode={venueCountryCode(m.venue)}
              home={teamOf(m.homeTeamId)}
              away={teamOf(m.awayTeamId)}
              homeScore={pred.homeScore}
              awayScore={pred.awayScore}
              onHomeScoreChange={(v) => preds.setScore(m.id, 'home', v)}
              onAwayScoreChange={(v) => preds.setScore(m.id, 'away', v)}
              saveStatus={preds.getSaveStatus(m.id)}
              onRetrySave={() => preds.retrySave(m.id)}
              countdown={countdownToDate(m.matchDate)}
              result={resulted ? { home: m.homeScore as number, away: m.awayScore as number } : undefined}
              score={matchScore ?? undefined}
              // Jokers stay actionable on locked cards until each match's own
              // kickoff (design-system §5 / scoring §1) — the entry lock freezes
              // scores, not joker moves.
              jokerState={pred.joker ? 'on' : 'available'}
              onToggleJoker={() => preds.toggleJoker(m.id)}
              // Chevron → the per-fixture match centre (enabled now that it ships).
              onOpen={() => navigate(`/match/${m.matchRef}`)}
            />
          )
        })}
      </div>

      <div className={g.tableLabel}>Predicted standings</div>
      <GroupTable caption={`Group ${letter} predicted table`} rows={rows} />

      {continuation && (
        <div className={g.continue}>
          <Button variant="primary" fullWidth onClick={() => navigate(continuation.path)}>
            {continuation.label}
          </Button>
        </div>
      )}
    </div>
  )
}
