import { useNavigate } from 'react-router'
import { ChevronRightIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import s from '../shared.module.css'
import m from './more.module.css'

export function MorePage() {
  const navigate = useNavigate()
  const { displayName } = useAuth()

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

      <button type="button" className={m.linkRow} onClick={() => navigate('/profile')}>
        Profile
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/account')}>
        Account
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/games')}>
        Games
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/more/scoring')}>
        How scoring works
        <ChevronRightIcon size={18} className={m.chev} />
      </button>
    </div>
  )
}
