import { useEffect, useRef, useState } from 'react'
import { Alert, ConfirmModal, EmptyState, Skeleton } from '../../design-system'
import { CheckIcon, AlertIcon, TrophyIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import {
  applyBracketPick,
  winnersToProgression,
  roundOfRef,
  type ProgressionStage,
} from '../../domain/tournament/bracketPicks'
import {
  buildBracketPipeline,
  ROUND_ORDER,
  ROUND_LABEL,
  type RoundKey,
} from './bracketPipeline'
import { RoundSwitcher } from './RoundSwitcher'
import { TieCard } from './TieCard'
import { ChampionCard } from './ChampionCard'
import { ConflictBanner } from '../predict/ConflictBanner'
import s from '../shared.module.css'
import b from './bracket.module.css'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

function progressionMap(winners: Record<string, string>): Record<string, ProgressionStage> {
  const map: Record<string, ProgressionStage> = {}
  for (const { teamId, stage } of winnersToProgression(winners)) map[teamId] = stage
  return map
}

type PendingPick = {
  ref: string
  teamId: string
  winners: Record<string, string>
  cleared: string[]
}

export function BracketRound() {
  const data = useTournamentData()
  const preds = usePredictions()

  const [active, setActive] = useState<RoundKey>('R16')
  const [pending, setPending] = useState<PendingPick | null>(null)
  // After a pick, we scroll to the next unpicked tie (or advance the round).
  const [autoTarget, setAutoTarget] = useState<{ kind: 'tie'; ref: string } | { kind: 'round'; key: RoundKey } | null>(null)
  const tieNodes = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    if (!autoTarget) return
    const reduce = prefersReducedMotion()
    if (autoTarget.kind === 'round') {
      setActive(autoTarget.key)
    } else {
      tieNodes.current
        .get(autoTarget.ref)
        ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    }
    setAutoTarget(null)
  }, [autoTarget])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Knockout bracket</h1>
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (data.status !== 'ready' || !preds.ready) {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <h1 className={s.title}>Knockout bracket</h1>
        </div>
        <div className={s.card}>
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  const pipeline = buildBracketPipeline(
    data.data,
    preds.getPrediction,
    preds.tieResolutions,
    preds.bracketProgression,
  )

  const header = (
    <div className={s.header}>
      <span className={s.eyebrow}>Predict</span>
      <h1 className={s.title}>Knockout bracket</h1>
    </div>
  )

  if (!pipeline.ready) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<TrophyIcon size={22} />}
          title="Finish the group stage first"
          description="Your bracket is drawn from your group predictions. Predict every group match and settle any ties, and the Round of 16 appears here."
        />
      </div>
    )
  }

  const activeRound = pipeline.rounds.find((r) => r.key === active) ?? pipeline.rounds[0]

  function commit(next: Record<string, string>, pickedRef: string) {
    preds.setBracketProgression(progressionMap(next))
    // Auto-advance: the next unpicked tie in this round, else the next round.
    const order = activeRound.ties.map((t) => t.ref)
    const nextTie = order.find((ref) => ref !== pickedRef && next[ref] === undefined)
    if (nextTie) {
      setAutoTarget({ kind: 'tie', ref: nextTie })
    } else {
      const idx = ROUND_ORDER.indexOf(active)
      if (idx < ROUND_ORDER.length - 1) setAutoTarget({ kind: 'round', key: ROUND_ORDER[idx + 1] })
    }
  }

  function onPick(ref: string, teamId: string) {
    if (pipeline.winners[ref] === teamId) return // already the winner — no-op
    const { winners, cleared } = applyBracketPick(pipeline.winners, ref, teamId)
    if (cleared.length > 0) {
      // Cascade-confirm: never silent, never blocked.
      setPending({ ref, teamId, winners, cleared })
    } else {
      commit(winners, ref)
    }
  }

  function confirmPending() {
    if (!pending) return
    commit(pending.winners, pending.ref)
    setPending(null)
  }

  const clearedRounds = pending
    ? [...new Set(pending.cleared.map((ref) => ROUND_LABEL[roundOfRef(ref)]))]
    : []

  return (
    <div className={s.page}>
      {header}

      <ConflictBanner />

      <SaveLine status={preds.bracketSaveStatus} onRetry={preds.retryBracketSave} />

      <RoundSwitcher
        rounds={pipeline.rounds.map((r) => ({ key: r.key, label: r.label, picked: r.picked, total: r.total }))}
        active={active}
        onSelect={setActive}
      />

      {active === 'FINAL' && pipeline.champion && (
        <ChampionCard name={pipeline.champion.name} countryCode={pipeline.champion.countryCode} />
      )}

      <div className={b.ties}>
        {activeRound.ties.map((tie) => (
          <div
            key={tie.ref}
            ref={(node) => {
              if (node) tieNodes.current.set(tie.ref, node)
              else tieNodes.current.delete(tie.ref)
            }}
          >
            <TieCard
              provenance={tie.provenance}
              date={tie.date}
              venue={tie.venue}
              venueCountryCode={tie.venueCountryCode}
              home={tie.home}
              away={tie.away}
              pickedTeamId={tie.pickedTeamId}
              onPick={tie.pickable ? (teamId) => onPick(tie.ref, teamId) : undefined}
            />
          </div>
        ))}
      </div>

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        title="Change this pick?"
        confirmLabel="Change it"
        cancelLabel="Keep current"
        destructive
      >
        Changing this clears {pending?.cleared.length} later pick
        {pending && pending.cleared.length === 1 ? '' : 's'}
        {clearedRounds.length > 0 ? ` (${clearedRounds.join(', ')})` : ''}. Those ties go back to
        placeholders.
      </ConfirmModal>
    </div>
  )
}

function SaveLine({ status, onRetry }: { status: string; onRetry: () => void }) {
  // 'conflict' is handled by the ConflictBanner above, not this inline line.
  if (status === 'idle' || status === 'conflict') return null
  return (
    <div className={b.saveLine} role="status">
      {status === 'saving' && <span className={b.saveMuted}>Saving…</span>}
      {status === 'saved' && (
        <span className={b.saveOk}>
          <CheckIcon size={14} /> Saved
        </span>
      )}
      {status === 'error' && (
        <span className={b.saveErr}>
          <AlertIcon size={14} /> Save failed —{' '}
          <button type="button" className={b.retry} onClick={onRetry}>
            retry
          </button>
        </span>
      )}
    </div>
  )
}
