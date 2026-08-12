import { useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router'
import { useTheme } from '../../app/providers/ThemeProvider'
import { useSite } from '../../app/site/SiteProvider'
import { bonusGames, gamesPlayedElsewhere, primaryGames } from '../../app/site/siteGames'
import { siteBrandCopy } from '../../app/site/sitePublicMetadata'
import { ChevronRightIcon, MoonIcon, SunIcon } from '../../design-system/icons'
import {
  fetchEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../../services/supabase/euroPublication'
import {
  actionHref,
  euroLandingPresentation,
  resolveActions,
  type EuroLandingAction,
  type EuroLandingState,
} from './euroLandingModel'
import s from './LandingPage.module.css'

/**
 * The Euro deployment's public landing page.
 *
 * IT IS A DIFFERENT PRODUCT, NOT THE HUB PAGE WITH A DIFFERENT HEADING. The
 * weekly page leads with three equal games across two domestic competitions;
 * this leads with one tournament, and presents the three weekly games beneath
 * it under the Bonus Games heading the site configuration supplies. Both are
 * built from the same commit and the same design system.
 *
 * WHAT IT SAYS IS THE SERVER'S ANSWER. Contract 143's `euro_publication_state()`
 * is executable by an anonymous visitor for exactly this reason: the public
 * page must fail closed from server truth rather than from a client-side
 * catalogue filter. While the read is in flight — and for ever, if it fails —
 * the page renders the `unknown` presentation, which says the tournament is not
 * open and offers the Hub. An outage produces a visitor who plays the weekly
 * games, never one told to register for something nobody has opened.
 *
 * NO PLACEHOLDER FOOTBALL. There is no draw, no team list, no fixture and no
 * countdown, because the tournament's own data does not exist yet and inventing
 * it would be the placeholder the design authority forbids. The parked
 * tournament programme returns in January 2028; this is the deployment shell.
 */
export function EuroLandingPage({
  readPublicationState = fetchEuroPublicationState,
}: {
  /** Injectable so every lifecycle state is provable without a network. */
  readPublicationState?: () => Promise<EuroPublicationSnapshot>
} = {}): ReactElement {
  const site = useSite()
  // The descriptive copy lives outside the runtime configuration, so a visitor
  // to either site downloads it only when a landing page renders.
  const brand = siteBrandCopy(site.variant)
  const [state, setState] = useState<EuroLandingState>('unknown')

  useEffect(() => {
    let active = true
    readPublicationState()
      .then((snapshot) => {
        if (active) setState(snapshot.state)
      })
      // Deliberately silent and deliberately unchanged: `unknown` is already
      // the safe presentation, and an error banner on a marketing page would
      // tell a stranger about an outage they cannot act on.
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [readPublicationState])

  const presentation = euroLandingPresentation(state)
  const sibling = site.routes.siblingSiteOrigin
  const { primary, secondary } = resolveActions(presentation, sibling)

  return (
    <div className={s.page}>
      <a className={s.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={s.header}>
        <div className={s.headerInner}>
          <span className={s.brand}>
            <span className={s.brandMark} aria-hidden="true">
              {brand.monogram}
            </span>
            <span className={s.brandCopy}>
              {site.brand.productName}
              <small>{presentation.status}</small>
            </span>
          </span>

          <div className={s.headerActions}>
            <ThemeToggle />
            <Link className={`${s.cta} ${s.ctaQuiet} ${s.ctaSmall}`} to="/auth/login">
              Sign in
            </Link>
            {/* The header offers account creation ONLY where the server says
                registration is open. `EURO-003` forbids implying otherwise, and
                a header button is the most confident implication a page has. */}
            {presentation.registrationOpen ? (
              <Link className={`${s.cta} ${s.ctaPrimary} ${s.ctaSmall}`} to="/auth/signup">
                Create account
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main-content" className={s.main} tabIndex={-1}>
        <section className={s.hero} id="hero" aria-labelledby="euro-hero-heading">
          <div className={s.shell}>
            {/* A two-column hero on desktop, and the second column is the
                LIFECYCLE rather than a picture. The weekly site puts a product
                preview here; this deployment has no tournament data to preview
                — no draw, no teams, no fixtures — and inventing one would be
                the placeholder the design authority forbids. What it does have
                is a truthful answer to the only question a visitor arrives
                with: is this open, and what can I do now. That answer comes
                from contract 143 and the site configuration, and from nothing
                else. */}
            <div className={s.heroAsideGrid}>
              <div className={s.heroCopy}>
                <p className={s.eyebrow}>{presentation.status}</p>
                <h1 className={s.heroHeading} id="euro-hero-heading">
                  {presentation.headline}
                </h1>
                <p className={s.heroLead}>{presentation.body}</p>
                <div className={s.heroActions}>
                  {primary ? (
                    <Action action={primary} sibling={sibling} emphasis="primary" />
                  ) : null}
                  {secondary ? (
                    <Action action={secondary} sibling={sibling} emphasis="secondary" />
                  ) : null}
                </div>
              </div>

              <aside className={s.heroStatusCard} aria-label="What is open on this site">
                <p className={s.heroStatusLabel}>Right now</p>
                <dl className={s.heroStatusList}>
                  <div className={s.heroStatusRow}>
                    <dt>{primaryGames(site.variant)[0]?.name ?? 'The tournament'}</dt>
                    {/* The server's word, never a guess. `registrationOpen` is
                        false for every state except the two that genuinely
                        are, so an outage reads as "not open yet". */}
                    <dd>{presentation.registrationOpen ? 'Registration open' : 'Not open yet'}</dd>
                  </div>
                  {site.navigation.bonusGamesLabel && bonusGames(site.variant).length > 0 ? (
                    <div className={s.heroStatusRow}>
                      <dt>{site.navigation.bonusGamesLabel}</dt>
                      <dd>
                        {bonusGames(site.variant)
                          .map((game) => game.name)
                          .join(' · ')}
                      </dd>
                    </div>
                  ) : null}
                  <div className={s.heroStatusRow}>
                    <dt>Your account</dt>
                    <dd>
                      {sibling
                        ? `One account, shared with ${site.routes.siblingSiteName}`
                        : 'One account for every game on this site'}
                    </dd>
                  </div>
                </dl>
                <p className={s.heroStatusNote}>
                  Every game is joined separately. Creating an account enters you into nothing.
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section className={s.section} id="games" aria-labelledby="euro-games-heading">
          <div className={s.shell}>
            <div className={s.sectionHead}>
              <h2 id="euro-games-heading">The games</h2>
              <p className={s.sectionLead}>
                Each game is joined separately, and joining one never joins another.
              </p>
            </div>

            <ul className={s.gameList}>
              {primaryGames(site.variant).map((game) => (
                <li key={game.key} className={s.gameRow}>
                  <span className={s.gameMark} aria-hidden="true">
                    {game.name.slice(0, 1)}
                  </span>
                  {/* The Hub's own row shape. `gameMeta` is the small uppercase
                      meta column beside a row, not the row's body: putting the
                      name and the summary inside it ran them together as one
                      unspaced line of uppercase grey. */}
                  <div>
                    <h3>{game.name}</h3>
                    <p>{game.summary}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Bonus Games are the SAME games with the same rules — ranked
                below the tournament because this site is about the tournament,
                never trimmed down for it. */}
            {site.navigation.bonusGamesLabel && bonusGames(site.variant).length > 0 ? (
              <>
                <div className={`${s.sectionHead} ${s.sectionTight}`}>
                  <h3>{site.navigation.bonusGamesLabel}</h3>
                  <p className={s.sectionLead}>
                    The weekly games, on the same account
                    {sibling ? ', and running now over on the Prediction Hub' : ''}.
                  </p>
                </div>
                <ul className={s.gameList}>
                  {bonusGames(site.variant).map((game) => (
                    <li key={game.key} className={s.gameRow}>
                      <span className={s.gameMark} aria-hidden="true">
                        {game.name.slice(0, 1)}
                      </span>
                      <div>
                        <h3>{game.name}</h3>
                        <p>{game.summary}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {/* NAMED, AND NOT OFFERED. Domestic Match Predictor used to be
                listed above as a Euro Bonus Game, which promised a weekly
                domestic game on a tournament site and had nowhere to send
                anyone who wanted it: it is not a game you attach to a
                competition, it IS a competition season. It is named here so a
                player looking for it is told where it is rather than concluding
                it does not exist — and only when this deployment knows the
                Hub's address, because naming a product with no way to reach it
                is worse than the omission. */}
            {sibling && gamesPlayedElsewhere(site.variant).length > 0 ? (
              <div className={`${s.sectionHead} ${s.sectionTight}`}>
                <h3>Played on {site.routes.siblingSiteName}</h3>
                <p className={s.sectionLead}>
                  {gamesPlayedElsewhere(site.variant)
                    .map((game) => game.name)
                    .join(', ')}{' '}
                  runs every matchweek of the Premier League and the Scottish
                  Premiership, on the same account —{' '}
                  <a className={s.textLink} href={sibling} rel="noreferrer">
                    play it on {site.routes.siblingSiteName}
                  </a>
                  .
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className={s.section} id="account" aria-labelledby="euro-account-heading">
          <div className={s.shell}>
            <div className={s.ctaPanel}>
              <h2 id="euro-account-heading">One account, both sites.</h2>
              <p className={s.sectionLead}>
                {site.routes.siblingSiteName} and {site.brand.productName} share one
                account, so signing up once is enough. It does not enter you into any
                game — every game is joined separately, wherever you play it.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.shell} ${s.footerInner}`}>
          <span>{site.brand.productName}</span>
          <nav className={s.footerLinks} aria-label="Footer">
            <Link to="/auth/login">Sign in</Link>
            {sibling ? (
              <a href={sibling} rel="noreferrer">
                {site.routes.siblingSiteName}
              </a>
            ) : null}
          </nav>
        </div>
      </footer>
    </div>
  )
}

function ThemeToggle(): ReactElement {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      className={s.iconButton}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}

/**
 * One call to action.
 *
 * A `siblingSite` action is an ordinary cross-origin anchor rather than a
 * router `Link`, because the other deployment is a different document on a
 * different domain. `resolveActions` has already dropped it if no origin is
 * configured, so this never renders a dead one.
 */
function Action({
  action,
  sibling,
  emphasis,
}: {
  action: EuroLandingAction
  sibling: string | null
  emphasis: 'primary' | 'secondary'
}): ReactElement | null {
  const href = actionHref(action, sibling)
  if (!href) return null
  const className = `${s.cta} ${emphasis === 'primary' ? s.ctaPrimary : s.ctaSecondary}`

  if (action.target === 'siblingSite') {
    return (
      <a className={className} href={href} rel="noreferrer">
        {action.label}
        {emphasis === 'primary' ? <ChevronRightIcon size={18} /> : null}
      </a>
    )
  }

  return (
    <Link className={className} to={href}>
      {action.label}
      {emphasis === 'primary' ? <ChevronRightIcon size={18} /> : null}
    </Link>
  )
}
