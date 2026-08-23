import { useCallback, useMemo, useRef, useState } from 'react'
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

type CreateLeagueRead = {
  readonly id: string
  readonly name: string
  readonly inviteCode: string
  readonly isOwner: boolean
}

type CreatePrivateRead = {
  readonly competitionId: string
  readonly name: string
  readonly gameKey: 'last_man_standing' | 'predictor_cup'
  readonly tournamentId: string
  readonly isOwner: boolean
  readonly inviteCode: string | null
}

/**
 * Writes and the reads that must confirm them. A mutation response is used only
 * to locate the row in the authoritative reread; success is not presented until
 * that row is visible through the same read the next page/reload uses.
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
  readonly readLeagues: (gameCompetitionId: string) => Promise<readonly CreateLeagueRead[]>
  readonly readPrivateCompetitions: () => Promise<readonly CreatePrivateRead[]>
}

export type VNextCreateScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly player: PlayerCompetitions | null
  readonly loading: boolean
  readonly failed: boolean
  readonly onRetry?: (() => void) | undefined
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  readonly onLeave?: (() => void) | undefined
  readonly onOpenCreated?: ((created: CreatedPrivatePlay) => void) | undefined
  readonly shareUrlFor?: ((code: string) => string) | undefined
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

function hostOf(host: CreateJourneyHost): CreateHost {
  return {
    id: host.gameCompetitionId ?? host.tournamentId,
    competitionName: host.competitionName,
    seasonLabel: host.seasonLabel,
  }
}

function codeFrom(entered: string): string {
  const trimmed = entered.trim()
  const segments = trimmed.split(/[/?#]/).filter((part) => part.length > 0)
  return segments.length === 0 ? '' : (segments[segments.length - 1] ?? '')
}

class CreateReadbackError extends Error {
  constructor() {
    super('The create completed but its authoritative reread did not confirm the container.')
  }
}

const READBACK_FAILURE =
  'The create request completed, but we could not confirm it in your private-play list. Check Leagues before trying again so you do not create a duplicate.'

async function resolveWrites(supplied: CreateWrites | undefined): Promise<CreateWrites> {
  if (supplied) return supplied
  const [leagues, privates, discovery] = await Promise.all([
    import('../../../services/supabase/gameLeagues'),
    import('../../../services/supabase/privateCompetitions'),
    import('../../../services/supabase/privateCompetitionDiscovery'),
  ])
  return {
    createLeague: leagues.createGameLeague,
    createLms: privates.createPrivateSeasonLms,
    createCup: privates.createPrivateSeasonCup,
    readLeagues: leagues.fetchMyGameLeagues,
    readPrivateCompetitions: async () =>
      (await discovery.fetchMyPrivateCompetitions(50, 0)).competitions,
  }
}

async function confirmLeague(
  perform: CreateWrites,
  gameCompetitionId: string,
  createdId: string,
): Promise<CreateLeagueRead> {
  try {
    const verified = (await perform.readLeagues(gameCompetitionId)).find(
      (league) => league.id === createdId && league.isOwner,
    )
    if (!verified) throw new CreateReadbackError()
    return verified
  } catch (error) {
    if (error instanceof CreateReadbackError) throw error
    throw new CreateReadbackError()
  }
}

async function confirmPrivateCompetition(
  perform: CreateWrites,
  createdId: string,
  tournamentId: string,
  gameKey: CreatePrivateRead['gameKey'],
): Promise<CreatePrivateRead> {
  try {
    const verified = (await perform.readPrivateCompetitions()).find(
      (competition) =>
        competition.competitionId === createdId &&
        competition.tournamentId === tournamentId &&
        competition.gameKey === gameKey &&
        competition.isOwner,
    )
    if (!verified) throw new CreateReadbackError()
    return verified
  } catch (error) {
    if (error instanceof CreateReadbackError) throw error
    throw new CreateReadbackError()
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
  const createInFlight = useRef(false)

  const journey = useMemo(() => presentCreateJourney(props.player), [props.player])
  const { options, byKey } = useMemo(() => optionsOf(journey), [journey])

  const chosen = gameKey === null ? null : (options.find((o) => o.key === gameKey) ?? null)
  const host = chosen?.hosts.find((entry) => entry.id === hostId) ?? null
  const { writes, shareUrlFor, onLeave, onOpenCreated, onJoinCode } = props

  const create = useCallback(async () => {
    if (createInFlight.current || chosen === null || host === null || gameKey === null) return
    const journeyGame = byKey.get(gameKey)
    if (!journeyGame) return
    const journeyHost = journeyGame.hosts.find(
      (entry) => (entry.gameCompetitionId ?? entry.tournamentId) === host.id,
    )
    if (!journeyHost) return

    createInFlight.current = true
    setCommit({ kind: 'working' })
    try {
      const perform = await resolveWrites(writes)
      const trimmed = name.trim()

      if (journeyGame.setup === 'league') {
        const result = await perform.createLeague(journeyHost.gameCompetitionId ?? '', trimmed)
        const league = await confirmLeague(
          perform,
          journeyHost.gameCompetitionId ?? '',
          result.id,
        )
        setCreated({
          containerId: league.id,
          game: 'match-predictor',
          name: league.name,
          competitionName: journeyHost.competitionName,
          inviteCode: league.inviteCode,
          shareUrl: shareUrlFor?.(league.inviteCode) ?? null,
          awaitsLaunch: false,
        })
      } else {
        const result =
          journeyGame.setup === 'lms'
            ? await perform.createLms(journeyHost.tournamentId, trimmed, lms)
            : await perform.createCup(journeyHost.tournamentId, trimmed)
        const expectedGame = journeyGame.setup === 'lms' ? 'last_man_standing' : 'predictor_cup'
        const competition = await confirmPrivateCompetition(
          perform,
          result.competitionId,
          journeyHost.tournamentId,
          expectedGame,
        )
        setCreated({
          containerId: competition.competitionId,
          game: journeyGame.setup === 'lms' ? 'last-man-standing' : 'championship',
          name: competition.name,
          competitionName: journeyHost.competitionName,
          inviteCode: competition.inviteCode,
          shareUrl: competition.inviteCode ? (shareUrlFor?.(competition.inviteCode) ?? null) : null,
          awaitsLaunch: journeyGame.setup === 'cup',
        })
      }

      setCommit({ kind: 'idle' })
      setStep('created')
    } catch (error) {
      setCommit({
        kind: 'failed',
        message:
          error instanceof CreateReadbackError
            ? READBACK_FAILURE
            : userFacingError(error, 'We could not create that just now.'),
      })
    } finally {
      createInFlight.current = false
    }
  }, [byKey, chosen, gameKey, host, lms, name, shareUrlFor, writes])

  const onIntent = useCallback(
    (intent: CreateIntent) => {
      switch (intent.kind) {
        case 'choose-game': {
          setGameKey(intent.game)
          const only = options.find((entry) => entry.key === intent.game)?.hosts
          setHostId(only?.length === 1 ? (only[0]?.id ?? null) : null)
          setCreated(null)
          setCommit({ kind: 'idle' })
          setStep('setup')
          return
        }
        case 'choose-host':
          setHostId(intent.hostId)
          setCommit({ kind: 'idle' })
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
          setCommit({ kind: 'idle' })
          return
        case 'lms':
          setLms(intent.setup)
          setCommit({ kind: 'idle' })
          return
        case 'review':
          if (chosen !== null && host !== null && name.trim().length > 0) {
            setCommit({ kind: 'idle' })
            setStep('review')
          }
          return
        case 'back':
          setCommit({ kind: 'idle' })
          setStep((current) => (current === 'review' ? 'setup' : 'game'))
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
    [chosen, create, created, host, joinCode, name, onJoinCode, onLeave, onOpenCreated, options, props],
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
        competition: null,
        playerName: null,
        outstandingGames: null,
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
