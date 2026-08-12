import { PRIVATE_PLAY_GAME_NAME } from './privatePlayModel'
import styles from './PrivatePlayExplainer.module.css'

/**
 * What the three kinds of private play actually are, beside the list of them.
 *
 * IT EXISTS BECAUSE THE NAVIGATION LABEL DELIBERATELY DOES NOT. The 10 August
 * direction chose "Leagues" over "Leagues & Competitions" and said why: the
 * page explains the difference between a private league and a private Last Man
 * Standing or Championship competition, because a navigation label is a worse
 * place to teach it. Until now no surface did the explaining, so the label was
 * carrying the ambiguity on its own.
 *
 * THE DISTINCTION IS REAL AND IS NOT A PRESENTATION CHOICE. A private LEAGUE
 * is a ranking OF a game a player has already joined — it holds no fixtures and
 * settles nothing, and joining one does not enter anybody into anything. A
 * private COMPETITION is the game itself, run for an invited field: joining it
 * IS game entry, and it has its own rounds, its own eliminations and its own
 * end. Conflating them is what makes a player think leaving a league removes
 * them from the football.
 *
 * IT INVENTS NO RULE AND NAMES NO NUMBER. Every sentence here restates a
 * distinction ADR 0011 and ADR 0013 already own; there is no scoring value, no
 * lock, no field size and no eligibility claim in it, because those belong to
 * the games and would be a second copy the moment one changed.
 *
 * IT IS CONTEXT, NEVER A ROUTE. Nothing is reachable only from here: creating
 * and joining are the two controls at the top of the main column, where they
 * stay at every width.
 */
export function PrivatePlayExplainer() {
  return (
    <section className={styles.panel} aria-labelledby="private-play-explainer">
      <h2 className={styles.heading} id="private-play-explainer">
        What is on this page
      </h2>
      <p className={styles.note}>
        Two different things live here, and they behave differently.
      </p>

      <dl className={styles.list}>
        <div className={styles.entry}>
          <dt className={styles.term}>A private league</dt>
          <dd className={styles.detail}>
            A private table over a game you have already joined — usually{' '}
            {PRIVATE_PLAY_GAME_NAME.main_predictor}. It ranks the same points the competition
            already gave you, so it has no fixtures and nothing of its own to play. Leaving one
            does not take you out of the game.
          </dd>
        </div>
        <div className={styles.entry}>
          <dt className={styles.term}>A private competition</dt>
          <dd className={styles.detail}>
            {PRIVATE_PLAY_GAME_NAME.last_man_standing} or the{' '}
            {PRIVATE_PLAY_GAME_NAME.predictor_cup}, run for an invited field. Joining one is
            entering that game: it has its own rounds and its own ending, separate from the public
            competition of the same name.
          </dd>
        </div>
      </dl>

      <p className={styles.note}>
        Both are joined with an invite code, and one code entry point handles either — you never
        have to know which kind a code belongs to.
      </p>
    </section>
  )
}
