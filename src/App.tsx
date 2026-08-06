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
const SeasonMatchPredictorRoute = lazy(() =>
  import('./features/season/SeasonMatchPredictorRoute').then((m) => ({
    default: m.SeasonMatchPredictorRoute,
  })),
)
const SeasonPlayRoute = lazy(() =>
  import('./features/season/SeasonGameRoutes').then((m) => ({ default: m.SeasonPlayRoute })),
)
const SeasonStandingsRoute = lazy(() =>
  import('./features/season/SeasonGameRoutes').then((m) => ({
    default: m.SeasonStandingsRoute,
  })),
)
const SeasonLmsRoute = lazy(() =>
  import('./features/season/SeasonGameRoutes').then((m) => ({ default: m.SeasonLmsRoute })),
)
const SeasonChampionshipRoute = lazy(() =>
  import('./features/season/SeasonGameRoutes').then((m) => ({
    default: m.SeasonChampionshipRoute,
  })),
)
const SeasonLeaguesRoute = lazy(() =>
  import('./features/season/SeasonGameRoutes').then((m) => ({
    default: m.SeasonLeaguesRoute,
  })),
)
const HomePage = lazy(() => import('./features/home/HomePage').then((m) => ({ default: m.HomePage })))
const PredictEntryPage = lazy(() => import('./features/predict/PredictEntryPage').then((m) => ({ default: m.PredictEntryPage })))
const PredictionTrendsPage = lazy(() => import('./features/trends/PredictionTrendsPage').then((m) => ({ default: m.PredictionTrendsPage })))
const GroupPredictorPage = lazy(() => import('./features/predict/GroupPredictorPage').then((m) => ({ default: m.GroupPredictorPage })))
const ThirdPlacePage = lazy(() => import('./features/predict/ThirdPlacePage').then((m) => ({ default: m.ThirdPlacePage })))
const BracketRound = lazy(() => import('./features/bracket').then((m) => ({ default: m.BracketRound })))
const JokersPage = lazy(() => import('./features/predict/JokersPage').then((m) => ({ default: m.JokersPage })))
const ReviewWorkspacePage = lazy(() => import('./features/predict/ReviewWorkspacePage').then((m) => ({ default: m.ReviewWorkspacePage })))
const LeaguePage = lazy(() => import('./features/league/LeaguePage').then((m) => ({ default: m.LeaguePage })))
const OverallStandingsPage = lazy(() => import('./features/league/OverallStandingsPage').then((m) => ({ default: m.OverallStandingsPage })))
const LeagueDetailRoutePage = lazy(() => import('./features/leagues/LeagueDetailRoutePage').then((m) => ({ default: m.LeagueDetailRoutePage })))
const JoinLandingPage = lazy(() => import('./features/leagues/JoinLandingPage').then((m) => ({ default: m.JoinLandingPage })))
const MorePage = lazy(() => import('./features/more/MorePage').then((m) => ({ default: m.MorePage })))
const AccountPage = lazy(() =>
  import('./features/account/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const GamesPage = lazy(() => import('./features/games/GamesPage').then((m) => ({ default: m.GamesPage })))
const KnockoutPredictionsPage = lazy(() => import('./features/games/KnockoutPredictionsPage').then((m) => ({ default: m.KnockoutPredictionsPage })))
const KoPredictorStandingsPage = lazy(() => import('./features/games/KoPredictorStandingsPage').then((m) => ({ default: m.KoPredictorStandingsPage })))
const LmsPage = lazy(() => import('./features/games/LmsPage').then((m) => ({ default: m.LmsPage })))
const CupPage = lazy(() => import('./features/games/CupPage').then((m) => ({ default: m.CupPage })))
const ScoringRulesPage = lazy(() => import('./features/more/ScoringRulesPage').then((m) => ({ default: m.ScoringRulesPage })))
const MatchesPage = lazy(() => import('./features/matches/MatchesPage').then((m) => ({ default: m.MatchesPage })))
const MatchCentrePage = lazy(() => import('./features/matches/MatchCentrePage').then((m) => ({ default: m.MatchCentrePage })))
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

/**
 * Route titles and announcements for the routes that render without a session.
 *
 * `RouteAccessibility` moved inside `AuthLayout` so it can tell apart the two
 * pages that share `/` — signed out it is the public landing page, signed in it
 * is the Hub — and that reading needs the session. These routes sit outside
 * `AuthLayout` on purpose: a component gallery must not mount a session, and
 * the not-found page needs none. They keep the same titling through their own
 * layout route, which is why the hook it uses tolerates having no provider
 * above it rather than throwing.
 */
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
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug"
                      element={<CompetitionDashboardPage />}
                    />
                    {/* Declared above the parameterised dashboard would make no
                        difference — React Router ranks by specificity, not by
                        source order — but it is kept next to it because the two
                        are the same competition seen at two depths. */}
                    <Route
                      path="/competitions/:competitionSlug/:seasonSlug/main-predictor"
                      element={<SeasonMatchPredictorRoute />}
                    />
                    <Route path="/competitions/euro/2028/original" element={<HomePage />} />
                    <Route path="/competitions/:competitionSlug/:seasonSlug/play" element={<SeasonPlayRoute />} />
                    <Route path="/competitions/:competitionSlug/:seasonSlug/standings" element={<SeasonStandingsRoute />} />
                    <Route path="/competitions/:competitionSlug/:seasonSlug/last-man-standing" element={<SeasonLmsRoute />} />
                    <Route path="/competitions/:competitionSlug/:seasonSlug/championship" element={<SeasonChampionshipRoute />} />
                    <Route path="/competitions/:competitionSlug/:seasonSlug/leagues" element={<SeasonLeaguesRoute />} />
                    <Route path="/predict" element={<PredictEntryPage />} />
                    <Route path="/prediction-trends" element={<PredictionTrendsPage />} />
                    <Route path="/predict/groups/:letter" element={<GroupPredictorPage />} />
                    <Route path="/predict/third-place" element={<ThirdPlacePage />} />
                    <Route path="/predict/bracket" element={<BracketRound />} />
                    <Route path="/predict/jokers" element={<JokersPage />} />
                    <Route path="/predict/review" element={<ReviewWorkspacePage />} />
                    <Route path="/league" element={<LeaguePage />} />
                    <Route path="/league/overall" element={<OverallStandingsPage />} />
                    <Route path="/league/:id" element={<LeagueDetailRoutePage />} />
                    <Route path="/h2h/:rivalId" element={<H2HPage />} />
                    <Route path="/matches" element={<MatchesPage />} />
                    <Route path="/match/:matchRef" element={<MatchCentrePage />} />
                    <Route path="/more" element={<MorePage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/games" element={<GamesPage />} />
                    <Route path="/games/knockout" element={<KnockoutPredictionsPage />} />
                    <Route path="/games/ko-predictor" element={<KoPredictorStandingsPage />} />
                    <Route path="/games/lms" element={<LmsPage />} />
                    <Route path="/games/cup" element={<CupPage />} />
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
