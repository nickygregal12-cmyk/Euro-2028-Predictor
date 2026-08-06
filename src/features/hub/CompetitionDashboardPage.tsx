import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, EmptyIllustration, Masthead } from '../../design-system'
import {
  fetchHubMembership,
  type HubSeasonMembership,
} from '../../services/supabase/competitionGames'
import type { CompetitionGame } from '../../services/supabase/competitionGamesModel'
import {
  registerBonusCompetition,
  withdrawBonusCompetition,
} from '../../services/supabase/bonusGames'
import s from '../shared.module.css'
import h from './hub.module.css'
import { isNextUi } from '../../app/routeFlags'
import {
  findHubCompetition,
  type HubCompetition,
  type HubGame,
} from './competitionCatalogue'
import { applyHubMembership } from './hubMembership'
import { decideGameMembership, gameMembershipRefusal } from './gameMembershipAction'

/**
 * One competition season: its games, and what the player may do about each.
 *
 * IT READS MEMBERSHIP FROM THE SERVER, like the Hub one level up. It used to
 * render the static catalogue's `joined` flag, which meant this page could say
 * "Joined" while the Hub — reading the same season from the database — said the
 * opposite one tap away. The catalogue still supplies presentation copy and the
 * slugs; the database supplies membership, exactly the split the Hub uses.
 *
 * THE MEMBERSHIP BUTTON DOES SOMETHING NOW. It was rendered enabled with no
 * handler at all, so pressing "Join game" did nothing and said nothing — a
 * player could not tell a broken control from a refused action. Every fact
 * needed to wire it was already in `get_competition_games`; the decode layer
 * was discarding the game id that a join is addressed by.
 *
 * A FAILED READ IS NEVER DRESSED AS "NOT JOINED". Loading, failed and ready are
 * three distinct states, because the catalogue's own default said the Premier
 * League games were joined and a silent fallback to it would assert membership
 * the server never confirmed.
 */

/**
 * The route each game card opens.
 *
 * The season games resolve their own season from these slugs, so one entry per
 * game kind covers every competition season the catalogue holds rather than
 * naming them one at a time. Only the Euro Original Predictor keeps a fixed
 * path, because it predates the competition-scoped routes and owns its own.
 *
 * `league-predictor` is the one that still returns null: the Main Predictor
 * card needs the matchweek to open at, and resolving "the next playable
 * matchweek" is the play-context read that arrives with its own contract.
 */
function gamePath(
  competitionSlug: string,
  seasonSlug: string,
  game: HubGame,
): string | null {
  if (competitionSlug === 'euro' && seasonSlug === '2028' && game.kind === 'original-predictor') {
    return '/competitions/euro/2028/original'
  }

  // The season Match Predictor. Reached from here rather than named in the
  // catalogue because the catalogue describes the games a competition offers,
  // and where a game lives is a routing fact — the Euro entry above is the same
  // decision, made once already.
  if (game.kind === 'league-predictor' && isNextUi('seasonMatchPredictor')) {
    return `/competitions/${competitionSlug}/${seasonSlug}/main-predictor`
  }

  // The other two season games carry no flag of their own: they are read-only
  // surfaces plus an entry control, with no lock or scoring interaction to roll
  // back, so the route is the whole change.
  const base = `/competitions/${competitionSlug}/${seasonSlug}`
  switch (game.kind) {
    case 'last-man-standing':
      return `${base}/last-man-standing`
    case 'predictor-championship':
      return `${base}/championship`
    default:
      return null
  }
}

type DashboardState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; competition: HubCompetition; season: HubSeasonMembership | null }

function useCompetitionDashboard(competition: HubCompetition | null) {
  const [state, setState] = useState<DashboardState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const seasonRowName = competition?.seasonRowName ?? null

  useEffect(() => {
    if (!competition || !seasonRowName) return
    let active = true
    setState({ status: 'loading' })
    fetchHubMembership([seasonRowName])
      .then((seasons) => {
        if (!active) return
        const { competitions } = applyHubMembership([competition], seasons)
        setState({
          status: 'ready',
          competition: competitions[0] ?? competition,
          season: seasons.find((entry) => entry.seasonName === seasonRowName) ?? null,
        })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
    // The catalogue entry is a module constant resolved from the route, so the
    // season name is the whole identity of this read.
  }, [seasonRowName, nonce, competition])

  return { state, reload: useCallback(() => setNonce((value) => value + 1), []) }
}

export function CompetitionDashboardPage() {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  const catalogue = findHubCompetition(competitionSlug, seasonSlug)
  const { state, reload } = useCompetitionDashboard(catalogue)

  const [acting, setActing] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const changeMembership = async (served: CompetitionGame, leaving: boolean) => {
    if (acting) return
    setActing(served.id)
    setActionError(null)
    try {
      if (leaving) {
        await withdrawBonusCompetition(served.id)
      } else {
        await registerBonusCompetition(served.id)
      }
      reload()
    } catch (error) {
      // Reload regardless: the reloaded facts are what explain an ambiguous
      // refusal, which the code alone cannot.
      setActionError(gameMembershipRefusal(error))
      reload()
    } finally {
      setActing(null)
    }
  }

  if (!catalogue) {
    return (
      <div className={s.page}>
        <Masthead>
          <div className={s.header}>
            <span className={s.eyebrow}>Football Prediction Hub</span>
            <h1 className={s.title}>Competition unavailable</h1>
          </div>
        </Masthead>
        <div className={h.empty}>
          <EmptyIllustration variant="list" />
        </div>
        <Alert variant="warning" title="This competition could not be found">
          Return to the hub and choose an available competition season.
        </Alert>
        <Button variant="primary" fullWidth onClick={() => navigate('/')}>
          Back to hub
        </Button>
      </div>
    )
  }

  // Presentation comes from the catalogue until the server has answered, but
  // membership does not: an unconfirmed `joined` is shown as unknown rather
  // than asserted from a constant.
  const competition = state.status === 'ready' ? state.competition : catalogue
  const membershipKnown = state.status === 'ready'
  const servedGames = state.status === 'ready' ? (state.season?.seasonGames.games ?? []) : []
  const serverNow = state.status === 'ready' ? (state.season?.seasonGames.serverNow ?? null) : null

  return (
    <div className={s.page}>
      <Masthead>
        <div className={s.header}>
          <span className={s.eyebrow}>Football Prediction Hub</span>
          <h1 className={s.title}>{competition.name}</h1>
          <div className={h.seasonRow}>
            <span className={h.season}>{competition.seasonLabel}</span>
            <span className={h.status}>{competition.status}</span>
          </div>
        </div>
      </Masthead>

      <p className={h.dashboardIntro}>
        This dashboard will prioritise incomplete predictions, the next lock, live results,
        current ranks and active game decisions for this competition.
      </p>

      {state.status === 'failed' ? (
        <Alert variant="warning" title="Couldn’t check your entries">
          Which games you have joined couldn’t be loaded right now, so no entry is claimed
          either way. Your entries are unaffected.
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="error" title="That change was not saved">
          {actionError}
        </Alert>
      ) : null}

      <section className={h.section} aria-labelledby="dashboard-games">
        <div className={h.sectionHead}>
          <h2 className={h.sectionTitle} id="dashboard-games">
            Games
          </h2>
          <span className={h.sectionCount}>{competition.games.length}</span>
        </div>

        <div className={h.gameStack}>
          {competition.games.map((game) => {
            const path = gamePath(competition.competitionSlug, competition.seasonSlug, game)
            const headingId = `game-${game.kind}`
            const served = servedGames.find((entry) => entry.gameKey === game.gameKey)
            const decision = served ? decideGameMembership(served, serverNow) : null
            const busy = served !== undefined && acting === served.id

            return (
              <section
                className={`${h.gameCard} ${game.joined ? '' : h.gameCardAvailable}`}
                key={game.kind}
                aria-labelledby={headingId}
              >
                <div className={h.gameHeader}>
                  <h3 className={h.gameCardHeading} id={headingId}>
                    {game.name}
                  </h3>
                  {!membershipKnown ? null : game.joined ? (
                    <span className={h.joined}>Joined</span>
                  ) : (
                    <span className={h.gameMeta}>
                      {game.status === 'coming-soon' ? 'Coming soon' : 'Available'}
                    </span>
                  )}
                </div>
                <span className={h.gameDescription}>{game.description}</span>
                <div className={h.actions}>
                  <Button
                    variant={path ? 'primary' : 'secondary'}
                    fullWidth
                    disabled={!path}
                    onClick={() => path && navigate(path)}
                  >
                    {path ? 'Open game' : 'Build pending'}
                  </Button>

                  {/* No dead controls: an action the server would refuse is
                      stated as a sentence rather than rendered as a button. */}
                  {decision?.action ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={busy || acting !== null}
                      onClick={() =>
                        served && changeMembership(served, decision.action === 'leave')
                      }
                    >
                      {busy ? 'Saving…' : decision.label}
                    </Button>
                  ) : decision?.refusal ? (
                    <p className={h.gameMeta}>{decision.refusal}</p>
                  ) : (
                    <Button variant="secondary" fullWidth disabled>
                      {state.status === 'loading' ? 'Checking…' : 'Entry unavailable'}
                    </Button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>

      <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
        Back to all competitions
      </Button>
    </div>
  )
}
