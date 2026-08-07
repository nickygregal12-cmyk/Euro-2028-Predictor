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
 * One-time domestic Hub orientation. This is deliberately lighter than the
 * planned persisted onboarding flow: it explains the weekly product without
 * pretending favourite-team or followed-competition setup has happened.
 * Seen-tracking and navigation stay in WelcomePage.
 */
export function WelcomeScreen({
  displayName,
  onStart,
  onScoring,
  startLabel = 'Go to your Hub →',
}: WelcomeScreenProps) {
  return (
    <div className={w.screen}>
      <div className={w.inner}>
        <span className={w.eyebrow}>Football Prediction Hub</span>
        <h1 className={w.title}>Welcome, {displayName ?? 'player'}</h1>
        <p className={w.tagline}>
          Premier League and Scottish Premiership. Three ways to play, one weekly home.
        </p>

        <div className={w.stepsCard}>
          <Step
            icon={<BallIcon size={18} />}
            title="Choose your competition"
            body="Follow the Premier League, Scottish Premiership, or both."
          />
          <Step
            icon={<TrophyIcon size={18} />}
            title="Choose how you play"
            body="Match Predictor, Last Man Standing and Predictor Championship stay separate."
          />
          <Step
            icon={<CardsIcon size={18} />}
            gold
            title="Know what needs action"
            body="Your Hub keeps picks, deadlines and results in the right competition each week."
          />
        </div>

        <Button variant="primary" fullWidth onClick={onStart}>
          {startLabel}
        </Button>
        <button type="button" className={w.scoringLink} onClick={onScoring}>
          How the games work →
        </button>
      </div>
    </div>
  )
}
