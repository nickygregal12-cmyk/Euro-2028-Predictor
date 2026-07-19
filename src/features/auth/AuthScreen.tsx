import type { ReactNode } from 'react'
import s from './auth.module.css'

// The shared frame for the log in / sign up screens: app title above a single
// centred card. Presentational only — no session logic (docs/auth-plan.md §3).
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className={s.screen}>
      <div className={s.inner}>
        <div className={s.brand}>
          <h1 className={s.title}>Euro 2028 Predictor</h1>
          <p className={s.tagline}>Predict every match. Beat your friends.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
