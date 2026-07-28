import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
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
const HomePage = lazy(() => import('./features/home/HomePage').then((m) => ({ default: m.HomePage })))
const PredictHubPage = lazy(() => import('./features/predict/PredictHubPage').then((m) => ({ default: m.PredictHubPage })))
const GroupPredictorPage = lazy(() => import('./features/predict/GroupPredictorPage').then((m) => ({ default: m.GroupPredictorPage })))
const ThirdPlacePage = lazy(() => import('./features/predict/ThirdPlacePage').then((m) => ({ default: m.ThirdPlacePage })))
const BracketRound = lazy(() => import('./features/bracket').then((m) => ({ default: m.BracketRound })))
const JokersPage = lazy(() => import('./features/predict/JokersPage').then((m) => ({ default: m.JokersPage })))
const ReviewWorkspacePage = lazy(() => import('./features/predict/ReviewWorkspacePage').then((m) => ({ default: m.ReviewWorkspacePage })))
const LeaguePage = lazy(() => import('./features/league/LeaguePage').then((m) => ({ default: m.LeaguePage })))
const OverallStandingsPage = lazy(() => import('./features/league/OverallStandingsPage').then((m) => ({ default: m.OverallStandingsPage })))
const LeagueDetailPage = lazy(() => import('./features/leagues/LeagueDetailPage').then((m) => ({ default: m.LeagueDetailPage })))
const JoinLandingPage = lazy(() => import('./features/leagues/JoinLandingPage').then((m) => ({ default: m.JoinLandingPage })))
const MorePage = lazy(() => import('./features/more/MorePage').then((m) => ({ default: m.MorePage })))
const GamesPage = lazy(() => import('./features/games/GamesPage').then((m) => ({ default: m.GamesPage })))
const KnockoutPredictionsPage = lazy(() => import('./features/games/KnockoutPredictionsPage').then((m) => ({ default: m.KnockoutPredictionsPage })))
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

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <RouteAccessibility />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {import.meta.env.DEV && ComponentsPreview ? (
              <Route path="/dev/components" element={<ComponentsPreview />} />
            ) : null}
            {import.meta.env.DEV && MatchCentreScenarioPreview ? (
              <Route path="/dev/match-centre/:scenario" element={<MatchCentreScenarioPreview />} />
            ) : null}

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
                    <Route path="/" element={<HomePage />} />
                    <Route path="/predict" element={<PredictHubPage />} />
                    <Route path="/predict/groups/:letter" element={<GroupPredictorPage />} />
                    <Route path="/predict/third-place" element={<ThirdPlacePage />} />
                    <Route path="/predict/bracket" element={<BracketRound />} />
                    <Route path="/predict/jokers" element={<JokersPage />} />
                    <Route path="/predict/review" element={<ReviewWorkspacePage />} />
                    <Route path="/league" element={<LeaguePage />} />
                    <Route path="/league/overall" element={<OverallStandingsPage />} />
                    <Route path="/league/:id" element={<LeagueDetailPage />} />
                    <Route path="/h2h/:rivalId" element={<H2HPage />} />
                    <Route path="/matches" element={<MatchesPage />} />
                    <Route path="/match/:matchRef" element={<MatchCentrePage />} />
                    <Route path="/more" element={<MorePage />} />
                    <Route path="/games" element={<GamesPage />} />
                    <Route path="/games/knockout" element={<KnockoutPredictionsPage />} />
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

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}
