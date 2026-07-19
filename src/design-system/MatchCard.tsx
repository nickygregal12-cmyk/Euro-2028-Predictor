import type { ReactNode } from 'react'
import styles from './MatchCard.module.css'
import { ScoreInput } from './ScoreInput'
import { TeamFlag } from './TeamFlag'
import { JokerButton } from './JokerButton'
import { CheckIcon, AlertIcon, LockIcon, ChevronRightIcon } from './icons'
import { FEATURES } from './featureFlags'
import type { MatchTeam } from './types'

export type MatchCardState = 'editable' | 'locked' | 'scored'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// 'none' = knockout match / no joker; 'available' = can play; 'on' = placed but
// not yet committed; 'committed' = match kicked off with the joker on it.
export type JokerState = 'none' | 'available' | 'on' | 'committed'

export type MatchCardScore = {
  kind: 'exact' | 'correct' | 'wrong'
  points: number
  joker: boolean
}

export type MatchCardProps = {
  state: MatchCardState
  // eyebrow
  group: string
  matchday: number
  date: string
  venue: string
  venueCountryCode: string
  // teams
  home: MatchTeam
  away: MatchTeam
  // the user's predicted score (inputs when editable, chips when locked,
  // quiet "You predicted" text when scored)
  homeScore: number | null
  awayScore: number | null
  onHomeScoreChange?: (v: number | null) => void
  onAwayScoreChange?: (v: number | null) => void
  // editable
  saveStatus?: SaveStatus
  onRetrySave?: () => void
  // locked
  countdown?: string
  // scored
  result?: { home: number; away: number }
  score?: MatchCardScore
  // joker (group-stage matches only)
  jokerState?: JokerState
  onToggleJoker?: () => void
  // navigation (Tier 4) — feature-flagged, off by default
  showChevron?: boolean
  onOpen?: () => void
}

/**
 * The match card across its full lifecycle (editable / locked / scored),
 * including joker states and gold border. Presentational only: all values and
 * callbacks come from the parent; no data fetching, no scoring logic.
 */
export function MatchCard(props: MatchCardProps) {
  const {
    state,
    group,
    matchday,
    date,
    venue,
    venueCountryCode,
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
    jokerState = 'none',
    onToggleJoker,
    showChevron = FEATURES.matchCardNavigation,
    onOpen,
  } = props

  const locked = state === 'locked'
  const scored = state === 'scored'
  const jokerActive = jokerState === 'on' || jokerState === 'committed'

  const cardClass = [
    styles.card,
    jokerActive ? styles.jokerActive : '',
    showChevron ? styles.withChevron : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass}>
      <div className={styles.eyebrow}>
        <span>
          Group {group} · MD{matchday}
        </span>
        <span className={styles.eyebrowRight}>
          <span>{date}</span>
          {locked ? (
            <LockIcon size={13} title="Predictions locked" />
          ) : (
            <>
              <TeamFlag countryCode={venueCountryCode} label={`${venue} (host venue)`} size="venue" />
              <span>{venue}</span>
            </>
          )}
        </span>
      </div>

      <div className={styles.teamRow}>
        <span className={`${styles.team} ${styles.teamHome}`}>
          <TeamFlag countryCode={home.countryCode} label={home.name} size="card" />
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
              />
              <span className={styles.sep}>–</span>
              <ScoreInput
                value={awayScore}
                ariaLabel={`${away.name} score`}
                onChange={onAwayScoreChange}
                locked={locked}
              />
            </>
          )}
        </span>

        <span className={`${styles.team} ${styles.teamAway}`}>
          <span className={styles.teamName}>{away.name}</span>
          <TeamFlag countryCode={away.countryCode} label={away.name} size="card" />
        </span>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLeft}>{renderStatus()}</span>
        <span className={styles.footerRight}>{renderJokerOrPoints()}</span>
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
      default:
        return <span className={styles.status} />
    }
  }

  function renderJokerOrPoints(): ReactNode {
    if (scored && score) return renderPointsPill(score)
    if (jokerState === 'available' || jokerState === 'on') {
      return <JokerButton state={jokerState} onToggle={onToggleJoker} />
    }
    return null
  }

  function renderPointsPill(s: MatchCardScore): ReactNode {
    if (s.kind === 'wrong') {
      return <span className={`${styles.pill} ${styles.pillMuted}`}>+0</span>
    }
    const label = s.kind === 'exact' ? 'Exact score' : 'Result'
    if (s.joker) {
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
