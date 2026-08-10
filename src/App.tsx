import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ThemeProvider } from './app/providers/ThemeProvider'
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
import { RequireAdmin } from './features/admin/RequireAdmin'
import { AdminLayout } from './features/admin/AdminLayout'

const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignUpPage = lazy(() => import('./features/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const ResetRequestPage = lazy(() => import('./features/auth/ResetRequestPage').then((m) => ({ default: m.ResetRequestPage })))
const UpdatePasswordPage = lazy(() => import('./features/auth/UpdatePasswordPage').then((m) => ({ default: m.UpdatePasswordPage })))
const HubPage = lazy(() => import('./features/hub/HubPage').then((m) => ({ default: m.HubPage })))
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
const GlobalPlayPage = lazy(() =>
  import('./features/hub/GlobalPlayPage').then((m) => ({ default: m.GlobalPlayPage })),
)
const GlobalMatchesPage = lazy(() =>
  import('./features/hub/GlobalMatchesPage').then((m) => ({ default: m.GlobalMatchesPage })),
)
const GlobalLeaguesPage = lazy(() =>
  import('./features/hub/GlobalLeaguesPage').then((m) => ({ default: m.GlobalLeaguesPage })),
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
const LeagueDetailRoutePage = lazy(() => import('./features/leagues/LeagueDetailRoutePage').then((m) => ({ default: m.LeagueDetailRoutePage })))
const JoinLandingPage = lazy(() => import('./features/leagues/JoinLandingPage').then((m) => ({ default: m.JoinLandingPage })))
const MorePage = lazy(() => import('./features/more/MorePage').then((m) => ({ default: m.MorePage })))
const AccountPage = lazy(() =>
  import('./features/account/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const ScoringRulesPage = lazy(() => import('./features/more/ScoringRulesPage').then((m) => ({ default: m.ScoringRulesPage })))
const WelcomePage = lazy(() => import('./features/welcome/WelcomePage').then((m) => ({ default: m.WelcomePage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
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
                <Route path="/auth/signup" element={<SignUpPage />} />
                <Route path="/auth/reset" element={<ResetRequestPage />} />
              </Route>

              <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
              <Route path="/join/:code" element={<JoinLandingPage />} />

              <Route element={<RequireAuth />}>
                <Route path="/welcome" element={<WelcomePage />} />

                <Route element={<RequireWelcome />}>
                  <Route element={<AppShell />}>
                    <Route path={weeklyRoutes.hub} element={<HubPage />} />
                    {/* The three global destinations are destinations in
                        their own right, not competition choosers: an action
                        inbox, one combined football calendar and all the
                        player's private play. The chooser they replaced asked
                        which competition before answering anything, which got
                        worse with every competition the platform adds. */}
                    <Route path={weeklyRoutes.play} element={<GlobalPlayPage />} />
                    <Route path={weeklyRoutes.matches} element={<GlobalMatchesPage />} />
                    <Route path={weeklyRoutes.leagues} element={<GlobalLeaguesPage />} />
                    {/* The catalogue, as deliberate discovery. Not a tab. */}
                    <Route path={weeklyRoutes.competitions} element={<ExploreCompetitionsPage />} />
                    <Route path={weeklyRoutes.more} element={<MorePage />} />

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
                    <Route
                      path={weeklyRoutePatterns.leagues}
                      element={<SeasonLeaguesRoute />}
                    />

                    {/* Compatibility only: the old global chooser name remains a
                        redirect, never a second weekly information architecture. */}
                    <Route path="/fixtures" element={<Navigate to={weeklyRoutes.matches} replace />} />
                    <Route path="/league" element={<Navigate to={weeklyRoutes.leagues} replace />} />
                    <Route path="/more/points" element={<Navigate to="/profile" replace />} />
                    <Route path="/more/scoring" element={<ScoringRulesPage />} />
                    {/* Outside the tournament boundary below, because the
                        account is the platform's rather than a competition's.
                        It stopped printing one competition's points and rank
                        under a player's name, and with that gone it reads
                        nothing from the tournament at all. */}
                    <Route path="/account" element={<AccountPage />} />

                    {/* Everything below answers for the Euro tournament and only
                        for it, so the tournament data and predictions providers
                        mount here rather than above the whole shell. A domestic
                        player never pays for a dataset they cannot reach.
                        See src/app/TournamentJourney.tsx. */}
                    <Route element={<TournamentJourney />}>
                      <Route path="/league/:id" element={<LeagueDetailRoutePage />} />
                      <Route path="/h2h/:rivalId" element={<H2HPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/profile/:playerId" element={<OtherPlayerProfilePage />} />
                    </Route>

                    <Route element={<RequireAdmin />}>
                      <Route path="/admin" element={<Navigate to="/admin/results" replace />} />
                      <Route element={<AdminLayout />}>
                        {/* The Results Centre confirms Euro match results and
                            reads the tournament to do it. Users administration
                            does not, and wrapping the whole admin tree would
                            have made every visit to it load the tournament. */}
                        <Route element={<TournamentJourney />}>
                          <Route path="/admin/results" element={<AdminResultsWorkspacePage />} />
                        </Route>
                        <Route path="/admin/users" element={<AdminUsersPage />} />
                        {/* Season administration reads and writes only season
                            authorities, so it sits outside the tournament
                            boundary above rather than inside it. */}
                        <Route path="/admin/season" element={<SeasonAdminPage />} />
                        {/* Euro publication reads and writes only the Contract
                            143 publication authority. It is deliberately
                            OUTSIDE the tournament boundary above: publishing a
                            tournament must not require loading it, and while
                            the state is hidden that load is exactly what the
                            route guard refuses. */}
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
  )
}
