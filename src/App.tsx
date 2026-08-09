import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { AuthLayout, RedirectIfAuthed, RequireAuth, RequireWelcome } from './app/Providers'
import { AppShell } from './app/AppShell'
import { RouteAccessibility } from './app/RouteAccessibility'
import { RouteFallback } from './app/RouteFallback'
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
const CompetitionChooserPage = lazy(() =>
  import('./features/hub/CompetitionChooserPage').then((m) => ({
    default: m.CompetitionChooserPage,
  })),
)
const SeasonMatchesRoute = lazy(() =>
  import('./features/season/SeasonMatchesRoute').then((m) => ({
    default: m.SeasonMatchesRoute,
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
                    <Route path="/" element={<HubPage />} />
                    <Route path="/play" element={<CompetitionChooserPage section="play" title="Play" />} />
                    <Route path="/matches" element={<CompetitionChooserPage section="matches" title="Matches" />} />
                    <Route path="/leagues" element={<CompetitionChooserPage section="leagues" title="Leagues" />} />
                    <Route path="/more" element={<MorePage />} />

                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug"
                      element={<CompetitionDashboardPage />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/play"
                      element={<SeasonPlayRoute />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/matches"
                      element={<SeasonMatchesRoute />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/games"
                      element={<CompetitionGamesPage />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/games/match-predictor"
                      element={<SeasonMatchPredictorRoute />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings"
                      element={<SeasonStandingsRoute />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/games/lms"
                      element={<SeasonLmsRoute />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/games/championship/*"
                      element={<SeasonChampionshipRouter />}
                    />
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/leagues"
                      element={<SeasonLeaguesRoute />}
                    />

                    {/* Compatibility only: the old global chooser name remains a
                        redirect, never a second weekly information architecture. */}
                    <Route path="/fixtures" element={<Navigate to="/matches" replace />} />
                    <Route path="/league" element={<Navigate to="/leagues" replace />} />
                    <Route path="/league/:id" element={<LeagueDetailRoutePage />} />

                    <Route path="/h2h/:rivalId" element={<H2HPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/:playerId" element={<OtherPlayerProfilePage />} />
                    <Route path="/more/points" element={<Navigate to="/profile" replace />} />
                    <Route path="/more/scoring" element={<ScoringRulesPage />} />

                    <Route element={<RequireAdmin />}>
                      <Route path="/admin" element={<Navigate to="/admin/results" replace />} />
                      <Route element={<AdminLayout />}>
                        <Route path="/admin/results" element={<AdminResultsWorkspacePage />} />
                        <Route path="/admin/users" element={<AdminUsersPage />} />
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
