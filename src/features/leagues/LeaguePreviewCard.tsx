import { Button } from '../../design-system'
import { UsersIcon, TrophyIcon } from '../../design-system/icons'
import type { LeaguePreview } from '../../services/supabase/leagues'
import s from './leagueForms.module.css'

export type LeaguePreviewCardProps = {
  preview: LeaguePreview
  joining?: boolean
  onJoin: () => void
  onDecline: () => void
}

/**
 * The league preview shown before joining (name, member count, owner) with
 * Join / Decline. Shared by the invite deep-link page and the code-entry join
 * sheet (design-system §6). If the user is already a member, Join becomes "Open
 * league" instead. Presentational — the parent owns the join action.
 */
export function LeaguePreviewCard({ preview, joining = false, onJoin, onDecline }: LeaguePreviewCardProps) {
  return (
    <div className={s.preview}>
      <span className={s.previewIcon}>
        <TrophyIcon size={22} />
      </span>
      <h2 className={s.previewName}>{preview.name}</h2>
      <p className={s.previewMeta}>
        <span className={s.previewMetaItem}>
          <UsersIcon size={14} />
          {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span className={s.previewDot} aria-hidden="true">
          ·
        </span>
        <span className={s.previewMetaItem}>Owner: {preview.ownerName}</span>
      </p>

      {preview.isMember && <p className={s.previewNote}>You're already in this league.</p>}

      <div className={s.previewActions}>
        <Button variant="secondary" onClick={onDecline} disabled={joining}>
          {preview.isMember ? 'Not now' : 'Decline'}
        </Button>
        <Button onClick={onJoin} loading={joining}>
          {preview.isMember ? 'Open league' : 'Join league'}
        </Button>
      </div>
    </div>
  )
}
