import { EmptyState } from '../../design-system'
import { InfoIcon } from '../../design-system/icons'
import s from '../shared.module.css'
import a from './admin.module.css'

export function AdminUsersPage() {
  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Admin control room</span>
        <h1 className={s.title}>Users</h1>
        <p className={a.intro}>User administration is a separate protected workstream from tournament results.</p>
      </div>

      <EmptyState
        icon={<InfoIcon size={22} />}
        title="User controls are not enabled yet"
        description="Search, moderation, suspension and league membership tools will be added only after their server-side permissions and audit trail are in place."
      />
    </div>
  )
}
