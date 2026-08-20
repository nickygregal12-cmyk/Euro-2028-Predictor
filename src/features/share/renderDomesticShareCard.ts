import {
  domesticCardCopy,
  type CardLine,
  type DomesticCardCopy,
  type DomesticCardFacts,
} from './domesticShareCard'

/**
 * The domestic season card, drawn.
 *
 * IT READS THE vNEXT TOKENS RATHER THAN CARRYING A PALETTE. `renderShareCard.ts`
 * holds its own fixed poster palette, and that was the right call for a Euro
 * bracket that predates the design system. Repeating the trick here would make
 * a THIRD set of hexes to keep in step, and this repository has already been
 * bitten by exactly that: the browser-chrome colour lived in two places, both
 * with a comment asking the reader to keep them matching `--bg`, and both had
 * drifted. So the palette is read from the stylesheet at draw time, with
 * fallbacks that exist for a headless canvas rather than as a second opinion.
 *
 * IT DRAWS IN THE DARK PALETTE WHATEVER THE PLAYER'S THEME IS, and that is not
 * an oversight. The card leaves the application: it lands in a chat thread on
 * somebody else's phone, beside other people's messages. A poster that changed
 * colour depending on a setting on the sharer's device would be two products'
 * worth of visual identity for one image, and the dark one is the identity this
 * product is recognised by.
 *
 * SQUARE, AND 1080. The same size the existing card uses, for the same reason:
 * it is what every messaging app and social surface accepts without recropping,
 * and a recrop is where a card loses its footer.
 *
 * NOTHING IS FETCHED. Every glyph is text in a self-hosted family and every
 * shape is drawn, so the canvas is never tainted and `toBlob` always succeeds.
 * That is a hard requirement rather than a nicety — a tainted canvas fails at
 * export, which is after the player has pressed Share.
 */

export const DOMESTIC_CARD_SIZE = 1080

/**
 * Read once per render from `:root`, where `src/vnext/foundations/tokens.css`
 * defines them. The fallbacks are the dark values from that file; they are
 * reached only where there is no document to read (a test, a worker), never as
 * a preference.
 */
export type CardPalette = {
  readonly canvas: string
  readonly canvasDeep: string
  readonly surface: string
  readonly hairline: string
  readonly text: string
  readonly textSecondary: string
  readonly textMuted: string
  readonly accent: string
}

const FALLBACK: CardPalette = {
  canvas: '#05070d',
  canvasDeep: '#020307',
  surface: '#0e131f',
  hairline: 'rgba(255, 255, 255, 0.09)',
  text: '#f2f6ff',
  textSecondary: '#b6c1d8',
  textMuted: '#8d9bb4',
  accent: '#37e0a0',
}

export function readCardPalette(): CardPalette {
  if (typeof document === 'undefined') return FALLBACK
  const root = document.documentElement
  const style = getComputedStyle(root)
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback

  // THE DARK VALUES SPECIFICALLY. `getComputedStyle` returns whatever theme the
  // player has chosen, and a light-theme card would be a different product's
  // poster. The dark values are read from the element the tokens are declared
  // on with the dark attribute forced, so the card is always the same one.
  const probe = document.createElement('div')
  probe.setAttribute('data-theme', 'dark')
  probe.style.display = 'none'
  root.appendChild(probe)
  const dark = getComputedStyle(probe)
  const darkToken = (name: string, fallback: string) =>
    dark.getPropertyValue(name).trim() || token(name, fallback)

  const palette: CardPalette = {
    canvas: darkToken('--vnext-canvas', FALLBACK.canvas),
    canvasDeep: darkToken('--vnext-canvas-deep', FALLBACK.canvasDeep),
    surface: darkToken('--vnext-surface', FALLBACK.surface),
    hairline: darkToken('--vnext-hairline', FALLBACK.hairline),
    text: darkToken('--vnext-text', FALLBACK.text),
    textSecondary: darkToken('--vnext-text-secondary', FALLBACK.textSecondary),
    textMuted: darkToken('--vnext-text-muted', FALLBACK.textMuted),
    accent: darkToken('--vnext-accent', FALLBACK.accent),
  }
  probe.remove()
  return palette
}

const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const BODY = "'Inter', system-ui, sans-serif"

type TextOptions = {
  readonly size: number
  readonly colour: string
  readonly weight?: string
  readonly family?: string
  readonly align?: CanvasTextAlign
  readonly caps?: boolean
  readonly letterSpacing?: number
  readonly maxWidth?: number
}

function write(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  options: TextOptions,
): void {
  ctx.fillStyle = options.colour
  ctx.textAlign = options.align ?? 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${options.weight ?? '500'} ${options.size}px ${options.family ?? DISPLAY}`
  ctx.letterSpacing = `${options.letterSpacing ?? 0}px`
  ctx.fillText(
    options.caps ? value.toUpperCase() : value,
    x,
    y,
    options.maxWidth,
  )
  ctx.letterSpacing = '0px'
}

/**
 * The pitch mark, the same geometry the installed application icon uses.
 *
 * Drawn rather than imported, because an image would be a fetch and a fetch
 * would taint the canvas. It is the one piece of identity on the card that is
 * not a word, and it is what makes a screenshot of this recognisable as this
 * product rather than as a generic dark poster.
 */
function drawMark(
  ctx: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  size: number,
  colour: string,
): void {
  ctx.save()
  ctx.strokeStyle = colour
  ctx.fillStyle = colour

  ctx.lineWidth = size * 0.07
  ctx.beginPath()
  ctx.moveTo(centreX - size / 2, centreY)
  ctx.lineTo(centreX + size / 2, centreY)
  ctx.stroke()

  ctx.lineWidth = size * 0.085
  ctx.beginPath()
  ctx.arc(centreX, centreY, size * 0.26, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(centreX, centreY, size * 0.075, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly CardLine[],
  palette: CardPalette,
): void {
  if (lines.length === 0) return

  const centre = DOMESTIC_CARD_SIZE / 2
  const top = 730
  const height = 132
  const width = 820
  const left = centre - width / 2

  // One panel, hairline-bordered, with the rows inside it. The design system
  // elevates by surface and separates by hairline rather than by shadow, and a
  // poster that shadowed its panels would read as a different system.
  ctx.fillStyle = palette.surface
  ctx.beginPath()
  const radius = 28
  ctx.moveTo(left + radius, top)
  ctx.arcTo(left + width, top, left + width, top + height, radius)
  ctx.arcTo(left + width, top + height, left, top + height, radius)
  ctx.arcTo(left, top + height, left, top, radius)
  ctx.arcTo(left, top, left + width, top, radius)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = palette.hairline
  ctx.lineWidth = 2
  ctx.stroke()

  const columnWidth = width / lines.length
  lines.forEach((line, index) => {
    const x = left + columnWidth * index + columnWidth / 2
    write(ctx, line.label, x, top + 52, {
      size: 24,
      colour: palette.textMuted,
      family: BODY,
      caps: true,
      letterSpacing: 1.5,
      maxWidth: columnWidth - 32,
    })
    write(ctx, line.value, x, top + 104, {
      size: 40,
      colour: palette.text,
      weight: '600',
      maxWidth: columnWidth - 32,
    })

    if (index > 0) {
      ctx.strokeStyle = palette.hairline
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(left + columnWidth * index, top + 28)
      ctx.lineTo(left + columnWidth * index, top + height - 28)
      ctx.stroke()
    }
  })
}

/**
 * Draw one card onto a canvas and return it.
 *
 * Synchronous, and that is worth stating: there is nothing to await because
 * nothing is loaded. The caller hands the canvas to `canvasToBlob` and then to
 * `shareOrDownloadImage`, which is the glue the Euro card already uses.
 */
export function renderDomesticShareCard(
  facts: DomesticCardFacts,
  options: { canvas?: HTMLCanvasElement; palette?: CardPalette } = {},
): HTMLCanvasElement {
  const copy = domesticCardCopy(facts)
  const palette = options.palette ?? readCardPalette()
  const canvas = options.canvas ?? document.createElement('canvas')
  canvas.width = DOMESTIC_CARD_SIZE
  canvas.height = DOMESTIC_CARD_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  paint(ctx, copy, palette)
  return canvas
}

/** Separated so a test can drive the drawing against a fake context. */
export function paint(
  ctx: CanvasRenderingContext2D,
  copy: DomesticCardCopy,
  palette: CardPalette,
): void {
  const size = DOMESTIC_CARD_SIZE
  const centre = size / 2

  const background = ctx.createLinearGradient(0, 0, 0, size)
  background.addColorStop(0, palette.canvas)
  background.addColorStop(1, palette.canvasDeep)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)

  drawMark(ctx, centre, 150, 112, palette.accent)

  write(ctx, copy.eyebrow, centre, 290, {
    size: 30,
    colour: palette.textSecondary,
    family: BODY,
    caps: true,
    letterSpacing: 2,
    maxWidth: 900,
  })

  // THE HEADLINE IS THE CARD. One number, as large as the tile allows, because
  // this is read at thumbnail size in a chat list before anybody opens it.
  write(ctx, copy.headline, centre, 540, {
    size: copy.headline.length > 4 ? 200 : 260,
    colour: palette.accent,
    weight: '600',
    maxWidth: 940,
  })

  write(ctx, copy.headlineLabel, centre, 630, {
    size: 44,
    colour: palette.text,
    family: BODY,
    maxWidth: 900,
  })

  drawLines(ctx, copy.lines, palette)

  ctx.strokeStyle = palette.hairline
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(centre - 120, 950)
  ctx.lineTo(centre + 120, 950)
  ctx.stroke()

  write(ctx, copy.footer, centre, 1010, {
    size: 30,
    colour: palette.textMuted,
    family: BODY,
    caps: true,
    letterSpacing: 3,
  })
}
