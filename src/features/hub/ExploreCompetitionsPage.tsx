import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, Skeleton, TextInput, Workspace } from '../../design-system'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { competitionPath } from './competitionCatalogue'
// The pure helper only. Naming `services/supabase/playerPreferences` at module
// scope pulls `client.ts` into the graph of anything that renders this page,
// and that module throws at load without configuration — the same reason the
// Account card imports its writes lazily.
import { isFollowing } from '../../services/supabase/playerPreferencesModel'
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
 * FOLLOW IS HERE NOW, AND THE PARAGRAPH THAT SAID IT COULD NOT BE IS CORRECTED
 * RATHER THAN DELETED. This docblock and a note at the foot of the page both
 * stated that following could not be persisted and that a Follow control would
 * therefore be a dead one — true when they were written, and stale from the
 * moment contract 157 landed `set_competition_follow` on 11 August 2026. The
 * Account page has offered follow and unfollow since that day, so the platform
 * has been telling a player on ONE surface that a preference is unstorable
 * while storing it on another. That is worse than a missing control.
 *
 * FOLLOW IS STILL NOT JOINING, AND THE CONTROL SAYS SO. The server writes no
 * membership row either way; the button's own label and the row's state line
 * keep membership and following visibly apart, because merging them is exactly
 * what §2A forbids. `Favourite` is not offered here — it is per competition and
 * constrained to a club that plays in it, which needs the club list Account
 * loads on demand, and duplicating that here would be a second picker over one
 * preference.
 *
 * THE CONTROL IS ABSENT RATHER THAN DISABLED WHERE IT CANNOT WORK. If the
 * preference read did not land, `preferences` is null and no button is
 * rendered: a Follow control that cannot know whether the player already
 * follows would have to guess its own label.
 */

export function ExploreCompetitionsPage() {
  const { status, player, preferences, reload } = usePlayerCompetitions()
  const [query, setQuery] = useState('')
  /** The competition being written, so only its own control shows the wait. */
  const [busy, setBusy] = useState<string | null>(null)
  const [followError, setFollowError] = useState<string | null>(null)

  const view = useMemo(() => presentExplore(player, query), [player, query])

  /**
   * Follow, then reload the shell.
   *
   * NOT AN OPTIMISTIC LOCAL EDIT, for the same reason the Account card is not
   * one: the shell's model is what the Hub, the rail, the switcher and the
   * Match Centre all read, so a preference changed here has to change there in
   * the same breath. Re-reading is the only way to get that without a second
   * source of truth.
   */
  async function toggleFollow(tournamentId: string, following: boolean) {
    setBusy(tournamentId)
    setFollowError(null)
    try {
      const { setCompetitionFollow } = await import(
        '../../services/supabase/playerPreferences'
      )
      await setCompetitionFollow(tournamentId, following)
      // Synchronous: the provider's `reload` bumps a nonce and the read
      // happens in its own effect. Awaiting it would await `undefined`.
      reload()
    } catch (error: unknown) {
      const { userFacingError } = await import('../../shared/errors/userFacingError')
      setFollowError(userFacingError(error))
    } finally {
      setBusy(null)
    }
  }

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

  // A searchable list of cards. It is the deliberate-discovery surface rather
  // than a dashboard, so it reads as one column; stretched to the full shell
  // the search field alone becomes 1440px of input for a two-word query.
  return (
    <Workspace width="reading">
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
              <li key={entry.key} className={styles.row}>
                <CompetitionRow entry={entry} />
                {/* Outside the card, never inside it. The card is a link, and
                    a button nested in a link is neither valid nor operable by
                    keyboard in the way either control promises. */}
                {preferences ? (
                  <FollowControl
                    entry={entry}
                    following={isFollowing(preferences, entry.competition.tournamentId)}
                    busy={busy === entry.competition.tournamentId}
                    onToggle={toggleFollow}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {view.noMatches ? (
        <p className={styles.none}>No competition matches “{query}”.</p>
      ) : null}

      {followError ? (
        <Alert variant="warning" title="That preference was not saved">
          {followError}
        </Alert>
      ) : null}

      {/* Stated once, at the bottom, where it explains what the control means
          rather than interrupting the list. */}
      <p className={styles.followNote}>
        Following a competition brings its football onto your Hub, your calendar and the
        competition switcher. It joins no game and changes no membership — you join a game inside
        the competition itself.
      </p>
    </div>
    </Workspace>
  )
}

/**
 * Follow or unfollow, beside the card rather than inside it.
 *
 * IT NAMES THE COMPETITION. A list of identical "Follow" buttons is unusable
 * with a screen reader, so the accessible name carries the competition and the
 * visible label stays short.
 */
function FollowControl({
  entry,
  following,
  busy,
  onToggle,
}: {
  entry: ExploreEntry
  following: boolean
  busy: boolean
  onToggle: (tournamentId: string, following: boolean) => void
}) {
  return (
    <Button
      variant="secondary"
      disabled={busy}
      aria-pressed={following}
      aria-label={`${following ? 'Unfollow' : 'Follow'} ${entry.competition.name}`}
      onClick={() => onToggle(entry.competition.tournamentId, !following)}
    >
      {busy ? 'Saving…' : following ? 'Following' : 'Follow'}
    </Button>
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
