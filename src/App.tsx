import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { SiteProvider } from './app/site/SiteProvider'
import { AuthLayout, RedirectIfAuthed, RequireAuth, RequireWelcome } from './app/Providers'
import { isNextUi } from './app/routeFlags'
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
/* LAZY, LIKE EVERY OTHER HEAVY ROUTE ELEMENT HERE, AND MEASURED RATHER THAN
   ASSUMED. Imported statically these cost the ENTRY chunk 240.19 kB → 428.67 kB
   raw (75.81 → 133.27 kB gzip) — a 78% increase paid by every visitor, for a
   surface that cannot render while `footballHubMatches` is off, because
   `isNextUi(...)` is a function call and no bundler can shake it out.

   Lazy, the vNext surfaces get their own 187.32 kB chunk (57.71 kB gzip),
   fetched only when the flag is on AND the route is visited. The entry still
   moves 240.19 → 262.33 kB raw (75.81 → 82.56 kB gzip), and that residue is
   NOT vNext code — the entry contains no vNext module. It is Rollup
   rebalancing: a second consumer for shared modules split `lib`,
   `seasonClubForm` and `shellRoutes` into their own chunks and hoisted common
   code up. Worth stating rather than rounding to zero. */
/* INLINE, AND IT HAS TO BE. Vite folds this to a literal so Rollup can drop
   the vNext subtree and its CSS entirely when the flag is off — the bundle then
   measures byte-identical to `main`. Re-exporting the comparison from
   `routeFlags.ts` was tried and does not fold across the module boundary. See
   the note there; the two readings must stay in step and a test pins them. */
const FOOTBALL_HUB_MATCHES_BUILT = import.meta.env.VITE_UI_FOOTBALL_HUB_MATCHES === 'true'
const VNextMatchesDestination = FOOTBALL_HUB_MATCHES_BUILT
  ? lazy(() =>
      import('./app/vnext/VNextMatchesDestination').then((m) => ({
        default: m.VNextMatchesDestination,
      })),
    )
  : null
const VNextMatchCentreDestination = FOOTBALL_HUB_MATCHES_BUILT
  ? lazy(() =>
      import('./app/vnext/VNextMatchesDestination').then((m) => ({
        default: m.VNextMatchCentreDestination,
      })),
    )
  : null
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
// Build-time exclusion as well as the route boundary below: the Euro artifact
// neither links to nor emits the private Hub laboratory chunk.
const AiLabPage = import.meta.env.VITE_SITE_VARIANT !== 'euro'
  ? lazy(() => import('./features/admin/AiLabPage').then((m) => ({ default: m.AiLabPage })))
  : null
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
const AiLabPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/AiLabPreview').then((m) => ({ default: m.AiLabPreview })))
  : null
// vNext Stage 6's integration evidence. `import.meta.env.DEV` is statically
// false in a production build, so this import is eliminated and no vNext chunk
// is emitted — the production isolation the vNext lane has held since Stage 3 is
// unchanged by connecting Home to real reads.
const VNextHomePreview = import.meta.env.DEV
  ? lazy(() => import('./dev/VNextHomePreview').then((m) => ({ default: m.VNextHomePreview })))
  : null
// vNext Stage 7's integration evidence, on exactly the same terms as Stage 6's
// above: statically eliminated in a production build, absent from the production
// navigation, and behind no flag. The production Match Predictor is untouched.
const VNextMatchPredictorPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextMatchPredictorPreview').then((m) => ({
        default: m.VNextMatchPredictorPreview,
      })),
    )
  : null
// vNext Stage 8's integration evidence, on exactly the same terms as Stages 6
// and 7 above: statically eliminated in a production build, absent from the
// production navigation, and behind no flag. It proves two things the
// deterministic worlds cannot — a real competition's fixtures, and a real
// fixture opened by its canonical id through contract 148. The production
// Matches surface and Match Centre are untouched.
const VNextMatchesPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextMatchesPreview').then((m) => ({
        default: m.VNextMatchesPreview,
      })),
    )
  : null

// vNext Stage 9's integration evidence, on the same terms. It proves the one
// thing no fixture can: that contract 191's `reach` really arrives on a real
// season table and really varies between rows, so the permission the whole
// social-identity rule rests on is the server's and not an assumption. The
// production Leagues surfaces are untouched.
const VNextLeaguesPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextLeaguesPreview').then((m) => ({
        default: m.VNextLeaguesPreview,
      })),
    )
  : null

// Stage 10's profile against real data, and it is REACHED FROM the Leagues
// harness by pressing a player — which is the only way to show the thing no
// fixture can: that contract 151 and contract 192's two reads really do have
// different boundaries, so a player whose season is private can still have a
// plotted position and a head-to-head. The production profile route is
// untouched.
const VNextPlayerProfilePreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextPlayerProfilePreview').then((m) => ({
        default: m.VNextPlayerProfilePreview,
      })),
    )
  : null

// Stage 11's Last Man Standing against real data, and it is the first vNext
// harness that WRITES: pressing a club calls `save_lms_selection` and spends it
// for the season. That is the point — a survival game whose write was never
// exercised against a real round is a survival game nobody has tested — and it
// is why this stays firmly behind the DEV gate. The production LMS surfaces are
// untouched.
const VNextLmsPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextLmsPreview').then((m) => ({
        default: m.VNextLmsPreview,
      })),
    )
  : null

// Stage 12's Predictor Championship against real data, and it is contract 193's
// FIRST CALLER — nothing in the application has ever invoked
// `get_season_cup_bracket`. Every payload shape the decoder handles was
// established by reading the migration, so this is where that reading meets a
// real database. Like Stage 11's harness it can WRITE: the Penalty Number form
// it renders submits a real sealed bid, and the harness says so on the page.
// The production Championship surfaces are untouched.
const VNextChampionshipPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextChampionshipPreview').then((m) => ({
        default: m.VNextChampionshipPreview,
      })),
    )
  : null

// Stage 13's Account surface against real data. It is the first vNext page that
// is NOT inside a competition — the route matrix keeps platform identity outside
// the tournament boundary — so it is also the first to exercise a shell built
// with no competition at all. Every call it makes is a read; the production
// /account, /profile and /more surfaces are untouched.
const VNextAccountPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextAccountPreview').then((m) => ({
        default: m.VNextAccountPreview,
      })),
    )
  : null

// Stage 13's Games hub against real data — the one surface where the three
// games are peers. It reads `get_competition_games` for a single season and
// WRITES NOTHING: pressing Join reports the intent rather than entering the
// competition, because a review harness pointed at a live season must not be
// able to enter one by a stray click.
const VNextGamesPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextGamesPreview').then((m) => ({
        default: m.VNextGamesPreview,
      })),
    )
  : null

const VNextHubPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextHubPreview').then((m) => ({
        default: m.VNextHubPreview,
      })),
    )
  : null

// Stage 13's Discovery surface against real data. Unlike the other Stage 13
// harnesses this one WRITES: Follow and Unfollow call set_competition_follow
// against the signed-in account. Following never enters a game — contract 157's
// migration refuses to install if it ever could — but unfollowing deletes the
// follow row and any favourite club on it, and the harness says so on the page.
const VNextDiscoveryPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextDiscoveryPreview').then((m) => ({
        default: m.VNextDiscoveryPreview,
      })),
    )
  : null

// Stage 13's invite landing against real data. It WRITES: accepting really
// joins, through whichever function the server's own joinWith names. The
// production /join/:code landing is untouched, including its pending-invite
// handling across sign-up, which is routing and therefore Stage 14's.
const VNextInvitePreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextInvitePreview').then((m) => ({
        default: m.VNextInvitePreview,
      })),
    )
  : null

// Stage 13's onboarding harness. READ-ONLY: the vNext screen writes nothing —
// not the progress stamp, not the follows, not the game entries — because the
// commit order lives in OnboardingJourney and this lane keeps no second copy.
// The production /welcome route is untouched and still runs that journey.
const VNextOnboardingPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/VNextOnboardingPreview').then((m) => ({
        default: m.VNextOnboardingPreview,
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
                {import.meta.env.DEV && AiLabPreview ? (
                  <Route path="/dev/ai-lab" element={<AiLabPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextHomePreview ? (
                  <Route path="/dev/vnext-home" element={<VNextHomePreview />} />
                ) : null}
                {import.meta.env.DEV && VNextMatchPredictorPreview ? (
                  <Route path="/dev/vnext-match-predictor" element={<VNextMatchPredictorPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextMatchesPreview ? (
                  <Route path="/dev/vnext-matches" element={<VNextMatchesPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextLeaguesPreview ? (
                  <Route path="/dev/vnext-leagues" element={<VNextLeaguesPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextPlayerProfilePreview ? (
                  <Route path="/dev/vnext-player" element={<VNextPlayerProfilePreview />} />
                ) : null}
                {import.meta.env.DEV && VNextLmsPreview ? (
                  <Route path="/dev/vnext-lms" element={<VNextLmsPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextChampionshipPreview ? (
                  <Route path="/dev/vnext-championship" element={<VNextChampionshipPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextAccountPreview ? (
                  <Route path="/dev/vnext-account" element={<VNextAccountPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextGamesPreview ? (
                  <Route path="/dev/vnext-games" element={<VNextGamesPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextHubPreview ? (
                  <Route path="/dev/vnext-hub" element={<VNextHubPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextDiscoveryPreview ? (
                  <Route path="/dev/vnext-discovery" element={<VNextDiscoveryPreview />} />
                ) : null}
                {import.meta.env.DEV && VNextInvitePreview ? (
                  <Route path="/dev/vnext-invite" element={<VNextInvitePreview />} />
                ) : null}
                {import.meta.env.DEV && VNextOnboardingPreview ? (
                  <Route path="/dev/vnext-onboarding" element={<VNextOnboardingPreview />} />
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
                          they are the tournament's own, which until PR #702's
                          successor landed were literally the Hub's pages with
                          Euro labels on the navigation above them. */}
                      <Route path={weeklyRoutes.hub} element={<HomeDestination />} />
                      <Route path={weeklyRoutes.play} element={<PlayDestination />} />
                      <Route path={weeklyRoutes.matches} element={<MatchesDestination />} />
                      <Route path={weeklyRoutes.leagues} element={<LeaguesDestination />} />
                      <Route path={weeklyRoutes.more} element={<MorePage />} />

                      {/* THE DOMESTIC WEEKLY TREE, AND WHOSE IT IS. The
                          catalogue and every `/competitions/:c/:s/**` surface
                          are the Prediction Hub's product. The Euro deployment
                          was serving all of them, so a visitor to the
                          tournament's domain could reach a domestic season's
                          Match Predictor under navigation reading "Tournament".
                          A catalogue omission is not a control — a guessable
                          URL still resolves — so the boundary is the route. */}
                      <Route element={<DomesticCompetitions />}>
                        {/* The catalogue, as deliberate discovery. Not a tab. */}
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
                        {/* STAGE 14, THE FIRST CUTOVER VERTICAL. The choice is
                            made HERE, at the routing layer, and not inside
                            either component — `routeFlags.ts` exists because a
                            flag threaded through a tree cannot be rolled back
                            with confidence, while a flag that selects which
                            element renders can. `SeasonMatchesRoute` and
                            `SeasonMatchCentreRoute` are untouched and still
                            mounted on the off branch, so turning the flag off
                            restores yesterday's journey with no data rollback.
                            It ships off: see `config/vnext-programme.json`. */}
                        <Route
                          path={weeklyRoutePatterns.matches}
                          element={
                            isNextUi('footballHubMatches') && VNextMatchesDestination ? (
                              <VNextMatchesDestination />
                            ) : (
                              <SeasonMatchesRoute />
                            )
                          }
                        />
                        <Route
                          path={weeklyRoutePatterns.matchCentre}
                          element={
                            isNextUi('footballHubMatches') && VNextMatchCentreDestination ? (
                              <VNextMatchCentreDestination />
                            ) : (
                              <SeasonMatchCentreRoute />
                            )
                          }
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
                        {/* INNOV-006 — the matchday television screen. It is
                            registered inside the one domestic boundary like
                            every other competition surface, and `AppShell`
                            renders it WITHOUT the app bar, bottom bar and rail:
                            a frame designed for a phone in a pocket is the
                            wrong frame for a screen on a wall. Declaring a
                            second boundary to achieve that would have made the
                            next route added to the wrong one silent. */}
                        <Route
                          path={weeklyRoutePatterns.tv}
                          element={<SeasonTvModeRoute />}
                        />
                        <Route
                          path={weeklyRoutePatterns.leagues}
                          element={<SeasonLeaguesRoute />}
                        />
                        {/* One player's season (contract 151). Competition-scoped
                            because points, rank and prediction history are facts
                            about a player IN a season; the server refuses any
                            caller who shares no private league with them, and
                            nothing here enumerates players. */}
                        <Route
                          path={weeklyRoutePatterns.player}
                          element={<SeasonPlayerProfileRoute />}
                        />
                        {/* Contract 185's private analytical surface belongs to
                            the Hub deployment, not to Euro 2028. Keeping the
                            route inside this one domestic boundary means a
                            guessed `/admin/ai` address on the Euro build is
                            refused before the page or its RPC client loads. */}
                        <Route element={<RequireAdmin capability="competitions" />}>
                          <Route element={<AdminLayout />}>
                            <Route
                              path="/admin/ai"
                              element={AiLabPage ? <AiLabPage /> : <Navigate to="/" replace />}
                            />
                          </Route>
                        </Route>
                      </Route>

                      {/* Compatibility only: the old global chooser name remains a
                          redirect, never a second weekly information architecture. */}
                      <Route path="/fixtures" element={<Navigate to={weeklyRoutes.matches} replace />} />
                      <Route path="/league" element={<Navigate to={weeklyRoutes.leagues} replace />} />
                      <Route path="/more/points" element={<Navigate to="/profile" replace />} />
                      <Route path="/more/scoring" element={<ScoringRulesPage />} />
                      {/* The PLATFORM profile, outside the tournament boundary
                          below. It used to be the Euro tournament profile, which
                          meant every visible Profile control — the top bar, More,
                          the desktop rail — sent a domestic player into a route
                          that `EURO-004` refuses while Euro is hidden, and
                          bounced them back to Home. It reads the account and the
                          shell's membership and nothing about any tournament. */}
                      <Route path="/profile" element={<PlatformProfilePage />} />
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
                        {/* Euro's own player profiles, kept inside the boundary
                            and addressed under `/tournament/` so no domestic
                            surface can link into them by accident. */}
                        <Route path="/tournament/profile" element={<TournamentProfilePage />} />
                        <Route
                          path="/tournament/profile/:playerId"
                          element={<OtherPlayerProfilePage />}
                        />
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
    </SiteProvider>
  )
}
