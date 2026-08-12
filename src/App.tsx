import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { SiteProvider } from './app/site/SiteProvider'
import { AuthLayout, RedirectIfAuthed, RequireAuth, RequireWelcome } from './app/Providers'
import { AppShell } from './app/AppShell'
import { RouteAccessibility } from './app/RouteAccessibility'
import { RouteFallback } from './app/RouteFallback'
// Deliberately static, and measured rather than assumed. Making the boundary
// lazy so a domestic player never downloads the providers looked like the
// obvious win; it split a shared graph the entry chunk already needed and moved
// the entry chunk from 75.0 KB gz to 76.9 — over its budget — for 1.1 KB more
// JavaScript overall. The saving this change makes is the request and the work
// at runtime, not the download.
import { TournamentJourney } from './app/TournamentJourney'
import { weeklyRoutePatterns, weeklyRoutes } from './app/shellRoutes'
// ADR 0026's four shared global destinations, resolved to this build's own
// product. Static rather than lazy, and both candidate pages lazy inside it, so
// neither deployment pays a second sequential dynamic import on the critical
// path of its own home. See src/app/destinations/VariantDestinations.tsx.
import {
  HomeDestination,
  LeaguesDestination,
  MatchesDestination,
  PlayDestination,
  SingularLeagueDestination,
} from './app/destinations/VariantDestinations'
import { DomesticCompetitions } from './app/DomesticCompetitions'
import { RequireAdmin } from './features/admin/RequireAdmin'
import { AdminLayout } from './features/admin/AdminLayout'

const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
// LAZY, AND MEASURED. Statically importing the gate put contract 143's
// publication read, its lifecycle presentation table and the auth splash into
// the entry chunk that every visitor downloads before anything renders — 1.7 KB
// gz, which took it over its ceiling — to guard one route that most visitors
// never open. It loads with the signup screen it wraps.
const EuroSignupGate = lazy(() =>
  import('./features/auth/EuroSignupGate').then((m) => ({ default: m.EuroSignupGate })),
)
const SignUpPage = lazy(() => import('./features/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const ResetRequestPage = lazy(() => import('./features/auth/ResetRequestPage').then((m) => ({ default: m.ResetRequestPage })))
const UpdatePasswordPage = lazy(() => import('./features/auth/UpdatePasswordPage').then((m) => ({ default: m.UpdatePasswordPage })))
const CompetitionDashboardPage = lazy(() =>
  import('./features/hub/CompetitionDashboardPage').then((m) => ({
    default: m.CompetitionDashboardPage,
  })),
)
const CompetitionGamesPage = lazy(() =>
  import('./features/hub/CompetitionDashboardPage').then((m) => ({
    default: m.CompetitionGamesPage,
  })),
)
const SeasonMatchPredictorRoute = lazy(() =>
  import('./features/season/SeasonGameRouteBundle').then((m) => ({
    default: m.SeasonMatchPredictorRoute,
  })),
)
const SeasonPlayRoute = lazy(() =>
  import('./features/season/SeasonGameRouteBundle').then((m) => ({ default: m.SeasonPlayRoute })),
)
const SeasonStandingsRoute = lazy(() =>
  import('./features/season/SeasonGameRouteBundle').then((m) => ({ default: m.SeasonStandingsRoute })),
)
const SeasonLmsRoute = lazy(() =>
  import('./features/season/SeasonGameRouteBundle').then((m) => ({ default: m.SeasonLmsRoute })),
)
const SeasonChampionshipRouter = lazy(() =>
  import('./features/season/SeasonChampionshipRouter').then((m) => ({
    default: m.SeasonChampionshipRouter,
  })),
)
const SeasonLeaguesRoute = lazy(() =>
  import('./features/season/SeasonGameRouteBundle').then((m) => ({
    default: m.SeasonLeaguesRoute,
  })),
)
const ExploreCompetitionsPage = lazy(() =>
  import('./features/hub/ExploreCompetitionsPage').then((m) => ({
    default: m.ExploreCompetitionsPage,
  })),
)
const SeasonMatchesRoute = lazy(() =>
  import('./features/season/SeasonMatchesRoute').then((m) => ({
    default: m.SeasonMatchesRoute,
  })),
)
const SeasonMatchCentreRoute = lazy(() =>
  import('./features/season/SeasonMatchCentreRoute').then((m) => ({
    default: m.SeasonMatchCentreRoute,
  })),
)
// INNOV-006. Lazy, and reached from nowhere in the ordinary navigation, so a
// player who never opens a television screen never downloads one.
const SeasonTvModeRoute = lazy(() =>
  import('./features/season/SeasonTvModeRoute').then((m) => ({
    default: m.SeasonTvModeRoute,
  })),
)
const SeasonPlayerProfileRoute = lazy(() =>
  import('./features/season/SeasonPlayerProfileRoute').then((m) => ({
    default: m.SeasonPlayerProfileRoute,
  })),
)
// The tournament's own journeys, un-parked on 11 August 2026 so `EURO-001`'s
// route half can be turned on. Every one is lazy and every one is registered
// under `TournamentJourney`, so a Hub visitor downloads none of them: the
// deployment gate refuses before the boundary resolves a child.
const PredictEntryPage = lazy(() => import('./features/predict/PredictEntryPage').then((m) => ({ default: m.PredictEntryPage })))
const GroupPredictorPage = lazy(() => import('./features/predict/GroupPredictorPage').then((m) => ({ default: m.GroupPredictorPage })))
const ThirdPlacePage = lazy(() => import('./features/predict/ThirdPlacePage').then((m) => ({ default: m.ThirdPlacePage })))
const BracketRound = lazy(() => import('./features/bracket').then((m) => ({ default: m.BracketRound })))
const JokersPage = lazy(() => import('./features/predict/JokersPage').then((m) => ({ default: m.JokersPage })))
const ReviewWorkspacePage = lazy(() => import('./features/predict/ReviewWorkspacePage').then((m) => ({ default: m.ReviewWorkspacePage })))
const PredictionTrendsPage = lazy(() => import('./features/trends/PredictionTrendsPage').then((m) => ({ default: m.PredictionTrendsPage })))
const MatchCentrePage = lazy(() => import('./features/matches/MatchCentrePage').then((m) => ({ default: m.MatchCentrePage })))
const GamesPage = lazy(() => import('./features/games/GamesPage').then((m) => ({ default: m.GamesPage })))
const KnockoutPredictionsPage = lazy(() => import('./features/games/KnockoutPredictionsPage').then((m) => ({ default: m.KnockoutPredictionsPage })))
const KoPredictorStandingsPage = lazy(() => import('./features/games/KoPredictorStandingsPage').then((m) => ({ default: m.KoPredictorStandingsPage })))
const LmsPage = lazy(() => import('./features/games/LmsPage').then((m) => ({ default: m.LmsPage })))
const CupPage = lazy(() => import('./features/games/CupPage').then((m) => ({ default: m.CupPage })))
const OverallStandingsPage = lazy(() => import('./features/league/OverallStandingsPage').then((m) => ({ default: m.OverallStandingsPage })))
const LeagueDetailRoutePage = lazy(() => import('./features/leagues/LeagueDetailRoutePage').then((m) => ({ default: m.LeagueDetailRoutePage })))
const JoinLandingPage = lazy(() => import('./features/leagues/JoinLandingPage').then((m) => ({ default: m.JoinLandingPage })))
const MorePage = lazy(() => import('./features/more/MorePage').then((m) => ({ default: m.MorePage })))
const AccountPage = lazy(() =>
  import('./features/account/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const ScoringRulesPage = lazy(() => import('./features/more/ScoringRulesPage').then((m) => ({ default: m.ScoringRulesPage })))
const WelcomePage = lazy(() => import('./features/welcome/WelcomePage').then((m) => ({ default: m.WelcomePage })))
const PlatformProfilePage = lazy(() =>
  import('./features/profile/PlatformProfilePage').then((m) => ({
    default: m.PlatformProfilePage,
  })),
)
const TournamentProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const OtherPlayerProfilePage = lazy(() => import('./features/profile/OtherPlayerProfilePage').then((m) => ({ default: m.OtherPlayerProfilePage })))
const H2HPage = lazy(() => import('./features/h2h/H2HPage').then((m) => ({ default: m.H2HPage })))
const AdminResultsWorkspacePage = lazy(() => import('./features/admin/AdminResultsWorkspacePage').then((m) => ({ default: m.AdminResultsWorkspacePage })))
const AdminUsersPage = lazy(() => import('./features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const SeasonAdminPage = lazy(() => import('./features/admin/SeasonAdminPage').then((m) => ({ default: m.SeasonAdminPage })))
const EuroPublicationPage = lazy(() => import('./features/admin/EuroPublicationPage').then((m) => ({ default: m.EuroPublicationPage })))
const NotFoundPage = lazy(() => import('./features/notfound/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

const ComponentsPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/ComponentsPreview').then((m) => ({ default: m.ComponentsPreview })))
  : null
const MatchCentreScenarioPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/MatchCentreScenarioPreview').then((m) => ({ default: m.MatchCentreScenarioPreview })))
  : null
const SeasonPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/SeasonPreview').then((m) => ({ default: m.SeasonPreview })))
  : null
const SeasonLeaderboardPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/SeasonLeaderboardPreview').then((m) => ({
        default: m.SeasonLeaderboardPreview,
      })),
    )
  : null
const SeasonMatchPredictorPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/SeasonMatchPredictorPreview').then((m) => ({
        default: m.SeasonMatchPredictorPreview,
      })),
    )
  : null
const SeasonStandingsPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/SeasonStandingsPreview').then((m) => ({
        default: m.SeasonStandingsPreview,
      })),
    )
  : null
const SeasonLmsPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/SeasonLmsPreview').then((m) => ({
        default: m.SeasonLmsPreview,
      })),
    )
  : null
const SeasonCupPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/SeasonCupPreview').then((m) => ({
        default: m.SeasonCupPreview,
      })),
    )
  : null

function SessionlessChrome() {
  return (
    <>
      <RouteAccessibility />
      <Outlet />
    </>
  )
}

export default function App() {
  return (
    // ADR 0026's deployment identity, and it sits above everything because it
    // decides what product this build is: the navigation's wording and order,
    // the public metadata, and whether the Euro tournament's routes are served
    // at all. Fails closed to the weekly platform.
    <SiteProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<SessionlessChrome />}>
                {import.meta.env.DEV && ComponentsPreview ? (
                  <Route path="/dev/components" element={<ComponentsPreview />} />
                ) : null}
                {import.meta.env.DEV && MatchCentreScenarioPreview ? (
                  <Route path="/dev/match-centre/:scenario" element={<MatchCentreScenarioPreview />} />
                ) : null}
                {import.meta.env.DEV && SeasonPreview ? (
                  <Route path="/dev/season" element={<SeasonPreview />} />
                ) : null}
                {import.meta.env.DEV && SeasonLeaderboardPreview ? (
                  <Route path="/dev/season-leaderboard" element={<SeasonLeaderboardPreview />} />
                ) : null}
                {import.meta.env.DEV && SeasonMatchPredictorPreview ? (
                  <Route path="/dev/season-predictor" element={<SeasonMatchPredictorPreview />} />
                ) : null}
                {import.meta.env.DEV && SeasonStandingsPreview ? (
                  <Route path="/dev/season-standings" element={<SeasonStandingsPreview />} />
                ) : null}
                {import.meta.env.DEV && SeasonLmsPreview ? (
                  <Route path="/dev/season-lms" element={<SeasonLmsPreview />} />
                ) : null}
                {import.meta.env.DEV && SeasonCupPreview ? (
                  <Route path="/dev/season-cup" element={<SeasonCupPreview />} />
                ) : null}

                <Route path="*" element={<NotFoundPage />} />
              </Route>

              <Route element={<AuthLayout />}>
                <Route element={<RedirectIfAuthed />}>
                  <Route path="/auth/login" element={<LoginPage />} />
                  {/* `EURO-003` AT THE ROUTE, NOT ON A BUTTON. Hiding the Euro
                      landing page's "Create account" control while the server
                      says registration is closed left `/auth/signup` directly
                      reachable and fully working — by bookmark, by a link shared
                      before the state changed, by typing it. The gate reads
                      contract 143's publication state and fails closed on
                      anything that is not an open state, including a failed
                      read. It is a no-op on the Hub build, whose signup is open
                      and must stay open: one Supabase project serves both
                      deployments, so closing signup there would close the Hub
                      to close Euro. Log in is deliberately outside it. */}
                  <Route element={<EuroSignupGate />}>
                    <Route path="/auth/signup" element={<SignUpPage />} />
                  </Route>
                  <Route path="/auth/reset" element={<ResetRequestPage />} />
                </Route>

                <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
                <Route path="/join/:code" element={<JoinLandingPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="/welcome" element={<WelcomePage />} />

                  <Route element={<RequireWelcome />}>
                    <Route element={<AppShell />}>
                      {/* THE FOUR SHARED DESTINATIONS, AND WHOSE THEY ARE.
                          Both deployments serve these four addresses and mean
                          different products by them, so each resolves through
                          the variant route authority rather than through a
                          branch here. On the Hub they are what they have always
                          been: an action inbox, one combined football calendar
                          and all the player's private play — destinations in
                          their own right rather than competition choosers,
                          because the chooser they replaced got worse with every
                          competition the platform adds. On the Euro deployment
                          they are the tournament's own. */}
                      <Route path={weeklyRoutes.hub} element={<HomeDestination />} />
                      <Route path={weeklyRoutes.play} element={<PlayDestination />} />
                      <Route path={weeklyRoutes.matches} element={<MatchesDestination />} />
                      <Route path={weeklyRoutes.leagues} element={<LeaguesDestination />} />
                      <Route path={weeklyRoutes.more} element={<MorePage />} />

                      {/* THE DOMESTIC WEEKLY TREE, AND WHOSE IT IS. The
                          catalogue and every `/competitions/:c/:s/**` surface
                          are the Prediction Hub's product. The Euro deployment
                          does not serve them; it links back to the Hub. */}
                      <Route element={<DomesticCompetitions />}>
                        <Route
                          path={weeklyRoutes.competitions}
                          element={<ExploreCompetitionsPage />}
                        />
                        <Route
                          path={weeklyRoutePatterns.competition}
                          element={<CompetitionDashboardPage />}
                        />
                        <Route
                          path={weeklyRoutePatterns.play}
                          element={<SeasonPlayRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.matches}
                          element={<SeasonMatchesRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.matchCentre}
                          element={<SeasonMatchCentreRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.games}
                          element={<CompetitionGamesPage />}
                        />
                        <Route
                          path={weeklyRoutePatterns.matchPredictor}
                          element={<SeasonMatchPredictorRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.matchPredictorStandings}
                          element={<SeasonStandingsRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.lms}
                          element={<SeasonLmsRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.championshipWildcard}
                          element={<SeasonChampionshipRouter />}
                        />
                        {/* INNOV-006 — the matchday television screen. */}
                        <Route
                          path={weeklyRoutePatterns.tv}
                          element={<SeasonTvModeRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.leagues}
                          element={<SeasonLeaguesRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.player}
                          element={<SeasonPlayerProfileRoute />}
                        />
                      </Route>

                      <Route path="/fixtures" element={<Navigate to={weeklyRoutes.matches} replace />} />
                      {/* `/league` belongs to different products on the two
                          deployments, so one variant destination owns it. */}
                      <Route path="/league" element={<SingularLeagueDestination />} />
                      <Route path="/more/points" element={<Navigate to="/profile" replace />} />
                      <Route path="/more/scoring" element={<ScoringRulesPage />} />
                      <Route path="/profile" element={<PlatformProfilePage />} />
                      <Route path="/account" element={<AccountPage />} />

                      {/* Tournament-only routes are registered once and refused
                          on the Hub by TournamentJourney's deployment gate. */}
                      <Route element={<TournamentJourney />}>
                        <Route path="/predict" element={<PredictEntryPage />} />
                        <Route path="/predict/groups/:letter" element={<GroupPredictorPage />} />
                        <Route path="/predict/third-place" element={<ThirdPlacePage />} />
                        <Route path="/predict/bracket" element={<BracketRound />} />
                        <Route path="/predict/jokers" element={<JokersPage />} />
                        <Route path="/predict/review" element={<ReviewWorkspacePage />} />
                        <Route path="/prediction-trends" element={<PredictionTrendsPage />} />
                        <Route path="/match/:matchRef" element={<MatchCentrePage />} />
                        <Route path="/games" element={<GamesPage />} />
                        <Route path="/games/knockout" element={<KnockoutPredictionsPage />} />
                        <Route path="/games/ko-predictor" element={<KoPredictorStandingsPage />} />
                        <Route path="/games/lms" element={<LmsPage />} />
                        <Route path="/games/cup" element={<CupPage />} />
                        <Route path="/league/overall" element={<OverallStandingsPage />} />
                        <Route path="/league/:id" element={<LeagueDetailRoutePage />} />
                        <Route path="/h2h/:rivalId" element={<H2HPage />} />
                        <Route path="/tournament/profile" element={<TournamentProfilePage />} />
                        <Route
                          path="/tournament/profile/:playerId"
                          element={<OtherPlayerProfilePage />}
                        />
                      </Route>

                      <Route element={<RequireAdmin />}>
                        <Route path="/admin" element={<Navigate to="/admin/results" replace />} />
                        <Route element={<AdminLayout />}>
                          <Route element={<TournamentJourney />}>
                            <Route path="/admin/results" element={<AdminResultsWorkspacePage />} />
                          </Route>
                          <Route path="/admin/users" element={<AdminUsersPage />} />
                          <Route path="/admin/season" element={<SeasonAdminPage />} />
                          <Route path="/admin/euro" element={<EuroPublicationPage />} />
                        </Route>
                      </Route>
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </SiteProvider>
  )
}
