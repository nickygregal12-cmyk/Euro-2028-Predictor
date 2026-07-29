import { useNavigate } from 'react-router'
import { ChevronRightIcon } from '../../design-system/icons'
import s from '../shared.module.css'
import m from './more.module.css'

// Sign-out and the profile details moved to More → Account (design-system
// §Account); this page keeps only the link rows.
export function MorePage() {
  const navigate = useNavigate()

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>More</h1>
      </div>

      {/* Theme switching lives in the top-nav app bar (design-system §6). */}
      <button type="button" className={m.linkRow} onClick={() => navigate('/account')}>
        Account
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/profile')}>
        Profile
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/prediction-trends')}>
        Prediction trends
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/games')}>
        Bonus Games
        <ChevronRightIcon size={18} className={m.chev} />
      </button>

      <button type="button" className={m.linkRow} onClick={() => navigate('/more/scoring')}>
        How scoring works
        <ChevronRightIcon size={18} className={m.chev} />
      </button>
    </div>
  )
}
