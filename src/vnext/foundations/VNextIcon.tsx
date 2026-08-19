/**
 * THE vNEXT ICON SET.
 *
 * ============================ WHY THE LANE HAS ITS OWN ==================
 *
 * `DEC-017` asked whether vNext reuses `src/design-system/icons.tsx` as
 * infrastructure or declares its own, and left it open. The lane's own rules
 * answer it, and they answer it both ways at once:
 *
 *   • `tests/vnext/vnextProductionBoundary.test.ts` forbids any vNext
 *     presentation module from importing `/src/design-system/`. So the legacy
 *     module cannot simply be re-exported, however much infrastructure it is.
 *   • `src/vnext/AGENTS.md` forbids ADDING an icon set as a dependency.
 *
 * So the answer is neither an import nor a package: the same Tabler-style
 * outline vocabulary the repository already standardised on, drawn here. That
 * is explicitly allowed — AGENTS.md calls a drawing whose coordinates are all
 * literals "not a calculation and deliberately outside" the drawn-geometry
 * rule.
 *
 * ============================ WHAT IT REPLACES =========================
 *
 * Emoji. `src/design-system/icons.tsx` opens with the rule — *"SVG only — no
 * emoji anywhere in the UI"* — and the vNext lane was breaking it in four
 * places: a trophy in the Championship and in Last Man Standing, a stopwatch on
 * the primary action card, and a tick in onboarding. Emoji render as a
 * different typeface on every platform, carry a colour nothing in the palette
 * chose, and are announced by screen readers as their unicode name.
 *
 * ============================ HOW THEY BEHAVE ===========================
 *
 * DECORATIVE BY DEFAULT. `aria-hidden` unless given a `title`, because an icon
 * beside a word that already says the thing is noise to a screen reader. Where
 * an icon is the only carrier of meaning, `title` makes it an image with a
 * name.
 *
 * COLOUR IS THE CALLER'S. Every path is `currentColor`, so an icon takes the
 * colour of the text it sits with — which is what makes the whole set work in
 * both themes with no per-theme icon anywhere.
 *
 * AND IT HOLDS ONLY WHAT IS DRAWN TODAY. A sun and a moon were written here
 * first, for a theme toggle — and then the appearance control turned out to be
 * a labelled radio group, because there are three answers and the third is
 * "match my device", which no pictogram says. They were removed rather than
 * baselined as unused: `src/vnext/AGENTS.md` asks the lane to resist growing
 * its foundations speculatively, and an icon nothing renders is exactly that.
 *
 * SIZE IS IN `em`, NOT PIXELS. An icon beside text should grow with that text,
 * and a fixed 16px icon beside a 36px score is a bug that only shows up at one
 * breakpoint.
 */

export type VNextIconProps = {
  /** Multiples of the current font size. Defaults to 1em. */
  readonly size?: number
  readonly className?: string | undefined
  /** Set only where the icon is the sole carrier of meaning. */
  readonly title?: string | undefined
}

function iconProps({ size = 1, className, title }: VNextIconProps) {
  return {
    width: `${size}em`,
    height: `${size}em`,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': title === undefined ? true : undefined,
    role: title === undefined ? undefined : ('img' as const),
    focusable: false as const,
  }
}

export function VNextTrophyIcon(props: VNextIconProps) {
  return (
    <svg {...iconProps(props)}>
      {props.title === undefined ? null : <title>{props.title}</title>}
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

export function VNextCheckIcon(props: VNextIconProps) {
  return (
    <svg {...iconProps(props)}>
      {props.title === undefined ? null : <title>{props.title}</title>}
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

export function VNextClockIcon(props: VNextIconProps) {
  return (
    <svg {...iconProps(props)}>
      {props.title === undefined ? null : <title>{props.title}</title>}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
