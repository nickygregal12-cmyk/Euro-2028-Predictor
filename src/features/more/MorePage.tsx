import { useNavigate } from 'react-router'
import { Workspace } from '../../design-system'
import { ChevronRightIcon } from '../../design-system/icons'
import s from '../shared.module.css'
import m from './more.module.css'

// Keep More limited to destinations that are part of the canonical weekly
// route tree. Retired tournament-only routes must not survive as visible rows.
export function MorePage() {
  const navigate = useNavigate()

  // A short stack of link rows. The shell is 1440px wide and this page has
  // nothing to put beside itself, so without a reading measure every row
  // becomes a metre-long tap target with its chevron at the far edge — the
  // stretched-phone-page composition the 10 August direction names.
  return (
    <Workspace width="reading">
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

      <button type="button" className={m.linkRow} onClick={() => navigate('/more/scoring')}>
        How the games work
        <ChevronRightIcon size={18} className={m.chev} />
      </button>
    </div>
    </Workspace>
  )
}
