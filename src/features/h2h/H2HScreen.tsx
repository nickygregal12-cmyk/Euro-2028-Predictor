import type { ReactNode } from 'react'
import { initialsOf, TeamFlag, type MatchTeam } from '../../design-system'
import { UsersIcon, ArrowsSplitIcon } from '../../design-system/icons'
import type { BracketHealth } from '../../domain/tournament/bracketHealth'
import h from './h2h.module.css'

const EMPTY_BRACKET_HEALTH: BracketHealth = {
  securedPoints: 0,
  possiblePoints: 0,
  lostPoints: 0,
  totalPredictedPoints: 0,
  milestones: [],
}

export type H2HPlayerView = {
  displayName: string
  champion: MatchTeam | null
  championEliminated: boolean
  totalPoints: number
  exactScores: number
  koPicksAlive: number
  maxPossible: number
  bracketHealth?: BracketHealth
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
  rankHistory?: ReactNode
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

function percentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0
}

function HealthPanel({ label, health }: { label: string; health: BracketHealth }) {
  const aria = `${label}: ${health.securedPoints} knockout points secured, ${health.possiblePoints} still possible, ${health.lostPoints} lost.`
  return (
    <div className={h.healthPanel}>
      <div className={h.healthPanelHead}>
        <span>{label}</span>
        <strong>{health.totalPredictedPoints} pts predicted</strong>
      </div>
      <div className={h.healthBar} role="img" aria-label={aria}>
        <span
          className={h.healthSecured}
          style={{ width: `${percentage(health.securedPoints, health.totalPredictedPoints)}%` }}
        />
        <span
          className={h.healthPossible}
          style={{ width: `${percentage(health.possiblePoints, health.totalPredictedPoints)}%` }}
        />
        <span
          className={h.healthLost}
          style={{ width: `${percentage(health.lostPoints, health.totalPredictedPoints)}%` }}
        />
      </div>
      <dl className={h.healthStats}>
        <div><dt>Secured</dt><dd>{health.securedPoints}</dd></div>
        <div><dt>Still possible</dt><dd>{health.possiblePoints}</dd></div>
        <div><dt>Lost</dt><dd>{health.lostPoints}</dd></div>
      </dl>
    </div>
  )
}

/**
 * H2H comparison: authoritative headline totals, browser-derived comparison
 * statistics, rank history, milestone-based knockout health, and major splits.
 */
export function H2HScreen({ you, rival, split, rankHistory }: H2HScreenProps) {
  const youHealth = you.bracketHealth ?? EMPTY_BRACKET_HEALTH
  const rivalHealth = rival.bracketHealth ?? EMPTY_BRACKET_HEALTH

  return (
    <>
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

      <div className={h.statCard}>
        <StatRow label="Exact scores" you={you.exactScores} rival={rival.exactScores} />
        <StatRow label="Max still possible" you={you.maxPossible} rival={rival.maxPossible} />
      </div>

      {rankHistory}

      <section className={h.healthCard} aria-labelledby="h2h-bracket-health-heading">
        <div>
          <span className={h.sectionEyebrow}>Bracket health</span>
          <h2 id="h2h-bracket-health-heading" className={h.sectionTitle}>
            Knockout value secured, alive and lost
          </h2>
        </div>
        <div className={h.healthGrid}>
          <HealthPanel label="You" health={youHealth} />
          <HealthPanel label={rival.displayName} health={rivalHealth} />
        </div>
        <p className={h.healthNote}>
          Knockout points stack by milestone. “Still possible” means the team can still reach that predicted stage.
        </p>
      </section>

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
