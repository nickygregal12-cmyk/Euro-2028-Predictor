import { initialsOf, TeamFlag, type MatchTeam } from '../../design-system'
import { UsersIcon, ArrowsSplitIcon } from '../../design-system/icons'
import h from './h2h.module.css'

export type H2HPlayerView = {
  displayName: string
  champion: MatchTeam | null
  championEliminated: boolean
  totalPoints: number
  exactScores: number
  koPicksAlive: number
  maxPossible: number
}

export type H2HSplitView = {
  champion: { agree: boolean; mine: MatchTeam | null; theirs: MatchTeam | null }
  sharedFinalists: MatchTeam[]
  mineOnlyFinalists: MatchTeam[]
  theirsOnlyFinalists: MatchTeam[]
}

export type H2HScreenProps = {
  you: H2HPlayerView
  rival: H2HPlayerView
  split: H2HSplitView
}

function PlayerHead({ p, isYou }: { p: H2HPlayerView; isYou: boolean }) {
  return (
    <div className={h.player}>
      <span className={`${h.avatar} ${isYou ? h.avatarYou : ''}`} aria-hidden="true">
        {initialsOf(p.displayName)}
      </span>
      <span className={h.playerName}>{p.displayName}</span>
      {p.champion ? (
        <span className={`${h.championChip} ${p.championEliminated ? h.championOut : ''}`}>
          <TeamFlag countryCode={p.champion.countryCode} label={`Champion: ${p.champion.name}`} size="venue" />
          <span className={p.championEliminated ? h.strike : ''}>{p.champion.name}</span>
        </span>
      ) : (
        <span className={h.noChampion}>No champion</span>
      )}
    </div>
  )
}

function StatRow({ label, you, rival }: { label: string; you: number; rival: number }) {
  const youBetter = you > rival
  const rivalBetter = rival > you
  return (
    <div className={h.statRow}>
      <span className={`${h.statVal} ${youBetter ? h.statBetter : ''}`}>{you}</span>
      <span className={h.statLabel}>{label}</span>
      <span className={`${h.statVal} ${rivalBetter ? h.statBetter : ''}`}>{rival}</span>
    </div>
  )
}

/**
 * H2H pass 1 (design-system §6): face-off header (both players + big totals),
 * stat-vs-stat rows (Exact / KO picks alive / Max still possible), and the
 * where-you-split strip. The rank-over-time graph and bracket-health are Phase 3
 * and deliberately absent. Presentational — the page computes and resolves teams.
 */
export function H2HScreen({ you, rival, split }: H2HScreenProps) {
  return (
    <>
      {/* Face-off header */}
      <div className={h.faceOff}>
        <PlayerHead p={you} isYou />
        <div className={h.scoreCol}>
          <span className={h.totals}>
            {you.totalPoints} <span className={h.dash}>–</span> {rival.totalPoints}
          </span>
          <span className={h.totalsLabel}>Total points</span>
        </div>
        <PlayerHead p={rival} isYou={false} />
      </div>

      {/* Stat vs stat */}
      <div className={h.statCard}>
        <StatRow label="Exact scores" you={you.exactScores} rival={rival.exactScores} />
        <StatRow label="KO picks alive" you={you.koPicksAlive} rival={rival.koPicksAlive} />
        <StatRow label="Max still possible" you={you.maxPossible} rival={rival.maxPossible} />
      </div>

      {/* Where you split */}
      <div className={h.splitCard}>
        <span className={h.splitEyebrow}>Where you split</span>

        <SplitLine
          agree={split.champion.agree}
          text={
            split.champion.agree
              ? `You both back ${split.champion.mine?.name ?? '—'} for the title`
              : `Champion: you ${split.champion.mine?.name ?? '—'} · them ${split.champion.theirs?.name ?? '—'}`
          }
        />

        {split.sharedFinalists.length > 0 && (
          <SplitLine
            agree
            text={`You both have ${split.sharedFinalists.map((t) => t.name).join(' & ')} in the final`}
          />
        )}
        {split.mineOnlyFinalists.length > 0 && (
          <SplitLine
            agree={false}
            text={`You alone back ${split.mineOnlyFinalists.map((t) => t.name).join(', ')} to the final`}
          />
        )}
        {split.theirsOnlyFinalists.length > 0 && (
          <SplitLine
            agree={false}
            text={`They alone back ${split.theirsOnlyFinalists.map((t) => t.name).join(', ')} to the final`}
          />
        )}
      </div>
    </>
  )
}

function SplitLine({ agree, text }: { agree: boolean; text: string }) {
  return (
    <div className={h.splitLine}>
      <span className={`${h.splitIcon} ${agree ? h.splitAgree : h.splitDiverge}`} aria-hidden="true">
        {agree ? <UsersIcon size={15} /> : <ArrowsSplitIcon size={15} />}
      </span>
      <span className={h.splitText}>{text}</span>
    </div>
  )
}
