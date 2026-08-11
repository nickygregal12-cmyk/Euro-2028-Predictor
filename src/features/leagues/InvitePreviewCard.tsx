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
 * THERE IS NO MEMBER COUNT AND NO CONTAINER ID TO RENDER. This card used to
 * carry a comment explaining that the resolver returned a member count and that
 * showing it would reopen `SEC-001` through a second surface. Contract 159
 * removed both fields from the resolver, so the restraint is now the server's
 * rather than this component's — which is the better place for it. The name is
 * what an invitee needs in order to know what they are being asked to join; the
 * size of the group is not, and the id is what would identify it.
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
  onDecline: () => void
  /**
   * Overrides the decline control's wording.
   *
   * IT EXISTS BECAUSE THERE IS NOTHING TO OPEN. Contract 159 stopped the
   * resolver returning a container id — a member count and an id are what turn
   * a guessed code into a positively identified private group — so a player who
   * is already in cannot be sent to that specific league or competition from
   * here. The honest control is the one that leaves, relabelled to say where it
   * goes, rather than an Open button pointing at an id the client does not have.
   */
  declineLabel?: string
}

export function InvitePreviewCard({
  invite,
  joining = false,
  onJoin,
  onDecline,
  declineLabel,
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
      <p className={s.previewMeta}>
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
        <p className={s.previewInfo}>
          This competition is closed to new entrants. Ask the organiser whether another one is
          running.
        </p>
      ) : null}

      {needsGame ? (
        <p className={s.previewInfo}>
          This league ranks {invite.game ?? 'a game'} in {invite.season ?? 'its competition'}. Join
          that game first and the code will work.
        </p>
      ) : null}

      {invite.kind === 'competition' && invite.isOwner ? (
        <p className={s.previewMeta}>You created this competition.</p>
      ) : null}

      <div className={s.previewActions}>
        <Button variant="secondary" onClick={onDecline} disabled={joining}>
          {declineLabel ?? (invite.alreadyIn ? 'Not now' : 'Decline')}
        </Button>
        {joinable ? (
          <Button onClick={onJoin} loading={joining}>
            {invite.kind === 'league' ? 'Join league' : 'Join competition'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
