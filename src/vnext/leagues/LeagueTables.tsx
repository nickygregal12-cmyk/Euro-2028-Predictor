import { useId } from 'react'
import type {
  LeagueMovement,
  LeaguesGlobalRow,
  LeaguesGlobalTable,
  LeaguesNeighbourhood,
  LeaguesPrivateRow,
  LeaguesPrivateTable,
} from '../models/leagues'
import { leagueRowKey, movementLabel } from '../models/leagues'
import { formatNumber } from '../foundations/format'
import { LeaguePlayerCell } from './LeaguePlayerCell'
import text from '../foundations/typography.module.css'
import styles from './leagues.module.css'

/**
 * THE TWO STANDINGS TABLES — AND THEY ARE TWO COMPONENTS ON PURPOSE.
 *
 * ============================ WHY NOT ONE TABLE WITH A PROP ==============
 *
 * Because they do not rank the same thing. A private league's totals come from
 * `season_standings`, so it cannot disagree with the season — but its RANK is
 * recomputed inside the league, so the same two players carry different ranks
 * in the two payloads. `seasonLeagueStandingsModel.ts` says why that matters in
 * terms: *a shared parser would invite a shared presenter, which is how a
 * competition-wide ranking gets asserted by accident.*
 *
 * One component with `kind="private"` is that shared presenter. Two components
 * cannot merge by accident, and the columns genuinely differ — owner, entry
 * state and movement exist only in a league, and none of them has a meaning in
 * a season table.
 *
 * ============================ THEY ARE REAL TABLES ========================
 *
 * `<table>` with `<th scope="col">` and a rank in `<th scope="row">`. A
 * standings table IS tabular: a screen reader user moving down the points
 * column and hearing the player name announced with each cell is getting
 * exactly what the sighted reader gets from the alignment. `LeagueLadder` on
 * Home uses an `<ol>` because it shows a five-row window around one person;
 * this shows a table, and the markup follows the content rather than the house
 * style.
 *
 * The caption is the accessible name and is visually hidden — the heading above
 * already says it on screen, and reading it twice is noise.
 *
 * ============================ NO RANK IS COMPUTED HERE ====================
 *
 * Not sorted, not renumbered, not derived from array position. `rank`, `tied`
 * and `position` are three server facts and all three are printed as given. The
 * row's REACT KEY is `leagueRowKey`, which is the player reference and falls
 * back to the row's position — never the display name, because two players may
 * share one and React would then reuse one person's row for another.
 *
 * ============================ POINTS NEVER TRAVEL ALONE ===================
 *
 * ADR 0012: two players on 84 points from 22 and 23 matchweeks are not tied in
 * meaning. Every points cell in this file is followed by its matchweek count,
 * and there is no variant that drops it.
 */

/* ==========================================================================
   SHARED ATOMS — small enough to carry no ranking meaning
   ========================================================================== */

/**
 * A RANK, WITH ITS TIE SAID OUT LOUD.
 *
 * The `=` before a shared rank is the football convention and is the visible
 * half; the sr-only word is the other half, because a punctuation mark is not
 * something a screen reader reliably announces and "tied" is a fact rather than
 * a decoration.
 */
function RankCell({ rank, tied }: { readonly rank: number; readonly tied: boolean }) {
  return (
    <span className={styles.rankValue}>
      {tied ? <span aria-hidden="true">=</span> : null}
      {formatNumber(rank)}
      {tied ? <span className={text.srOnly}> tied</span> : null}
    </span>
  )
}

/**
 * POINTS AND THE MATCHWEEKS THEY CAME FROM, WHICH ARE ONE FACT.
 */
function PointsCell({
  points,
  matchweeksPlayed,
}: {
  readonly points: number
  readonly matchweeksPlayed: number
}) {
  return (
    <span className={styles.pointsCell}>
      <span className={`${text.numeric} ${styles.pointsValue}`}>{formatNumber(points)}</span>
      <span className={`${text.micro} ${styles.pointsFrom}`}>
        from {formatNumber(matchweeksPlayed)}
        <span aria-hidden="true"> MW</span>
        <span className={text.srOnly}>
          {matchweeksPlayed === 1 ? ' matchweek' : ' matchweeks'}
        </span>
      </span>
    </span>
  )
}

/**
 * A RANK CHANGE, IN A WORD AS WELL AS A COLOUR AND AN ARROW.
 *
 * Contract 150 only ever produces this over a SETTLED matchweek, so a movement
 * that reaches here is a fact about football that has finished happening. The
 * matchweek is named, because "up 2" with no answer to "since when" is the kind
 * of number a player quietly assumes is about today.
 */
function MovementCell({ movement }: { readonly movement: LeagueMovement | null }) {
  if (movement === null) {
    // A GAP INSIDE A SETTLED TABLE STILL GETS A WORD. The column is only drawn
    // once something has settled, so a null here is a member the movement read
    // did not mention — someone who joined after the matchweek. The dash is the
    // visible half; without the sentence the cell is completely silent to a
    // screen reader, and "no movement recorded" is indistinguishable from a
    // broken cell. Every other state on this page says its word.
    return (
      <span className={`${text.micro} ${styles.movementFlat}`}>
        <span aria-hidden="true">—</span>
        <span className={text.srOnly}>no movement recorded</span>
      </span>
    )
  }

  const direction = movement.places > 0 ? 'up' : movement.places < 0 ? 'down' : 'none'
  const tone =
    direction === 'up'
      ? styles.movementUp
      : direction === 'down'
        ? styles.movementDown
        : styles.movementNone
  return (
    <span className={`${styles.movement} ${tone}`}>
      <span aria-hidden="true" className={styles.movementGlyph}>
        {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–'}
      </span>
      <span aria-hidden="true" className={text.micro}>
        {movement.places === 0 ? '0' : formatNumber(Math.abs(movement.places))}
      </span>
      <span className={text.srOnly}>
        {movementLabel(movement)} since {movement.matchweekLabel}
      </span>
    </span>
  )
}

/**
 * A TABLE THE SERVER ANSWERED WITH NOBODY IN IT.
 *
 * IT IS A SENTENCE AND NOT AN EMPTY TABLE. A `<table>` carrying column headers
 * over an empty `<tbody>` announces a table structure with no data in it, which
 * is a worse experience than plain prose and is a genuine WCAG 1.3.1 failure —
 * the accessibility scan in `tests/vnext/leagues.test.tsx` found exactly that
 * before this existed.
 *
 * IT IS ALSO NOT AN ERROR. Zero rows is the server's own answer, and the early
 * days of a season legitimately have one. The unavailable strip above the table
 * is where a read that did not answer is reported; this is where a read that
 * answered "nobody" is.
 */
function EmptyStandings({ children }: { readonly children: string }) {
  return (
    <p className={`${text.body} ${styles.emptyStandings}`}>{children}</p>
  )
}

/* ==========================================================================
   THE GLOBAL TABLE — the whole competition season
   ========================================================================== */

export type GlobalStandingsTableProps = {
  readonly table: LeaguesGlobalTable
  readonly caption: string
  readonly onOpenPlayer?:
    | ((playerRef: string, playerId: string | null) => void)
    | undefined
}

/**
 * WHERE EVERYONE IN THE COMPETITION SEASON STANDS.
 *
 * `you` IS RENDERED SEPARATELY AND DELIBERATELY. It arrives from the read as
 * its own row precisely because it may not be on this page — a player standing
 * 400th is not in the first twenty-five, and a surface that searched the rows
 * for `isYou` would show them nothing at all. So the caller's row is pinned
 * below the table when it is not already in it, which is the answer to "where
 * do I stand" for most of the people asking.
 */
export function GlobalStandingsTable({
  table,
  caption,
  onOpenPlayer,
}: GlobalStandingsTableProps) {
  const captionId = useId()
  // `isYou` IS THE SERVER'S MARK, so "am I already on this page" is answered by
  // reading it rather than by matching the pinned row against the rows — a
  // comparison on rank would call two players tied on the same rank the same
  // person, and a comparison on display name is the defect contract 191 exists
  // to remove.
  const youOnPage = table.rows.some((row) => row.isYou)

  if (table.rows.length === 0 && table.you === null) {
    return <EmptyStandings>Nobody has entered this season yet.</EmptyStandings>
  }

  return (
    <div className={styles.tableBlock}>
      {table.rows.length === 0 ? null : (
        <div className={styles.tableScroll}>
          <table className={styles.table} aria-describedby={captionId}>
            <caption className={text.srOnly}>{caption}</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.colRank}>
                  Rank
                </th>
                <th scope="col" className={styles.colPlayer}>
                  Player
                </th>
                <th scope="col" className={styles.colPoints}>
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <GlobalRow
                  key={leagueRowKey(row.player, row.position)}
                  row={row}
                  onOpenPlayer={onOpenPlayer}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {table.you !== null && !youOnPage ? (
        <div className={styles.yourStanding} data-vnext-zone="your-standing">
          <p className={`${text.micro} ${styles.yourStandingLabel}`}>Your standing</p>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={text.srOnly}>Your place in {caption}</caption>
              {/* IT CARRIES ITS OWN HEADERS. A one-row data table with no
                  `<thead>` reads its rank as a bare "318" with nothing to
                  associate it to in table-navigation mode — and axe does not
                  flag a header-less data table, so only reading it catches
                  this. The points cell describes itself; the rank does not. */}
              <thead>
                <tr>
                  <th scope="col" className={styles.colRank}>
                    Rank
                  </th>
                  <th scope="col" className={styles.colPlayer}>
                    Player
                  </th>
                  <th scope="col" className={styles.colPoints}>
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                <GlobalRow row={table.you} onOpenPlayer={onOpenPlayer} />
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p id={captionId} className={`${text.micro} ${styles.tableFoot}`}>
        {tableFootSentence(table.rows.length, table.totalCount, table.hasMore, 'player')}
      </p>

      <RankNeighbourhood neighbourhood={table.neighbourhood} onOpenPlayer={onOpenPlayer} />
    </div>
  )
}

/**
 * THE CHASE — who the caller is actually racing, contract 183 / `MIG-UI-18`.
 *
 * ============================ THE PROBLEM IT CLOSES ======================
 *
 * The table above shows the leaders and pins the caller's own row underneath,
 * so a player standing 412th learns the number 412 and nothing else. The people
 * that number is about — 411th and 413th — are eighty pages away, and this
 * surface has no paging control on purpose. A rank with nobody beside it is a
 * label; a rank with two names and two gaps is a game.
 *
 * ============================ IT DRAWS ONLY WHAT IT WAS TOLD =============
 *
 * `null` renders NOTHING — not an empty strip, not a spinner, not a zero. It
 * means the window has not landed or did not answer, which is different from
 * "nobody is near you", and a strip that appeared empty would teach a player to
 * ignore the one place worth reading.
 *
 * The gap on each row is the SERVER's signed arithmetic and the edges are the
 * server's flags. Nothing here subtracts two points totals and nothing counts
 * rows to decide whether the caller is at the top — the model's own header
 * records why both would be wrong.
 *
 * ============================ AND MOST ROWS DO NOT OPEN ==================
 *
 * The window payload predates contract 191 and carries no identity, so a
 * neighbour is openable only where the loaded page already held the door for
 * the same server-issued position. `LeaguePlayerCell` draws a closed row as
 * plain text rather than as a disabled control, which is the same rule the
 * tables above follow.
 */
function RankNeighbourhood({
  neighbourhood,
  onOpenPlayer,
}: {
  readonly neighbourhood: LeaguesNeighbourhood | null
  readonly onOpenPlayer?:
    | ((playerRef: string, playerId: string | null) => void)
    | undefined
}) {
  const headingId = useId()

  // NOT LOADED IS NOT EMPTY, and a window with no caller in it is a season the
  // player holds no standing in — which the table above already says better.
  if (neighbourhood === null || neighbourhood.rows.length === 0) return null

  // A window containing ONLY the caller is a table of one. There is no chase to
  // draw and the pinned row above has already said where they stand.
  if (neighbourhood.rows.every((row) => row.isYou)) return null

  return (
    <section
      className={styles.neighbourhood}
      data-vnext-zone="rank-neighbourhood"
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className={`${text.label} ${styles.neighbourhoodTitle}`}>
        The chase
      </h3>

      {/* THE EDGES, IN WORDS, BECAUSE THE ROWS CANNOT SHOW THEM. A caller at
          the top receives fewer rows above than the window asked for, and a
          strip that simply started at their name would be indistinguishable
          from one whose data was missing. Both flags are the server's. */}
      {neighbourhood.atTop ? (
        <p className={`${text.micro} ${styles.neighbourhoodEdge}`}>
          Nobody above you — you lead this season.
        </p>
      ) : null}

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={text.srOnly}>
            The players immediately above and below you, of{' '}
            {formatNumber(neighbourhood.totalCount)}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.colRank}>
                Rank
              </th>
              <th scope="col" className={styles.colPlayer}>
                Player
              </th>
              <th scope="col" className={styles.colPoints}>
                Points
              </th>
              <th scope="col" className={styles.colGap}>
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {neighbourhood.rows.map((row) => (
              <tr
                key={leagueRowKey(row.player, row.position)}
                className={`${styles.row} ${row.isYou ? styles.rowYou : ''}`}
                data-vnext-neighbour-row={leagueRowKey(row.player, row.position)}
                {...(row.isYou ? { 'aria-current': 'true' as const } : {})}
              >
                <th scope="row" className={styles.cellRank}>
                  <RankCell rank={row.rank} tied={row.tied} />
                </th>
                <td className={styles.cellPlayer}>
                  <LeaguePlayerCell player={row.player} onOpen={onOpenPlayer} />
                </td>
                <td className={styles.cellPoints}>
                  <PointsCell points={row.points} matchweeksPlayed={row.matchweeksPlayed} />
                </td>
                <td className={styles.cellGap}>
                  <GapCell isYou={row.isYou} pointsFromYou={row.pointsFromYou} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {neighbourhood.atBottom ? (
        <p className={`${text.micro} ${styles.neighbourhoodEdge}`}>
          Nobody below you yet.
        </p>
      ) : null}
    </section>
  )
}

/**
 * THE GAP, AS A DIRECTION AND A NUMBER.
 *
 * The sign is the server's and it is the whole point of the cell: "+3" is three
 * points to catch and "−1" is one point of cushion, and a bare "3" is neither.
 *
 * IT IS NEVER A COLOUR ALONE. The sign character carries the direction for a
 * greyscale reader, and the screen-reader text says it in words because "+3"
 * and "−3" are read identically by some voices — the same rule `MovementCell`
 * follows two hundred lines up.
 */
function GapCell({
  isYou,
  pointsFromYou,
}: {
  readonly isYou: boolean
  readonly pointsFromYou: number
}) {
  // NO GAP TO YOURSELF. A dash rather than a zero, because "0" beside the
  // caller's own row reads as "level with somebody" rather than as "this is
  // you", and the row is already marked.
  if (isYou) {
    return (
      <span className={styles.gapSelf}>
        <span aria-hidden="true">—</span>
        <span className={text.srOnly}>your total</span>
      </span>
    )
  }

  if (pointsFromYou === 0) {
    return (
      <span className={`${text.numeric} ${styles.gapLevel}`}>
        <span aria-hidden="true">0</span>
        <span className={text.srOnly}>level with you</span>
      </span>
    )
  }

  const ahead = pointsFromYou > 0
  const size = Math.abs(pointsFromYou)

  return (
    <span
      className={`${text.numeric} ${ahead ? styles.gapAhead : styles.gapBehind}`}
    >
      <span aria-hidden="true">
        {ahead ? '+' : '−'}
        {formatNumber(size)}
      </span>
      <span className={text.srOnly}>
        {formatNumber(size)} {size === 1 ? 'point' : 'points'}{' '}
        {ahead ? 'ahead of you' : 'behind you'}
      </span>
    </span>
  )
}

function GlobalRow({
  row,
  onOpenPlayer,
}: {
  readonly row: LeaguesGlobalRow
  readonly onOpenPlayer?:
    | ((playerRef: string, playerId: string | null) => void)
    | undefined
}) {
  return (
    <tr
      className={`${styles.row} ${row.isYou ? styles.rowYou : ''}`}
      data-vnext-standings-row={leagueRowKey(row.player, row.position)}
      {...(row.isYou ? { 'aria-current': 'true' as const } : {})}
    >
      <th scope="row" className={styles.cellRank}>
        <RankCell rank={row.rank} tied={row.tied} />
      </th>
      <td className={styles.cellPlayer}>
        <LeaguePlayerCell player={row.player} onOpen={onOpenPlayer} />
      </td>
      <td className={styles.cellPoints}>
        <PointsCell points={row.points} matchweeksPlayed={row.matchweeksPlayed} />
      </td>
    </tr>
  )
}

/**
 * WATCH ONE PLAYER, so Home leads with them.
 *
 * ============================ THE LABEL IS THE STATE =====================
 *
 * `aria-pressed` carries it and the visible word carries it too: "Watching"
 * when on, "Watch" when off. An eye icon alone would be a memory test, and a
 * toggle whose only state is a colour is unreadable in greyscale — the rule
 * every state in this lane follows.
 *
 * ============================ AND IT NAMES WHO ===========================
 *
 * A table of eight rows produces eight identically-named controls, which read
 * aloud as "Watch, button" eight times. The accessible name carries the
 * player, the visible label does not, and the two are the same sentence.
 *
 * ============================ WATCHING IS PRIVATE ========================
 *
 * One-directional and invisible to the watched. Nothing here tells a player
 * who is watching them, and nothing may: this is a preference about whose
 * points the reader wants on their own Home, not a relationship between two
 * accounts.
 */
function WatchToggle({
  playerName,
  watched,
  onToggle,
}: {
  readonly playerName: string
  readonly watched: boolean
  readonly onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={styles.watchToggle}
      aria-pressed={watched}
      aria-label={watched ? `Stop watching ${playerName}` : `Watch ${playerName}`}
      onClick={onToggle}
    >
      {watched ? 'Watching' : 'Watch'}
    </button>
  )
}

/* ==========================================================================
   A PRIVATE LEAGUE'S TABLE — its own rank, its own columns
   ========================================================================== */

export type PrivateStandingsTableProps = {
  readonly table: LeaguesPrivateTable
  readonly onOpenPlayer?:
    | ((playerRef: string, playerId: string | null) => void)
    | undefined
  /**
   * Start or stop watching somebody (contract 157).
   *
   * ABSENT MEANS NO CONTROL AT ALL, not a disabled one. A story, a screenshot
   * and a signed-out preview all render this table with no host behind it, and
   * a toggle that cannot write is a promise the surface cannot keep.
   */
  readonly onWatchPlayer?: ((playerId: string, watched: boolean) => void) | undefined
}

/**
 * ONE PRIVATE LEAGUE, RANKED INSIDE ITSELF.
 *
 * THE MOVEMENT COLUMN ONLY EXISTS WHEN SOMETHING HAS SETTLED. `movementSettled`
 * is the difference between "nobody moved" and "nothing has been settled yet",
 * and those are not the same sentence — so before the first settlement the
 * column is not drawn at all rather than drawn full of dashes. Contract 150 is
 * explicit that no surface may render movement while `settled` is false, and a
 * column of em-dashes is a rendering of it.
 *
 * A MEMBER WITH NO ENTRY IS MARKED RATHER THAN RANKED SILENTLY. `hasEntry:
 * false` is a real person who joined the league and never entered the game;
 * `get_season_league_standings` includes them deliberately, because *the
 * alternative hides a league from the person who created it*. Drawing them on
 * zero points beside players who have actually played, with nothing to say so,
 * would be a lie of omission.
 */
export function PrivateStandingsTable({
  table,
  onOpenPlayer,
  onWatchPlayer,
}: PrivateStandingsTableProps) {
  const captionId = useId()
  const showMovement = table.movementSettled

  // See `GlobalStandingsTable` — the server's own mark, not a rank comparison.
  const youOnPage = table.rows.some((row) => row.isYou)

  if (table.rows.length === 0 && table.you === null) {
    return <EmptyStandings>No member of this league has entered yet.</EmptyStandings>
  }

  return (
    <div className={styles.tableBlock}>
      {table.rows.length === 0 ? null : (
        <div className={styles.tableScroll}>
          <table className={styles.table} aria-describedby={captionId}>
            <caption className={text.srOnly}>{table.name} standings</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.colRank}>
                  Rank
                </th>
                <th scope="col" className={styles.colPlayer}>
                  Player
                </th>
                {showMovement ? (
                  <th scope="col" className={styles.colMovement}>
                    Moved
                  </th>
                ) : null}
                <th scope="col" className={styles.colPoints}>
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <PrivateRow
                  key={leagueRowKey(row.player, row.position)}
                  row={row}
                  showMovement={showMovement}
                  onOpenPlayer={onOpenPlayer}
                  onWatchPlayer={onWatchPlayer}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {table.you !== null && !youOnPage ? (
        <div className={styles.yourStanding} data-vnext-zone="your-standing">
          <p className={`${text.micro} ${styles.yourStandingLabel}`}>Your standing</p>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={text.srOnly}>Your place in {table.name}</caption>
              {/* See `GlobalStandingsTable` — a one-row data table still owes
                  its rank a header to be associated with. */}
              <thead>
                <tr>
                  <th scope="col" className={styles.colRank}>
                    Rank
                  </th>
                  <th scope="col" className={styles.colPlayer}>
                    Player
                  </th>
                  {showMovement ? (
                    <th scope="col" className={styles.colMovement}>
                      Moved
                    </th>
                  ) : null}
                  <th scope="col" className={styles.colPoints}>
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Your own row never carries the control — watching yourself
                    is not a thing — so this table has no watch column. */}
                {/* Your own row never carries the control — watching yourself
                    is not a thing — so no handler is passed here. */}
                <PrivateRow
                  row={table.you}
                  showMovement={showMovement}
                  onOpenPlayer={onOpenPlayer}
                />
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p id={captionId} className={`${text.micro} ${styles.tableFoot}`}>
        {tableFootSentence(table.rows.length, table.totalCount, table.hasMore, 'member')}
        {showMovement ? null : ' · Movement appears once a matchweek settles'}
      </p>
    </div>
  )
}

function PrivateRow({
  row,
  showMovement,
  onOpenPlayer,
  onWatchPlayer,
}: {
  readonly row: LeaguesPrivateRow
  readonly showMovement: boolean
  readonly onOpenPlayer?:
    | ((playerRef: string, playerId: string | null) => void)
    | undefined
  readonly onWatchPlayer?: ((playerId: string, watched: boolean) => void) | undefined
}) {
  const watchableId =
    row.canWatch && row.player.destination.kind === 'open'
      ? row.player.destination.playerId
      : null
  return (
    <tr
      className={`${styles.row} ${row.isYou ? styles.rowYou : ''} ${row.hasEntry ? '' : styles.rowNoEntry}`}
      data-vnext-standings-row={leagueRowKey(row.player, row.position)}
      {...(row.isYou ? { 'aria-current': 'true' as const } : {})}
    >
      <th scope="row" className={styles.cellRank}>
        <RankCell rank={row.rank} tied={row.tied} />
      </th>
      <td className={styles.cellPlayer}>
        <LeaguePlayerCell player={row.player} onOpen={onOpenPlayer} />
        <span className={styles.playerTags}>
          {row.isOwner ? <span className={styles.tag}>Organiser</span> : null}
          {row.hasEntry ? null : <span className={styles.tagQuiet}>Not entered</span>}
          {/*
            IN THE PLAYER CELL, NOT IN A COLUMN OF ITS OWN.
            A fifth column pushed the control past the right edge of a table
            that already scrolls sideways on a phone — so the one way to use
            the feature was invisible at the width most people are at. Beside
            the player it belongs to, it is reachable at every width and reads
            as what it is: something about that person, not a fifth fact about
            their standing.
          */}
          {watchableId === null || onWatchPlayer === undefined ? null : (
            <WatchToggle
              playerName={row.player.displayName}
              watched={row.watched}
              onToggle={() => onWatchPlayer(watchableId, !row.watched)}
            />
          )}
        </span>
      </td>
      {showMovement ? (
        <td className={styles.cellMovement}>
          <MovementCell movement={row.movement} />
        </td>
      ) : null}
      <td className={styles.cellPoints}>
        <PointsCell points={row.points} matchweeksPlayed={row.matchweeksPlayed} />
      </td>
    </tr>
  )
}

/* ==========================================================================
   THE FOOT
   ========================================================================== */

/**
 * HOW MUCH OF THE TABLE IS ON SCREEN, SAID PLAINLY.
 *
 * `hasMore` IS THE SERVER'S AND IS NEVER DERIVED from `shown < total`. The two
 * usually agree and the day they do not is exactly the day a player is told
 * there is nothing further while the read is still holding a page back.
 *
 * There is no "load more" control here. Stage 9 shows one page of a table it
 * did not paginate itself; a control that promised more would be a promise this
 * surface cannot keep without a second read it was not given.
 */
function tableFootSentence(
  shown: number,
  total: number,
  hasMore: boolean,
  noun: 'player' | 'member',
): string {
  const plural = total === 1 ? noun : `${noun}s`
  if (!hasMore && shown >= total) {
    return `${formatNumber(total)} ${plural}`
  }
  return `Showing ${formatNumber(shown)} of ${formatNumber(total)} ${plural}`
}
