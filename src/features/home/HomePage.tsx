import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, ProgressBar, Skeleton, TeamFlag } from '../../design-system'
import { CheckIcon, ShareIcon } from '../../design-system/icons'
import { daysUntil, formatLongDate } from '../../app/time'
import { StatStrip } from './StatStrip'
import { TodayCard } from './TodayCard'
import { CatchUpLine } from './CatchUpLine'
import { LeagueSnapshot } from './LeagueSnapshot'
import { useHomeData, type HomeModel } from './useHomeData'
import { ShareSheet } from '../share/ShareSheet'
import { useShareModel } from '../share/useShareModel'
import type { ShareVariant } from '../share/shareModel'
import s from '../shared.module.css'
import h from './home.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const state = useHomeData()

  // Share card (design-system §6). Brag numbers only during the tournament.
  const hm = state.status === 'ready' ? state.model : null
  const brag =
    hm && hm.phase === 'during' ? { points: hm.totalPoints, rank: hm.rank, total: hm.entryCount } : null
  const share = useShareModel({ brag })
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDefault, setShareDefault] = useState<ShareVariant>('tease')
  const openShare = (v: ShareVariant) => {
    setShareDefault(v)
    setShareOpen(true)
  }

  const header = (
    <div className={s.header}>
      <span className={s.eyebrow}>Euro 2028</span>
      <h1 className={s.title}>Home</h1>
    </div>
  )

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load your dashboard">
          {state.message}
        </Alert>
      </div>
    )
  }

  const m = state.model
  const canShare = share.model !== null && share.variants.length > 0
  return (
    <div className={s.page}>
      {header}
      {m.phase === 'during' && <DuringLayout m={m} navigate={navigate} onShare={canShare ? openShare : undefined} />}
      {m.phase === 'preSubmitted' && <PreSubmittedLayout m={m} navigate={navigate} onShare={canShare ? openShare : undefined} />}
      {m.phase === 'preIncomplete' && <PreIncompleteLayout m={m} navigate={navigate} />}
      {share.model && (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          model={share.model}
          variants={share.variants}
          defaultVariant={shareDefault}
        />
      )}
    </div>
  )
}

type Nav = ReturnType<typeof useNavigate>

function DuringLayout({ m, navigate, onShare }: { m: HomeModel; navigate: Nav; onShare?: (v: ShareVariant) => void }) {
  return (
    <>
      {onShare && (
        <Button variant="secondary" fullWidth onClick={() => onShare('brag')}>
          <span className={h.shareBtn}>
            <ShareIcon size={15} /> Share your standing
          </span>
        </Button>
      )}
      <StatStrip
        totalPoints={m.totalPoints}
        pointsToday={m.pointsToday}
        rank={m.rank}
        entryCount={m.entryCount}
        bestLeagueRank={m.bestLeague?.rank ?? null}
        hasLeague={m.hasAnyLeague}
        onPoints={() => navigate('/profile')}
        onToday={() => navigate('/profile')}
        onRank={() => navigate('/league/overall')}
        onLeague={() => (m.bestLeague ? navigate(`/league/${m.bestLeague.id}`) : navigate('/league'))}
      />
      <TodayCard section={m.today} onOpenMatch={(ref) => navigate(`/match/${ref}`)} />
      {m.catchUp && <CatchUpLine catchUp={m.catchUp} />}
      <LeagueSnapshot
        league={m.bestLeague}
        onOpen={(id) => navigate(`/league/${id}`)}
        onCreate={() => navigate('/league')}
      />
    </>
  )
}

function PreSubmittedLayout({ m, navigate, onShare }: { m: HomeModel; navigate: Nav; onShare?: (v: ShareVariant) => void }) {
  const days = m.lockAt ? daysUntil(m.lockAt.slice(0, 10)) : m.startsOn ? daysUntil(m.startsOn) : null
  return (
    <>
      <div className={h.submittedBanner}>
        <span className={h.submittedTitle}>
          <CheckIcon size={16} className={h.submittedIcon} /> Entry submitted
        </span>
        <span className={h.submittedSub}>
          You're in.{' '}
          {days !== null && days > 0
            ? `Editable until kickoff — in ${days} day${days === 1 ? '' : 's'}.`
            : 'Editable until kickoff.'}
        </span>
      </div>

      {m.champion && (
        <div className={h.championMini}>
          <TeamFlag
            countryCode={m.champion.countryCode}
            label={`Your champion: ${m.champion.name}`}
            size="champion"
          />
          <span className={h.championMiniBody}>
            <span className={s.eyebrow}>Your champion</span>
            <span className={h.championName}>{m.champion.name}</span>
          </span>
          <Button variant="secondary" onClick={() => onShare?.('tease')} disabled={!onShare}>
            <span className={h.shareBtn}>
              <ShareIcon size={15} /> Share
            </span>
          </Button>
        </div>
      )}

      <Button variant="primary" fullWidth onClick={() => navigate('/league')}>
        {m.hasAnyLeague ? 'Invite friends to your league' : 'Create a league'}
      </Button>
    </>
  )
}

function PreIncompleteLayout({ m, navigate }: { m: HomeModel; navigate: Nav }) {
  const days = m.startsOn ? daysUntil(m.startsOn) : null
  return (
    <>
      <div className={s.card}>
        <span className={s.eyebrow}>Your entry</span>
        <div className={s.rowBetween}>
          <span className={s.stat}>{m.entryPercent}%</span>
          <span className={s.statLabel}>
            {m.groupsPredicted} of {m.groupsTotal}
            <br />
            group matches predicted
          </span>
        </div>
        <ProgressBar value={m.entryPercent} label="Group predictions complete" />
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Deadline</span>
        {days !== null && m.startsOn ? (
          <p className={s.sub}>
            Predictions lock when the tournament kicks off
            {days > 0 ? ` — in ${days} day${days === 1 ? '' : 's'}` : ''} (
            {formatLongDate(m.startsOn)}). The server enforces the lock; this countdown is a reminder.
          </p>
        ) : (
          <p className={s.sub}>Kickoff date to be confirmed.</p>
        )}
      </div>

      <Button variant="primary" fullWidth onClick={() => navigate('/predict')}>
        Continue your predictions
      </Button>
    </>
  )
}
