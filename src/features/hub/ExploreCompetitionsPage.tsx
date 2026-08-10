import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, Skeleton, TextInput } from '../../design-system'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { competitionPath } from './competitionCatalogue'
import { presentExplore, type ExploreEntry } from './exploreModel'
import styles from './ExploreCompetitionsPage.module.css'
import s from '../shared.module.css'

/**
 * `/competitions` — the whole published catalogue, as deliberate discovery.
 *
 * IT IS NOT A SIXTH GLOBAL DESTINATION. The 10 August navigation authority
 * keeps the catalogue out of permanent navigation: the rail carries a bounded
 * few of the player's own competitions and then one link to here. That is the
 * scalability rule in one sentence — a platform with twenty published
 * competitions and a player relevant to three must feel like a
 * three-competition product, and the other seventeen live behind this page.
 *
 * IT IS BUILT FOR A CATALOGUE THAT GROWS. Search filters as you type and the
 * player's own competitions are pinned above everything else, so the page does
 * not degrade into one flat wall of equal cards. Grouping beyond that —
 * region, competition type, popularity — is data the catalogue does not carry
 * yet; the model has the seam for it and this page does not invent one.
 *
 * THERE IS NO FOLLOW BUTTON, AND THAT IS DELIBERATE. Follow is a distinct
 * choice from joining a game, and nothing in the repository can persist it: the
 * audit is `MIG-UI-10`. A Follow control here would be a dead one, or worse,
 * one that silently meant "join". The page says what it can offer instead —
 * open the competition, where joining a game is a real, server-owned action.
 */

export function ExploreCompetitionsPage() {
  const { status, player, reload } = usePlayerCompetitions()
  const [query, setQuery] = useState('')

  const view = useMemo(() => presentExplore(player, query), [player, query])

  if (status === 'failed') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>All competitions</h1>
        <Alert variant="error" title="We could not load your competitions">
          The catalogue is still below, but which of these are yours could not be checked.
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={s.page} aria-busy="true">
        <h1 className={s.title}>All competitions</h1>
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={96} />
      </div>
    )
  }

  return (
    <div className={s.page}>
      <h1 className={s.title}>All competitions</h1>
      <p className={styles.intro}>
        Every competition on the platform. Opening one shows its fixtures and the games it runs;
        joining a game happens inside it.
      </p>

      <TextInput
        label="Search competitions"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Premier League, Scottish…"
      />

      {view.groups.map((group) => (
        <section className={styles.group} key={group.key} aria-labelledby={`explore-${group.key}`}>
          <div className={styles.groupHead}>
            <h2 className={styles.groupTitle} id={`explore-${group.key}`}>
              {group.title}
            </h2>
            <span className={styles.count}>{group.entries.length}</span>
          </div>
          {group.note ? <p className={styles.note}>{group.note}</p> : null}
          <ul className={styles.list}>
            {group.entries.map((entry) => (
              <li key={entry.key}>
                <CompetitionRow entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {view.noMatches ? (
        <p className={styles.none}>No competition matches “{query}”.</p>
      ) : null}

      {/* Stated once, at the bottom, where it explains the absence of a control
          rather than interrupting the list. */}
      <p className={styles.followNote}>
        Following a competition for its football alone — without joining a game — is not stored yet,
        so there is no Follow button here. Competitions you play in appear above automatically.
      </p>
    </div>
  )
}

function CompetitionRow({ entry }: { entry: ExploreEntry }) {
  return (
    <Link className={styles.card} to={competitionPath(entry.competition)}>
      <span className={styles.name}>{entry.competition.name}</span>
      <span className={styles.season}>{entry.competition.seasonLabel}</span>
      <span className={styles.summary}>{entry.competition.summary}</span>
      <span className={styles.state}>
        {/* Membership, never "followed": the two are different choices and only
            one of them has an authority behind it. */}
        {entry.playing.length > 0
          ? `Playing ${entry.playing.length === 1 ? '1 game' : `${entry.playing.length} games`}`
          : `${entry.competition.games.length} games available`}
      </span>
    </Link>
  )
}
