import { useRef, type ReactNode } from 'react'
import styles from './ClubMatchCard.module.css'
import { ScoreInput } from './ScoreInput'
import { ClubIdentity, type ClubIdentityTokens } from './ClubIdentity'
import { CheckIcon, AlertIcon, LockIcon, ChevronRightIcon } from './icons'
import type { SaveStatus } from './MatchCard'

export type ClubMatchCardState = 'editable' | 'locked' | 'scored'

export type MatchClub = {
  name: string
  tokens: ClubIdentityTokens
}

export type ClubMatchCardScore = {
  kind: 'exact' | 'correct' | 'wrong'
  points: number
  /** The whole-matchweek Joker doubled this matchweek's points. */
  jokerDoubled: boolean
}

export type ClubMatchCardProps = {
  state: ClubMatchCardState
  // eyebrow
  matchweek: number
  /**
   * An ALREADY-FORMATTED kickoff label — "Sat 22 Aug · 17:45" or "17:45" where
   * a date heading sits above the list. Never an instant: this component is
   * presentational and does no zone resolution, and `src/shared/time/kickoff.ts`
   * is the one authority that turns an instant into a label. `null` when the
   * instant could not be formatted, in which case the line is dropped rather
   * than printed empty.
   */
  kickoff: string | null
  venue?: string
  // clubs
  home: MatchClub
  away: MatchClub
  // the user's predicted score (inputs when editable, chips when locked,
  // quiet "You predicted" text when scored)
  homeScore: number | null
  awayScore: number | null
  onHomeScoreChange?: ((v: number | null) => void) | undefined
  onAwayScoreChange?: ((v: number | null) => void) | undefined
  // editable
  saveStatus?: SaveStatus | undefined
  onRetrySave?: () => void
  // locked
  countdown?: string | undefined
  // scored
  result?: { home: number; away: number } | undefined
  score?: ClubMatchCardScore
  // navigation
  showChevron?: boolean
  onOpen?: () => void
}

/**
 * The club-football sibling of `MatchCard` (ADR 0020). Same lifecycle —
 * editable, locked, scored — with the differences club football actually has:
 *
 * - clubs render through `ClubIdentity` (colour, pattern, monogram; never a
 *   crest and never a national flag), and the venue is plain text;
 * - the eyebrow names the matchweek, not a group and matchday;
 * - there is NO per-fixture Joker control. The domestic Joker doubles a whole
 *   matchweek and is declared at matchweek level; the card only reports, via
 *   its points pill, that a settled matchweek's points were doubled.
 *
 * Presentational only: all values and callbacks come from the parent; no data
 * fetching, no scoring logic, no lock arithmetic.
 */
export function ClubMatchCard(props: ClubMatchCardProps) {
  const {
    state,
    matchweek,
    kickoff,
    venue,
    home,
    away,
    homeScore,
    awayScore,
    onHomeScoreChange,
    onAwayScoreChange,
    saveStatus = 'idle',
    onRetrySave,
    countdown,
    result,
    score,
    showChevron = false,
    onOpen,
  } = props

  const locked = state === 'locked'
  const scored = state === 'scored'

  // Single-digit auto-advance pairing (design-system §5): entering a digit in
  // the home box jumps to away; entering one in away blurs.
  const awayInputRef = useRef<HTMLInputElement>(null)

  const cardClass = [styles.card, showChevron ? styles.withChevron : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass}>
      <div className={styles.eyebrow}>
        <span>Matchweek {matchweek}</span>
        <span className={styles.eyebrowRight}>
          {kickoff ? <span>{kickoff}</span> : null}
          {locked ? (
            <LockIcon size={13} title="Predictions locked" />
          ) : venue ? (
            <span>{venue}</span>
          ) : null}
        </span>
      </div>

      <div className={styles.teamRow}>
        <span className={`${styles.team} ${styles.teamHome}`}>
          <ClubIdentity name={home.name} tokens={home.tokens} size="card" />
          <span className={styles.teamName}>{home.name}</span>
        </span>

        <span className={styles.scores}>
          {scored && result ? (
            <>
              <span className={styles.heroScore}>{result.home}</span>
              <span className={styles.sep}>–</span>
              <span className={styles.heroScore}>{result.away}</span>
            </>
          ) : (
            <>
              <ScoreInput
                value={homeScore}
                ariaLabel={`${home.name} score`}
                onChange={onHomeScoreChange}
                locked={locked}
                onAdvance={() => awayInputRef.current?.focus()}
              />
              <span className={styles.sep}>–</span>
              <ScoreInput
                value={awayScore}
                ariaLabel={`${away.name} score`}
                onChange={onAwayScoreChange}
                locked={locked}
                inputRef={awayInputRef}
                onAdvance={() => awayInputRef.current?.blur()}
              />
            </>
          )}
        </span>

        <span className={`${styles.team} ${styles.teamAway}`}>
          <span className={styles.teamName}>{away.name}</span>
          <ClubIdentity name={away.name} tokens={away.tokens} size="card" />
        </span>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLeft}>{renderStatus()}</span>
        <span className={styles.footerRight}>{scored && score ? renderPointsPill(score) : null}</span>
      </div>

      {showChevron && (
        <button type="button" className={styles.chevron} aria-label="Open match centre" onClick={onOpen}>
          <ChevronRightIcon size={18} />
        </button>
      )}
    </div>
  )

  function renderStatus(): ReactNode {
    if (scored) {
      return (
        <span className={styles.predicted}>
          You predicted {homeScore ?? '–'} – {awayScore ?? '–'}
        </span>
      )
    }
    if (locked) {
      return (
        <span className={styles.countdown}>
          <LockIcon size={12} /> Kicks off in {countdown}
        </span>
      )
    }
    switch (saveStatus) {
      case 'saving':
        return <span className={styles.status}>Saving…</span>
      case 'saved':
        return (
          <span className={`${styles.status} ${styles.statusSaved}`}>
            <CheckIcon size={14} /> Saved
          </span>
        )
      case 'error':
        return (
          <span className={`${styles.status} ${styles.statusError}`}>
            <AlertIcon size={14} /> Save failed —{' '}
            <button type="button" className={styles.retry} onClick={onRetrySave}>
              retry
            </button>
          </span>
        )
      case 'conflict':
        return (
          <span className={`${styles.status} ${styles.statusError}`}>
            <AlertIcon size={14} /> Changed on another device
          </span>
        )
      default:
        return <span className={styles.status} />
    }
  }

  function renderPointsPill(s: ClubMatchCardScore): ReactNode {
    if (s.kind === 'wrong') {
      return <span className={`${styles.pill} ${styles.pillMuted}`}>+0</span>
    }
    const label = s.kind === 'exact' ? 'Exact score' : 'Result'
    if (s.jokerDoubled) {
      return (
        <span className={`${styles.pill} ${styles.pillGold}`}>
          {label} · joker 2× · +{s.points}
        </span>
      )
    }
    return (
      <span className={`${styles.pill} ${styles.pillAccent}`}>
        {label} +{s.points}
      </span>
    )
  }
}
