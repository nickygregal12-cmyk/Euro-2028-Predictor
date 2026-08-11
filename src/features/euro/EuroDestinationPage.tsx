import { useEffect, useState } from 'react'
import { Alert, Skeleton, Workspace } from '../../design-system'
import { useSite } from '../../app/site/SiteProvider'
import { bonusGames } from '../../app/site/siteGames'
import {
  fetchEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../../services/supabase/euroPublication'
import type { EuroLandingState } from '../landing/euroLandingModel'
import { euroSignedInPanel, type EuroDestination } from './euroSignedInModel'
import s from '../shared.module.css'
import styles from './EuroDestinationPage.module.css'

/**
 * One of the four global destinations, on the Euro deployment, for a signed-in
 * player.
 *
 * IT IS HERE BECAUSE THE ALTERNATIVE WAS THE OTHER PRODUCT. Before this, a
 * signed-in visitor to the Euro domain got the domestic Hub at all four
 * addresses — its cross-competition action inbox, its followed-competition
 * calendar, its weekly private leagues — with the Euro navigation's wording on
 * top. Every onward link led further into the weekly platform, and a player who
 * had come for a tournament was quietly enrolled in a tour of a different one.
 *
 * IT SHOWS NO FOOTBALL, AND THAT IS THE POINT. Euro 2028 has no draw, no groups
 * and no fixtures, and the tournament's own surfaces are parked for their January
 * 2028 return. A page that rendered empty group tables or a countdown to a date
 * nobody has fixed would be the placeholder the design authority forbids, and
 * would be indistinguishable to a player from a product that is broken.
 *
 * IT FAILS CLOSED. The publication state comes from contract 143's bounded server
 * read; while it is in flight the page shows its skeleton, and if it fails or
 * answers something this build does not recognise the state stays `unknown`,
 * which reads exactly as `hidden` does. An outage never opens anything.
 *
 * IT JOINS NOTHING. There is no entry control anywhere on it. Arriving here,
 * signing in, following a competition or reading this page has never been game
 * entry and does not become it.
 */

export type EuroDestinationPageProps = {
  destination: EuroDestination
  /** Injectable so every lifecycle state is provable without a network. */
  readPublicationState?: () => Promise<EuroPublicationSnapshot>
}

export function EuroDestinationPage({
  destination,
  readPublicationState = fetchEuroPublicationState,
}: EuroDestinationPageProps) {
  const site = useSite()
  const [state, setState] = useState<EuroLandingState | null>(null)

  useEffect(() => {
    let active = true
    setState(null)
    readPublicationState()
      .then((snapshot) => {
        if (active) setState(snapshot.state)
      })
      // `unknown` rather than an error surface: the player cannot act on a
      // failed publication read, and the answer it produces — "not open" — is
      // the same answer the closed states produce.
      .catch(() => {
        if (active) setState('unknown')
      })
    return () => {
      active = false
    }
  }, [readPublicationState, destination])

  if (state === null) {
    return (
      <div className={s.page} aria-busy="true">
        <Workspace width="reading">
          <div className={styles.stack}>
            <Skeleton width="60%" height={28} />
            <Skeleton width="100%" height={120} />
            <Skeleton width="100%" height={96} />
          </div>
        </Workspace>
      </div>
    )
  }

  const panel = euroSignedInPanel(state, destination)
  const sibling = site.routes.siblingSiteOrigin
  const bonus = bonusGames(site.variant)

  return (
    <div className={s.page}>
      <Workspace
        width="reading"
        asideLabel={panel.offerSiblingSite && sibling ? 'Playing now' : undefined}
        aside={
          // The panel is an enhancement and never the only route to anything:
          // the same link is in the body below, so a phone loses nothing.
          panel.offerSiblingSite && sibling ? (
            <section className={styles.asidePanel} aria-labelledby="euro-aside-heading">
              <h2 className={styles.asideHeading} id="euro-aside-heading">
                Playing now
              </h2>
              <p className={styles.asideBody}>
                {site.routes.siblingSiteName} runs every matchweek of the Premier League
                and the Scottish Premiership, on this same account.
              </p>
              <a className={styles.asideLink} href={sibling} rel="noreferrer">
                Go to {site.routes.siblingSiteName}
              </a>
            </section>
          ) : undefined
        }
      >
        <header className={s.header}>
          <p className={s.eyebrow}>{panel.status}</p>
          <h1 className={s.title}>{panel.heading}</h1>
          <p className={s.sub}>{panel.body}</p>
        </header>

        {/* Stated as a sentence rather than drawn as an empty version of the
            real thing. An outlined, greyed-out fixture list is a fixture list. */}
        <Alert variant="info" title="What will be here">
          {panel.awaiting}
        </Alert>

        {panel.offerSiblingSite ? (
          <section className={styles.section} aria-labelledby="euro-meanwhile-heading">
            <h2 className={styles.sectionHeading} id="euro-meanwhile-heading">
              In the meantime
            </h2>
            {sibling ? (
              <p className={styles.sectionBody}>
                {site.routes.siblingSiteName} is running now, on the same account —{' '}
                <a className={styles.inlineLink} href={sibling} rel="noreferrer">
                  play every matchweek
                </a>
                . Nothing there enters you into anything here, and nothing here enters you
                into anything there.
              </p>
            ) : (
              // No configured sibling origin means no link rather than a guessed
              // one. The sentence still tells the player the weekly platform
              // exists, which is true and is not a dead control.
              <p className={styles.sectionBody}>
                The weekly Prediction Hub runs every matchweek on this same account.
              </p>
            )}

            {/* The Bonus Games, named because a player asked to wait deserves to
                know what for. They are the weekly games and they are played on
                the Hub — this deliberately does not list domestic Match
                Predictor among them, because that is a Hub product rather than
                a bonus attached to this tournament. See `siteGames.ts`. */}
            {site.navigation.bonusGamesLabel && bonus.length > 0 ? (
              <>
                <h3 className={styles.subHeading}>{site.navigation.bonusGamesLabel}</h3>
                <ul className={styles.gameList}>
                  {bonus.map((game) => (
                    <li key={game.key} className={styles.game}>
                      <strong>{game.name}</strong>
                      <span>{game.summary}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}
      </Workspace>
    </div>
  )
}
