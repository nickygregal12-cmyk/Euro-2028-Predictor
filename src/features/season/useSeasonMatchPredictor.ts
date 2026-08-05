import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SaveStatus } from '../../domain/saveCoordinator'
import type { ScorelinePrediction } from '../../domain/season/scoring'
import { createSaveController, type SaveController } from '../../app/providers/saveController'
import { isVersionConflict } from '../../services/supabase/writeConflict'
import {
  type CardPresentation,
  type MatchPredictorCommand,
  type MatchPredictorGateway,
  type MatchPredictorPage,
  commandRefusal,
  presentCard,
} from './matchPredictorModel'

/**
 * Season matchweek state, saved optimistically, with conflict recovery.
 *
 * WHY THIS IS NOT A CONSUMER OF `PredictionsProvider`. That provider is keyed on
 * a single `tournament.id`, calls the tournament RPCs (`upsertMatchPrediction`,
 * `replace_predicted_progression`, `submit_entry`) and enforces the tournament
 * Joker allowance. None of that serves a season, and widening it would put two
 * competitions' write rules in one object — which ADR 0011's separation law
 * exists to prevent. What IS reused is everything one level down: the pure
 * ordering machine in `domain/saveCoordinator`, its impure runner in
 * `app/providers/saveController`, and `isVersionConflict`. So there is one
 * save-ordering implementation in the repository, with two callers.
 *
 * OPTIMISTIC, AND NOT ROLLED BACK. A local edit applies immediately and stays
 * applied through a failure, matching the tournament flow: silently reverting a
 * player's typing is worse than showing a save that is retrying, because the
 * player cannot tell a revert from having mistyped. What a failure changes is
 * the save status, which is rendered per fixture.
 *
 * A VERSION CONFLICT IS TERMINAL. The coordinator classifies it as
 * non-retryable, and this hook surfaces it as `conflict_requires_refresh` — the
 * one state in §12.1 that any load can reach. Recovery is an explicit reload,
 * because the page is knowingly showing data the server has already changed and
 * guessing which side wins is exactly what a conflict means we cannot do.
 */

export type SeasonMatchPredictorView = {
  status: 'loading' | 'ready' | 'failed'
  page: MatchPredictorPage | null
  presentation: CardPresentation | null
  /** Save status per fixture id, plus `joker` and `card` for the two card-level keys. */
  saveStatus: Readonly<Record<string, SaveStatus>>
  /** Set when the last command was refused, with the reason to show. */
  refusal: string | null
  /** Set when the load itself failed. */
  loadError: string | null
  setPrediction: (fixtureId: string, prediction: ScorelinePrediction | null) => void
  setJoker: (played: boolean) => void
  confirmCard: () => void
  retrySave: (key: string) => void
  reload: () => void
}

const JOKER_KEY = 'joker'
const CARD_KEY = 'card'

export function useSeasonMatchPredictor(
  gateway: MatchPredictorGateway,
  matchweek: number,
): SeasonMatchPredictorView {
  const [page, setPage] = useState<MatchPredictorPage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [refusal, setRefusal] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const controllerRef = useRef<SaveController | null>(null)
  const pageRef = useRef<MatchPredictorPage | null>(null)
  pageRef.current = page

  const hasConflict = useMemo(
    () => Object.values(saveStatus).some((value) => value === 'conflict'),
    [saveStatus],
  )

  const presentation = useMemo(
    () => (page === null ? null : presentCard(page, hasConflict)),
    [page, hasConflict],
  )

  // One controller for the whole matchweek, created once. Recreating it on
  // every render would lose in-flight state and defeat the ordering guarantees
  // the coordinator exists to provide.
  if (controllerRef.current === null) {
    controllerRef.current = createSaveController({
      performSave: async (key, payload) => {
        await gateway.apply(matchweek, payload as MatchPredictorCommand)
        void key
      },
      onStatus: (key, next) => {
        setSaveStatus((current) => ({ ...current, [key]: next }))
      },
      isConflict: isVersionConflict,
    })
  }

  useEffect(() => {
    const controller = controllerRef.current
    return () => {
      controller?.dispose()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError(null)
    gateway
      .load(matchweek)
      .then((loaded) => {
        if (cancelled) return
        setPage(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // The message is the gateway's, not invented here: an honest
        // "unavailable" needs to say which thing was unavailable.
        setLoadError(error instanceof Error ? error.message : 'This matchweek could not be loaded.')
        setStatus('failed')
      })
    return () => {
      cancelled = true
    }
  }, [gateway, matchweek, reloadToken])

  const issue = useCallback(
    (key: string, command: MatchPredictorCommand, optimistic: () => void) => {
      const current = pageRef.current
      if (current === null) return
      const refused = commandRefusal(presentCard(current, hasConflict), command, current.joker)
      if (refused !== null) {
        setRefusal(refused)
        return
      }
      setRefusal(null)
      optimistic()
      controllerRef.current?.change(key, command)
    },
    [hasConflict],
  )

  const setPrediction = useCallback(
    (fixtureId: string, prediction: ScorelinePrediction | null) => {
      issue(fixtureId, { kind: 'setPrediction', fixtureId, prediction }, () => {
        setPage((current) =>
          current === null
            ? current
            : {
                ...current,
                // A player who edits anything has engaged the matchweek, so the
                // card stops being `no_submission`. That is the difference
                // between unbanked and banking what they entered, so it has to
                // move here rather than waiting for a server round trip.
                cardStatus: current.cardStatus === 'no_submission' ? 'provisional' : current.cardStatus,
                fixtures: current.fixtures.map((fixture) =>
                  fixture.fixtureId === fixtureId ? { ...fixture, prediction } : fixture,
                ),
              },
        )
      })
    },
    [issue],
  )

  const setJoker = useCallback(
    (played: boolean) => {
      issue(JOKER_KEY, { kind: 'setJoker', played }, () => {
        setPage((current) =>
          current === null
            ? current
            : {
                ...current,
                joker: {
                  ...current.joker,
                  playedHere: played,
                  remainingThisHalf: Math.max(
                    0,
                    current.joker.remainingThisHalf + (played ? -1 : 1),
                  ),
                },
              },
        )
      })
    },
    [issue],
  )

  const confirmCard = useCallback(() => {
    issue(CARD_KEY, { kind: 'confirmCard' }, () => {
      setPage((current) => (current === null ? current : { ...current, cardStatus: 'confirmed' }))
    })
  }, [issue])

  const retrySave = useCallback((key: string) => {
    controllerRef.current?.manualRetry(key)
  }, [])

  const reload = useCallback(() => {
    controllerRef.current?.reset()
    setSaveStatus({})
    setRefusal(null)
    setReloadToken((token) => token + 1)
  }, [])

  return {
    status,
    page,
    presentation,
    saveStatus,
    refusal,
    loadError,
    setPrediction,
    setJoker,
    confirmCard,
    retrySave,
    reload,
  }
}
