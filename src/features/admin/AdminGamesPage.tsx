import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchAdministeredSeasons, type AdministeredSeason } from '../../services/supabase/administeredSeasons'
import { fetchSeasonGames } from '../../services/supabase/competitionGames'
import type { CompetitionGame, SeasonGames } from '../../services/supabase/competitionGamesModel'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type Read<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'ready'; readonly value: T }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The operational read failed.'
}

function gameLabel(game: CompetitionGame): string {
  if (game.displayName) return game.displayName
  switch (game.gameKey) {
    case 'main_predictor': return 'Match Predictor'
    case 'last_man_standing': return 'Last Man Standing'
    case 'predictor_cup': return 'Predictor Championship'
    case 'original_predictor': return 'Original Predictor'
    case 'ko_predictor': return 'KO Predictor'
  }
}

function formatInstant(value: string | null): string {
  return formatKickoffWithDay(value) ?? 'Unknown'
}

export function AdminGamesPage() {
  const [seasons, setSeasons] = useState<Read<AdministeredSeason[]>>({ status: 'loading' })
  const [seasonId, setSeasonId] = useState('')
  const [games, setGames] = useState<Read<SeasonGames> | null>(null)

  useEffect(() => {
    let active = true
    fetchAdministeredSeasons()
      .then((rows) => {
        if (!active) return
        setSeasons({ status: 'ready', value: rows })
        setSeasonId((current) => current || rows[0]?.id || '')
      })
      .catch((error) => {
        if (active) setSeasons({ status: 'failed', message: messageOf(error) })
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!seasonId) {
      setGames(null)
      return
    }
    let active = true
    setGames({ status: 'loading' })
    fetchSeasonGames(seasonId)
      .then((value) => {
        if (active) setGames({ status: 'ready', value })
      })
      .catch((error) => {
        if (active) setGames({ status: 'failed', message: messageOf(error) })
      })
    return () => {
      active = false
    }
  }, [seasonId])

  const selected = seasons.status === 'ready'
    ? seasons.value.find((season) => season.id === seasonId) ?? null
    : null
  const activeGames = games?.status === 'ready' ? games.value.games.filter((game) => game.active).length : null
  const completedGames = games?.status === 'ready' ? games.value.games.filter((game) => game.completedAt !== null).length : null

  return (
    <ControlRoomPage
      eyebrow="Football operations"
      title="Games"
      intro="One operational catalogue for Match Predictor, Last Man Standing and Predictor Championship. It reports the server's game configuration and routes consequential controls back to their existing authorities; it does not reimplement a game engine."
      actions={<Link className={styles.secondaryButton} to="/admin/season">Open competition controls</Link>}
    >
      <div className={styles.grid4}>
        <Stat label="Competition" value={selected?.name ?? '—'} detail={selected?.status ?? 'No season selected'} />
        <Stat label="Configured games" value={games?.status === 'ready' ? games.value.games.length : '—'} detail="Returned by get_competition_games" />
        <Stat label="Active" value={activeGames ?? '—'} detail="Server catalogue flag" state={activeGames === null ? 'unknown' : activeGames > 0 ? 'healthy' : 'warning'} />
        <Stat label="Completed" value={completedGames ?? '—'} detail="Games with a completion timestamp" />
      </div>

      <Panel title="Competition game state" description="Registration windows and lifecycle fields come directly from the existing competition-game catalogue. Entrant counts, scoring health and progression are not guessed where this read does not expose them.">
        {seasons.status === 'loading' ? (
          <ReadState kind="loading" title="Loading administered competitions" detail="Waiting for the existing season list." />
        ) : seasons.status === 'failed' ? (
          <ReadState kind="failed" title="Competition list unavailable" detail={seasons.message} />
        ) : seasons.value.length === 0 ? (
          <ReadState kind="empty" title="No administered league seasons" detail="No game state is invented without a competition." />
        ) : (
          <>
            <label>
              <span className={styles.meta}>Competition season</span>
              <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
                {seasons.value.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
              </select>
            </label>

            {games?.status === 'loading' ? (
              <ReadState kind="loading" title="Loading game catalogue" detail="The server remains the owner of registration and lifecycle state." />
            ) : games?.status === 'failed' ? (
              <ReadState kind="failed" title="Game catalogue unavailable" detail={games.message} />
            ) : games?.status === 'ready' && games.value.games.length === 0 ? (
              <ReadState kind="empty" title="No games configured" detail="An empty server catalogue is shown as empty, not as healthy readiness." />
            ) : games?.status === 'ready' ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Game</th><th>State</th><th>Registration opens</th><th>Registration closes</th><th>Completed</th><th>Operator note</th></tr>
                  </thead>
                  <tbody>
                    {games.value.games.map((game) => (
                      <tr key={game.id}>
                        <td data-label="Game"><strong>{gameLabel(game)}</strong></td>
                        <td data-label="State"><StatusPill state={game.active ? 'healthy' : 'disabled'} label={game.active ? 'Active' : 'Inactive'} /></td>
                        <td data-label="Registration opens">{formatInstant(game.registrationOpensAt)}</td>
                        <td data-label="Registration closes">{formatInstant(game.registrationClosesAt)}</td>
                        <td data-label="Completed">{formatInstant(game.completedAt)}</td>
                        <td data-label="Operator note">Use Competition controls for server-owned entrants, setup and settlement evidence.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <div className={styles.grid3}>
        <Panel title="Match Predictor" description="Current matchweek, fixture/result control and entrant inspection remain in the season authority.">
          <StatusPill state={games?.status === 'ready' && games.value.games.some((game) => game.gameKey === 'main_predictor' && game.active) ? 'healthy' : 'unknown'} label="Catalogue state shown above" />
          <p className={styles.meta}>Completion rate, scoring generation and settlement are not calculated in this browser workspace without a bounded admin summary.</p>
        </Panel>
        <Panel title="Last Man Standing" description="Selection, used-team lifecycle, survival and round progression remain server-owned.">
          <StatusPill state={games?.status === 'ready' && games.value.games.some((game) => game.gameKey === 'last_man_standing' && game.active) ? 'healthy' : 'unknown'} label="Catalogue state shown above" />
          <p className={styles.meta}>No client-side elimination or next-round readiness rule is introduced here.</p>
        </Panel>
        <Panel title="Predictor Championship" description="Field, group/split/knockout progression and settlement remain the Championship authority.">
          <StatusPill state={games?.status === 'ready' && games.value.games.some((game) => game.gameKey === 'predictor_cup' && game.active) ? 'healthy' : 'unknown'} label="Catalogue state shown above" />
          <p className={styles.meta}>A dedicated bounded operational summary would be needed to state phase and progression health globally.</p>
        </Panel>
      </div>
    </ControlRoomPage>
  )
}
