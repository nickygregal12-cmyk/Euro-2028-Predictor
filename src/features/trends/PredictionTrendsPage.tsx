import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ChevronLeftIcon, LockIcon, TrophyIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import {
  fetchConsensusPlayers,
  fetchPredictionConsensus,
  type ConsensusPlayer,
} from '../../services/supabase/predictionConsensus'
import type {
  PredictionConsensus,
  UniqueConsensusPick,
} from '../../services/supabase/predictionConsensusModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import t from './trends.module.css'

type ReadyState = {
  consensus: PredictionConsensus
  players: ConsensusPlayer[]
}

type State =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ReadyState }

function percent(picks: number, total: number): number {
  return total > 0 ? Math.round((picks / total) * 100) : 0
}

export function PredictionTrendsPage() {
  const navigate = useNavigate()
  const tournament = useTournamentData()
  const tournamentId = tournament.status === 'ready' ? tournament.data.tournament.id : null
  const locked = tournament.status === 'ready' && isEntryLocked(tournament.data.tournament.lockAt)
  const [state, setState] = useState<State>({ status: 'idle' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!tournamentId || !locked) {
      setState({ status: 'idle' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    void fetchPredictionConsensus(tournamentId)
      .then(async (consensus) => {
        const players = await fetchConsensusPlayers(
          consensus.goldenBoot.map((pick) => pick.playerId),
        ).catch(() => [])
        if (active) setState({ status: 'ready', data: { consensus, players } })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(error, 'Could not load prediction trends. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [locked, reloadKey, tournamentId])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/predict')}>
        <ChevronLeftIcon size={16} /> My entry
      </button>
      <span className={s.eyebrow}>After the lock</span>
      <h1 className={s.title}>Prediction trends</h1>
      <p className={s.sub}>See the crowd view without revealing anyone else's full entry.</p>
    </div>
  )

  if (tournament.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load the tournament">{tournament.message}</Alert>
      </div>
    )
  }

  if (tournament.status !== 'ready') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}><Skeleton lines={5} /></div>
        <div className={s.card}><Skeleton lines={4} /></div>
      </div>
    )
  }

  if (!locked) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<LockIcon size={28} />}
          title="Trends unlock at kickoff"
          description="Everyone's predictions stay private until the Original Predictor locks. Your own entry remains editable until then."
          action={<Button onClick={() => navigate('/predict')}>Return to your entry</Button>}
        />
      </div>
    )
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}><Skeleton lines={5} /></div>
        <div className={s.card}><Skeleton lines={6} /></div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load prediction trends">
          {state.message}
          <div className={t.actionRow}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>
          </div>
        </Alert>
      </div>
    )
  }

  const { consensus, players } = state.data
  if (consensus.submittedEntries === 0) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<TrophyIcon size={28} />}
          title="No submitted entries yet"
          description="The crowd view will appear as soon as locked, submitted entries are available."
        />
      </div>
    )
  }

  return (
    <TrendsContent
      consensus={consensus}
      players={players}
      teams={tournament.data.teams}
      matches={tournament.data.matches}
      header={header}
    />
  )
}

function TrendsContent({
  consensus,
  players,
  teams,
  matches,
  header,
}: {
  consensus: PredictionConsensus
  players: ConsensusPlayer[]
  teams: { id: string; name: string }[]
  matches: { id: string; matchRef: string; homeTeamId: string | null; awayTeamId: string | null }[]
  header: React.ReactNode
}) {
  const teamName = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams])
  const playerName = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players])
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches])
  const topChampion = consensus.championRace[0]?.picks ?? 1
  const maxGoalEntries = Math.max(1, ...consensus.goalsSpread.distribution.map((point) => point.entries))

  const matchLabel = (matchId: string, fallback: string) => {
    const match = matchById.get(matchId)
    if (!match) return fallback
    return `${match.homeTeamId ? (teamName.get(match.homeTeamId) ?? 'TBC') : 'TBC'} v ${
      match.awayTeamId ? (teamName.get(match.awayTeamId) ?? 'TBC') : 'TBC'
    }`
  }

  return (
    <div className={s.page}>
      {header}

      <div className={t.summaryStrip} aria-label="Consensus sample">
        <strong>{consensus.submittedEntries}</strong>
        <span>locked {consensus.submittedEntries === 1 ? 'entry' : 'entries'} in this view</span>
      </div>

      <section className={s.card} aria-labelledby="champion-race-heading">
        <div>
          <span className={s.eyebrow}>The headline</span>
          <h2 id="champion-race-heading" className={t.sectionTitle}>Champion race</h2>
        </div>
        <div className={t.rankedList}>
          {consensus.championRace.slice(0, 6).map((pick, index) => (
            <div key={pick.teamId} className={t.rankedRow}>
              <span className={t.rank}>{index + 1}</span>
              <span className={t.label}>{teamName.get(pick.teamId) ?? 'Team TBC'}</span>
              <span className={t.barTrack} aria-hidden="true">
                <span className={t.bar} style={{ width: `${Math.max(8, (pick.picks / topChampion) * 100)}%` }} />
              </span>
              <strong className={t.value}>{percent(pick.picks, consensus.submittedEntries)}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={t.signalGrid} aria-label="Prediction signals">
        <SignalCard
          eyebrow="Most agreed"
          title={consensus.mostAgreedMatch ? matchLabel(consensus.mostAgreedMatch.matchId, consensus.mostAgreedMatch.matchRef) : 'Not enough data'}
          value={consensus.mostAgreedMatch ? `${percent(consensus.mostAgreedMatch.dominantPicks, consensus.mostAgreedMatch.predictions)}% backed the leading outcome` : '—'}
        />
        <SignalCard
          eyebrow="Most divided"
          title={consensus.mostDividedMatch ? matchLabel(consensus.mostDividedMatch.matchId, consensus.mostDividedMatch.matchRef) : 'Not enough data'}
          value={consensus.mostDividedMatch ? `${consensus.mostDividedMatch.topTwoGap} pick gap between the top two outcomes` : '—'}
        />
        <SignalCard
          eyebrow="Most trusted"
          title={consensus.mostTrustedTeam ? (teamName.get(consensus.mostTrustedTeam.teamId) ?? 'Team TBC') : 'Not enough data'}
          value={consensus.mostTrustedTeam ? `${consensus.mostTrustedTeam.predictedWins} predicted group wins` : '—'}
        />
      </section>

      <section className={s.card} aria-labelledby="peoples-final-heading">
        <div>
          <span className={s.eyebrow}>Knockout picture</span>
          <h2 id="peoples-final-heading" className={t.sectionTitle}>The people's final</h2>
        </div>
        {consensus.peoplesFinal.length > 0 ? (
          <ol className={t.simpleList}>
            {consensus.peoplesFinal.slice(0, 5).map((pick) => (
              <li key={`${pick.teamAId}-${pick.teamBId}`}>
                <span>{teamName.get(pick.teamAId) ?? 'TBC'} v {teamName.get(pick.teamBId) ?? 'TBC'}</span>
                <strong>{percent(pick.picks, consensus.submittedEntries)}%</strong>
              </li>
            ))}
          </ol>
        ) : <p className={s.sub}>No complete predicted finals are available.</p>}
      </section>

      <section className={s.card} aria-labelledby="boot-heading">
        <div>
          <span className={s.eyebrow}>Awards</span>
          <h2 id="boot-heading" className={t.sectionTitle}>Golden Boot picks</h2>
        </div>
        {consensus.goldenBoot.length > 0 ? (
          <ol className={t.simpleList}>
            {consensus.goldenBoot.slice(0, 5).map((pick) => (
              <li key={pick.playerId}>
                <span>{playerName.get(pick.playerId) ?? 'Official squad player'}</span>
                <strong>{percent(pick.picks, consensus.submittedEntries)}%</strong>
              </li>
            ))}
          </ol>
        ) : <p className={s.sub}>No Golden Boot selections are available.</p>}
      </section>

      <section className={s.card} aria-labelledby="goals-heading">
        <div>
          <span className={s.eyebrow}>Group-stage goals</span>
          <h2 id="goals-heading" className={t.sectionTitle}>How bold was the field?</h2>
        </div>
        <div className={t.goalStats}>
          <span><strong>{consensus.goalsSpread.minimum ?? '—'}</strong>Low</span>
          <span><strong>{consensus.goalsSpread.median ?? '—'}</strong>Median</span>
          <span><strong>{consensus.goalsSpread.average ?? '—'}</strong>Average</span>
          <span><strong>{consensus.goalsSpread.maximum ?? '—'}</strong>High</span>
        </div>
        <div className={t.distribution} aria-label="Predicted group-stage goal totals">
          {consensus.goalsSpread.distribution.map((point) => (
            <div key={point.totalGoals} className={t.distributionRow}>
              <span>{point.totalGoals}</span>
              <span className={t.goalTrack} aria-hidden="true">
                <span className={t.goalBar} style={{ width: `${Math.max(5, (point.entries / maxGoalEntries) * 100)}%` } as CSSProperties} />
              </span>
              <strong>{point.entries}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={s.card} aria-labelledby="only-you-heading">
        <div>
          <span className={s.eyebrow}>Your entry</span>
          <h2 id="only-you-heading" className={t.sectionTitle}>Only you called it</h2>
        </div>
        {consensus.onlyYou.length > 0 ? (
          <ul className={t.uniqueList}>
            {consensus.onlyYou.map((pick, index) => (
              <li key={`${pick.kind}-${index}`}>{uniquePickLabel(pick, teamName, playerName)}</li>
            ))}
          </ul>
        ) : (
          <p className={s.sub}>Your headline picks were shared by at least one other submitted entry.</p>
        )}
      </section>
    </div>
  )
}

function SignalCard({ eyebrow, title, value }: { eyebrow: string; title: string; value: string }) {
  return (
    <article className={t.signalCard}>
      <span className={s.eyebrow}>{eyebrow}</span>
      <h2 className={t.signalTitle}>{title}</h2>
      <p>{value}</p>
    </article>
  )
}

function uniquePickLabel(
  pick: UniqueConsensusPick,
  teams: Map<string, string>,
  players: Map<string, string>,
): string {
  switch (pick.kind) {
    case 'champion':
      return `${teams.get(pick.teamId) ?? 'Team TBC'} as champion`
    case 'final':
      return `${teams.get(pick.teamAId) ?? 'TBC'} v ${teams.get(pick.teamBId) ?? 'TBC'} as the final`
    case 'golden_boot':
      return `${players.get(pick.playerId) ?? 'An official squad player'} for the Golden Boot`
    case 'exact_score':
      return `${pick.matchRef}: ${pick.homeScore}–${pick.awayScore}`
  }
}
