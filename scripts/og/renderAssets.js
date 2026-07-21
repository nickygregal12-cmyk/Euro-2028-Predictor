// Reproducible source for the public-site image assets in `public/`:
//   og-image.png (1200×630), favicon.svg / favicon.ico / apple-touch-icon.png.
//
// There is no local SVG rasterizer in this repo, and these assets must render in
// the app's actual typefaces (self-hosted Space Grotesk 500 + Inter, loaded by
// src/styles/fonts.css). So the canonical generator is the APP'S OWN CANVAS:
// run the draw functions below in a browser tab that has an app page loaded
// (the fonts are then available), export the canvas to PNG, and write the bytes
// to public/. This file is the editable source of truth for the artwork — tweak
// the palette / copy / layout here and re-run.
//
// ── How to regenerate ────────────────────────────────────────────────────────
//   1. `npm run dev`, open the app (any page loads fonts.css).
//   2. In the page console, paste this file's contents, then:
//        copy(drawOgImage().toDataURL('image/png'))            // OG banner
//        copy(drawFavicon(180, true).toDataURL('image/png'))   // apple-touch
//        copy(drawFavicon(32).toDataURL('image/png'))          // ico source (also 16, 48)
//   3. Decode each data: URL to bytes and write to public/ (favicon.ico wraps the
//      16/32/48 PNGs in an ICO container; favicon.svg is hand-authored alongside).
//   Palette + type are the design-system tokens (src/styles/tokens.css).

const C = {
  bg: '#0A1128', bg2: '#101E3E', line: '#26355C',
  acc: '#22E06C', tx: '#F2F5FB', tx2: '#9AA6C2', tx3: '#7E8BA8',
}

// 1200×630 Open Graph banner — "take A": one-line headline, green accent bar,
// faint knockout-bracket texture on the edges, domain footer. No user data, no
// flags, no third-party marks.
function drawOgImage() {
  const W = 1200, H = 630
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')

  // Navy gradient + a faint accent glow behind the headline.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, C.bg2); g.addColorStop(1, C.bg)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const rg = ctx.createRadialGradient(W / 2, H * 0.44, 40, W / 2, H * 0.44, 540)
  rg.addColorStop(0, 'rgba(34,224,108,0.10)'); rg.addColorStop(1, 'rgba(34,224,108,0)')
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)

  // Bracket motif — faint funnels mirrored on both edges.
  const bracket = (x0, dir, cy) => {
    ctx.save()
    ctx.strokeStyle = 'rgba(122,139,168,0.16)'; ctx.lineWidth = 2.5
    const run = 70, arm = 150
    const ys = [cy - 165, cy - 55, cy + 55, cy + 165]
    ctx.beginPath()
    for (const y of ys) { ctx.moveTo(x0, y); ctx.lineTo(x0 + dir * arm, y) }
    ctx.moveTo(x0 + dir * arm, ys[0]); ctx.lineTo(x0 + dir * arm, ys[1])
    ctx.moveTo(x0 + dir * arm, ys[2]); ctx.lineTo(x0 + dir * arm, ys[3])
    const m1 = (ys[0] + ys[1]) / 2, m2 = (ys[2] + ys[3]) / 2
    ctx.moveTo(x0 + dir * arm, m1); ctx.lineTo(x0 + dir * (arm + run), m1)
    ctx.moveTo(x0 + dir * arm, m2); ctx.lineTo(x0 + dir * (arm + run), m2)
    ctx.moveTo(x0 + dir * (arm + run), m1); ctx.lineTo(x0 + dir * (arm + run), m2)
    const mm = (m1 + m2) / 2
    ctx.moveTo(x0 + dir * (arm + run), mm); ctx.lineTo(x0 + dir * (arm + run + run), mm)
    ctx.stroke(); ctx.restore()
  }
  bracket(0, 1, H / 2)
  bracket(W, -1, H / 2)

  const T = (s, x, y, o) => {
    ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.font = `${o.weight || '500'} ${o.size}px ${o.font || "'Space Grotesk'"}, system-ui, sans-serif`
    ctx.letterSpacing = (o.ls || 0) + 'px'
    ctx.fillText(o.caps ? s.toUpperCase() : s, x, y)
    ctx.letterSpacing = '0px'
  }
  ctx.fillStyle = C.acc; ctx.fillRect(W / 2 - 34, 208, 68, 6)
  T('EURO 2028 PREDICTOR', W / 2, 320, { size: 82, caps: true, ls: 2, color: C.tx })
  T('Predict every match. Beat your mates.', W / 2, 392, { size: 34, font: "'Inter'", color: C.tx2 })
  T('euro28predictor.com', W / 2, 568, { size: 26, color: C.tx3 })
  return cv
}

// The "28" monogram — navy tile, green digits. `square` fills the whole canvas
// (apple-touch, which iOS masks itself); otherwise a rounded tile (favicon).
function drawFavicon(size, square) {
  const cv = document.createElement('canvas')
  cv.width = size; cv.height = size
  const ctx = cv.getContext('2d')
  ctx.fillStyle = C.bg
  if (square) {
    ctx.fillRect(0, 0, size, size)
  } else {
    const r = size * 0.22
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.arcTo(size, 0, size, size, r); ctx.arcTo(size, size, 0, size, r)
    ctx.arcTo(0, size, 0, 0, r); ctx.arcTo(0, 0, size, 0, r)
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = C.acc; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.letterSpacing = Math.round(size * 0.01) + 'px'
  ctx.font = `500 ${Math.round(size * 0.56)}px 'Space Grotesk', system-ui, sans-serif`
  ctx.fillText('28', size / 2, size * 0.545)
  ctx.letterSpacing = '0px'
  return cv
}

if (typeof module !== 'undefined') module.exports = { drawOgImage, drawFavicon, C }
