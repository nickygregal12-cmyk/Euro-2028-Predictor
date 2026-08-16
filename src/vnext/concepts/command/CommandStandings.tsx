import type { HomeModel, PrivateLeague, Rival } from '../../models/home'
import { formatNumber } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../../components/game/RankMovementIndicator'
import styles from './command.module.css'

export type CommandStandingsProps = {
  model: HomeModel
}

/**
 * Standings, and the two lists that actually create the tension.
 *
 * A league table on its own tells a player where they are. What makes the game
 * social is the pair of questions underneath it: who can I still catch, and who
 * is catching me. So each league shows the window around the user, and beneath
 * both leagues the rivals are split into those two lists by the sign of their
 * points difference, each with the sentence the model already wrote.
 *
 * The user's own row is marked three ways — `aria-current`, an accent edge and
 * the word "You" — because a highlight alone reaches nobody who cannot see it.
 */
export function CommandStandings({ model }: CommandStandingsProps) {
  const chasing = model.rivals.filter((rival) => rival.pointsDifference > 0)
  const chasedBy = model.rivals.filter((rival) => rival.pointsDifference < 0)

  return (
    <div className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={`${typography.label} ${styles.panelTitle}`}>
          Leagues and rivals
        </h2>
        <p className={typography.micro}>{model.privateLeagues.length} private leagues</p>
      </header>

      <div className={styles.leagues}>
        {model.privateLeagues.map((league) => (
          <LeagueBlock key={league.id} league={league} />
        ))}
      </div>

      <div className={styles.gapBoards}>
        <GapBoard
          title="You can catch"
          empty="Nobody above you here"
          rivals={chasing}
          tone="chase"
        />
        <GapBoard
          title="Catching you"
          empty="Nobody within range"
          rivals={chasedBy}
          tone="defend"
        />
      </div>
    </div>
  )
}

function LeagueBlock({ league }: { league: PrivateLeague }) {
  return (
    <section className={styles.league} aria-label={league.name}>
      <header className={styles.leagueHead}>
        <h3 className={`${typography.body} ${typography.clamp2} ${styles.leagueName}`}>
          {league.name}
        </h3>
        <span className={styles.leagueRank}>
          <span className={`${styles.leagueRankValue} ${typography.numeric}`}>
            {league.userRank}
            <span className={styles.leagueRankOf}>
              /{formatNumber(league.participantCount)}
            </span>
          </span>
          <RankMovementIndicator movement={league.userMovement} />
        </span>
      </header>

      <ol className={styles.table}>
        {league.standings.map((standing) => (
          <li
            key={standing.player.id}
            className={`${styles.tableRow} ${standing.isUser ? styles.tableUser : ''}`}
            aria-current={standing.isUser ? 'true' : undefined}
          >
            <span className={`${styles.tableRankCell} ${typography.numeric}`}>
              {standing.rank}
            </span>
            <span className={`${typography.body} ${typography.truncate} ${styles.tableName}`}>
              {standing.isUser ? 'You' : standing.player.name}
            </span>
            <RankMovementIndicator
              movement={standing.movement}
              subject={standing.isUser ? 'You' : standing.player.name}
            />
            <span className={`${styles.tablePoints} ${typography.numeric}`}>
              {formatNumber(standing.points)}
            </span>
          </li>
        ))}
      </ol>

      <p className={`${typography.caption} ${styles.leagueGap}`}>
        {league.gapToLeader === 0
          ? `You lead ${league.name}`
          : `${league.gapToLeader} ${
              league.gapToLeader === 1 ? 'point' : 'points'
            } to catch ${league.leaderName}`}
      </p>
    </section>
  )
}

function GapBoard({
  title,
  empty,
  rivals,
  tone,
}: {
  title: string
  empty: string
  rivals: readonly Rival[]
  tone: 'chase' | 'defend'
}) {
  return (
    <section
      className={`${styles.gapBoard} ${tone === 'chase' ? styles.gapChase : styles.gapDefend}`}
      aria-label={title}
    >
      <h3 className={`${typography.label} ${styles.gapTitle}`}>{title}</h3>
      {rivals.length === 0 ? (
        <p className={typography.micro}>{empty}</p>
      ) : (
        <ul className={styles.gapList}>
          {rivals.map((rival) => (
            <li
              key={`${rival.player.id}-${rival.sharedLeagueName}`}
              className={styles.gapRow}
            >
              {/* Hidden from assistive technology because the headline beneath
                  it already says the same number in a sentence — "2 points to
                  catch Jamie" — and a bare "2" announced first is noise. */}
              <span
                className={`${styles.gapDelta} ${typography.numeric}`}
                aria-hidden="true"
              >
                {Math.abs(rival.pointsDifference)}
              </span>
              <span className={styles.gapWho}>
                <span className={`${typography.body} ${typography.truncate}`}>
                  {rival.player.name}
                </span>
                <span className={`${typography.micro} ${typography.truncate}`}>
                  {rival.headline ?? rival.sharedLeagueName}
                </span>
              </span>
              <RankMovementIndicator
                movement={rival.movement}
                subject={rival.player.name}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
