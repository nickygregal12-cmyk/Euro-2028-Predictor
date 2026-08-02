import type { ReactNode } from 'react'
import { Button } from '../../design-system'
import { BallIcon, TrophyIcon, CardsIcon } from '../../design-system/icons'
import w from './welcome.module.css'

export type WelcomeScreenProps = {
  displayName: string | null
  onStart: () => void
  onScoring: () => void
  startLabel?: string
}

function Step({ icon, gold, title, body }: { icon: ReactNode; gold?: boolean; title: string; body: string }) {
  return (
    <div className={w.step}>
      <span className={`${w.stepIcon} ${gold ? w.stepIconGold : ''}`} aria-hidden="true">
        {icon}
      </span>
      <span className={w.stepBody}>
        <span className={w.stepTitle}>{title}</span>
        <span className={w.stepText}>{body}</span>
      </span>
    </div>
  )
}

/**
 * The one-time orientation screen (design-system §6). Presentational only —
 * display name, CTA copy and callbacks come from the caller; seen-tracking and
 * navigation live in WelcomePage. Single screen, no carousel.
 */
export function WelcomeScreen({
  displayName,
  onStart,
  onScoring,
  startLabel = 'Start with Group A →',
}: WelcomeScreenProps) {
  return (
    <div className={w.screen}>
      <div className={w.inner}>
        <span className={w.eyebrow}>Football Prediction Hub</span>
        <h1 className={w.title}>Welcome, {displayName ?? 'player'}</h1>
        <p className={w.tagline}>Pick your competitions. Play for bragging rights all season.</p>

        <div className={w.stepsCard}>
          <Step
            icon={<BallIcon size={18} />}
            title="Predict every group match"
            body="Your group tables build themselves."
          />
          <Step
            icon={<TrophyIcon size={18} />}
            title="Build your bracket"
            body="All the way to your champion at Wembley."
          />
          <Step
            icon={<CardsIcon size={18} />}
            gold
            title="Play your jokers, beat your mates"
            body="Five jokers double a match's points. Join a league and settle it properly."
          />
        </div>

        <Button variant="primary" fullWidth onClick={onStart}>
          {startLabel}
        </Button>
        <button type="button" className={w.scoringLink} onClick={onScoring}>
          How the scoring works →
        </button>
      </div>
    </div>
  )
}
