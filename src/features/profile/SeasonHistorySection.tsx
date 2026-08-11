import { useEffect, useState } from 'react'
import { Alert, Skeleton, StatCard } from '../../design-system'
import type { CompetitionRelevance } from '../hub/playerCompetitions'
import {
  correctOutcomeRate,
  exactScoreRate,
  type SeasonWrapped,
} from '../../services/supabase/seasonWrappedModel'
import styles from './SeasonHistorySection.module.css'

/**
 * Season history — the seasons this player has finished, as the archive
 * recorded them (contract 156, `MIG-UI-08`).
 *
 * IT READS A SNAPSHOT AND RECOMPUTES NOTHING. `season_wrapped` is written once,
 * when the season has ended, is immutable by trigger and stores facts rather
 * than presentation. Every number below is one it stored. There is no derived
 * percentile here, no combined career total and no trophy count: a percentile
 * computed in the browser from rank and field size would be a number the archive
 * never agreed to, and a career total would be the cross-competition figure
 * ADR 0011 says no authority computes.
 *
 * A SEASON WITH NO WRAPPED IS SIMPLY NOT LISTED. `{ finalised: false }` is the
 * common case — every season still being played answers it — and it is a real
 * answer rather than an error. It is never rendered as a season of zeros, which
 * would be a lie about a season the player is currently winning.
 *
 * WHAT IT CANNOT SEE, STATED RATHER THAN HIDDEN. `get_season_wrapped` is
 * addressed by one `tournament_id`, and nothing lists which seasons a player
 * HAS a Wrapped for. So this can only ask about the seasons the shell already
 * knows about — the currently published catalogue — and a season archived and
 * unpublished years ago is invisible to it. That is `MIG-UI-17` in the accepted
 * requirements, and the section says so in words rather than implying the
 * archive is empty.
 *
 * EVERY SEASON IS ASKED IN PARALLEL AND FAILURES ARE PER SEASON. One unreadable
 * season must not blank the others; a season that failed is reported as
 * unreadable rather than dropped, because "we could not read it" and "you never
 * finished one" are different sentences.
 */

export type SeasonHistorySectionProps = {
  competitions: readonly CompetitionRelevance[]
}

type Entry = {
  name: string
  seasonLabel: string
  wrapped: SeasonWrapped | 'failed'
}

export function SeasonHistorySection({ competitions }: SeasonHistorySectionProps) {
  const [entries, setEntries] = useState<readonly Entry[] | null>(null)

  useEffect(() => {
    let active = true
    const targets = competitions.filter((entry) => entry.tournamentId !== null)
    if (targets.length === 0) {
      setEntries([])
      return
    }
    setEntries(null)
    void (async () => {
      const { fetchSeasonWrapped } = await import('../../services/supabase/seasonWrapped')
      const loaded = await Promise.all(
        targets.map(async (entry): Promise<Entry> => {
          const base = {
            name: entry.competition.name,
            seasonLabel: entry.competition.seasonLabel,
          }
          try {
            return { ...base, wrapped: await fetchSeasonWrapped(entry.tournamentId as string) }
          } catch {
            return { ...base, wrapped: 'failed' }
          }
        }),
      )
      if (active) setEntries(loaded)
    })()
    return () => {
      active = false
    }
  }, [competitions])

  if (entries === null) {
    return (
      <section className={styles.section} aria-busy="true">
        <h2 className={styles.title}>Season history</h2>
        <Skeleton width="100%" height={120} />
      </section>
    )
  }

  const finalised = entries.filter(
    (entry): entry is Entry & { wrapped: Extract<SeasonWrapped, { finalised: true }> } =>
      entry.wrapped !== 'failed' && entry.wrapped.finalised,
  )
  const failed = entries.filter((entry) => entry.wrapped === 'failed')

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Season history</h2>

      {finalised.length === 0 ? (
        <p className={styles.empty}>
          No season you play in has finished yet. When one does, its Wrapped is written once and
          kept — final points, where you finished, your best matchweek and how often you called it
          exactly.
        </p>
      ) : (
        <ul className={styles.list}>
          {finalised.map((entry) => (
            <WrappedCard key={`${entry.name}-${entry.seasonLabel}`} entry={entry} />
          ))}
        </ul>
      )}

      {failed.length > 0 ? (
        <Alert variant="warning" title="Some seasons could not be read">
          {failed.map((entry) => `${entry.name} ${entry.seasonLabel}`).join(', ')} could not be
          checked just now.
        </Alert>
      ) : null}

      {/* Said once, plainly, rather than leaving a player to conclude the
          archive lost their old seasons. */}
      <p className={styles.note}>
        This lists the seasons in competitions currently published. A finished season that is no
        longer listed cannot be looked up yet.
      </p>
    </section>
  )
}

function WrappedCard({
  entry,
}: {
  entry: Entry & { wrapped: Extract<SeasonWrapped, { finalised: true }> }
}) {
  const { season, accuracy, bestMatchweek, jokersPlayed } = entry.wrapped
  const exact = exactScoreRate(accuracy)
  const outcomes = correctOutcomeRate(accuracy)

  return (
    <li className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardName}>{entry.name}</span>
        <span className={styles.cardSeason}>{entry.seasonLabel}</span>
      </header>

      <div className={styles.stats}>
        <StatCard label="Points" value={String(season.points)} />
        <StatCard
          label="Finished"
          // Rank and field size are printed together or not at all: "7th" with
          // no field is a different claim from "7th of 1,204".
          value={
            season.rank !== null && season.fieldSize !== null
              ? `${season.rank} of ${season.fieldSize}`
              : season.rank !== null
                ? String(season.rank)
                : '—'
          }
        />
        <StatCard label="Matchweeks played" value={String(season.matchweeksPlayed)} />
        {bestMatchweek ? (
          <StatCard
            label={`Best matchweek (${bestMatchweek.ordinal})`}
            value={String(bestMatchweek.points)}
          />
        ) : null}
      </div>

      <dl className={styles.detail}>
        <div className={styles.detailRow}>
          <dt>Fixtures predicted</dt>
          <dd>{accuracy.fixturesPredicted}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Exact scores</dt>
          <dd>
            {accuracy.exactScores}
            {exact !== null ? ` (${Math.round(exact * 100)}%)` : ''}
          </dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Correct outcomes</dt>
          <dd>
            {accuracy.correctOutcomes}
            {outcomes !== null ? ` (${Math.round(outcomes * 100)}%)` : ''}
          </dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Jokers played</dt>
          <dd>{jokersPlayed}</dd>
        </div>
      </dl>
    </li>
  )
}
