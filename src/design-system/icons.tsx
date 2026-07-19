// Shared outline icons (Tabler-style). SVG only — no emoji anywhere in the UI
// (design-system §1). Decorative by default: aria-hidden + focusable=false.
// Colour comes from `currentColor`, so callers set it via CSS `color`.

export type IconProps = {
  size?: number
  className?: string
  title?: string // when set, the icon is meaningful and gets an accessible name
}

function svgProps({ size = 16, className, title }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
    focusable: false as const,
  }
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M10.3 4.3 2.6 18a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 4.3a1.6 1.6 0 0 0-2.8 0" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

// Two stacked cards — the joker glyph.
export function CardsIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <rect x="3" y="6" width="11" height="15" rx="2" />
      <path d="M7.5 4h9.5a2 2 0 0 1 2 2v11.5" />
    </svg>
  )
}
