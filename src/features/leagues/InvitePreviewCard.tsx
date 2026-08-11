import { Button } from '../../design-system'
import { TrophyIcon } from '../../design-system/icons'
import type { ResolvedInvite } from '../../services/supabase/inviteCodesModel'
import s from './leagueForms.module.css'

/**
 * What one invite code turns out to be, before the player commits to it
 * (contract 155, `MIG-UI-07`).
 *
 * ONE CARD FOR BOTH CONTAINERS. A code resolves to a league or to a private
 * competition, never both, and an invitee should not have to know which kind
 * they were sent. The differences that MATTER are stated — a league needs the
 * underlying game first, a competition does not; a launched Championship is
 * closed — and the differences that do not are hidden.
 *
 * MEMBER COUNT IS DELIBERATELY NOT RENDERED, although `resolve_invite_code`
 * returns it. Contract 158 removed exactly that field from
 * `get_league_preview` because it was the thing that turned a guessed code into
 * a positively identified private group — `SEC-001`. Showing it here would
 * reopen the hole through a second surface. The name is what an invitee needs
 * in order to know what they are being asked to join; the size of the group is
 * not.
 *
 * A REFUSAL IS NEVER A DEAD END. Every state that cannot be joined — already
 * in, closed, needs the game first — offers the action that WOULD work, or says
 * plainly what to do. A card that renders a disabled button and no explanation
 * is the pattern this replaces.
 *
 * PRESENTATIONAL. The parent owns joining, opening and declining.
 */

export type InvitePreviewCardProps = {
  invite: Extract<ResolvedInvite, { found: true }>
  joining?: boolean
  onJoin: () => void
  /** Offered when the caller is already in, and has somewhere to send them. */
  onOpen?: () => void
  onDecline: () => void
}

export function InvitePreviewCard({
  invite,
  joining = false,
  onJoin,
  onOpen,
  onDecline,
}: InvitePreviewCardProps) {
  const closed = invite.kind === 'competition' && invite.closed
  const needsGame = invite.kind === 'league' && invite.requiresGameEntry
  const joinable = !invite.alreadyIn && !closed && !needsGame

  return (
    <div className={s.preview}>
      <span className={s.previewIcon}>
        <TrophyIcon size={22} />
      </span>
      <h2 className={s.previewName}>{invite.name}</h2>

      {/* What it is, in the server's own words: the game's display name and the
          season's name, both from the catalogue rather than derived here. */}
      <p className={s.previewNote}>
        {[invite.game, invite.season].filter(Boolean).join(' · ')}
      </p>

      {invite.alreadyIn ? (
        <p className={s.previewNote}>
          You’re already in {invite.kind === 'league' ? 'this league' : 'this competition'}.
        </p>
      ) : null}

      {closed ? (
        // Closed covers both "the organiser launched it" and "it finished", and
        // the server does not say which. Neither does this, rather than
        // guessing at a reason.
        <p className={s.previewNote}>
          This competition is closed to new entrants. Ask the organiser whether another one is
          running.
        </p>
      ) : null}

      {needsGame ? (
        <p className={s.previewNote}>
          This league ranks {invite.game ?? 'a game'} in {invite.season ?? 'its competition'}. Join
          that game first and the code will work.
        </p>
      ) : null}

      {invite.kind === 'competition' && invite.isOwner ? (
        <p className={s.previewNote}>You created this competition.</p>
      ) : null}

      <div className={s.previewActions}>
        <Button variant="secondary" onClick={onDecline} disabled={joining}>
          {invite.alreadyIn ? 'Not now' : 'Decline'}
        </Button>
        {invite.alreadyIn && onOpen ? (
          <Button onClick={onOpen} disabled={joining}>
            {invite.kind === 'league' ? 'Open league' : 'Open competition'}
          </Button>
        ) : null}
        {joinable ? (
          <Button onClick={onJoin} loading={joining}>
            {invite.kind === 'league' ? 'Join league' : 'Join competition'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
