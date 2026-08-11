import { Link } from 'react-router'
import { Alert, EmptyState, Skeleton } from '../../design-system'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { useAuth } from '../auth/AuthProvider'
import { competitionPlayerRoute, competitionRoute, weeklyRoutes } from '../../app/weeklyRoutes'
import { GAME_PRESENTATION } from '../hub/competitionCatalogue'
import { SeasonHistorySection } from './SeasonHistorySection'
import s from '../shared.module.css'
import styles from './PlatformProfilePage.module.css'

/**
 * `/profile` — the signed-in player's PLATFORM profile.
 *
 * WHY THIS PAGE EXISTS, AND WHAT IT FIXED. `/profile` used to be the Euro 2028
 * tournament profile, registered inside `TournamentJourney`. Since `EURO-004`
 * that boundary refuses every player route while Euro's publication state is
 * `hidden` — which it is — so the visible Profile controls in the top bar, in
 * More and on the desktop rail all sent a domestic player to a route that
 * bounced them straight back to Home. A visible control that cannot work is the
 * dead control the finishing standard forbids, and this is the route that makes
 * it work.
 *
 * IT DEPENDS ON NO COMPETITION AND ON NO PUBLICATION STATE. It is registered
 * outside the tournament boundary and reads the account and the shell's own
 * membership answer. Opening it loads no tournament dataset.
 *
 * IT INVENTS NO CROSS-COMPETITION TOTAL. There is no combined score, rank or
 * career figure anywhere on it, because no authority computes one: ADR 0011
 * keeps every game's scoring its own and ADR 0012 ranks a season on that
 * season's points. What this page holds is IDENTITY and ROUTES — who the player
 * is, which competition seasons they play in, which games in each — and each
 * season's own record is one link away, at the season profile contract 151
 * answers.
 *
 * SEASON HISTORY IS REAL NOW, AND ONLY AS FAR AS THE ARCHIVE GOES. Contract 156
 * (`MIG-UI-08`) writes a Wrapped once a season has ended, immutably, and
 * `SeasonHistorySection` renders exactly what it stored. There is still no
 * trophy case and no streak count, because the archive holds neither; the page
 * continues to say nothing about them rather than rendering empty furniture.
 * What it also cannot do is FIND a Wrapped for a season nobody publishes any
 * more — `get_season_wrapped` is addressed by one season id and nothing lists
 * which ones a player has — so the section says that in words. `MIG-UI-17`.
 */
export function PlatformProfilePage() {
  const { displayName, userId } = useAuth()
  const { status, player } = usePlayerCompetitions()

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Profile</h1>
      </div>

      <section className={styles.identity}>
        <p className={styles.name}>{displayName ?? 'Your profile'}</p>
        <p className={styles.identityNote}>
          Your display name is what other players in your private leagues see. Change it in
          Account.
        </p>
      </section>

      <h2 className={styles.sectionTitle}>Your competitions</h2>

      {status === 'loading' ? (
        <div aria-busy="true" aria-live="polite">
          <Skeleton width="100%" height={72} />
          <Skeleton width="100%" height={72} />
        </div>
      ) : status === 'failed' || player === null ? (
        // Failed is not empty. "You play in nothing" and "we could not find out"
        // send a player to different places.
        <Alert variant="warning" title="Your competitions could not be loaded">
          This is a failure to read your memberships, not an empty account.
        </Alert>
      ) : player.mine.length === 0 ? (
        <EmptyState
          title="You have not joined a game yet"
          description="Joining a game in a competition is what gives you a season to have. Browse what is published and pick one."
          action={
            <Link className={styles.card} to={weeklyRoutes.competitions}>
              All competitions
            </Link>
          }
        />
      ) : (
        <ul className={styles.list}>
          {player.mine.map((entry) => {
            const ref = {
              competitionSlug: entry.competition.competitionSlug,
              seasonSlug: entry.competition.seasonSlug,
            }
            const games = entry.joinedGames.map(
              (gameKey) => GAME_PRESENTATION[gameKey]?.name ?? gameKey,
            )
            // Only the player's own season profile is linked from here, and
            // only for themselves. This page is not, and must not become, a way
            // to reach anybody else — contract 151 answers about one named
            // player and there is no directory.
            const href = userId
              ? competitionPlayerRoute(ref, userId)
              : competitionRoute(ref)

            return (
              <li key={entry.competition.seasonRowName}>
                <Link className={styles.card} to={href}>
                  <span className={styles.cardTop}>
                    <span className={styles.cardName}>{entry.competition.name}</span>
                    <span className={styles.cardSeason}>{entry.competition.seasonLabel}</span>
                  </span>
                  <span className={styles.games}>
                    {games.length > 0 ? games.join(' · ') : 'No games joined'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <p className={styles.note}>
        Points and rank belong to a season, not to an account: each competition is scored on its
        own. Open a competition above to see the season you are having in it.
      </p>

      {status === 'ready' && player !== null ? (
        <SeasonHistorySection competitions={player.mine} />
      ) : null}
    </div>
  )
}
