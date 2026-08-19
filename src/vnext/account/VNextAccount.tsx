import { motion } from 'framer-motion'
import type {
  AccountPageModel,
  FollowedCompetition,
  FollowsPanel,
  HistoryPanel,
  PlayedSeason,
} from '../models/account'
import { partitionByResult } from '../models/account'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './account.module.css'

/**
 * vNEXT ACCOUNT / YOU.
 *
 * ============================ IT ANSWERS A DEAD BUTTON ==================
 *
 * `shell.ts` has emitted a `kind: 'account'` intent from every vNext surface
 * since Stage 8 — from the desktop rail and the mobile top bar, both rendered
 * as the signed-in player's own initials and name — and no vNext surface has
 * ever answered it. The dev harnesses route it to the LEGACY `/account` page,
 * so pressing your own name currently leaves vNext altogether. This is the
 * answer.
 *
 * IT IS NOT ONE OF THE FOUR DESTINATIONS. `home | matches | games | leagues`
 * are, and none of them should light up while the player is here, so this
 * renders with `destination="none"`.
 *
 * ============================ TWO PANELS, TWO READS ======================
 *
 * Follows (contract 157) and season history (contract 161) resolve separately
 * and are drawn separately. Neither is a fallback for the other, and neither
 * failing may blank the other — the reason each has its own union rather than
 * the page having one "loaded".
 *
 * ============================ WHAT IT WILL NOT SAY =======================
 *
 * A COMPETITION'S NAME IT DOES NOT HAVE. A follow the catalogue no longer
 * lists and the player never played cannot be named by any read this page
 * makes. It renders as a follow the page cannot name, not as a uuid and not as
 * a plausible guess.
 *
 * WHICH CLUB IS THE FAVOURITE. Contract 157 carries an id; resolving it is one
 * competition-scoped read per follow. The page says a favourite is set and
 * sends the player to the competition, where that read already happens.
 *
 * A LINK TO A SEASON THAT CANNOT BE OPENED. Contract 161 supplies a null slug
 * for a season the catalogue no longer publishes, and its own header says
 * saying "archived" beats rendering a link that goes nowhere.
 */

export type AccountIntent =
  | { readonly kind: 'open-season'; readonly competitionSlug: string; readonly seasonKey: string }
  | { readonly kind: 'manage-follow'; readonly tournamentId: string }

export type VNextAccountProps = {
  readonly model: AccountPageModel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}

export function VNextAccount({ model, onRetry, refreshing = false, onIntent }: VNextAccountProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context } = model

  return (
    <VNextShell
      destination="none"
      header={
        <VNextPageHeader
          title="You"
          competition={context.displayName ?? 'Your account'}
          context="Account"
        />
      }
    >
      <div className={styles.page}>
        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Follows panel={model.follows} onRetry={onRetry} refreshing={refreshing} onIntent={onIntent} />
          <History panel={model.history} onRetry={onRetry} onIntent={onIntent} />
        </motion.div>
      </div>
    </VNextShell>
  )
}

/* ==========================================================================
   FOLLOWS
   ========================================================================== */

function Follows({
  panel,
  onRetry,
  refreshing,
  onIntent,
}: {
  readonly panel: FollowsPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing: boolean
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  return (
    <section className={styles.panel} data-vnext-zone="follows">
      <h2 className={`${text.h2 ?? text.title} ${styles.panelHeading}`}>Competitions you follow</h2>

      {panel.kind === 'unavailable' ? (
        <div className={styles.empty}>
          <p className={text.body}>We could not load what you follow just now.</p>
          {onRetry === undefined ? null : (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : panel.kind === 'empty' ? (
        // A REAL ANSWER, and phrased as one. "You follow nothing" and "we could
        // not find out" send a player to different screens, so they read
        // differently here too.
        <p className={`${text.body} ${styles.empty}`} data-vnext-zone="follows-empty">
          You are not following any competitions yet.
        </p>
      ) : (
        <ul className={styles.list} data-refreshing={refreshing || undefined}>
          {panel.competitions.map((competition) => (
            <FollowRow key={competition.tournamentId} competition={competition} onIntent={onIntent} />
          ))}
        </ul>
      )}
    </section>
  )
}

function FollowRow({
  competition,
  onIntent,
}: {
  readonly competition: FollowedCompetition
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  const { identity, favourite } = competition

  return (
    <li className={styles.row} data-vnext-follow={identity.kind}>
      <div className={styles.rowMain}>
        {identity.kind === 'named' ? (
          <>
            <p className={`${text.body} ${styles.rowTitle}`}>{identity.competitionName}</p>
            <p className={`${text.micro} ${styles.rowMeta}`}>{identity.seasonName}</p>
          </>
        ) : (
          // NOT A UUID AND NOT A GUESS. The follow is real; the name is not
          // available from any read this page makes.
          <>
            <p className={`${text.body} ${styles.rowTitle}`}>A competition you follow</p>
            <p className={`${text.micro} ${styles.rowMeta}`}>
              We cannot show its name here — it is no longer in the catalogue and
              you have not played a season of it.
            </p>
          </>
        )}

        {favourite.kind === 'set' ? (
          // THE FACT, NOT THE CLUB. See the model: naming it is one extra read
          // per follow, and it belongs beside the competition anyway.
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="favourite">
            You have picked a favourite club for this competition.
          </p>
        ) : null}
      </div>

      {identity.kind === 'named' && identity.route !== null ? (
        <button
          type="button"
          className={styles.rowAction}
          onClick={() =>
            onIntent?.({
              kind: 'open-season',
              competitionSlug: identity.route!.competitionSlug,
              seasonKey: identity.route!.seasonKey,
            })
          }
        >
          Open
          <span className={text.srOnly}> {identity.competitionName}</span>
        </button>
      ) : null}
    </li>
  )
}

/* ==========================================================================
   SEASON HISTORY
   ========================================================================== */

function History({
  panel,
  onRetry,
  onIntent,
}: {
  readonly panel: HistoryPanel
  readonly onRetry?: (() => void) | undefined
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  return (
    <section className={styles.panel} data-vnext-zone="history">
      <h2 className={`${text.h2 ?? text.title} ${styles.panelHeading}`}>Your seasons</h2>

      {panel.kind === 'unavailable' ? (
        <div className={styles.empty}>
          <p className={text.body}>We could not load your seasons just now.</p>
          {onRetry === undefined ? null : (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : panel.kind === 'empty' ? (
        <p className={`${text.body} ${styles.empty}`} data-vnext-zone="history-empty">
          You have not played a season yet.
        </p>
      ) : (
        <Seasons panel={panel} onIntent={onIntent} />
      )}
    </section>
  )
}

function Seasons({
  panel,
  onIntent,
}: {
  readonly panel: Extract<HistoryPanel, { kind: 'seasons' }>
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  // GROUPED, NOT SORTED. `partitionByResult` keeps the server's order inside
  // each group; contract 161 ordered its own seasons and nothing here re-ranks.
  const { finished, ongoing } = partitionByResult(panel.seasons)

  return (
    <>
      {ongoing.length === 0 ? null : (
        <>
          <h3 className={`${text.micro} ${styles.groupHeading}`}>Still going</h3>
          <ul className={styles.list} data-vnext-zone="ongoing">
            {ongoing.map((season) => (
              <SeasonRow key={season.tournamentId} season={season} onIntent={onIntent} />
            ))}
          </ul>
        </>
      )}

      {finished.length === 0 ? null : (
        <>
          <h3 className={`${text.micro} ${styles.groupHeading}`}>Finished</h3>
          <ul className={styles.list} data-vnext-zone="finished">
            {finished.map((season) => (
              <SeasonRow key={season.tournamentId} season={season} onIntent={onIntent} />
            ))}
          </ul>
        </>
      )}

      {panel.hasMore ? (
        // THE SERVER'S OWN PAGING FACT. Stated rather than silently truncating,
        // so a player with a long history knows this is not all of it.
        <p className={`${text.micro} ${styles.groupHeading}`} data-vnext-zone="has-more">
          Showing {panel.seasons.length} of {panel.total} seasons.
        </p>
      ) : null}
    </>
  )
}

function SeasonRow({
  season,
  onIntent,
}: {
  readonly season: PlayedSeason
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  return (
    <li className={styles.row} data-vnext-season={season.tournamentId}>
      <div className={styles.rowMain}>
        <p className={`${text.body} ${styles.rowTitle}`}>{season.seasonName}</p>
        {season.competitionName === null ? null : (
          <p className={`${text.micro} ${styles.rowMeta}`}>{season.competitionName}</p>
        )}

        {season.result === null ? null : (
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="result">
            <strong className={text.numeric}>{season.result.points}</strong> points
            {season.result.rank === null ? null : (
              <>
                {' · finished '}
                <strong className={text.numeric}>{season.result.rank}</strong>
                {season.result.fieldSize === null ? null : ` of ${season.result.fieldSize}`}
              </>
            )}
            {` · ${season.result.matchweeksPlayed} matchweeks`}
          </p>
        )}

        {season.games.length === 0 ? null : (
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="games">
            {season.games.map((game) => game.gameName).join(' · ')}
          </p>
        )}

        {season.inPublishedCatalogue ? null : (
          // ARCHIVED IS A FACT, and a better one than a link that goes nowhere.
          <p className={`${text.micro} ${styles.archived}`} data-vnext-zone="archived">
            Archived — no longer in the catalogue.
          </p>
        )}
      </div>

      {season.route === null ? null : (
        <button
          type="button"
          className={styles.rowAction}
          onClick={() =>
            onIntent?.({
              kind: 'open-season',
              competitionSlug: season.route!.competitionSlug,
              seasonKey: season.route!.seasonKey,
            })
          }
        >
          Open
          <span className={text.srOnly}> {season.seasonName}</span>
        </button>
      )}
    </li>
  )
}
