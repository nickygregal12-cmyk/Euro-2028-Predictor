import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { AuthLayout, RedirectIfAuthed, RequireAuth, RequireWelcome } from './app/Providers'
import { AppShell } from './app/AppShell'
import { RouteFallback } from './app/RouteFallback'

// Route-level components are code-split (React.lazy) so each screen ships as its
// own chunk, keeping the initial bundle small. The gates, providers and shell
// stay eager (they decide what renders); only the leaf screens are lazy.
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
const ReviewPage = lazy(() => import('./features/predict/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const LeaguePage = lazy(() => import('./features/league/LeaguePage').then((m) => ({ default: m.LeaguePage })))
const OverallStandingsPage = lazy(() => import('./features/league/OverallStandingsPage').then((m) => ({ default: m.OverallStandingsPage })))
const LeagueDetailPage = lazy(() => import('./features/leagues/LeagueDetailPage').then((m) => ({ default: m.LeagueDetailPage })))
const JoinLandingPage = lazy(() => import('./features/leagues/JoinLandingPage').then((m) => ({ default: m.JoinLandingPage })))
const MorePage = lazy(() => import('./features/more/MorePage').then((m) => ({ default: m.MorePage })))
const ScoringRulesPage = lazy(() => import('./features/more/ScoringRulesPage').then((m) => ({ default: m.ScoringRulesPage })))
const MatchesPage = lazy(() => import('./features/matches/MatchesPage').then((m) => ({ default: m.MatchesPage })))
const MatchCentrePage = lazy(() => import('./features/matches/MatchCentrePage').then((m) => ({ default: m.MatchCentrePage })))
const WelcomePage = lazy(() => import('./features/welcome/WelcomePage').then((m) => ({ default: m.WelcomePage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const H2HPage = lazy(() => import('./features/h2h/H2HPage').then((m) => ({ default: m.H2HPage })))
const NotFoundPage = lazy(() => import('./features/notfound/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

// The design-system gallery is DEV-ONLY. Referencing the dynamic import inside a
// statically-false `import.meta.env.DEV` branch means the production build dead-
// code-eliminates it entirely — the chunk is never emitted and the route never
// registered. In dev it lazy-loads exactly as before.
const ComponentsPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/ComponentsPreview').then((m) => ({ default: m.ComponentsPreview })))
  : null

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Dev-only design-system gallery, outside the app shell + providers.
                Absent from production builds entirely (see above). */}
            {import.meta.env.DEV && ComponentsPreview ? (
              <Route path="/dev/components" element={<ComponentsPreview />} />
            ) : null}

            {/* AuthProvider wraps both the auth screens and the app so they share
                one session; the gates decide which the visitor sees. */}
            <Route element={<AuthLayout />}>
              {/* Signed-out only: log in / sign up / request a password reset. */}
              <Route element={<RedirectIfAuthed />}>
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/signup" element={<SignUpPage />} />
                <Route path="/auth/reset" element={<ResetRequestPage />} />
              </Route>

              {/* Set-a-new-password lands here from the email link, which carries a
                  recovery session — so it sits OUTSIDE the gates (RedirectIfAuthed
                  would bounce that session to Home) and handles its own states. */}
              <Route path="/auth/update-password" element={<UpdatePasswordPage />} />

              {/* Invite deep link — handles both signed-in and signed-out itself,
                  so it sits outside the gates (survives the logged-out case). */}
              <Route path="/join/:code" element={<JoinLandingPage />} />

              {/* Signed-in only: tournament data + predictions → shell → screens. */}
              <Route element={<RequireAuth />}>
                {/* /welcome sits above the welcome gate (no shell): a first-time
                    user is routed here once, before Home. */}
                <Route path="/welcome" element={<WelcomePage />} />

                {/* Everything else is gated on having seen /welcome. */}
                <Route element={<RequireWelcome />}>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/predict" element={<PredictHubPage />} />
                    <Route path="/predict/groups/:letter" element={<GroupPredictorPage />} />
                    <Route path="/predict/third-place" element={<ThirdPlacePage />} />
                    <Route path="/predict/bracket" element={<BracketRound />} />
                    <Route path="/predict/jokers" element={<JokersPage />} />
                    <Route path="/predict/review" element={<ReviewPage />} />
                    <Route path="/league" element={<LeaguePage />} />
                    <Route path="/league/overall" element={<OverallStandingsPage />} />
                    <Route path="/league/:id" element={<LeagueDetailPage />} />
                    <Route path="/h2h/:rivalId" element={<H2HPage />} />
                    <Route path="/matches" element={<MatchesPage />} />
                    <Route path="/match/:matchRef" element={<MatchCentrePage />} />
                    <Route path="/more" element={<MorePage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    {/* /more/points consolidated into Profile (which embeds the same
                        PointsBreakdown). Kept as a redirect so old links resolve. */}
                    <Route path="/more/points" element={<Navigate to="/profile" replace />} />
                    <Route path="/more/scoring" element={<ScoringRulesPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* Unknown routes get a real recovery view (not a silent redirect). */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}
