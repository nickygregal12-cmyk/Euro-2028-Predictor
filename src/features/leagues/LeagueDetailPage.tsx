import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, ConfirmModal, Skeleton, Toast } from '../../design-system'
import { ChevronLeftIcon, ShareIcon, UsersIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import {
  deleteLeague,
  fetchLeague,
  fetchLeagueMembersPage,
  leaveLeague,
  type LeagueHeader,
  type LeagueMember,
  type LeagueMemberYou,
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

const PAGE_SIZE = 50

type Loaded = {
  header: LeagueHeader
  rows: LeagueMember[]
  totalCount: number
  hasMore: boolean
  nextCursor: string | null
  you: LeagueMemberYou | null
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Loaded }

type MemberLike = LeagueMember | LeagueMemberYou

export function LeagueDetailPage() {
  const { id: leagueId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tournament = useTournamentData()
  const lockAt = tournament.status === 'ready' ? tournament.data.tournament.lockAt : null
  const groupMatchCount =
    tournament.status === 'ready'
      ? tournament.data.matches.filter((match) => match.round === 'group').length
      : 36
  const revealed = isEntryLocked(lockAt)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'leave' | 'delete'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

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
    setLoadingMore(false)
    setMoreError(null)
    setExpanded(null)

    Promise.all([
      fetchLeague(leagueId),
      fetchLeagueMembersPage(leagueId, { limit: PAGE_SIZE }),
    ])
      .then(([header, page]) => {
        if (!active) return
        setState({
          status: 'ready',
          data: {
            header,
            rows: page.rows,
            totalCount: page.totalCount,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            you: page.you,
          },
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          status: 'error',
          message: userFacingError(error, 'Could not load the league. Please try again.'),
        })
      })

    return () => {
      active = false
    }
  }, [leagueId, reloadKey])

  useEffect(() => {
    if (state.status === 'ready' && state.data.rows.some((member) => member.isYou)) {
      youRow.current?.scrollIntoView({ block: 'center' })
    }
  }, [state])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function loadMore() {
    if (
      !leagueId ||
      state.status !== 'ready' ||
      !state.data.hasMore ||
      !state.data.nextCursor ||
      loadingMore
    ) {
      return
    }

    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await fetchLeagueMembersPage(leagueId, {
        limit: PAGE_SIZE,
        after: state.data.nextCursor,
      })
      setState((current) => {
        if (current.status !== 'ready') return current
        const byPosition = new Map(
          [...current.data.rows, ...page.rows].map((member) => [member.position, member]),
        )
        return {
          status: 'ready',
          data: {
            header: current.data.header,
            rows: [...byPosition.values()].sort((a, b) => a.position - b.position),
            totalCount: page.totalCount,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            you: page.you,
          },
        }
      })
    } catch (error) {
      setMoreError(
        userFacingError(error, 'Could not load more league members. Please try again.'),
      )
    } finally {
      setLoadingMore(false)
    }
  }

  const pageHeader = (
    <button type="button" className={d.back} onClick={() => navigate('/league')}>
      <ChevronLeftIcon size={16} /> League
    </button>
  )

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {pageHeader}
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
        {pageHeader}
        <Alert variant="error" title="Couldn't load the league">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const { header: league, rows, totalCount, hasMore, you } = state.data
  const youLoaded = rows.some((member) => member.isYou)

  async function doLeave() {
    if (!leagueId) return
    setActing(true)
    setActionError(null)
    try {
      await leaveLeague(leagueId)
      navigate('/league')
    } catch (error) {
      setActing(false)
      setActionError(userFacingError(error, 'Could not leave the league. Please try again.'))
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
    } catch (error) {
      setActing(false)
      setActionError(userFacingError(error, 'Could not delete the league. Please try again.'))
      setConfirm(null)
    }
  }

  function renderMember(member: MemberLike, isYou: boolean) {
    return (
      <LeagueMemberRow
        rank={member.rank}
        name={member.displayName}
        totalPoints={member.totalPoints}
        latestPoints={null}
        isYou={isYou}
        hasEntry={member.hasEntry}
        progress={
          !member.hasEntry && !revealed
            ? { predicted: member.predictedCount, total: groupMatchCount }
            : null
        }
        expanded={expanded === member.userId}
        onToggle={() => setExpanded((current) => (current === member.userId ? null : member.userId))}
        revealed={revealed}
        stats={{ exact: null, correct: null, maxLeft: null }}
        onProfile={
          isYou
            ? () => navigate('/profile')
            : () => setToast('Player profiles are coming soon.')
        }
        onHeadToHead={isYou ? undefined : () => navigate(`/h2h/${member.userId}`)}
      />
    )
  }

  return (
    <div className={s.page}>
      {pageHeader}

      <div className={d.headerCard}>
        <div className={d.headerTop}>
          <div className={d.headerText}>
            <h1 className={d.name}>{league.name}</h1>
            <p className={d.meta}>
              <span className={d.metaItem}>
                <UsersIcon size={14} />
                {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'}
              </span>
              <span className={d.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={d.metaItem}>
                {league.isOwner ? 'You own this' : `Owner: ${league.ownerName}`}
              </span>
            </p>
          </div>

          <LeagueOptionsDisclosure
            isOwner={league.isOwner}
            onTransferOwnership={() => setTransferOpen(true)}
            onDeleteLeague={() => setConfirm('delete')}
            onLeaveLeague={() => setConfirm('leave')}
          />
        </div>

        <InvitePanel leagueName={league.name} code={league.inviteCode} mode="chip" />
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

      {you && !youLoaded ? (
        <section className={d.yourPosition} aria-labelledby="league-your-position-heading">
          <div className={d.yourPositionHeader}>
            <span id="league-your-position-heading">Your position</span>
            <span>
              {you.position} of {totalCount}
            </span>
          </div>
          {renderMember(you, true)}
        </section>
      ) : null}

      <div className={d.table}>
        <div className={d.headRow}>
          <span>#</span>
          <span />
          <span className={d.headPlayer}>Player</span>
          <span className={d.headLatest}>Latest</span>
          <span className={d.headPts}>Pts</span>
          <span />
        </div>
        {rows.map((member) => (
          <div key={member.position} ref={member.isYou ? youRow : undefined}>
            {renderMember(member, member.isYou)}
          </div>
        ))}
      </div>

      <p className={d.loadedCount}>
        Showing {rows.length} of {totalCount}
      </p>

      {moreError ? (
        <Alert variant="warning" title="Couldn't load more league members">
          {moreError}
        </Alert>
      ) : null}

      {hasMore ? (
        <Button variant="secondary" fullWidth loading={loadingMore} onClick={loadMore}>
          Load more members
        </Button>
      ) : null}

      {league.isOwner && (
        <TransferOwnershipModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          leagueId={league.id}
          onTransferred={() => {
            setTransferOpen(false)
            setReloadKey((key) => key + 1)
          }}
        />
      )}

      <ConfirmModal
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        onConfirm={doLeave}
        title="Leave this league?"
        confirmLabel="Leave league"
        destructive
        loading={acting}
      >
        You'll drop out of {league.name}'s standings. You can re-join later with the invite code.
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
        {league.name} and its standings will be permanently removed for all {league.memberCount}{' '}
        members. This can't be undone.
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
