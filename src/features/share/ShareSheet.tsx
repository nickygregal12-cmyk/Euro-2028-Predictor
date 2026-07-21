import { useEffect, useRef, useState } from 'react'
import { Modal, Button } from '../../design-system'
import { renderShareCard } from './renderShareCard'
import { canvasToBlob, shareOrDownloadImage } from './shareImage'
import { chipText, type ShareCardModel, type ShareVariant } from './shareModel'
import s from './ShareSheet.module.css'

const VARIANT_LABEL: Record<ShareVariant, string> = {
  tease: 'Champion',
  bracket: 'Full bracket',
  brag: 'My standing',
}

export type ShareSheetProps = {
  open: boolean
  onClose: () => void
  model: ShareCardModel
  variants: ShareVariant[]
}

/**
 * The share moment: a live 1080×1080 card preview with a variant switcher and a
 * Share button (native share sheet where files are supported, download fallback).
 * The card renders client-side from the ShareCardModel; nothing leaves the device
 * except what the user actively shares.
 */
export function ShareSheet({ open, onClose, model, variants }: ShareSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [variant, setVariant] = useState<ShareVariant>(variants[0] ?? 'tease')
  const [rendering, setRendering] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Re-render the card whenever the sheet opens or the variant changes.
  useEffect(() => {
    if (!open || !canvasRef.current) return
    let active = true
    setRendering(true)
    setStatus(null)
    renderShareCard(canvasRef.current, model, variant).finally(() => {
      if (active) setRendering(false)
    })
    return () => {
      active = false
    }
  }, [open, variant, model])

  // Keep the selected variant valid if the available set changes.
  useEffect(() => {
    if (!variants.includes(variant) && variants[0]) setVariant(variants[0])
  }, [variants, variant])

  async function onShare() {
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus(null)
    const blob = await canvasToBlob(canvas)
    if (!blob) {
      setStatus("Couldn't create the image. Try again.")
      return
    }
    const result = await shareOrDownloadImage(blob, `euro28-${variant}.png`, {
      title: 'My Euro 2028 predictions',
      text: chipText(model, variant),
      url: model.url,
    })
    if (result === 'downloaded') setStatus('Saved to your device.')
    else if (result === 'shared') setStatus('Shared.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share your entry"
      footer={
        <div className={s.footer}>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button variant="primary" onClick={onShare} disabled={rendering}>
            {rendering ? 'Preparing…' : 'Share'}
          </Button>
        </div>
      }
    >
      {variants.length > 1 ? (
        <div className={s.tabs} role="tablist" aria-label="Card style">
          {variants.map((v) => (
            <button
              key={v}
              type="button"
              className={`${s.tab} ${variant === v ? s.tabOn : ''}`}
              aria-pressed={variant === v}
              onClick={() => setVariant(v)}
            >
              {VARIANT_LABEL[v]}
            </button>
          ))}
        </div>
      ) : null}

      <div className={s.preview}>
        <canvas ref={canvasRef} className={s.canvas} width={1080} height={1080} aria-label="Shareable card preview" />
      </div>

      <p className={s.note} role="status">
        {status ?? 'Rendered on your device — shared only when you tap Share (a download on browsers without a share sheet).'}
      </p>
    </Modal>
  )
}
