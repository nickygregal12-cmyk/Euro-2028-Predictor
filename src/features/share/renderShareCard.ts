// Self-contained canvas renderer for the shareable cards (design-system §6).
// Draws a fixed 1080×1080 dark-navy poster — theme-independent, big shapes,
// flags over names, high contrast — from a ShareCardModel. No external requests
// (flags are bundled same-origin assets, so the canvas is never tainted and
// toBlob works). One renderer, three content states.

import { flagUrl } from './flagAssets'
import {
  type ShareCardModel,
  type ShareVariant,
  type ShareTeam,
  statLine,
  bragLine,
  chipText,
  flagSizeForStage,
} from './shareModel'

export const CARD_SIZE = 1080

// Fixed poster palette (independent of the app theme).
const C = {
  bg0: '#0a0f1e',
  bg1: '#111a30',
  card: '#16203a',
  line: 'rgba(255,255,255,0.12)',
  text: '#f8fafc',
  muted: '#9fb0c8',
  faint: '#63748f',
  accent: '#5ee08a',
  gold: '#f2c14e',
}
const DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const BODY = "'Inter', system-ui, sans-serif"

const imgCache = new Map<string, Promise<HTMLImageElement | null>>()
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = imgCache.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    imgCache.set(url, p)
  }
  return p
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// A flag in a 3:2 rounded box with a hairline; a neutral placeholder when we
// don't ship that flag (or the team is unknown). Optionally dimmed (tombstone).
async function drawFlag(
  ctx: CanvasRenderingContext2D,
  team: ShareTeam | null,
  cx: number,
  cy: number,
  h: number,
  opts: { ring?: boolean; dim?: boolean } = {},
) {
  const w = h * 1.5
  const x = cx - w / 2
  const y = cy - h / 2
  ctx.save()
  if (opts.dim) ctx.globalAlpha = 0.4
  roundRect(ctx, x, y, w, h, Math.max(6, h * 0.1))
  ctx.clip()
  const url = team ? flagUrl(team.countryCode) : null
  const img = url ? await loadImage(url) : null
  if (img) {
    ctx.drawImage(img, x, y, w, h)
  } else {
    ctx.fillStyle = C.card
    ctx.fillRect(x, y, w, h)
    if (team) {
      ctx.fillStyle = C.faint
      ctx.font = `600 ${Math.round(h * 0.4)}px ${DISPLAY}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(team.name.slice(0, 2).toUpperCase(), cx, cy)
    }
  }
  ctx.restore()
  // Hairline + optional accent ring.
  ctx.save()
  if (opts.dim) ctx.globalAlpha = 0.4
  roundRect(ctx, x, y, w, h, Math.max(6, h * 0.1))
  ctx.lineWidth = opts.ring ? 8 : 2
  ctx.strokeStyle = opts.ring ? C.accent : C.line
  ctx.stroke()
  ctx.restore()
}

function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  opts: { size: number; font?: string; color?: string; align?: CanvasTextAlign; weight?: string; caps?: boolean; maxWidth?: number },
) {
  ctx.fillStyle = opts.color ?? C.text
  ctx.font = `${opts.weight ?? '500'} ${opts.size}px ${opts.font ?? DISPLAY}`
  ctx.textAlign = opts.align ?? 'center'
  ctx.textBaseline = 'alphabetic'
  const s = opts.caps ? str.toUpperCase() : str
  ctx.fillText(s, x, y, opts.maxWidth)
}

function drawChip(ctx: CanvasRenderingContext2D, label: string, cy: number, accent = true) {
  ctx.font = `600 30px ${DISPLAY}`
  const w = Math.min(880, ctx.measureText(label).width + 72)
  const x = (CARD_SIZE - w) / 2
  const h = 76
  roundRect(ctx, x, cy - h / 2, w, h, h / 2)
  ctx.fillStyle = accent ? C.accent : C.card
  ctx.fill()
  text(ctx, label, CARD_SIZE / 2, cy + 10, { size: 30, weight: '600', color: accent ? C.bg0 : C.text, maxWidth: w - 48 })
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, CARD_SIZE)
  g.addColorStop(0, C.bg1)
  g.addColorStop(1, C.bg0)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)
  text(ctx, 'Euro 2028 · Predictor', CARD_SIZE / 2, 76, { size: 26, color: C.faint, caps: true, weight: '500' })
}

function header(ctx: CanvasRenderingContext2D, model: ShareCardModel) {
  const label = model.header.leagueName
    ? model.header.leagueName
    : model.header.locked
      ? `${model.header.playerName} · locked in`
      : `${model.header.playerName}'s entry`
  text(ctx, label, CARD_SIZE / 2, 150, { size: 40, color: C.text, weight: '600', maxWidth: 900 })
}

async function drawChampionHero(ctx: CanvasRenderingContext2D, model: ShareCardModel, cy: number) {
  const champ = model.champion
  text(ctx, 'My champion', CARD_SIZE / 2, cy - 210, { size: 30, color: C.accent, caps: true })
  await drawFlag(ctx, champ, CARD_SIZE / 2, cy, flagSizeForStage('CHAMPION'), { ring: true, dim: champ?.eliminated })
  const name = champ?.name ?? 'Not picked'
  text(ctx, name, CARD_SIZE / 2, cy + 260, { size: 78, weight: '600', color: champ?.eliminated ? C.faint : C.text, maxWidth: 940 })
  if (champ?.eliminated) {
    ctx.strokeStyle = C.faint
    ctx.lineWidth = 5
    const w = ctx.measureText(name).width
    ctx.beginPath()
    ctx.moveTo(CARD_SIZE / 2 - w / 2, cy + 232)
    ctx.lineTo(CARD_SIZE / 2 + w / 2, cy + 232)
    ctx.stroke()
  }
}

function finalLine(ctx: CanvasRenderingContext2D, model: ShareCardModel, cy: number) {
  if (!model.finalists) return
  const [a, b] = model.finalists
  // handled by the async caller for flags; here just the labels + venue/date
  text(ctx, `${a.name}  v  ${b.name}`, CARD_SIZE / 2, cy, { size: 40, color: C.text, weight: '600', maxWidth: 940 })
  const sub = [model.venue, model.dateLabel].filter(Boolean).join(' · ')
  if (sub) text(ctx, sub, CARD_SIZE / 2, cy + 44, { size: 28, color: C.muted })
}

async function renderTease(ctx: CanvasRenderingContext2D, model: ShareCardModel) {
  await drawChampionHero(ctx, model, 470)
  finalLine(ctx, model, 800)
  text(ctx, statLine(model.stats.goalsPredicted, model.stats.jokersArmed), CARD_SIZE / 2, 900, { size: 30, color: C.muted, font: BODY })
  drawChip(ctx, chipText(model, 'tease'), 1000)
}

async function renderBrag(ctx: CanvasRenderingContext2D, model: ShareCardModel) {
  await drawChampionHero(ctx, model, 480)
  if (model.brag) {
    text(ctx, bragLine(model.brag.points, model.brag.rank, model.brag.total), CARD_SIZE / 2, 840, {
      size: 52,
      weight: '600',
      color: C.accent,
      maxWidth: 940,
    })
  }
  // No challenge copy on the brag; a plain URL/league chip only.
  drawChip(ctx, model.header.leagueName ? chipText(model, 'brag') : model.url, 990, false)
}

async function renderBracket(ctx: CanvasRenderingContext2D, model: ShareCardModel) {
  // Funnel: rows of survivor flags converging (8 → 4 → 2) at fixed centres so the
  // champion + awards + chip always fit below. Flag size grows with depth. Rows
  // beyond the first three (unexpected) are ignored.
  const ROW_CY: Record<string, number> = { R16: 300, QF: 402, SF: 516 }
  const ROW_SIZE: Record<string, number> = { R16: 56, QF: 76, SF: 100 }
  for (const row of model.survivors) {
    const size = ROW_SIZE[row.stage]
    const cy = ROW_CY[row.stage]
    if (!size || !cy) continue
    const gap = 26
    const totalW = row.teams.length * size * 1.5 + (row.teams.length - 1) * gap
    let x = (CARD_SIZE - totalW) / 2 + (size * 1.5) / 2
    for (const t of row.teams) {
      await drawFlag(ctx, t, x, cy, size)
      x += size * 1.5 + gap
    }
  }
  // Champion (large, ring) + name.
  await drawFlag(ctx, model.champion, CARD_SIZE / 2, 690, 172, { ring: true, dim: model.champion?.eliminated })
  text(ctx, model.champion?.name ?? 'Champion', CARD_SIZE / 2, 838, { size: 58, weight: '600', maxWidth: 900 })
  // Awards strip (no emojis — the gold treatment carries the golden boot).
  if (model.awards.goldenBootName) {
    text(ctx, `Golden boot: ${model.awards.goldenBootName}`, CARD_SIZE / 2, 908, { size: 30, color: C.gold, weight: '600', maxWidth: 900 })
  }
  text(ctx, `${model.awards.groupGoals} group goals predicted`, CARD_SIZE / 2, model.awards.goldenBootName ? 948 : 920, { size: 28, color: C.muted, font: BODY })
  drawChip(ctx, chipText(model, 'bracket'), 1016)
}

/**
 * Render a card variant onto a 1080×1080 canvas. Async because it awaits the
 * bundled flag images and (in the browser) the fonts. Resolves once drawn, so
 * callers can immediately export the canvas.
 */
export async function renderShareCard(
  canvas: HTMLCanvasElement,
  model: ShareCardModel,
  variant: ShareVariant,
): Promise<void> {
  canvas.width = CARD_SIZE
  canvas.height = CARD_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* fonts optional */
    }
  }
  background(ctx)
  header(ctx, model)

  // The tease/brag final-and-hero flags need async draws; render body per variant.
  if (variant === 'tease') {
    await renderTease(ctx, model)
    // finalist flags flanking the "v" line
    if (model.finalists) {
      await drawFlag(ctx, model.finalists[0], CARD_SIZE / 2 - 300, 792, 56)
      await drawFlag(ctx, model.finalists[1], CARD_SIZE / 2 + 300, 792, 56)
    }
  } else if (variant === 'brag') {
    await renderBrag(ctx, model)
  } else {
    await renderBracket(ctx, model)
  }
}
