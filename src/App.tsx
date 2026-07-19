import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { Providers } from './app/Providers'
import { AppShell } from './app/AppShell'
import { ComponentsPreview } from './dev/ComponentsPreview'
import { HomePage } from './features/home/HomePage'
import { PredictHubPage } from './features/predict/PredictHubPage'
import { GroupPredictorPage } from './features/predict/GroupPredictorPage'
import { ThirdPlacePage } from './features/predict/ThirdPlacePage'
import { BracketPage } from './features/predict/BracketPage'
import { JokersPage } from './features/predict/JokersPage'
import { ReviewPage } from './features/predict/ReviewPage'
import { LeaguePage } from './features/league/LeaguePage'
import { MorePage } from './features/more/MorePage'
import { ScoringRulesPage } from './features/more/ScoringRulesPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Dev-only design-system gallery, outside the app shell + providers. */}
          <Route path="/dev/components" element={<ComponentsPreview />} />

          {/* The authenticated app: providers → shell → screens. */}
          <Route element={<Providers />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/predict" element={<PredictHubPage />} />
              <Route path="/predict/groups/:letter" element={<GroupPredictorPage />} />
              <Route path="/predict/third-place" element={<ThirdPlacePage />} />
              <Route path="/predict/bracket" element={<BracketPage />} />
              <Route path="/predict/jokers" element={<JokersPage />} />
              <Route path="/predict/review" element={<ReviewPage />} />
              <Route path="/league" element={<LeaguePage />} />
              <Route path="/more" element={<MorePage />} />
              <Route path="/more/scoring" element={<ScoringRulesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
