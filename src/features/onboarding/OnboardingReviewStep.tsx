import { useId } from 'react'
import { Alert, Button, ClubIdentity } from '../../design-system'
import type { OnboardingDraft } from './onboardingDraft'
import { competitionsWithoutGames, gamesFor, totalGameChoices } from './onboardingDraft'
import type { OnboardingCompetitionOffer } from './OnboardingGamesStep'
import type { OnboardingTeam } from './OnboardingFavouriteStep'
import styles from './onboarding.module.css'

/**
 * The final step — everything the player has chosen, before anything is saved.
 *
 * IT REINFORCES THE THREE CHOICES BY SHOWING THEM APART. Follow, Join game and
 * Favourite each get their own block with their own sentence, because this is
 * the last screen before a player commits and the one place a
 * misunderstanding becomes a wrong membership. A competition followed with no
 * game is stated as exactly that, not treated as an error: following without
 * playing is a legitimate outcome and the whole reason the two are separate.
 *
 * THE FINISH CONTROL DOES NOT LIE. It appears when `onFinish` is supplied,
 * which the live journey does now that contract 157 can persist a follow, a
 * favourite and onboarding progress. Rendered without one — a gallery, a test —
 * the step still says plainly that nothing will be saved, rather than showing a
 * button that would silently drop the draft.
 *
 * DRAFT, NOT TRUTH. Everything here is what the player has picked in this
 * session.
 */

export type OnboardingReviewStepProps = {
  competitions: readonly OnboardingCompetitionOffer[]
  teams: readonly OnboardingTeam[]
  draft: OnboardingDraft
  /** The real submit. Omitted only where there is nothing to submit to. */
  onFinish?: () => void
  /** Disabled and relabelled while the submit is in flight. */
  finishing?: boolean
}

export function OnboardingReviewStep({
  competitions,
  teams,
  draft,
  onFinish,
  finishing = false,
}: OnboardingReviewStepProps) {
  const headingId = useId()
  const followed = competitions.filter((entry) => draft.followed.includes(entry.key))
  const favourites = followed
    .map((entry) => ({
      competition: entry.name,
      team: teams.find((team) => team.teamId === draft.favourites[entry.key]) ?? null,
    }))
    .filter((row) => row.team !== null)
  const withoutGames = competitionsWithoutGames(draft)
  const nameOf = (key: string) =>
    competitions.find((entry) => entry.key === key)?.name ?? key

  return (
    <section className={styles.step} aria-labelledby={headingId}>
      <h2 className={styles.stepTitle} id={headingId}>
        Review your choices
      </h2>

      <div className={styles.reviewBlock}>
        <h3 className={styles.reviewTitle}>Following</h3>
        <p className={styles.reviewNote}>
          Fixtures, results and context. Following enters you into nothing.
        </p>
        {followed.length === 0 ? (
          <p className={styles.none}>No competitions selected.</p>
        ) : (
          <ul className={styles.reviewList}>
            {followed.map((entry) => (
              <li className={styles.reviewRow} key={entry.key}>
                {entry.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.reviewBlock}>
        <h3 className={styles.reviewTitle}>Games you will join</h3>
        <p className={styles.reviewNote}>
          Each is a separate membership in one competition. This is what you are entering.
        </p>
        {totalGameChoices(draft) === 0 ? (
          <p className={styles.none}>No games selected. You can join one at any time.</p>
        ) : (
          <ul className={styles.reviewList}>
            {followed.map((entry) => {
              const chosen = gamesFor(draft, entry.key)
              if (chosen.length === 0) return null
              return (
                <li className={styles.reviewRow} key={entry.key}>
                  <span className={styles.reviewWhere}>{entry.name}</span>
                  <span className={styles.reviewValue}>
                    {chosen
                      .map(
                        (game) =>
                          entry.games.find((offer) => offer.gameKey === game)?.name ?? game,
                      )
                      .join(', ')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {withoutGames.length > 0 ? (
          // Stated, not flagged as a problem: following without playing is a
          // legitimate outcome and the reason the two are separate at all.
          <p className={styles.reviewNote}>
            Following without joining a game: {withoutGames.map(nameOf).join(', ')}.
          </p>
        ) : null}
      </div>

      <div className={styles.reviewBlock}>
        <h3 className={styles.reviewTitle}>Favourite clubs</h3>
        <p className={styles.reviewNote}>
          Presentation only. It changes nothing you score, join or unlock.
        </p>
        {favourites.length === 0 ? (
          <p className={styles.none}>None chosen.</p>
        ) : (
          <ul className={styles.reviewList}>
            {favourites.map((row) => (
              <li className={styles.reviewRow} key={row.competition}>
                <span className={styles.reviewWhere}>{row.competition}</span>
                <span className={styles.reviewFavourite}>
                  <ClubIdentity name={row.team!.name} tokens={row.team!.tokens} size="table" />
                  <span>{row.team!.name}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {onFinish ? (
        <div className={styles.stepActions}>
          <Button variant="primary" onClick={onFinish} disabled={finishing}>
            {finishing ? 'Saving…' : 'Finish setup'}
          </Button>
        </div>
      ) : (
        <Alert variant="info" title="These choices are not saved here">
          This review is rendered without a submit, so it shows what has been picked rather than
          what the server holds.
        </Alert>
      )}
    </section>
  )
}
