import { Route, Routes } from 'react-router'
import {
  SeasonChampionshipFixtureRoute,
  SeasonChampionshipFixturesRoute,
  SeasonChampionshipRoute,
  SeasonChampionshipTableRoute,
} from './SeasonGameRouteBundle'

/**
 * Keep Championship's instance-level route tree inside the already-lazy season
 * surface. These routes are useful only after a player opens Championship, so
 * carrying all four route elements in the application entry chunk would make
 * every page pay for them.
 */
export function SeasonChampionshipRouter() {
  return (
    <Routes>
      <Route index element={<SeasonChampionshipRoute />} />
      <Route path=":competitionId" element={<SeasonChampionshipFixtureRoute />} />
      <Route path=":competitionId/table" element={<SeasonChampionshipTableRoute />} />
      <Route path=":competitionId/fixtures" element={<SeasonChampionshipFixturesRoute />} />
    </Routes>
  )
}
