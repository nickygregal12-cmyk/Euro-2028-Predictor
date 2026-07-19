import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system'
import { ChevronRightIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../../app/providers/ThemeProvider'
import s from '../shared.module.css'
import m from './more.module.css'

export function MorePage() {
  const navigate = useNavigate()
  const { displayName, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      // A real sign-out: clears the session and the route gate returns to the
      // log-in screen. (In a dev build with auto-login on, a full page reload
      // will sign back in as the dev tester — see docs/auth-plan.md §1.)
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>More</h1>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Profile</span>
        <div className={m.row}>
          <span className={m.rowLabel}>Display name</span>
          <span className={m.rowValue}>{displayName ?? '—'}</span>
        </div>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Appearance</span>
        <div className={m.row}>
          <span className={m.rowLabel}>Theme</span>
          <Button variant="secondary" onClick={toggle}>
            {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          </Button>
        </div>
      </div>

      <button type="button" className={m.linkRow} onClick={() => navigate('/more/scoring')}>
        How scoring works
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <div className={s.card}>
        <Button variant="destructive" fullWidth loading={signingOut} onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
