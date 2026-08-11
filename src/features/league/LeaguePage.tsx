import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { GlobeIcon, ChevronRightIcon, PlusIcon, UsersIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { fetchLeaderboardPage } from '../../services/supabase/leaderboard'
import { fetchMyLeagues, type LeagueSummary } from '../../services/supabase/leagues'
import { MyLeagueCard } from '../leagues/MyLeagueCard'
import { CreateLeagueModal } from '../leagues/CreateLeagueModal'
import { JoinLeagueModal } from '../leagues/JoinLeagueModal'
import { ordinal } from './ordinal'
import s from '../shared.module.css'
import h from '../leagues/hub.module.css'

type OverallSummary = { entryCount: number; yourRank: number | null; preResults: boolean }

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; overall: OverallSummary }

type LeaguesState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'ready'; rows: LeagueSummary[] }

export function LeaguePage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  const [state, setState] = useState<State>({ status: 'loading' })
  const [leaguesState, setLeaguesState] = useState<LeaguesState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [leaguesReloadKey, setLeaguesReloadKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setState({ status: 'loading' })

    // The hub needs only total count and current-user context. Requesting a
    // single row keeps the summary bounded even at the operating cap.
    fetchLeaderboardPage(tournamentId, { limit: 1 })
      .then((page) => {
        if (!active) return
        const preResults = page.totalCount === 0 || page.rows[0]?.rank === null
        setState({
          status: 'ready',
          overall: {
            entryCount: page.totalCount,
            yourRank: preResults ? null : (page.you?.rank ?? null),
            preResults,
          },
        })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(error, 'Could not load standings. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [tournamentId, reloadKey])

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setLeaguesState({ status: 'loading' })

    fetchMyLeagues(tournamentId)
      .then((rows) => {
        if (active) setLeaguesState({ status: 'ready', rows })
      })
      .catch((error) => {
        if (active) {
          setLeaguesState({
            status: 'unavailable',
            message: userFacingError(error, 'Could not load your leagues. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [tournamentId, leaguesReloadKey])

  const header = (
    <div className={s.header}>
      <h1 className={s.title}>League</h1>
    </div>
  )

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (state.status === 'loading' || data.status !== 'ready') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={2} />
        </div>
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load standings">
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

  const { overall } = state

  return (
    <div className={s.page}>
      {header}

      <button type="button" className={h.overallCard} onClick={() => navigate('/league/overall')}>
        <span className={h.globe}>
          <GlobeIcon size={22} />
        </span>
        <span className={h.overallBody}>
          <span className={h.overallTitle}>All players, everywhere</span>
          <span className={h.overallSub}>
            {overall.preResults
              ? `${overall.entryCount} ${overall.entryCount === 1 ? 'entry' : 'entries'} · standings once results come in`
              : overall.yourRank !== null
                ? `You're ${ordinal(overall.yourRank)} of ${overall.entryCount}`
                : `${overall.entryCount} ${overall.entryCount === 1 ? 'entry' : 'entries'}`}
          </span>
        </span>
        {overall.yourRank !== null && (
          <span className={h.overallRank}>{ordinal(overall.yourRank)}</span>
        )}
        <ChevronRightIcon size={18} className={h.chev} />
      </button>

      <p className={h.sectionLabel}>Your leagues</p>
      {leaguesState.status === 'loading' ? (
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
      ) : leaguesState.status === 'unavailable' ? (
        <Alert variant="warning" title="Couldn't load your leagues">
          {leaguesState.message}
          <div style={{ marginTop: 10 }}>
            <Button
              variant="secondary"
              onClick={() => setLeaguesReloadKey((key) => key + 1)}
            >
              Retry leagues
            </Button>
          </div>
        </Alert>
      ) : leaguesState.rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={22} />}
          title="No leagues yet"
          description="Create a private league to play your mates, or join one with an invite code."
        />
      ) : (
        <div className={h.leagueList}>
          {leaguesState.rows.map((league) => (
            <MyLeagueCard
              key={league.id}
              name={league.name}
              memberCount={league.memberCount}
              isOwner={league.isOwner}
              rank={null}
              onOpen={() => navigate(`/league/${league.id}`)}
            />
          ))}
        </div>
      )}

      <div className={h.actions}>
        <Button fullWidth onClick={() => setCreating(true)}>
          <span className={h.actionBtnInner}>
            <PlusIcon size={16} /> Create league
          </span>
        </Button>
        <Button variant="secondary" fullWidth onClick={() => setJoining(true)}>
          Join league
        </Button>
      </div>

      {tournamentId && (
        <CreateLeagueModal
          open={creating}
          onClose={() => setCreating(false)}
          tournamentId={tournamentId}
          onView={(id) => {
            setCreating(false)
            navigate(`/league/${id}`)
          }}
        />
      )}
      <JoinLeagueModal
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={(joined) => {
          setJoining(false)
          // A code can now resolve to a private competition as well as a
          // league. This page is a league page, so a competition goes to the
          // private-play list, which is where it appears.
          navigate(
            joined.kind === 'league' ? `/league/${joined.leagueId}` : weeklyRoutes.leagues,
          )
        }}
      />
    </div>
  )
}
