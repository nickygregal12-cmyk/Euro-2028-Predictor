import { useEffect, useState } from 'react'
import { Alert, Skeleton, StatCard } from '../../design-system'
import type {
  SeasonHistoryEntry,
  SeasonHistoryPage,
} from '../../services/supabase/seasonHistoryModel'
import styles from './SeasonHistorySection.module.css'

/**
 * Season history — every season this player has taken part in (contract 161,
 * `MIG-UI-17`), with contract 156's stored Wrapped where one exists.
 *
 * IT IS KEYED ON PARTICIPATION, NOT PUBLICATION, AND THAT IS THE FIX. This
 * section used to ask `get_season_wrapped` once per competition in the
 * PUBLISHED catalogue, which meant a season stopped being findable the day it
 * stopped being published — a player's 2026/27 would vanish from their own
 * history when it was archived, and the surface had to say so in its own copy.
 * `get_my_season_history` asks the other question: which seasons did YOU play
 * in. The apology is gone with the gap.
 *
 * IT IS ONE READ, NOT N. The previous shape issued one request per competition
 * and reported each failure separately. One paginated read replaces them, so a
 * player with twenty seasons costs one round trip rather than twenty.
 *
 * NOTHING IS RECOMPUTED. `final` is contract 156's immutable snapshot, present
 * only where a Wrapped was finalised. There is no derived percentile — one
 * computed here from rank and field size would be a number the archive never
 * agreed to — and no career total, because ADR 0011 says no authority computes
 * one.
 *
 * A SEASON STILL BEING PLAYED IS LISTED AND SAYS SO. It is part of a player's
 * history the moment they enter it; what it does not have is a final, and
 * printing zeros for one would be a lie about a season they might be winning.
 *
 * A SEASON THE CATALOGUE NO LONGER PUBLISHES IS LISTED AND IS NOT A LINK.
 * `inPublishedCatalogue` is the server's answer about routability, and an
 * archived season is named rather than given a link that goes nowhere.
 */

export type SeasonHistorySectionProps = {
  /**
   * Contract 161's read. Injected so the section is testable without a client,
   * and defaulted by the page that mounts it.
   */
  read: () => Promise<SeasonHistoryPage>
}

export function SeasonHistorySection({ read }: SeasonHistorySectionProps) {
  const [page, setPage] = useState<SeasonHistoryPage | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setPage(null)
    setFailed(false)
    read()
      .then((next) => {
        if (active) setPage(next)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [read])

  if (failed) {
    return (
      <section className={styles.section}>
        <h2 className={styles.title}>Season history</h2>
        {/* A failed read is a failure. "You have played nothing" is a claim
            about the player and this read never made it. */}
        <Alert variant="warning" title="We could not load your season history">
          This is a failed read, not an empty history.
        </Alert>
      </section>
    )
  }

  if (page === null) {
    return (
      <section className={styles.section} aria-busy="true">
        <h2 className={styles.title}>Season history</h2>
        <Skeleton width="100%" height={120} />
      </section>
    )
  }

  if (page.seasons.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.title}>Season history</h2>
        <p className={styles.empty}>
          You have not played a season yet. Join a game in a competition and it will appear here —
          and it will stay here afterwards, whether or not the competition is still running.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Season history</h2>
      <ul className={styles.list}>
        {page.seasons.map((entry) => (
          <SeasonCard key={entry.tournamentId} entry={entry} />
        ))}
      </ul>
      {page.hasMore ? (
        // The bound, stated. A page nobody knows is a page reads as a complete
        // history.
        <p className={styles.note}>
          Showing {page.seasons.length} of {page.total} seasons.
        </p>
      ) : null}
    </section>
  )
}

function SeasonCard({ entry }: { entry: SeasonHistoryEntry }) {
  const games = entry.games
    .map((game) => game.gameName ?? game.gameKey)
    .filter((name): name is string => Boolean(name))

  return (
    <li className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardName}>{entry.competitionName ?? entry.seasonName}</span>
        <span className={styles.cardSeason}>{entry.seasonKey ?? ''}</span>
        {/* Named rather than linked. The server says whether the catalogue
            still publishes it, and an archived season given a link would be a
            link that goes nowhere. */}
        {!entry.inPublishedCatalogue ? (
          <span className={styles.cardSeason}>Archived</span>
        ) : null}
      </header>

      {entry.final ? (
        <>
          <div className={styles.stats}>
            <StatCard label="Points" value={String(entry.final.points)} />
            <StatCard
              label="Finished"
              value={
                entry.final.rank !== null && entry.final.fieldSize !== null
                  ? `${entry.final.rank} of ${entry.final.fieldSize}`
                  : entry.final.rank !== null
                    ? String(entry.final.rank)
                    : '—'
              }
            />
            <StatCard label="Matchweeks played" value={String(entry.final.matchweeksPlayed)} />
          </div>
        </>
      ) : (
        <p className={styles.note}>
          {entry.complete
            ? 'This season has finished. Its Wrapped has not been written yet.'
            : 'Still being played — its final record is written when the season ends.'}
        </p>
      )}

      {games.length > 0 ? (
        <dl className={styles.detail}>
          <div className={styles.detailRow}>
            <dt>Games</dt>
            <dd>{games.join(', ')}</dd>
          </div>
        </dl>
      ) : null}
    </li>
  )
}
