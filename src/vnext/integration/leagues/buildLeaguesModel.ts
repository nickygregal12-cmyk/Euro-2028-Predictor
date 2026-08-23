import type {
  SeasonLeaderboardPage,
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
  LeaguesNeighbourhood,
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
  return (
    movement !== null &&
    movement.settled &&
    (movement.matchweek?.label ?? null) !== null &&
    // AND IT NAMED SOMEBODY. `settled: true` with a labelled matchweek and no
    // members is constructible, and it would draw a "Moved" column in which
    // every single row is a dash — the column of em-dashes this whole rule
    // exists to prevent, arriving through an empty payload instead of an
    // unsettled one. A column nobody is in is not a column.
    movement.members.length > 0
  )
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
  playerRef: string | null,
  isYou: boolean,
): LeaguePlayerDestination {
  if (isYou || reach === 'self') return { kind: 'you' }

  // THE SERVER'S PERMISSION, AND ONLY IT. `profile` is contract 151's shared
  // private league; `compare` is contract 206's same season. Anything else —
  // `name-only` — is a stranger, and no identifier this row happens to carry
  // changes that.
  if (reach !== 'profile' && reach !== 'compare') return { kind: 'closed', reason: 'not-shared' }

  // PERMISSION WITHOUT AN ADDRESS. Contract 206 made the season ref the address,
  // so a row from below contract 191 has nowhere to send the caller: the server
  // has said they may look without saying where. `not-stated` rather than
  // `not-shared`, because those are different facts and only one is a permission.
  if (playerRef === null) return { kind: 'closed', reason: 'not-stated' }

  // PROF-001, CLOSED BY CONTRACT 206. `compare` used to fall through to
  // `not-shared`, which was correct against the database as deployed — the only
  // profile read wanted an account id and this boundary sends none.
  // `get_season_player_profile_by_ref` answers the ref instead, so the row opens.
  //
  // AND THE ACCOUNT ID DOES NOT TRAVEL WITH IT. The migration is explicit that
  // the ref is *"the only navigation identity exposed by this path"*, so a
  // `compare` row carries no id here even if a payload somehow offered one —
  // which is the same structural rule as before, applied to what may be BUILT
  // rather than to what may be opened.
  return { kind: 'open', playerRef, playerId: reach === 'profile' ? playerId : null }
}

function globalPlayer(row: SeasonLeaderboardRow | SeasonLeaderboardYou, isYou: boolean): LeaguePlayer {
  return {
    ref: row.playerRef,
    displayName: row.displayName,
    destination: destinationOf(row.reach, row.playerId, row.playerRef, isYou),
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
    destination: isYou
      ? { kind: 'you' }
      // THE ACCOUNT ID IS BOTH IDENTITIES HERE, and the note above says why:
      // this read predates contract 191's season ref and sends the account id,
      // which is what the profile read this boundary uses is addressed by.
      : { kind: 'open', playerRef: row.userId, playerId: row.userId },
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
    neighbourhood: neighbourhoodOf(source, page),
  }
}

/**
 * THE ENTRANTS EITHER SIDE OF THE CALLER — contract 183, `MIG-UI-18`.
 *
 * ============================ IT JOINS ON AN ORDINAL, NEVER ON A NAME ====
 *
 * The neighbourhood payload predates contract 191 and carries no `playerRef`,
 * no `reach` and no `playerId`, so on its own every neighbour would be a name
 * with nowhere to go. The paged leaderboard DOES carry all three, and pgTAP
 * `232_season_clubs_and_neighbourhood.sql` requires the two reads to agree on
 * `position` — that agreement is asserted server-side rather than assumed here,
 * which is the whole reason this join is legitimate.
 *
 * SO A NEIGHBOUR OPENS ONLY WHERE THE PAGE ALREADY HELD THE DOOR. A player on
 * page one — the leaders, and the caller's own row — is joined and keeps
 * whatever destination `globalPlayer` gave them. Everyone else is `closed` with
 * reason `not-stated`, which is the honest sentence: the server did not state a
 * reach for this row in this payload, and that is a different fact from having
 * refused one.
 *
 * MATCHING BY DISPLAY NAME WOULD BE THE DEFECT. Two entrants may legitimately
 * share a display name, and contract 191's reference exists precisely so that
 * nothing in this codebase has to guess between them. `position` is unique in
 * the total order; `rank` is NOT, because tied entrants share it, which is why
 * the key here is the ordinal and never the rank.
 */
function neighbourhoodOf(
  source: LeaguesSource,
  page: SeasonLeaderboardPage,
): LeaguesNeighbourhood | null {
  const window = source.neighbourhood
  if (window === null) return null

  // The identities the OTHER read already stated, keyed by the ordinal the two
  // reads are required to agree on. The caller's own row is included: it
  // arrives separately from the page and is frequently the only row of the
  // window that page one can identify.
  const identified = new Map<number, LeaguePlayer>()
  for (const row of page.rows) identified.set(row.position, globalPlayer(row, row.isYou))
  if (page.you !== null) identified.set(page.you.position, globalPlayer(page.you, true))

  return {
    rows: window.rows.map((row) => ({
      player: identified.get(row.position) ?? {
        // NO REF, BECAUSE THIS PAYLOAD HAS NONE and one may not be invented.
        ref: null,
        displayName: row.displayName,
        destination: row.isYou ? { kind: 'you' } : { kind: 'closed', reason: 'not-stated' },
      },
      rank: row.rank,
      tied: row.tied,
      position: row.position,
      points: row.points,
      matchweeksPlayed: row.matchweeksPlayed,
      isYou: row.isYou,
      // THE SERVER'S SIGNED GAP, CARRIED. Recomputing it from two points totals
      // would put a second opinion about the chase in the browser.
      pointsFromYou: row.pointsFromYou,
    })),
    totalCount: window.totalCount,
    // Both flags are the server's. See the model's own note: a caller at rank 2
    // receives fewer rows above than the window asked for, so inferring either
    // from the row count draws the top of the table as missing data.
    atTop: window.atTop,
    atBottom: window.atBottom,
  }
}

/**
 * WHETHER A ROW MAY BE WATCHED, decided from what the server already told us.
 *
 * `set_pinned_rival` refuses anybody the caller shares no private league with.
 * That is the same boundary that decides whether the row carries an account id
 * at all — so a row the server named WITH an id is one it will accept a pin
 * for, and every other row is one the control would be refused on.
 *
 * Reading eligibility out of the destination rather than inventing a second
 * rule is the whole point: a control offered where the write will fail is a
 * worse defect than an absent one, and re-deciding the boundary here would be
 * a second opinion about a disclosure rule.
 */
function watchable(player: LeaguePlayer, isYou: boolean): string | null {
  if (isYou) return null
  if (player.destination.kind !== 'open') return null
  return player.destination.playerId
}

function privateRow(
  row: SeasonLeagueStandingsRow,
  movement: ReadonlyMap<string, LeagueMovement>,
  watched: ReadonlySet<string>,
): LeaguesPrivateRow {
  const player = leaguePlayer(row, row.isYou)
  const watchableId = watchable(player, row.isYou)

  return {
    player,
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
    watched: watchableId !== null && watched.has(watchableId),
    canWatch: watchableId !== null,
    movement: movement.get(row.userId) ?? null,
  }
}

function privateTableOf(
  source: LeaguesSource,
  movement: ReadonlyMap<string, LeagueMovement>,
): LeaguesPrivateTable | null {
  const page = source.league
  if (page === null || source.selectedLeagueId === null) return null

  const watched = new Set(source.watchedRivalIds)

  const chosen = (source.leagues ?? []).find(
    (league) => league.id === source.selectedLeagueId,
  )

  return {
    leagueId: source.selectedLeagueId,
    // The league list is where a league's NAME lives; the standings read
    // answers the table. A missing name is a list that did not answer, and the
    // honest label for a league we cannot name is not a made-up one.
    name: chosen?.name ?? 'This league',
    rows: page.rows.map((row) => privateRow(row, movement, watched)),
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
            // Watching yourself is not a thing.
            watched: false,
            canWatch: false,
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
