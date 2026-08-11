import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, ClubIdentity, Skeleton } from '../../design-system'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
// THE PURE HELPERS COME FROM THE MODEL, THE WRITES ARE IMPORTED LAZILY. Naming
// `services/supabase/playerPreferences` at module scope pulls `client.ts` into
// the graph of anything that renders this card, and that module throws at load
// without configuration — which is what turned this component into one no test
// could mount. The provider does the same thing for the same reason.
import {
  favouriteTeamFor,
  isFollowing,
} from '../../services/supabase/playerPreferencesModel'
import type { SeasonClub } from '../../services/supabase/seasonClubs'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import a from './account.module.css'
import f from './followedCompetitions.module.css'

/**
 * Account controls for the two preferences contract 157 stores: which
 * competitions the player follows, and their favourite club in each.
 *
 * FOLLOW IS NOT GAME ENTRY, AND THIS SURFACE HAS TO SAY SO OUT LOUD. Unfollowing
 * a competition here leaves every game membership exactly where it was — the
 * server writes no membership row either way, and the copy tells the player
 * that, because a control that silently withdrew somebody from a league they
 * were winning would be the worst possible surprise.
 *
 * A FAVOURITE IS PER COMPETITION, because the server constrains it to a club
 * that plays in the competition being followed, and because "my club" means
 * something different in the Premier League and the Scottish Premiership. It is
 * offered only once a competition is followed: there is nowhere to store a
 * favourite for a competition the player has not followed.
 *
 * THE CLUB LIST IS LOADED ON DEMAND, one competition at a time, and only when
 * the player opens the picker. Loading every competition's clubs to render a
 * list of competitions would be twenty reads to show twenty rows.
 *
 * EVERY WRITE IS FOLLOWED BY A RELOAD OF THE SHELL, not by an optimistic local
 * edit. The shell's model is what the Hub, the rail, the switcher and the
 * Match Centre all read, so a preference that changed here has to change there
 * in the same breath — that is the "without requiring another login" property,
 * and re-reading is the only way to get it without two sources of truth.
 */
export function FollowedCompetitionsCard() {
  const { status, player, preferences, reload } = usePlayerCompetitions()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const write = useCallback(
    async (tournamentId: string, following: boolean, favouriteTeamId: string | null) => {
      setBusy(tournamentId)
      setError(null)
      try {
        const { setCompetitionFollow } = await import(
          '../../services/supabase/playerPreferences'
        )
        await setCompetitionFollow(tournamentId, following, favouriteTeamId)
        reload()
      } catch (caught) {
        setError(userFacingError(caught, 'That preference did not save. Please try again.'))
      } finally {
        setBusy(null)
      }
    },
    [reload],
  )

  if (status === 'loading') {
    return (
      <div className={s.card}>
        <span className={s.eyebrow}>Competitions you follow</span>
        <Skeleton lines={4} />
      </div>
    )
  }

  if (status === 'failed' || !player || !preferences) {
    return (
      <div className={s.card}>
        <span className={s.eyebrow}>Competitions you follow</span>
        {/* Not an empty list. "You follow nothing" is a claim about the player
            and this read never made it. */}
        <Alert variant="warning" title="Couldn’t load your competitions">
          We couldn’t read which competitions you follow.
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  return (
    <div className={s.card}>
      <span className={s.eyebrow}>Competitions you follow</span>
      <p className={a.detailValue}>
        Following a competition brings its fixtures, results and context to your Hub. It does not
        enter you into any game, and unfollowing never removes you from one.
      </p>

      {error ? (
        <p role="alert" className={a.fieldError}>
          {error}
        </p>
      ) : null}

      <ul className={f.list}>
        {player.catalogue.map((competition) => {
          const tournamentId = competition.tournamentId
          const following = isFollowing(preferences, tournamentId)
          const favouriteId = favouriteTeamFor(preferences, tournamentId)
          const pending = busy === tournamentId

          return (
            <li key={tournamentId} className={f.row}>
              <div className={f.body}>
                <span className={f.name}>{competition.name}</span>
                <span className={f.season}>{competition.seasonLabel}</span>
                {following ? (
                  <FavouriteControl
                    tournamentId={tournamentId}
                    competitionName={competition.name}
                    favouriteTeamId={favouriteId}
                    open={open === tournamentId}
                    disabled={pending}
                    onOpen={() => setOpen(open === tournamentId ? null : tournamentId)}
                    onChoose={(teamId) => {
                      setOpen(null)
                      void write(tournamentId, true, teamId)
                    }}
                  />
                ) : null}
              </div>
              <Button
                variant={following ? 'secondary' : 'primary'}
                disabled={pending}
                onClick={() => {
                  setOpen(null)
                  // Unfollowing sends the favourite as null because the follow
                  // row goes with it; re-following starts from no favourite,
                  // which is what the server does too.
                  void write(tournamentId, !following, following ? null : favouriteId)
                }}
              >
                {pending ? 'Saving…' : following ? 'Following' : 'Follow'}
              </Button>
            </li>
          )
        })}
      </ul>

      {player.catalogue.length === 0 ? (
        <p className={a.detailValue}>No competitions have been published yet.</p>
      ) : null}
    </div>
  )
}

type FavouriteControlProps = {
  tournamentId: string
  competitionName: string
  favouriteTeamId: string | null
  open: boolean
  disabled: boolean
  onOpen: () => void
  onChoose: (teamId: string | null) => void
}

/**
 * The favourite-club control for one followed competition.
 *
 * PRESENTATION PROMINENCE ONLY, and the copy says it once here rather than
 * relying on the player to remember it from the card header. Clearing is always
 * offered, because a favourite is optional and a control that can only be set
 * is a trap.
 */
function FavouriteControl({
  tournamentId,
  competitionName,
  favouriteTeamId,
  open,
  disabled,
  onOpen,
  onChoose,
}: FavouriteControlProps) {
  const [clubs, setClubs] = useState<readonly SeasonClub[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!open || clubs) return
    let active = true
    setLoadFailed(false)
    void (async () => {
      try {
        const { fetchSeasonClubs } = await import('../../services/supabase/seasonClubs')
        const loaded = await fetchSeasonClubs(tournamentId)
        if (active) setClubs(loaded)
      } catch {
        if (active) setLoadFailed(true)
      }
    })()
    return () => {
      active = false
    }
  }, [open, clubs, tournamentId])

  const chosen = clubs?.find((club) => club.teamId === favouriteTeamId) ?? null

  return (
    <div className={f.favourite}>
      <button
        type="button"
        className={f.favouriteToggle}
        disabled={disabled}
        aria-expanded={open}
        onClick={onOpen}
      >
        {chosen ? (
          <>
            <ClubIdentity name={chosen.name} tokens={chosen.tokens} size="table" />
            <span>{chosen.name}</span>
          </>
        ) : (
          <span>{favouriteTeamId ? 'Favourite club' : 'Choose a favourite club'}</span>
        )}
      </button>

      {open ? (
        <div className={f.picker}>
          {loadFailed ? (
            <p role="alert" className={a.fieldError}>
              We couldn’t load the clubs in {competitionName}.
            </p>
          ) : !clubs ? (
            <Skeleton lines={3} />
          ) : clubs.length === 0 ? (
            <p className={a.detailValue}>This competition has no clubs listed yet.</p>
          ) : (
            <>
              <ul className={f.clubs}>
                {clubs.map((club) => (
                  <li key={club.teamId}>
                    <button
                      type="button"
                      className={f.club}
                      aria-pressed={club.teamId === favouriteTeamId}
                      onClick={() => onChoose(club.teamId)}
                    >
                      <ClubIdentity name={club.name} tokens={club.tokens} size="table" />
                      <span className={f.clubName}>{club.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {favouriteTeamId ? (
                <Button variant="secondary" onClick={() => onChoose(null)}>
                  Clear favourite
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
