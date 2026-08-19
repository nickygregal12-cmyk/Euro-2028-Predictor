import { useState, type CSSProperties } from 'react'
import type { Team } from '../../models/football'
import styles from './TeamCrest.module.css'

export type TeamCrestSize = 'sm' | 'md' | 'lg'

export type TeamCrestProps = {
  team: Team
  size?: TeamCrestSize
  /** Decorative use, when the team name is already written beside it. */
  decorative?: boolean
  /**
   * Load the badge immediately rather than lazily.
   *
   * FOR GENUINE ABOVE-THE-FOLD HERO IDENTITY ONLY — the one or two crests in a
   * Match Centre header, never a fixture list. A list of twenty eager images is
   * twenty requests competing with the page's own content for the first
   * connections, which is exactly how a decorative asset damages LCP.
   */
  eager?: boolean
}

/**
 * A club's visual identity: colour, kit and monogram, with an official badge
 * over the top where — and only where — the policy has allowed one.
 *
 * ============================ THE KIT IS THE PRODUCT, NOT THE FALLBACK ===
 *
 * ADR 0017 decided this and has not been superseded: the product launches
 * badge-free, and a shirt shape in the club's own colours carrying its
 * three-letter code is what it ships as. That is a first-class supported mode
 * and not temporary code scheduled for deletion — the same ADR notes that
 * making `ClubIdentity` the sole rendering path is what keeps adding licensed
 * crests later a single component change.
 *
 * So the kit is ALWAYS DRAWN, and a badge sits on top of it. That ordering is
 * what makes every failure free: a badge that never loads, loads slowly or
 * errors reveals a complete club identity underneath rather than a hole.
 *
 * ============================ THIS COMPONENT DECIDES NOTHING ============
 *
 * `team.officialBadge` is already resolved — badges on, provider approved,
 * competition allowed, URL usable, all answered in
 * `src/domain/clubIdentity/officialBadge.ts` before the model was built. There
 * is no provider name here, no flag and no URL to judge, because a condition
 * like `if (provider === …)` in a crest is the same condition in four other
 * components a month later.
 *
 * ============================ A BROKEN IMAGE IS NEVER SHOWN =============
 *
 * `onError` drops the `<img>` entirely rather than leaving the browser's own
 * broken-image glyph in a 24px circle. One club failing affects that club and
 * nothing else, which is what keeps a mixed page — two badges and a newly
 * promoted club's kit — looking intentional rather than broken.
 *
 * ============================ AND IT NEVER MOVES THE PAGE ===============
 *
 * The badge is absolutely positioned inside the crest's own fixed box, so it
 * occupies no layout of its own: it cannot shift a row as it loads, cannot
 * resize one when it fails, and the geometry is identical in all three states.
 *
 * The code is never the only identifier: every crest carries the full club name
 * for assistive technology, and callers show the name in text beside it. That
 * is ADR 0017's accessibility rule — colour plus monogram plus name, always —
 * and it holds whether a badge is drawn or not.
 */
export function TeamCrest({
  team,
  size = 'md',
  decorative = false,
  eager = false,
}: TeamCrestProps) {
  const { colours, kitPattern, officialBadge } = team
  const [badgeFailed, setBadgeFailed] = useState(false)
  const badge = officialBadge !== null && !badgeFailed ? officialBadge : null

  return (
    <span
      className={`${styles.crest} ${styles[size]} ${styles[kitPattern]} ${
        colours.onPrimary === 'dark' ? styles.onDark : ''
      }`}
      style={
        {
          '--vnext-team-primary': colours.primary,
          '--vnext-team-secondary': colours.secondary,
          '--vnext-team-accent': colours.accent,
        } as CSSProperties
      }
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': team.name })}
    >
      <span className={styles.code} aria-hidden="true">
        {team.abbreviation}
      </span>
      {badge === null ? null : (
        <img
          className={styles.badge}
          src={badge.url}
          // ALWAYS EMPTY. The badge is a second rendering of an identity the
          // parent already names — announcing the club twice is noise, and the
          // parent carries the accessible name whether or not a badge loaded.
          alt=""
          aria-hidden="true"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          // The deployment already sends `strict-origin-when-cross-origin`,
          // which sends only the origin to a provider host. `no-referrer` is
          // stated here anyway because a badge is the one request that has no
          // reason to identify the page it is on, and a rights holder's CDN is
          // not somewhere this product's URLs need to appear in a log.
          referrerPolicy="no-referrer"
          onError={() => setBadgeFailed(true)}
        />
      )}
    </span>
  )
}
