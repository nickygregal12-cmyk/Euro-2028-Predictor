import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, EmptyIllustration } from '../../design-system'
import {
  competitionGameRoute,
  competitionSectionRoute,
  type DomesticGameRoute,
} from '../../app/weeklyRoutes'
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
  gamesJoinedFirst,
  type HubCompetition,
  type HubGame,
} from './competitionCatalogue'
import { applyHubMembership } from './hubMembership'
import { decideGameMembership, gameMembershipRefusal } from './gameMembershipAction'
import { CompetitionWeekPanel } from './CompetitionWeekPanel'
import {
  formatWeekDeadline,
  weekActionCallToAction,
  weekActionForGame,
} from './competitionWeekModel'
import { useCompetitionWeek } from './useCompetitionWeek'
import { SeasonCompetitionShell } from '../season/SeasonCompetitionShell'
import { SeasonFixturePreview } from '../season/SeasonFixturePreview'
import { seasonShellDestinations } from '../season/seasonDestinations'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'
import { fetchSeasonLeaveEligibility } from '../../services/supabase/gameLeaveEligibility'
import type { GameLeaveEligibility } from '../../services/supabase/gameLeaveEligibilityModel'
import { GameRulesDisclosure } from '../season/GameRulesDisclosure'
import {
  SEASON_GAME_RULES,
  seasonGameRules,
  type SeasonRulesGameKey,
} from '../season/gameRules'

function domesticGameRoute(game: HubGame): DomesticGameRoute | null {
  switch (game.kind) {
    case 'league-predictor':
      return isNextUi('seasonMatchPredictor') ? 'match-predictor' : null
    case 'last-man-standing':
      return 'lms'
    case 'predictor-championship':
      return 'championship'
    default:
      return null
  }
}

function gamePath(competition: HubCompetition, game: HubGame): string | null {
  const route = domesticGameRoute(game)
  return route ? competitionGameRoute(competition, route) : null
}

/**
 * Overview's fixtures, in their own component for one reason: the gateway must
 * keep its identity between renders or the window hook's effect re-runs for
 * ever, and the memo that gives it one cannot be a hook inside `CompetitionPage`
 * — that component already returns early when the slugs name no competition.
 * A child renders only when there is a season, so its hooks are unconditional.
 */
function OverviewFixtures({
  tournamentId,
  onSeeAll,
}: {
  tournamentId: string
  onSeeAll: () => void
}) {
  const gateway = useMemo(
    () => ({
      load: (window: { from?: string; to?: string }) =>
        fetchSeasonFixtureList(tournamentId, window),
    }),
    [tournamentId],
  )
  return <SeasonFixturePreview gateway={gateway} onSeeAll={onSeeAll} />
}

type DashboardState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; competition: HubCompetition; season: HubSeasonMembership | null }

/**
 * Contract 140's leave eligibility, in its own state beside the membership read.
 *
 * SEPARATE, AND ALLOWED TO FAIL ALONE. It is a second round trip for a fact
 * that makes one control better informed. Folding it into `DashboardState`
 * would make its failure the page's failure — a dashboard that cannot show a
 * player their games because it could not check whether they may leave one is
 * a worse page than the one that existed before the read. So it stays null
 * until it answers, and `decideGameMembership` treats null as "not yet known"
 * rather than as permission.
 */
function useLeaveEligibility(tournamentId: string | null, nonce: number) {
  const [games, setGames] = useState<readonly GameLeaveEligibility[] | null>(null)

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setGames(null)
    fetchSeasonLeaveEligibility(tournamentId)
      .then((answer) => {
        if (active) setGames(answer.games)
      })
      .catch(() => {
        // Silent on purpose: nothing on this page is wrong without it. The
        // Leave control simply goes back to being attempted rather than
        // predicted, which is what it did before contract 140 existed.
        if (active) setGames(null)
      })
    return () => {
      active = false
    }
  }, [tournamentId, nonce])

  return games
}

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
  }, [seasonRowName, nonce, competition])

  return { state, nonce, reload: useCallback(() => setNonce((value) => value + 1), []) }
}

type CompetitionPageMode = 'overview' | 'games'

function CompetitionPage({ mode }: { mode: CompetitionPageMode }) {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  const catalogue = findHubCompetition(competitionSlug, seasonSlug)
  const { state, nonce, reload } = useCompetitionDashboard(catalogue)
  const [acting, setActing] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const changeMembership = async (served: CompetitionGame, leaving: boolean) => {
    if (acting) return
    setActing(served.id)
    setActionError(null)
    try {
      if (leaving) await withdrawBonusCompetition(served.id)
      else await registerBonusCompetition(served.id)
      reload()
    } catch (error) {
      setActionError(gameMembershipRefusal(error))
      reload()
    } finally {
      setActing(null)
    }
  }

  if (!catalogue) {
    return (
      <div className={s.page}>
        <div className={h.empty}>
          <EmptyIllustration variant="list" />
        </div>
        <Alert variant="warning" title="This competition could not be found">
          Return to the Hub and choose an available competition season.
        </Alert>
        <Button variant="primary" fullWidth onClick={() => navigate('/')}>
          Back to Hub
        </Button>
      </div>
    )
  }

  const competition = state.status === 'ready' ? state.competition : catalogue
  const membershipKnown = state.status === 'ready'
  const servedGames = state.status === 'ready' ? (state.season?.seasonGames.games ?? []) : []
  const serverNow = state.status === 'ready' ? (state.season?.seasonGames.serverNow ?? null) : null
  const base = competitionSectionRoute(competition, 'overview')
  const destinations = seasonShellDestinations(base)

  // Where each game lives, resolved once here rather than inside the week hook:
  // the Match Predictor destination is flag-gated and that decision belongs in
  // the one place that already makes it.
  const weekHrefs = {
    matchPredictor: isNextUi('seasonMatchPredictor')
      ? competitionGameRoute(competition, 'match-predictor')
      : null,
    lms: competitionGameRoute(competition, 'lms'),
    championship: competitionGameRoute(competition, 'championship'),
  }
  const week = useCompetitionWeek(competitionSlug, seasonSlug, servedGames, weekHrefs, nonce)
  const leaveEligibility = useLeaveEligibility(
    state.status === 'ready' ? (state.season?.tournamentId ?? null) : null,
    nonce,
  )

  return (
    <SeasonCompetitionShell
      competitionName={competition.name}
      seasonLabel={competition.seasonLabel}
      statusStrip={[competition.status]}
      active={mode}
      destinations={destinations}
      // Overview is the one section with two independent things to show — what
      // this player owes the week, and what the competition is playing — so on
      // desktop they sit side by side instead of the football being a scroll
      // below the actions. The Games list has no second column and takes none.
      asideLabel={mode === 'overview' ? 'Fixtures and results' : undefined}
      aside={
        mode === 'overview' && state.status === 'ready' && state.season ? (
          <OverviewFixtures
            tournamentId={state.season.tournamentId}
            onSeeAll={() => navigate(competitionSectionRoute(competition, 'matches'))}
          />
        ) : undefined
      }
    >
      {state.status === 'failed' ? (
        <Alert variant="warning" title="Couldn’t check your entries">
          Which games you have joined couldn’t be loaded right now, so no entry is claimed either
          way. Your entries are unaffected.
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {mode === 'overview' ? (
        <section className={h.section} aria-labelledby="competition-overview">
          <div className={h.sectionHead}>
            <h2 className={h.sectionTitle} id="competition-overview">
              Overview
            </h2>
          </div>
          <p className={s.sub}>{competition.summary}</p>
          {/* §7.3's Overview job: what is due, before what exists. It renders
              nothing at all for a player who has joined no game here — an
              action panel with no actions is furniture. */}
          <CompetitionWeekPanel
            week={week.week}
            loading={week.loading}
            failed={week.failed}
          />
          {/* What the COMPETITION is playing — which the panel above does not
              say, since it reports what each GAME is asking of this player —
              is the contextual panel above. It stacks here on a phone, in
              exactly this position, and moves beside the actions on a wide
              screen. Fixtures belong to the competition and are the same for
              everyone following it, joined or not. */}
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate(competitionSectionRoute(competition, 'games'))}
          >
            View games
          </Button>
        </section>
      ) : (
        <>
          {actionError ? (
            <Alert variant="error" title="That change was not saved">
              {actionError}
            </Alert>
          ) : null}

          <section className={h.section} aria-labelledby="competition-games">
            <div className={h.sectionHead}>
              <h2 className={h.sectionTitle} id="competition-games">
                Games
              </h2>
              <span className={h.sectionCount}>{competition.games.length}</span>
            </div>

            <div className={h.gameStack}>
              {/* Joined first (`UI-F08`). A player opens Games to do something
                  in a game they are in, and the catalogue's declaration order
                  put an unjoined game above a joined one whenever it happened
                  to list it first. */}
              {gamesJoinedFirst(competition.games).map((game) => {
                const path = gamePath(competition, game)
                const headingId = `game-${game.kind}`
                const served = servedGames.find((entry) => entry.gameKey === game.gameKey)
                const decision = served
                  ? decideGameMembership(
                      served,
                      serverNow,
                      leaveEligibility?.find((entry) => entry.id === served.id) ?? null,
                    )
                  : null
                const busy = served !== undefined && acting === served.id
                const action = weekActionForGame(week.week, game.gameKey)
                const when = action ? formatWeekDeadline(action) : null
                const callToAction = weekActionCallToAction(action)
                // The action's destination when it has one, else the card's.
                const destination = (callToAction ? action?.href : null) ?? path

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

                    {/* "How it works", answered here rather than linked away.
                        The rules come from `domain/season/`, which is what
                        decides them; a game this build has no rules content for
                        renders nothing rather than a generic paragraph. */}
                    <GameRulesDisclosure
                      rules={
                        game.gameKey in SEASON_GAME_RULES
                          ? seasonGameRules(game.gameKey as SeasonRulesGameKey)
                          : null
                      }
                    />

                    {/* What this game is asking of the player right now, from
                        the game's OWN read — the same computation Overview's
                        summary uses, so a card and the panel cannot disagree
                        about a deadline. A game the player has not joined says
                        nothing here: it is asking them for nothing. */}
                    {action ? (
                      <p
                        className={action.outstanding ? h.gameStateOutstanding : h.gameState}
                      >
                        {action.title}
                        {when ? <span className={h.gameWhen}>{when}</span> : null}
                      </p>
                    ) : null}

                    <div className={h.actions}>
                      {/* `DFA-006`'s direct action. Where the game is asking
                          for something, the primary control IS that thing and
                          goes where it is done; otherwise it opens the game,
                          which is a destination and is labelled as one. The
                          action's own href is preferred over the card's route
                          because the action knows which surface answers it —
                          they are the same route today, built by the same
                          authority, and this does not assume that. */}
                      {/* A BUTTON ONLY WHERE THERE IS SOMETHING TO PRESS. This
                          card used to render up to three disabled ones — "Build
                          pending", "Checking…" and "Entry unavailable" — which
                          is what a player meant by unclickable buttons. Each of
                          those is a STATEMENT, so each is now a sentence, and
                          the controls that remain all do something. */}
                      {destination ? (
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => navigate(destination)}
                        >
                          {callToAction ?? 'Open game'}
                        </Button>
                      ) : (
                        <p className={h.gameMeta}>
                          This game does not have a page yet. It appears here when it does.
                        </p>
                      )}

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
                      ) : state.status === 'loading' ? (
                        <p className={h.gameMeta}>Checking your entry…</p>
                      ) : (
                        // The season runs no such game yet — measured, this is
                        // the current state of both league seasons, so it is
                        // the state most players actually meet. It is not a
                        // refusal of the player and does not read as one.
                        <p className={h.gameMeta}>
                          This competition has not opened {game.name} yet. Entry appears here
                          when it does.
                        </p>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </section>
        </>
      )}
    </SeasonCompetitionShell>
  )
}

export function CompetitionDashboardPage() {
  return <CompetitionPage mode="overview" />
}

export function CompetitionGamesPage() {
  return <CompetitionPage mode="games" />
}
