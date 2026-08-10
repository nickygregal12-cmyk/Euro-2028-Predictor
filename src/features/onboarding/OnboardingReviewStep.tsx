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
 * THE FINISH CONTROL DOES NOT LIE. No authority can persist a follow, a
 * favourite or onboarding progress (`MIG-UI-10`), so the primary action is
 * rendered unavailable with the reason in words rather than as a button that
 * silently drops the draft. When the persistence contract lands, `onFinish`
 * becomes the real submit and the notice goes; nothing else about this step
 * changes.
 *
 * DRAFT, NOT TRUTH. Everything here is what the player has picked in this
 * session.
 */

export type OnboardingReviewStepProps = {
  competitions: readonly OnboardingCompetitionOffer[]
  teams: readonly OnboardingTeam[]
  draft: OnboardingDraft
  /**
   * The real submit, once persistence exists. Omitted today, and its absence is
   * what makes the step honest rather than a Finish button that loses the
   * draft.
   */
  onFinish?: () => void
}

export function OnboardingReviewStep({
  competitions,
  teams,
  draft,
  onFinish,
}: OnboardingReviewStepProps) {
  const headingId = useId()
  const followed = competitions.filter((entry) => draft.followed.includes(entry.key))
  const favourite = teams.find((team) => team.teamId === draft.favouriteTeamId) ?? null
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
        <h3 className={styles.reviewTitle}>Favourite team</h3>
        <p className={styles.reviewNote}>
          Presentation only. It changes nothing you score, join or unlock.
        </p>
        {favourite ? (
          <p className={styles.reviewFavourite}>
            <ClubIdentity name={favourite.name} tokens={favourite.tokens} size="table" />
            <span>{favourite.name}</span>
          </p>
        ) : (
          <p className={styles.none}>None chosen.</p>
        )}
      </div>

      {onFinish ? (
        <div className={styles.stepActions}>
          <Button variant="primary" onClick={onFinish}>
            Finish setup
          </Button>
        </div>
      ) : (
        <Alert variant="info" title="These choices are not saved yet">
          Onboarding needs somewhere to store followed competitions, a favourite team and its own
          progress. Until that exists, this review shows what you have picked in this session
          rather than what the server holds.
        </Alert>
      )}
    </section>
  )
}
