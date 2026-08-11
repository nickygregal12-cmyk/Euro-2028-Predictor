import { useId, useMemo, useState } from 'react'
import { Alert, Skeleton, TextInput } from '../../design-system'
import { monogramOf } from '../../app/railDestinations'
import type { PlayerCompetitions } from '../hub/playerCompetitions'
import type { OnboardingDraft } from './onboardingDraft'
import styles from './onboarding.module.css'

/**
 * Step 1 — choose the competitions to follow.
 *
 * IT IS BUILT FOR TWENTY, NOT TWO. Search filters as you type, chosen
 * competitions are pinned above the rest so a long catalogue never buries what
 * the player has already picked, and the count is stated. Nothing here indexes,
 * orders or special-cases the launch pair.
 *
 * FOLLOWING IS NOT JOINING. The copy says so once, at the top, because this is
 * the step where the two are most easily confused — a player who has just
 * ticked six competitions reasonably assumes they have entered six games. The
 * games step is where membership is chosen, and nothing is selected for them.
 *
 * EVERY PUBLISHED COMPETITION IS SELECTABLE. This step used to carry a
 * "Newly published, not openable" group, because `public.competitions.slug`
 * was not browser-readable and a season could exist with no URL. Contract 147
 * returns the slug, so that state cannot occur and the group is gone: the
 * catalogue this step renders is the server's, in full.
 *
 * DRAFT ONLY. Selecting writes nothing: no Follow authority exists
 * (`MIG-UI-10`). The caller owns the draft and this component never claims a
 * choice is saved.
 */

export type OnboardingCompetitionStepProps = {
  /** Null while the catalogue read is in flight. */
  player: PlayerCompetitions | null
  /** Set when the catalogue could not be read at all. */
  failed?: boolean
  draft: OnboardingDraft
  onToggle: (key: string) => void
}

export function OnboardingCompetitionStep({
  player,
  failed = false,
  draft,
  onToggle,
}: OnboardingCompetitionStepProps) {
  const [query, setQuery] = useState('')
  const headingId = useId()

  const { chosen, rest, noMatches } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (name: string) => needle === '' || name.toLowerCase().includes(needle)
    const catalogue = (player?.catalogue ?? []).filter((entry) => matches(entry.name))
    return {
      chosen: catalogue.filter((entry) => draft.followed.includes(entry.seasonRowName)),
      rest: catalogue.filter((entry) => !draft.followed.includes(entry.seasonRowName)),
      noMatches: catalogue.length === 0,
    }
  }, [player, draft.followed, query])

  if (failed) {
    return (
      <section className={styles.step} aria-labelledby={headingId}>
        <h2 className={styles.stepTitle} id={headingId}>
          Choose your competitions
        </h2>
        <Alert variant="error" title="We could not load the competitions">
          Nothing has been chosen either way. This is a failure to read the catalogue, not an
          empty platform.
        </Alert>
      </section>
    )
  }

  if (player === null) {
    return (
      <section className={styles.step} aria-labelledby={headingId} aria-busy="true">
        <h2 className={styles.stepTitle} id={headingId}>
          Choose your competitions
        </h2>
        <Skeleton width="100%" height={48} />
        <Skeleton width="100%" height={72} />
        <Skeleton width="100%" height={72} />
      </section>
    )
  }

  const empty = player.catalogue.length === 0

  return (
    <section className={styles.step} aria-labelledby={headingId}>
      <h2 className={styles.stepTitle} id={headingId}>
        Choose your competitions
      </h2>
      <p className={styles.stepLead}>
        Following a competition gives you its fixtures, results and context. It does not enter you
        into any game — you choose those next.
      </p>

      {empty ? (
        <p className={styles.none}>
          No competitions are published yet. This screen fills in as they are.
        </p>
      ) : (
        <>
          <TextInput
            label="Search competitions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Premier League, Scottish…"
          />

          <p className={styles.count} aria-live="polite">
            {draft.followed.length === 0
              ? 'None selected'
              : draft.followed.length === 1
                ? '1 competition selected'
                : `${draft.followed.length} competitions selected`}
          </p>

          {chosen.length > 0 ? (
            <Group title="Selected">
              {chosen.map((entry) => (
                <CompetitionChoice
                  key={entry.seasonRowName}
                  name={entry.name}
                  seasonLabel={entry.seasonLabel}
                  selected
                  onToggle={() => onToggle(entry.seasonRowName)}
                />
              ))}
            </Group>
          ) : null}

          {rest.length > 0 ? (
            <Group title={chosen.length > 0 ? 'More competitions' : 'Competitions'}>
              {rest.map((entry) => (
                <CompetitionChoice
                  key={entry.seasonRowName}
                  name={entry.name}
                  seasonLabel={entry.seasonLabel}
                  selected={false}
                  onToggle={() => onToggle(entry.seasonRowName)}
                />
              ))}
            </Group>
          ) : null}



          {noMatches ? (
            <p className={styles.none}>No competition matches “{query}”.</p>
          ) : null}
        </>
      )}
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <div className={styles.choices}>{children}</div>
    </div>
  )
}

/**
 * One competition, as a real toggle button.
 *
 * `aria-pressed` rather than a checkbox, because the visual is a card and a
 * hidden input with a styled label is one more thing to get wrong; the state is
 * spoken either way, and the tick is a second, non-colour signal.
 */
function CompetitionChoice({
  name,
  seasonLabel,
  selected,
  onToggle,
}: {
  name: string
  seasonLabel: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${selected ? styles.choiceOn : ''}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className={styles.choiceMonogram} aria-hidden="true">
        {monogramOf(name)}
      </span>
      <span className={styles.choiceCopy}>
        <span className={styles.choiceName}>{name}</span>
        <span className={styles.choiceSeason}>{seasonLabel}</span>
      </span>
      <span className={styles.choiceMark} aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
    </button>
  )
}
