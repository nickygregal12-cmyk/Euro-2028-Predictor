import type {
  SeasonLeaderboardRow,
  SeasonLeaderboardYou,
  SeasonPlayerReach,
} from '../../../services/supabase/seasonLeaderboardModel'
import type {
  SeasonLeagueStandingsRow,
  SeasonLeagueStandingsYou,
} from '../../../services/supabase/seasonLeagueStandingsModel'
import type { SeasonLeagueMovement } from '../../../services/supabase/seasonLeagueMovementModel'
import type {
  LeagueMovement,
  LeaguePlayer,
  LeaguePlayerDestination,
  LeaguesGlobalRow,
  LeaguesGlobalTable,
  LeaguesModel,
  LeaguesPrivateRow,
  LeaguesPrivateTable,
  LeaguesScope,
} from '../../models/leagues'
import type { LeaguesSource } from './leaguesSource'

/**
 * `LeaguesSource` → `LeaguesModel`. PURE: no network, no storage, no clock and
 * no React — the same four rules every vNext mapper is written under.
 *
 * ============================ IT COMPUTES NO RANK ========================
 *
 * The single rule this file exists to hold. Nothing here sorts a table, derives
 * a rank from points, renumbers from an array index or compares two players to
 * decide who is ahead. `rank`, `position` and `tied` are three different
 * server-supplied facts and all three are carried through untouched.
 *
 * The temptation is real and specific: `rows.map((row, index) => index + 1)`
 * produces something that looks exactly like a rank and is wrong the first time
 * two players tie or a page starts anywhere but the top. Contract 160 warns
 * about it for the football table in as many words; contract 128 recomputes a
 * private league's rank server-side precisely so nobody has to here.
 *
 * ============================ IT INFERS NO PERMISSION ====================
 *
 * `destinationOf` maps the SERVER's `reach` to a destination, and the only
 * openable case additionally requires the id the server sent. It never asks
 * "is there a playerId?" and concludes a permission from the answer — contract
 * 191's decoder refuses to do that one layer down and states why: it would put
 * a permission rule in the browser. A row the caller may not open therefore has
 * no id anywhere in its model, so a surface cannot build a link to it.
 */
/**
 * WHETHER MOVEMENT WAS ASKED FOR AND ANSWERED — ONE PREDICATE, USED TWICE.
 *
 * `movementSettled` and the movement map have to agree, because a surface reads
 * the first to decide whether to DRAW the column and the second to fill it. A
 * payload that says `settled: true` and carries a matchweek with no label maps
 * to no movement at all, and if the flag disagreed the table would draw a
 * "Moved" column in which every row is a dash — literally the "column of
 * em-dashes standing in for nothing has settled yet" that contract 150's rule
 * exists to prevent.
 */
function movementAnswered(movement: SeasonLeagueMovement | null): boolean {
  return movement !== null && movement.settled && (movement.matchweek?.label ?? null) !== null
}

export function buildLeaguesModel(source: LeaguesSource): LeaguesModel {
  const scope: LeaguesScope =
    source.selectedLeagueId === null
      ? { kind: 'global' }
      : { kind: 'private', leagueId: source.selectedLeagueId }

  const leagues = (source.leagues ?? []).map((league) => ({
    id: league.id,
    name: league.name,
    memberCount: league.memberCount,
  }))

  const movement = movementByPlayer(source.movement)

  return {
    generatedAt: source.generatedAt,
    context: {
      competitionName: source.context.competitionName,
      seasonLabel: source.context.seasonLabel,
      gameName: source.context.gameName,
    },
    scope,
    leagues,
    // The list ANSWERED, even if it answered with nothing. `null` is unread.
    leaguesKnown: source.leagues !== null,
    global: scope.kind === 'global' ? globalTableOf(source) : null,
    private: scope.kind === 'private' ? privateTableOf(source, movement) : null,
    unavailable: unavailableOf(source),
  }
}

/* ==========================================================================
   PEOPLE
   ========================================================================== */

/**
 * THE SERVER'S PERMISSION, MAPPED RATHER THAN INTERPRETED.
 *
 *   `self`       the caller. Drawn, never linked — you do not open yourself
 *                from a table you are already standing in.
 *   `profile`    a private-league co-member on this season (contract 151). The
 *                ONE openable case, and it requires the id to exist.
 *   `compare`    a same-season entrant, comparable after a matchweek locks
 *                (contract 129) but NOT profile-readable. A real, ordinary
 *                answer — not an error and not a disabled control.
 *   `name-only`  no address at all. Only ever from a database below contract
 *                191; every row of a season table is at least `compare` once
 *                the contract is applied.
 *
 * A `profile` reach with NO id is treated as closed, and deliberately: the
 * server has said the caller may look but has not said where, and a surface
 * cannot open a door it was given no handle for. It reports `not-stated` rather
 * than `not-shared`, because those are different facts and only one of them is
 * about permission.
 */
function destinationOf(
  reach: SeasonPlayerReach,
  playerId: string | null,
  isYou: boolean,
): LeaguePlayerDestination {
  if (isYou || reach === 'self') return { kind: 'you' }
  if (reach === 'profile') {
    return playerId === null
      ? { kind: 'closed', reason: 'not-stated' }
      : { kind: 'open', playerId }
  }
  return { kind: 'closed', reason: 'not-shared' }
}

function globalPlayer(row: SeasonLeaderboardRow | SeasonLeaderboardYou, isYou: boolean): LeaguePlayer {
  return {
    ref: row.playerRef,
    displayName: row.displayName,
    destination: destinationOf(row.reach, row.playerId, isYou),
  }
}

/**
 * A PRIVATE-LEAGUE MEMBER, WHO IS ALWAYS ADDRESSABLE — and that is contract
 * 151's rule rather than an assumption made here.
 *
 * `get_season_league_standings` returns members of a league the caller belongs
 * to, and contract 151 grants a profile read exactly to a co-member on the
 * season. So a row from this read carries a real `userId` and the caller
 * genuinely may open it. There is no `reach` on this payload because there is
 * nothing for one to decide.
 *
 * THE REFERENCE IS THE USER ID HERE. Contract 191's season-scoped `playerRef`
 * belongs to the leaderboard payload; this read predates it and sends the
 * account id, which is stable and distinguishes two members who share a display
 * name — which is all a key has to do.
 */
function leaguePlayer(row: SeasonLeagueStandingsRow | SeasonLeagueStandingsYou, isYou: boolean): LeaguePlayer {
  return {
    ref: row.userId,
    displayName: row.displayName,
    destination: isYou ? { kind: 'you' } : { kind: 'open', playerId: row.userId },
  }
}

/* ==========================================================================
   THE TWO TABLES — built separately, on purpose
   ========================================================================== */

function globalRow(row: SeasonLeaderboardRow): LeaguesGlobalRow {
  return {
    player: globalPlayer(row, row.isYou),
    // Three server facts, carried. Not one derived from another.
    rank: row.rank,
    tied: row.tied,
    position: row.position,
    points: row.points,
    matchweeksPlayed: row.matchweeksPlayed,
    isYou: row.isYou,
  }
}

function globalTableOf(source: LeaguesSource): LeaguesGlobalTable | null {
  const page = source.global
  if (page === null) return null

  return {
    rows: page.rows.map(globalRow),
    totalCount: page.totalCount,
    // The caller's own row arrives separately BECAUSE IT MAY NOT BE ON THIS
    // PAGE. A surface that searched the rows for `isYou` would show nothing for
    // a player standing 400th, which is most players.
    you:
      page.you === null
        ? null
        : {
            player: globalPlayer(page.you, true),
            rank: page.you.rank,
            tied: page.you.tied,
            position: page.you.position,
            points: page.you.points,
            matchweeksPlayed: page.you.matchweeksPlayed,
            isYou: true,
          },
    hasMore: page.hasMore,
  }
}

function privateRow(
  row: SeasonLeagueStandingsRow,
  movement: ReadonlyMap<string, LeagueMovement>,
): LeaguesPrivateRow {
  return {
    player: leaguePlayer(row, row.isYou),
    // RECOMPUTED WITHIN THE LEAGUE by the server — a different number from the
    // same player's season rank, and never reconciled with it here.
    rank: row.rank,
    tied: row.tied,
    position: row.position,
    points: row.points,
    matchweeksPlayed: row.matchweeksPlayed,
    isYou: row.isYou,
    isOwner: row.isOwner,
    hasEntry: row.hasEntry,
    movement: movement.get(row.userId) ?? null,
  }
}

function privateTableOf(
  source: LeaguesSource,
  movement: ReadonlyMap<string, LeagueMovement>,
): LeaguesPrivateTable | null {
  const page = source.league
  if (page === null || source.selectedLeagueId === null) return null

  const chosen = (source.leagues ?? []).find(
    (league) => league.id === source.selectedLeagueId,
  )

  return {
    leagueId: source.selectedLeagueId,
    // The league list is where a league's NAME lives; the standings read
    // answers the table. A missing name is a list that did not answer, and the
    // honest label for a league we cannot name is not a made-up one.
    name: chosen?.name ?? 'This league',
    memberCount: chosen?.memberCount ?? page.totalCount,
    rows: page.rows.map((row) => privateRow(row, movement)),
    totalCount: page.totalCount,
    you:
      page.you === null
        ? null
        : {
            player: leaguePlayer(page.you, true),
            rank: page.you.rank,
            tied: page.you.tied,
            position: page.you.position,
            points: page.you.points,
            matchweeksPlayed: page.you.matchweeksPlayed,
            isYou: true,
            isOwner: page.you.isOwner,
            hasEntry: page.you.hasEntry,
            movement: movement.get(page.you.userId) ?? null,
          },
    hasMore: page.hasMore,
    movementSettled: movementAnswered(source.movement),
  }
}

/**
 * MOVEMENT, INDEXED BY THE PLAYER IT BELONGS TO.
 *
 * AN UNSETTLED MATCHWEEK MOVES NOBODY, and contract 150 is explicit that no
 * surface may render movement while `settled` is false. So an unsettled answer
 * produces an EMPTY MAP here rather than being carried and re-checked
 * downstream — the same discipline `useVNextHomeSource` applies to the same
 * contract, and it means a component cannot draw movement it was not given.
 *
 * THE SIGN IS THE SERVER'S. `movement` is `rankBefore - rankAfter`, positive
 * for a climb, and it is copied rather than recomputed from the two ranks
 * beside it: two ways of producing one number is one chance for them to
 * disagree.
 */
function movementByPlayer(
  movement: SeasonLeagueMovement | null,
): ReadonlyMap<string, LeagueMovement> {
  if (!movementAnswered(movement) || movement === null) return new Map()

  const label = movement.matchweek?.label ?? ''

  return new Map(
    movement.members.map((row) => [row.userId, { matchweekLabel: label, places: row.movement }]),
  )
}

/**
 * WHAT THE APPLICATION COULD NOT ANSWER, NAMED.
 *
 * Movement is deliberately NOT listed. It is absent far more often than it is
 * present — it exists only over a settled matchweek — and reporting "movement
 * unavailable" on every table before the first settlement would be an apology
 * for the ordinary state of a new season.
 */
function unavailableOf(source: LeaguesSource): readonly string[] {
  const missing: string[] = []
  if (source.leagues === null) missing.push('your private leagues')
  if (source.selectedLeagueId !== null && source.league === null) {
    missing.push('this league’s table')
  }
  if (source.selectedLeagueId === null && source.global === null) {
    missing.push('the season table')
  }
  return missing
}
