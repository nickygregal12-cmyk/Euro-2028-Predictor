import { Button } from '../../design-system'
import { TrophyIcon } from '../../design-system/icons'
import type { LeaguePreview } from '../../services/supabase/leagues'
import s from './leagueForms.module.css'

export type LeaguePreviewCardProps = {
  preview: LeaguePreview
  joining?: boolean
  onJoin: () => void
  onDecline: () => void
}

/**
 * The league preview shown before joining, with Join / Decline. Shared by the
 * invite deep-link page and the code-entry join sheet (design-system §6). If
 * the user is already a member, Join becomes "Open league" instead.
 * Presentational — the parent owns the join action.
 *
 * MEMBER COUNT AND OWNER NAME ARE GONE, and their absence is a security
 * boundary rather than a simplification. `SEC-001`: any signed-in caller could
 * type six characters and, on a hit, be told the size of a private group and
 * the display name of the person who runs it. Contract 152 stopped the server
 * returning either, so there is nothing here to render. The league's name is
 * what an invitee needs in order to know what they are being asked to join.
 */
export function LeaguePreviewCard({ preview, joining = false, onJoin, onDecline }: LeaguePreviewCardProps) {
  return (
    <div className={s.preview}>
      <span className={s.previewIcon}>
        <TrophyIcon size={22} />
      </span>
      <h2 className={s.previewName}>{preview.name}</h2>

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
