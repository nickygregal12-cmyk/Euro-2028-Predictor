import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { HUB_COMPETITIONS } from './competitionCatalogue'
import { fetchHubMembership } from '../../services/supabase/competitionGames'
import type { HubSeasonMembership } from '../../services/supabase/competitionGames'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  presentCompetitionChooser,
  type ChooserSection,
} from './competitionChooserModel'
import styles from './CompetitionChooserPage.module.css'
import s from '../shared.module.css'

/**
 * What a global navigation tab shows on a multi-competition platform.
 *
 * Predict, Matches and League in the bottom bar used to be the Euro
 * tournament's own journeys. They now ask which competition, because a global
 * tab cannot name one and the platform stores no favourite — see
 * `competitionChooserModel` for why that is the honest answer rather than a
 * lazy one.
 *
 * ONE JOINED COMPETITION IS STILL SHOWN, NOT REDIRECTED PAST. A redirect would
 * be one tap cheaper and would hide which competition answered — and the first
 * time a player joins a second one, a screen they had never seen would appear
 * where a familiar page used to be. The list is the same shape at one entry as
 * at four.
 *
 * A FAILED READ IS A FAILURE, NEVER AN EMPTY CHOOSER. "You have not joined
 * anything" and "we could not find out" are different sentences, and only one
 * of them should send a player to the Hub to fix it.
 */

export type CompetitionChooserPageProps = {
  section: ChooserSection
  title: string
}

type State =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; seasons: HubSeasonMembership[] }

export function CompetitionChooserPage({ section, title }: CompetitionChooserPageProps) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchHubMembership(HUB_COMPETITIONS.map((competition) => competition.seasonRowName))
      .then((seasons) => {
        if (active) setState({ status: 'ready', seasons })
      })
      .catch((cause) => {
        if (active) setState({ status: 'failed', message: userFacingError(cause) })
      })
    return () => {
      active = false
    }
  }, [attempt])

  if (state.status === 'loading') {
    return (
      <div className={s.page} aria-busy="true">
        <h1 className={s.title}>{title}</h1>
        <Skeleton width="100%" height={72} />
        <Skeleton width="100%" height={72} />
      </div>
    )
  }

  if (state.status === 'failed') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>{title}</h1>
        <Alert variant="error" title="We could not load your competitions">
          {state.message}
        </Alert>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    )
  }

  const view = presentCompetitionChooser(HUB_COMPETITIONS, state.seasons, section)

  return (
    <div className={s.page}>
      <h1 className={s.title}>{title}</h1>

      {view.empty ? (
        <EmptyState
          title="You have not joined a competition yet"
          description="Competitions and the games inside them are joined from the hub."
          action={
            <Link className={styles.hubLink} to="/">
              Go to the hub
            </Link>
          }
        />
      ) : (
        <>
          <p className={styles.intro}>{view.intro}</p>
          <ul className={styles.list}>
            {view.destinations.map((destination) => (
              <li key={destination.key}>
                <Link className={styles.card} to={destination.href}>
                  <span className={styles.name}>{destination.name}</span>
                  <span className={styles.season}>{destination.seasonLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
