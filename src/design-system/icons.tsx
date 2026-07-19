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

export function HomeIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10.5V20h12v-9.5" />
    </svg>
  )
}

// Checklist — the predictions glyph.
export function PredictIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M4 7h9" />
      <path d="M4 12h9" />
      <path d="M4 17h5" />
      <path d="M14.5 15.8l1.8 1.8 3.2-3.6" />
    </svg>
  )
}

// Soccer ball — the Predict glyph (design-system §6: football icon for Predict).
export function BallIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.4l3.4 2.5-1.3 4h-4.2l-1.3-4z" />
      <path d="M12 7.4V4.4M15.4 9.9l2.7-1M13.8 13.9l1.9 2.3M10.2 13.9l-1.9 2.3M8.6 9.9l-2.7-1" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  )
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 5H6a2 2 0 0 0 0 4h2" />
      <path d="M16 5h2a2 2 0 0 1 0 4h-2" />
      <path d="M12 12v4" />
      <path d="M9 20h6" />
      <path d="M10 20a2 2 0 0 1 4 0" />
    </svg>
  )
}

// Three dots — the "more" glyph. Filled so they read as dots, not rings.
export function MoreIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a15.4 15.4 0 0 1-2.9 3.4" />
      <path d="M6.6 6.6A15.4 15.4 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.5-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
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
