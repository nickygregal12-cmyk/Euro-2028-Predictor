import { useId, useState } from 'react'
import { Button } from '../../design-system'
import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import type { OnboardingDraft } from './onboardingDraft'
import { gamesFor } from './onboardingDraft'
import styles from './onboarding.module.css'

/**
 * Step 3 — choose games, independently per followed competition.
 *
 * NOTHING IS SILENTLY SELECTED. Following a competition chooses no game; every
 * membership on this step is an explicit press. That is the scalability
 * contract's rule and the draft model enforces it — this component cannot
 * select a game the player did not.
 *
 * BULK IS OFFERED BECAUSE REPETITION IS THE REAL PROBLEM. A player following
 * five competitions should not answer the same three questions five times. So
 * there are two modes: apply one set of choices to every selected competition,
 * or customise each. **Applying REPLACES rather than merges**, and the copy
 * says so — merging would make the control's effect depend on what was already
 * picked elsewhere, which nobody can predict. The review step then shows the
 * outcome before anything is submitted, so bulk never becomes silent.
 *
 * THE THREE GAMES ARE NOT MADE IDENTICAL. Their mechanics genuinely differ —
 * one is a weekly card, one is a single elimination pick, one is a head-to-head
 * table — and flattening them into three identical tiles would hide the only
 * thing a new player needs in order to choose. Each carries its own cadence and
 * what the player actually does.
 *
 * AN UNAVAILABLE GAME IS EXPLAINED, NEVER A DISABLED MYSTERY. Where a
 * competition does not run a game, or its registration is not open, the row
 * says which and offers no control.
 *
 * DRAFT ONLY. Memberships are server-owned and this writes none
 * (`MIG-UI-10` for the flow; the joins themselves already have authorities).
 */

export type OnboardingGameOffer = {
  gameKey: CompetitionGameKey
  name: string
  /** What the game is, in one line. */
  description: string
  /** How often the player acts: "Every matchweek", "Every round". */
  cadence: string
  /** What they actually do. */
  action: string
  /** Null when the game can be chosen; a sentence when it cannot. */
  refusal: string | null
  /** True when the player already holds an active membership. */
  joined: boolean
}

export type OnboardingCompetitionOffer = {
  key: string
  name: string
  games: readonly OnboardingGameOffer[]
}

export type OnboardingGamesStepProps = {
  competitions: readonly OnboardingCompetitionOffer[]
  draft: OnboardingDraft
  onToggleGame: (competitionKey: string, game: CompetitionGameKey) => void
  onApplyToAll: (games: readonly CompetitionGameKey[]) => void
}

export function OnboardingGamesStep({
  competitions,
  draft,
  onToggleGame,
  onApplyToAll,
}: OnboardingGamesStepProps) {
  const headingId = useId()
  // Bulk is only meaningful across more than one competition, and defaulting to
  // it for a single competition would add a mode for nothing.
  const [mode, setMode] = useState<'all' | 'each'>(
    competitions.length > 1 ? 'all' : 'each',
  )
  const [bulk, setBulk] = useState<readonly CompetitionGameKey[]>([])

  if (competitions.length === 0) {
    return (
      <section className={styles.step} aria-labelledby={headingId}>
        <h2 className={styles.stepTitle} id={headingId}>
          Choose your games
        </h2>
        <p className={styles.none}>
          Choose a competition first. Games belong to a competition, so there is nothing to pick
          until one is selected.
        </p>
      </section>
    )
  }

  // Every game any selected competition offers, for the bulk control. Keyed so
  // a game appearing in several competitions is offered once.
  const bulkOffers = new Map<CompetitionGameKey, OnboardingGameOffer>()
  for (const competition of competitions) {
    for (const game of competition.games) {
      if (!bulkOffers.has(game.gameKey)) bulkOffers.set(game.gameKey, game)
    }
  }

  return (
    <section className={styles.step} aria-labelledby={headingId}>
      <h2 className={styles.stepTitle} id={headingId}>
        Choose your games
      </h2>
      <p className={styles.stepLead}>
        Each game is joined separately, per competition. Nothing is selected for you.
      </p>

      {competitions.length > 1 ? (
        <div className={styles.modes} role="group" aria-label="How to choose">
          <button
            type="button"
            className={`${styles.mode} ${mode === 'all' ? styles.modeOn : ''}`}
            aria-pressed={mode === 'all'}
            onClick={() => setMode('all')}
          >
            Apply to all {competitions.length}
          </button>
          <button
            type="button"
            className={`${styles.mode} ${mode === 'each' ? styles.modeOn : ''}`}
            aria-pressed={mode === 'each'}
            onClick={() => setMode('each')}
          >
            Customise by competition
          </button>
        </div>
      ) : null}

      {mode === 'all' && competitions.length > 1 ? (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Play in all {competitions.length} competitions</h3>
          <div className={styles.gameList}>
            {[...bulkOffers.values()].map((game) => (
              <GameRow
                key={game.gameKey}
                game={game}
                selected={bulk.includes(game.gameKey)}
                onToggle={() =>
                  setBulk((current) =>
                    current.includes(game.gameKey)
                      ? current.filter((entry) => entry !== game.gameKey)
                      : [...current, game.gameKey],
                  )
                }
              />
            ))}
          </div>
          {/* Replacing, not merging, and said before it happens. */}
          <p className={styles.note}>
            Applying replaces the game choices for every selected competition. You can review them
            all before anything is saved.
          </p>
          <div className={styles.stepActions}>
            <Button variant="primary" onClick={() => onApplyToAll(bulk)}>
              Apply to all {competitions.length}
            </Button>
            <Button variant="secondary" onClick={() => setMode('each')}>
              Customise instead
            </Button>
          </div>
        </div>
      ) : (
        competitions.map((competition) => (
          <div className={styles.group} key={competition.key}>
            <h3 className={styles.groupTitle}>{competition.name}</h3>
            <div className={styles.gameList}>
              {competition.games.map((game) => (
                <GameRow
                  key={game.gameKey}
                  game={game}
                  selected={gamesFor(draft, competition.key).includes(game.gameKey)}
                  onToggle={() => onToggleGame(competition.key, game.gameKey)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function GameRow({
  game,
  selected,
  onToggle,
}: {
  game: OnboardingGameOffer
  selected: boolean
  onToggle: () => void
}) {
  const body = (
    <>
      <span className={styles.gameCopy}>
        <span className={styles.gameName}>{game.name}</span>
        <span className={styles.gameDescription}>{game.description}</span>
        <span className={styles.gameMeta}>
          {game.cadence} · {game.action}
        </span>
      </span>
      {game.joined ? (
        <span className={styles.gameTag}>Already joined</span>
      ) : (
        <span className={styles.choiceMark} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
      )}
    </>
  )

  // Unavailable, or already a member: a sentence, never a disabled control the
  // player has to hover to understand.
  if (game.refusal !== null || game.joined) {
    return (
      <div className={`${styles.game} ${styles.gameInert}`}>
        {body}
        {game.refusal ? <span className={styles.gameRefusal}>{game.refusal}</span> : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`${styles.game} ${selected ? styles.gameOn : ''}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {body}
    </button>
  )
}
