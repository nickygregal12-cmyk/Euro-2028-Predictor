import { motion } from 'framer-motion'
import type {
  CataloguePanel,
  DiscoverableSeason,
  DiscoveryPageModel,
  FollowKnowledge,
} from '../models/discovery'
import { offersFollow, offersUnfollow } from '../models/discovery'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './discovery.module.css'

/**
 * vNEXT DISCOVERY — the whole published catalogue.
 *
 * ============================ IT IS THE PLATFORM'S LIST, NOT THE PLAYER'S =
 *
 * Every other surface in this lane shows the player's own competitions. This
 * one shows what the platform publishes, which is the only place a player can
 * find something they are not already in. That is why the matrix keeps its
 * address while taking it out of the permanent navigation: it is a deliberate
 * act, not a destination.
 *
 * ============================ FOLLOWING IS NOT JOINING ===================
 *
 * Contract 157's migration refuses to install if following ever creates a game
 * entry. Nothing here may suggest otherwise: the control says Follow, the copy
 * says what following does, and getting into a game happens in the game.
 *
 * ============================ THERE IS NO FOLLOW TOGGLE ==================
 *
 * Follow appears only for a season the player does not follow; Unfollow only
 * for one they do. Never both, and never one control that flips. The write is
 * an upsert whose favourite argument defaults to null, so a follow re-sent for
 * a competition already followed CLEARS the player's favourite club — and a
 * toggle is exactly the shape that re-sends.
 *
 * While the follow state is UNKNOWN — the preferences read failed and the
 * catalogue did not — neither control is drawn. The catalogue is still worth
 * reading; the write is not worth guessing at.
 */

export type DiscoveryIntent =
  | { readonly kind: 'open-season'; readonly competitionSlug: string; readonly seasonKey: string }
  | { readonly kind: 'follow'; readonly tournamentId: string }
  | { readonly kind: 'unfollow'; readonly tournamentId: string }

export type VNextDiscoveryProps = {
  readonly model: DiscoveryPageModel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean
  readonly onIntent?: ((intent: DiscoveryIntent) => void) | undefined
  /** A follow write is in flight for this season, named so one row's work does not disable the rest. */
  readonly busyTournamentId?: string | null
  /**
   * A follow write that did not land, and the season it was for.
   *
   * NAMED, FOR THE SAME REASON `busyTournamentId` IS. A write that fails
   * silently is the worst of the three outcomes: the control returns to
   * "Follow" and the row is telling the truth about the server while telling a
   * player nothing about their own press. One row failing must not blank the
   * catalogue, so this is a sentence in a row rather than a page state — and
   * never a modal, because there is nothing to decide.
   */
  readonly writeFailure?:
    | { readonly tournamentId: string; readonly message: string }
    | null
    | undefined
}

export function VNextDiscovery({
  model,
  onRetry,
  refreshing = false,
  onIntent,
  busyTournamentId = null,
  writeFailure = null,
}: VNextDiscoveryProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)

  return (
    <VNextShell
      // NOT ONE OF THE FOUR. Discovery is reached from Explore, not from the
      // navigation, so nothing lights up while the player is here.
      destination="none"
      header={
        <VNextPageHeader
          title="Competitions"
          competition="Everything published"
          context="Discover"
        />
      }
    >
      <div className={styles.page}>
        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Catalogue
            panel={model.catalogue}
            knowledge={model.followKnowledge}
            onRetry={onRetry}
            refreshing={refreshing}
            onIntent={onIntent}
            busyTournamentId={busyTournamentId}
            writeFailure={writeFailure}
          />
        </motion.div>
      </div>
    </VNextShell>
  )
}

function Catalogue({
  panel,
  knowledge,
  onRetry,
  refreshing,
  onIntent,
  busyTournamentId,
  writeFailure,
}: {
  readonly panel: CataloguePanel
  readonly knowledge: FollowKnowledge
  readonly onRetry?: (() => void) | undefined
  readonly refreshing: boolean
  readonly onIntent?: ((intent: DiscoveryIntent) => void) | undefined
  readonly busyTournamentId: string | null
  readonly writeFailure: { readonly tournamentId: string; readonly message: string } | null
}) {
  if (panel.kind === 'unavailable') {
    return (
      <div className={styles.empty} data-vnext-zone="unavailable">
        <p className={text.body}>We could not load the competition list just now.</p>
        {onRetry === undefined ? null : (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    )
  }

  if (panel.kind === 'empty') {
    return (
      <p className={`${text.body} ${styles.empty}`} data-vnext-zone="no-competitions">
        There are no published competitions right now.
      </p>
    )
  }

  return (
    <>
      {knowledge === 'unknown' ? (
        // SAID, NOT HIDDEN. The rows below carry no Follow control, and a
        // player deserves to know that is a fault rather than a rule.
        <p className={`${text.micro} ${styles.knowledgeNote}`} data-vnext-zone="follow-unknown">
          We could not check which of these you already follow, so following is
          unavailable for the moment. Everything else here is up to date.
        </p>
      ) : null}

      <ul className={styles.list} data-refreshing={refreshing || undefined}>
        {panel.seasons.map((season) => (
          <SeasonRow
            key={season.tournamentId}
            season={season}
            knowledge={knowledge}
            onIntent={onIntent}
            busy={busyTournamentId === season.tournamentId}
            failure={
              writeFailure && writeFailure.tournamentId === season.tournamentId
                ? writeFailure.message
                : null
            }
          />
        ))}
      </ul>
    </>
  )
}

function SeasonRow({
  season,
  knowledge,
  onIntent,
  busy,
  failure,
}: {
  readonly season: DiscoverableSeason
  readonly knowledge: FollowKnowledge
  readonly onIntent?: ((intent: DiscoveryIntent) => void) | undefined
  readonly busy: boolean
  readonly failure: string | null
}) {
  const canFollow = offersFollow(season, knowledge)
  const canUnfollow = offersUnfollow(season, knowledge)

  return (
    <li
      className={styles.row}
      data-vnext-season={season.tournamentId}
      data-follow={knowledge === 'known' ? season.follow : 'unknown'}
    >
      <div className={styles.rowMain}>
        <p className={`${text.body} ${styles.rowTitle}`}>{season.competitionName}</p>
        <p className={`${text.micro} ${styles.rowMeta}`}>{season.seasonName}</p>
        {season.status === null ? null : (
          // THE CATALOGUE'S OWN WORD. Not a publication state and not styled as
          // one — the weekly platform has no equivalent of Euro's.
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="status">
            {season.status}
          </p>
        )}
      </div>

      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.rowAction}
          onClick={() =>
            onIntent?.({
              kind: 'open-season',
              competitionSlug: season.route.competitionSlug,
              seasonKey: season.route.seasonKey,
            })
          }
        >
          Look inside
          <span className={text.srOnly}> {season.competitionName}</span>
        </button>

        {canFollow ? (
          <button
            type="button"
            className={styles.rowFollow}
            disabled={busy}
            onClick={() => onIntent?.({ kind: 'follow', tournamentId: season.tournamentId })}
          >
            {busy ? 'Following…' : 'Follow'}
            <span className={text.srOnly}> {season.competitionName}</span>
          </button>
        ) : null}

        {canUnfollow ? (
          <button
            type="button"
            className={styles.rowAction}
            disabled={busy}
            onClick={() => onIntent?.({ kind: 'unfollow', tournamentId: season.tournamentId })}
          >
            {busy ? 'Updating…' : 'Unfollow'}
            <span className={text.srOnly}> {season.competitionName}</span>
          </button>
        ) : null}
      </div>

      {failure === null ? null : (
        // `role="status"` RATHER THAN `alert`. The row is unchanged, nothing is
        // lost and the player may simply press again — polite is the honest
        // register, and an assertive interruption for a retryable write talks
        // over whatever else the page just said.
        //
        // THE CONTROL BESIDE IT IS THE RETRY. It has already returned to
        // "Follow" because the write did not land, so there is nothing to add
        // and nothing to decide; a second button would be the same press twice.
        <p
          className={`${text.micro} ${styles.rowFailure}`}
          role="status"
          data-vnext-zone="follow-failed"
        >
          {failure}
        </p>
      )}
    </li>
  )
}
