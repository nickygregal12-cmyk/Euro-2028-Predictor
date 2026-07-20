import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { AuthLayout, RedirectIfAuthed, RequireAuth } from './app/Providers'
import { AppShell } from './app/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { ComponentsPreview } from './dev/ComponentsPreview'
import { HomePage } from './features/home/HomePage'
import { PredictHubPage } from './features/predict/PredictHubPage'
import { GroupPredictorPage } from './features/predict/GroupPredictorPage'
import { ThirdPlacePage } from './features/predict/ThirdPlacePage'
import { BracketRound } from './features/bracket'
import { JokersPage } from './features/predict/JokersPage'
import { ReviewPage } from './features/predict/ReviewPage'
import { LeaguePage } from './features/league/LeaguePage'
import { OverallStandingsPage } from './features/league/OverallStandingsPage'
import { LeagueDetailPage } from './features/leagues/LeagueDetailPage'
import { JoinLandingPage } from './features/leagues/JoinLandingPage'
import { MorePage } from './features/more/MorePage'
import { ScoringRulesPage } from './features/more/ScoringRulesPage'
import { MyPointsPage } from './features/scoring'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Dev-only design-system gallery, outside the app shell + providers. */}
          <Route path="/dev/components" element={<ComponentsPreview />} />

          {/* AuthProvider wraps both the auth screens and the app so they share
              one session; the gates decide which the visitor sees. */}
          <Route element={<AuthLayout />}>
            {/* Signed-out only: log in / sign up. */}
            <Route element={<RedirectIfAuthed />}>
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/signup" element={<SignUpPage />} />
            </Route>

            {/* Invite deep link — handles both signed-in and signed-out itself,
                so it sits outside the gates (survives the logged-out case). */}
            <Route path="/join/:code" element={<JoinLandingPage />} />

            {/* Signed-in only: tournament data + predictions → shell → screens. */}
            <Route element={<RequireAuth />}>
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
                <Route path="/more" element={<MorePage />} />
                <Route path="/more/points" element={<MyPointsPage />} />
                <Route path="/more/scoring" element={<ScoringRulesPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
