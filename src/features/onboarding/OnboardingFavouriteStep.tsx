import { useId, useMemo, useState } from 'react'
import { Button, ClubIdentity, TextInput } from '../../design-system'
import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'
import styles from './onboarding.module.css'

/**
 * Step 2 — an optional favourite team.
 *
 * OPTIONAL MEANS A REAL SKIP, not a step a player has to guess their way out
 * of. Skip is a control of its own, always present, and clearing a chosen team
 * is offered once one is picked.
 *
 * IT IS PRESENTATION ONLY, AND THE COPY SAYS SO. The scalability contract is
 * explicit: a favourite must never alter membership, scoring, locks,
 * permissions, ranking, prediction state or action urgency. Nothing about this
 * step implies otherwise, and it deliberately says what a favourite does — a
 * little more prominence — rather than leaving a player to assume it enters
 * them into something.
 *
 * THE SHIRT IS NEVER THE ONLY IDENTIFIER. `ClubIdentity` carries the canonical
 * colours and monogram, and the club's name is beside it in text on every
 * option, per `DFA-003`.
 *
 * CANONICAL IDENTITY, SUPPLIED BY THE CALLER. Teams come in as
 * `{ teamId, name, tokens }` from whichever authoritative read the caller
 * holds; this component resolves no identity of its own and invents no colours.
 *
 * DRAFT ONLY. No preference authority exists (`MIG-UI-10`).
 */

export type OnboardingTeam = {
  teamId: string
  name: string
  tokens: ClubIdentityTokens
}

export type OnboardingFavouriteStepProps = {
  teams: readonly OnboardingTeam[]
  selectedTeamId: string | null
  onSelect: (teamId: string | null) => void
}

/** Above this a plain grid stops being scannable and search earns its place. */
const SEARCH_THRESHOLD = 12

export function OnboardingFavouriteStep({
  teams,
  selectedTeamId,
  onSelect,
}: OnboardingFavouriteStepProps) {
  const [query, setQuery] = useState('')
  const headingId = useId()

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return teams
    return teams.filter((team) => team.name.toLowerCase().includes(needle))
  }, [teams, query])

  const selected = teams.find((team) => team.teamId === selectedTeamId) ?? null

  return (
    <section className={styles.step} aria-labelledby={headingId}>
      <h2 className={styles.stepTitle} id={headingId}>
        Pick a favourite team
      </h2>
      <p className={styles.stepLead}>
        Optional. A favourite gives your team a little more prominence around the product. It does
        not follow a competition, enter a game or affect anything you score.
      </p>

      {teams.length === 0 ? (
        <p className={styles.none}>No teams to choose from yet.</p>
      ) : (
        <>
          {teams.length > SEARCH_THRESHOLD ? (
            <TextInput
              label="Search teams"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Celtic, Rangers…"
            />
          ) : null}

          <p className={styles.count} aria-live="polite">
            {selected ? `${selected.name} selected` : 'No favourite selected'}
          </p>

          {shown.length === 0 ? (
            <p className={styles.none}>No team matches “{query}”.</p>
          ) : (
            <div className={styles.teams}>
              {shown.map((team) => {
                const isSelected = team.teamId === selectedTeamId
                return (
                  <button
                    key={team.teamId}
                    type="button"
                    className={`${styles.team} ${isSelected ? styles.teamOn : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(isSelected ? null : team.teamId)}
                  >
                    <ClubIdentity name={team.name} tokens={team.tokens} size="table" />
                    {/* The name, always, in text. The shirt is never the only
                        identifier. */}
                    <span className={styles.teamName}>{team.name}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className={styles.stepActions}>
            <Button variant="secondary" onClick={() => onSelect(null)}>
              {selected ? 'Clear favourite' : 'Skip this step'}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
