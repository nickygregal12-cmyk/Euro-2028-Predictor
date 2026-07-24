import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, ConfirmModal, Skeleton, Toast } from '../../design-system'
import { ChevronLeftIcon, ShareIcon, UsersIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { rankLeaderboard } from '../../domain/tournament/rankLeaderboard'
import {
  deleteLeague,
  fetchLeague,
  fetchLeagueMembers,
  leaveLeague,
  type LeagueHeader,
  type LeagueMember,
} from '../../services/supabase/leagues'
import { InvitePanel } from './InvitePanel'
import { inviteUrl } from './share'
import { LeagueMemberRow } from './LeagueMemberRow'
import { LeagueOptionsDisclosure } from './LeagueOptionsDisclosure'
import { TransferOwnershipModal } from './TransferOwnershipModal'
import { ShareSheet } from '../share/ShareSheet'
import { useShareModel } from '../share/useShareModel'
import s from '../shared.module.css'
import d from './detail.module.css'

type Loaded = { header: LeagueHeader; members: LeagueMember[] }
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Loaded }

export function LeagueDetailPage() {
  const { id: leagueId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tournament = useTournamentData()
  const lockAt = tournament.status === 'ready' ? tournament.data.tournament.lockAt : null
  const groupMatchCount =
    tournament.status === 'ready'
      ? tournament.data.matches.filter((m) => m.round === 'group').length
      : 36
  const revealed = isEntryLocked(lockAt)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  // Recruitment card: your own bracket with a "Join <league>" invite chip.
  const shareLeague = state.status === 'ready' ? state.data.header : null
  const share = useShareModel(
    shareLeague ? { leagueName: shareLeague.name, url: inviteUrl(shareLeague.inviteCode) } : {},
  )
  const canShare = share.model !== null && share.variants.length > 0

  const youRow = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!leagueId) return
    let active = true
    setState({ status: 'loading' })
    Promise.all([fetchLeague(leagueId), fetchLeagueMembers(leagueId)])
      .then(([header, members]) => {
        if (active) setState({ status: 'ready', data: { header, members } })
      })
      .catch((e) => {
        if (active)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Failed to load the league.',
          })
      })
    return () => {
      active = false
    }
  }, [leagueId, reloadKey])

  // Scroll the current user's row into view once populated.
  useEffect(() => {
    if (state.status === 'ready') youRow.current?.scrollIntoView({ block: 'center' })
  }, [state.status])

  // Auto-dismiss the coming-soon toast.
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const header = (
    <button type="button" className={d.back} onClick={() => navigate('/league')}>
      <ChevronLeftIcon size={16} /> League
    </button>
  )

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={2} />
        </div>
        <div className={s.card}>
          <Skeleton lines={6} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load the league">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const { header: lg, members } = state.data
  const ranked = rankLeaderboard(members)

  async function doLeave() {
    if (!leagueId) return
    setActing(true)
    setActionError(null)
    try {
      await leaveLeague(leagueId)
      navigate('/league')
    } catch (e) {
      setActing(false)
      setActionError(e instanceof Error ? e.message : 'Could not leave the league.')
      setConfirm(null)
    }
  }

  async function doDelete() {
    if (!leagueId) return
    setActing(true)
    setActionError(null)
    try {
      await deleteLeague(leagueId)
      navigate('/league')
    } catch (e) {
      setActing(false)
      setActionError(e instanceof Error ? e.message : 'Could not delete the league.')
      setConfirm(null)
    }
  }

  return (
    <div className={s.page}>
      {header}

      {/* Header card ------------------------------------------------------- */}
      <div className={d.headerCard}>
        <div className={d.headerTop}>
          <div className={d.headerText}>
            <h1 className={d.name}>{lg.name}</h1>
            <p className={d.meta}>
              <span className={d.metaItem}>
                <UsersIcon size={14} />
                {lg.memberCount} {lg.memberCount === 1 ? 'member' : 'members'}
              </span>
              <span className={d.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={d.metaItem}>
                {lg.isOwner ? 'You own this' : `Owner: ${lg.ownerName}`}
              </span>
            </p>
          </div>

          <LeagueOptionsDisclosure
            isOwner={lg.isOwner}
            onTransferOwnership={() => setTransferOpen(true)}
            onDeleteLeague={() => setConfirm('delete')}
            onLeaveLeague={() => setConfirm('leave')}
          />
        </div>

        <InvitePanel leagueName={lg.name} code={lg.inviteCode} mode="chip" />
        {canShare && (
          <Button variant="secondary" fullWidth onClick={() => setShareOpen(true)}>
            <span className={d.shareBtn}>
              <ShareIcon size={15} /> Share your bracket to recruit
            </span>
          </Button>
        )}
      </div>

      {actionError && (
        <Alert variant="error" title="Something went wrong">
          {actionError}
        </Alert>
      )}

      {/* Members table ----------------------------------------------------- */}
      <div className={d.table}>
        <div className={d.headRow}>
          <span>#</span>
          <span />
          <span className={d.headPlayer}>Player</span>
          <span className={d.headLatest}>Latest</span>
          <span className={d.headPts}>Pts</span>
          <span />
        </div>
        {ranked.map((m) => (
          <div key={m.userId} ref={m.isYou ? youRow : undefined}>
            <LeagueMemberRow
              rank={m.rank}
              name={m.displayName}
              totalPoints={m.totalPoints}
              latestPoints={null}
              isYou={m.isYou}
              hasEntry={m.hasEntry}
              progress={
                !m.hasEntry && !revealed
                  ? { predicted: m.predictedCount, total: groupMatchCount }
                  : null
              }
              expanded={expanded === m.userId}
              onToggle={() => setExpanded((cur) => (cur === m.userId ? null : m.userId))}
              revealed={revealed}
              stats={{ exact: null, correct: null, maxLeft: null }}
              // Your own row opens your profile (it exists now, via /profile);
              // other players' profiles still await the reveal-after-lock RLS,
              // which is the only secure path to their stats (roadmap Phase 2).
              onProfile={
                m.isYou
                  ? () => navigate('/profile')
                  : () => setToast('Player profiles are coming soon.')
              }
              // Post-lock only: the button lives behind `revealed` (isEntryLocked),
              // and the endpoint itself refuses pre-lock (defense in depth).
              onHeadToHead={() => navigate(`/h2h/${m.userId}`)}
            />
          </div>
        ))}
      </div>

      {/* Owner: transfer ownership */}
      {lg.isOwner && (
        <TransferOwnershipModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          leagueId={lg.id}
          candidates={members.filter((m) => !m.isYou)}
          onTransferred={() => {
            setTransferOpen(false)
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      {/* Leave / delete confirms */}
      <ConfirmModal
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        onConfirm={doLeave}
        title="Leave this league?"
        confirmLabel="Leave league"
        destructive
        loading={acting}
      >
        You'll drop out of {lg.name}'s standings. You can re-join later with the invite code.
      </ConfirmModal>

      <ConfirmModal
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={doDelete}
        title="Delete this league?"
        confirmLabel="Delete league"
        destructive
        loading={acting}
      >
        {lg.name} and its standings will be permanently removed for all {lg.memberCount} members.
        This can't be undone.
      </ConfirmModal>

      {toast && (
        <div className={d.toastHost}>
          <Toast variant="info" message={toast} onDismiss={() => setToast(null)} />
        </div>
      )}

      {share.model && (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          model={share.model}
          variants={share.variants}
          defaultVariant="bracket"
        />
      )}
    </div>
  )
}
