from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


path = Path("src/app/providers/PredictionsProvider.tsx")
text = path.read_text()
text = replace_once(
    text,
    "import { useTournamentData } from './TournamentDataProvider'\n",
    "import { useTournamentData } from './TournamentDataProvider'\n"
    "import { useReturnToForeground } from './useReturnToForeground'\n",
    "foreground hook import",
)
text = replace_once(
    text,
    "  const localEditRevisionsRef = useRef<LoadRevisions>(createLoadRevisions())\n",
    "  const localEditRevisionsRef = useRef<LoadRevisions>(createLoadRevisions())\n"
    "  const foregroundRefreshInFlightRef = useRef(false)\n"
    "  const mountedRef = useRef(false)\n",
    "foreground refresh refs",
)
text = replace_once(
    text,
    "  // Stop the controller and all debounce/retry timers when the provider unmounts.\n"
    "  useEffect(\n"
    "    () => () => {\n"
    "      clearDebounceTimers()\n"
    "      controllerRef.current?.dispose()\n"
    "    },\n"
    "    [],\n"
    "  )\n",
    "  // Stop the controller and all debounce/retry timers when the provider unmounts.\n"
    "  useEffect(() => {\n"
    "    mountedRef.current = true\n"
    "    return () => {\n"
    "      mountedRef.current = false\n"
    "      clearDebounceTimers()\n"
    "      controllerRef.current?.dispose()\n"
    "    }\n"
    "  }, [])\n",
    "provider lifecycle guard",
)
marker = "  }, [userId, tournamentId])\n\n  // Hand the match's latest local state to the controller."
refresh_block = """  }, [userId, tournamentId])

  async function refreshPersistedEntryAfterForeground() {
    const id = entryIdRef.current
    if (
      !id ||
      !userId ||
      !tournamentId ||
      !ready ||
      submittingRef.current ||
      foregroundRefreshInFlightRef.current
    ) {
      return
    }

    foregroundRefreshInFlightRef.current = true
    flushDebouncedSaves()

    try {
      // Never replace local work while a write is pending, retrying, failed or in
      // conflict. Successful settlement means the server contains every local
      // change that existed before these refresh reads begin.
      const settled = await controller.waitForSettled()
      if (!settled.ok || settled.cancelled || entryIdRef.current !== id) return

      const revisions = { ...localEditRevisionsRef.current }
      const [entryResult, matchResult, tieResult, progressionResult, goldenBootResult] =
        await Promise.allSettled([
          getOrCreateEntry(userId, tournamentId),
          fetchMatchPredictions(id),
          fetchTieResolutions(id),
          fetchProgression(id),
          fetchGoldenBoot(id),
        ])

      if (!mountedRef.current || entryIdRef.current !== id) return

      if (
        entryResult.status === 'fulfilled' &&
        entryResult.value.id === id &&
        !submittingRef.current
      ) {
        setSubmittedAt(entryResult.value.submittedAt)
      }

      if (
        matchResult.status === 'fulfilled' &&
        initialLoadCanApply('matches', revisions.matches)
      ) {
        const map: Record<string, Prediction> = {}
        const versions: Record<string, number> = {}
        for (const row of matchResult.value) {
          map[row.matchId] = {
            homeScore: row.homeScore,
            awayScore: row.awayScore,
            joker: row.joker,
          }
          versions[row.matchId] = row.version
        }
        matchVersionsRef.current = versions
        predictionsRef.current = map
        setPredictions(map)
      }

      if (tieResult.status === 'fulfilled' && initialLoadCanApply('ties', revisions.ties)) {
        setTieResolutions(
          tieResult.value.map((row) => ({ teamIds: row.teamIds, order: row.order })),
        )
      }

      if (
        progressionResult.status === 'fulfilled' &&
        initialLoadCanApply('progression', revisions.progression)
      ) {
        const map: Record<string, ProgressionStage> = {}
        const versions: Record<string, number> = {}
        for (const row of progressionResult.value) {
          map[row.teamId] = row.stage
          versions[row.teamId] = row.version
        }
        setProgression(map)
        progressionPersistedRef.current = map
        progressionDesiredRef.current = map
        progressionVersionsRef.current = versions
      }

      if (
        goldenBootResult.status === 'fulfilled' &&
        initialLoadCanApply('goldenBoot', revisions.goldenBoot)
      ) {
        setGoldenBootPlayerId(goldenBootResult.value.playerId)
        goldenBootVersionRef.current = goldenBootResult.value.version
      }
    } finally {
      foregroundRefreshInFlightRef.current = false
    }
  }

  useReturnToForeground(() => {
    void refreshPersistedEntryAfterForeground()
  })

  // Hand the match's latest local state to the controller."""
text = replace_once(text, marker, refresh_block, "foreground refresh insertion")
path.write_text(text)

Path(".github/scripts/implement-rel005.py").unlink()
