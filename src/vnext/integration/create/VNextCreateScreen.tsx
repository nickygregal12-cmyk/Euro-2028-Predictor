import { useCallback, useMemo, useState } from 'react'
import { presentCreateJourney } from '../../../features/leagues/createJourneyModel'
import type {
  CreateJourney,
  CreateJourneyGame,
  CreateJourneyHost,
} from '../../../features/leagues/createJourneyModel'
import type { PlayerCompetitions } from '../../../features/hub/playerCompetitions'
import type { CompetitionGameKey } from '../../../services/supabase/competitionGamesModel'
import { userFacingError } from '../../../shared/errors/userFacingError'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import {
  VNextCreatePrivatePlay,
  type CreateIntent,
} from '../../create/VNextCreatePrivatePlay'
import {
  DEFAULT_LMS_SETUP,
  type CreateCommit,
  type CreateGameKey,
  type CreateGameOption,
  type CreateHost,
  type CreateLmsSetup,
  type CreatedPrivatePlay,
  type CreatePrivatePlayView,
  type CreateStep,
} from '../../models/createPrivatePlay'

/**
 * THE CONNECTED CREATE CORRIDOR.
 *
 * ============================ IT DECIDES NOTHING ABOUT WHAT MAY EXIST ===
 *
 * `presentCreateJourney` already answers that from membership and the published
 * catalogue, and it is the SAME function the legacy journey calls. This file
 * maps its answer into the presentation model and calls the three creators —
 * `create_game_league`, `create_private_season_lms`, `create_private_season_cup`
 * — each addressed the way its own container requires. There is no second copy
 * of the creation rules here, no re-validated name and no re-checked lives
 * range; a refusal arrives as the server's own sentence.
 *
 * ============================ WHICH FUNCTION, AND WHY THE ID IS OPAQUE ==
 *
 * The presentation model's `CreateHost.id` is opaque on purpose. For a league
 * it is a `game_competition_id`; for the other two it is a season row. A
 * component that knew the difference would be a component that could send one
 * to the wrong function, so the mapping back lives here, keyed on the host the
 * journey supplied rather than reconstructed.
 *
 * ============================ AND THE WRITES ARE INJECTABLE =============
 *
 * Production passes nothing and the dynamic imports below are used, which keeps
 * three Supabase modules off the corridor's critical path. A test passes them
 * and proves the corridor sends a Championship to the cup creator and a league
 * to the league creator without a network.
 */

export type CreateWrites = {
  readonly createLeague: (
    gameCompetitionId: string,
    name: string,
  ) => Promise<{ id: string; name: string; inviteCode: string | null }>
  readonly createLms: (
    tournamentId: string,
    name: string,
    setup: CreateLmsSetup,
  ) => Promise<{ competitionId: string; name: string; inviteCode: string }>
  readonly createCup: (
    tournamentId: string,
    name: string,
  ) => Promise<{ competitionId: string; name: string; inviteCode: string }>
}

export type VNextCreateScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  /** The player's competitions, from the provider the application mounts. */
  readonly player: PlayerCompetitions | null
  /** True while that read is still in flight. `failed` is stated, not guessed. */
  readonly loading: boolean
  readonly failed: boolean
  readonly onRetry?: (() => void) | undefined
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  /** Where the corridor goes when it is finished, or abandoned. */
  readonly onLeave?: (() => void) | undefined
  /** Open what was just created, where the host has an address for it. */
  readonly onOpenCreated?: ((created: CreatedPrivatePlay) => void) | undefined
  /** The absolute invite link for a code, composed by the host. */
  readonly shareUrlFor?: ((code: string) => string) | undefined
  /**
   * Take an invite code somewhere that can resolve it — `/join/:code`, which
   * owns every answer about a code including the ones it refuses to
   * distinguish. This corridor validates nothing about it.
   */
  readonly onJoinCode?: ((code: string) => void) | undefined
  readonly writes?: CreateWrites | undefined
}

const GAME_KEYS: Readonly<Record<CompetitionGameKey, CreateGameKey | null>> = {
  main_predictor: 'match-predictor',
  last_man_standing: 'last-man-standing',
  predictor_cup: 'championship',
  original_predictor: null,
  ko_predictor: null,
}

function optionsOf(journey: CreateJourney): {
  readonly options: readonly CreateGameOption[]
  readonly byKey: ReadonlyMap<CreateGameKey, CreateJourneyGame>
} {
  const options: CreateGameOption[] = []
  const byKey = new Map<CreateGameKey, CreateJourneyGame>()

  for (const game of journey.games) {
    const key = GAME_KEYS[game.gameKey]
    // A GAME THIS CORRIDOR HAS NO KEY FOR IS OMITTED RATHER THAN GUESSED. The
    // three weekly games are the three the corridor creates; a fourth appearing
    // in the journey would be a catalogue change this lane must not paper over.
    if (key === null) continue
    byKey.set(key, game)
    options.push({
      key,
      name: game.name,
      description: game.description,
      hosts: game.hosts.map(hostOf),
      refusal: game.refusal,
    })
  }

  return { options, byKey }
}

/**
 * The host, with its identity reduced to the one the creator will be addressed
 * by. A league is created against its `game_competition_id`; the other two
 * against the season.
 */
function hostOf(host: CreateJourneyHost): CreateHost {
  return {
    id: host.gameCompetitionId ?? host.tournamentId,
    competitionName: host.competitionName,
    seasonLabel: host.seasonLabel,
  }
}

/**
 * THE CODE OUT OF WHATEVER THE PLAYER PASTED.
 *
 * People paste the whole link as often as they type the code, and a corridor
 * that answered "that is not a code" to a working invite URL would be refusing
 * the commonest input. It takes the last path segment and nothing else — no
 * shape check, no length check, no character class: `/join/:code` owns which
 * codes exist and deliberately makes unknown, malformed and rotated ones
 * indistinguishable, and a guess here would undo that.
 */
function codeFrom(entered: string): string {
  const trimmed = entered.trim()
  const segments = trimmed.split(/[/?#]/).filter((part) => part.length > 0)
  return segments.length === 0 ? '' : (segments[segments.length - 1] ?? '')
}

async function resolveWrites(supplied: CreateWrites | undefined): Promise<CreateWrites> {
  if (supplied) return supplied
  const [leagues, privates] = await Promise.all([
    import('../../../services/supabase/gameLeagues'),
    import('../../../services/supabase/privateCompetitions'),
  ])
  return {
    createLeague: leagues.createGameLeague,
    createLms: privates.createPrivateSeasonLms,
    createCup: privates.createPrivateSeasonCup,
  }
}

export function VNextCreateScreen(props: VNextCreateScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const [generatedAt] = useState(() => new Date().toISOString())
  const [step, setStep] = useState<CreateStep>('game')
  const [gameKey, setGameKey] = useState<CreateGameKey | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [lms, setLms] = useState<CreateLmsSetup>(DEFAULT_LMS_SETUP)
  const [joinCode, setJoinCode] = useState('')
  const [commit, setCommit] = useState<CreateCommit>({ kind: 'idle' })
  const [created, setCreated] = useState<CreatedPrivatePlay | null>(null)

  const journey = useMemo(() => presentCreateJourney(props.player), [props.player])
  const { options, byKey } = useMemo(() => optionsOf(journey), [journey])

  const chosen = gameKey === null ? null : (options.find((o) => o.key === gameKey) ?? null)
  const host = chosen?.hosts.find((entry) => entry.id === hostId) ?? null

  const { writes, shareUrlFor, onLeave, onOpenCreated, onJoinCode } = props

  const create = useCallback(async () => {
    if (chosen === null || host === null || gameKey === null) return
    const journeyGame = byKey.get(gameKey)
    if (!journeyGame) return
    const journeyHost = journeyGame.hosts.find(
      (entry) => (entry.gameCompetitionId ?? entry.tournamentId) === host.id,
    )
    if (!journeyHost) return

    setCommit({ kind: 'working' })
    try {
      const perform = await resolveWrites(writes)
      const trimmed = name.trim()

      if (journeyGame.setup === 'league') {
        // ADDRESSED BY THE GAME MEMBERSHIP, never by the season. A league ranks
        // points already being scored in one game in one competition.
        const league = await perform.createLeague(journeyHost.gameCompetitionId ?? '', trimmed)
        setCreated({
          game: 'match-predictor',
          name: league.name,
          competitionName: journeyHost.competitionName,
          inviteCode: league.inviteCode,
          shareUrl: league.inviteCode ? (shareUrlFor?.(league.inviteCode) ?? null) : null,
          awaitsLaunch: false,
        })
      } else {
        const competition =
          journeyGame.setup === 'lms'
            ? await perform.createLms(journeyHost.tournamentId, trimmed, lms)
            : await perform.createCup(journeyHost.tournamentId, trimmed)
        setCreated({
          game: journeyGame.setup === 'lms' ? 'last-man-standing' : 'championship',
          name: competition.name,
          competitionName: journeyHost.competitionName,
          inviteCode: competition.inviteCode,
          shareUrl: shareUrlFor?.(competition.inviteCode) ?? null,
          // A CHAMPIONSHIP IS CREATED AND THEN LAUNCHED, and only a Championship
          // is. The flag comes from which creator ran rather than from reading
          // the payload's outcome, because the two say the same thing and the
          // corridor should not have an opinion about the second.
          awaitsLaunch: journeyGame.setup === 'cup',
        })
      }

      setCommit({ kind: 'idle' })
      setStep('created')
    } catch (error) {
      setCommit({
        kind: 'failed',
        message: userFacingError(error, 'We could not create that just now.'),
      })
    }
  }, [byKey, chosen, gameKey, host, lms, name, shareUrlFor, writes])

  const onIntent = useCallback(
    (intent: CreateIntent) => {
      switch (intent.kind) {
        case 'choose-game': {
          setGameKey(intent.game)
          const only = options.find((entry) => entry.key === intent.game)?.hosts
          // ONE HOST IS NOT A CHOICE. Preselecting it saves a press for the
          // common case and changes nothing for a player in several.
          setHostId(only?.length === 1 ? (only[0]?.id ?? null) : null)
          setCommit({ kind: 'idle' })
          setStep('setup')
          return
        }
        case 'choose-host':
          setHostId(intent.hostId)
          return
        case 'join-code':
          setJoinCode(intent.code)
          return
        case 'join': {
          const code = codeFrom(joinCode)
          if (code.length > 0) onJoinCode?.(code)
          return
        }
        case 'name':
          setName(intent.name)
          return
        case 'lms':
          setLms(intent.setup)
          return
        case 'back':
          setStep('game')
          setCommit({ kind: 'idle' })
          return
        case 'create':
          void create()
          return
        case 'share':
          if (created?.shareUrl) void navigator.clipboard?.writeText(created.shareUrl)
          return
        case 'open-created':
          if (created) onOpenCreated?.(created)
          return
        case 'retry':
          props.onRetry?.()
          return
        default:
          onLeave?.()
      }
    },
    [create, created, joinCode, onJoinCode, onLeave, onOpenCreated, options, props],
  )

  const view = useMemo<CreatePrivatePlayView>(() => {
    if (props.authLoading || props.loading) return { kind: 'loading' }
    if (props.userId === null) {
      return {
        kind: 'unavailable',
        message: 'Private play belongs to an account, so we need to know who you are first.',
      }
    }
    if (props.failed) {
      return {
        kind: 'unavailable',
        message:
          'We could not read your competitions, so we cannot say what you could build one in.',
      }
    }
    return {
      kind: 'ready',
      model: {
        generatedAt,
        step,
        games: options,
        chosen,
        host,
        name,
        joinCode,
        lms,
        commit,
        created,
        blocked: journey.blocked,
      },
    }
  }, [
    chosen,
    commit,
    created,
    generatedAt,
    host,
    joinCode,
    journey.blocked,
    lms,
    name,
    options,
    props.authLoading,
    props.failed,
    props.loading,
    props.userId,
    step,
  ])

  const shell = useMemo(
    () =>
      buildShellModel({
        // The corridor spans competitions — a Championship can be built on a
        // season the player plays nothing in — so it names none in the chrome.
        competition: null,
        playerName: null,
        outstandingPredictions: null,
        canNavigateAway: props.onShellIntent !== undefined,
        elsewhere,
      }),
    [props.onShellIntent, elsewhere],
  )

  return (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      <VNextCreatePrivatePlay view={view} onIntent={onIntent} />
    </VNextShellProvider>
  )
}
