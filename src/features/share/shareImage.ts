// Browser glue for exporting a rendered card canvas: to a PNG blob, then through
// the native share sheet where files are supported, otherwise a download. No
// domain logic. The canvas is drawn only from same-origin assets so it isn't
// tainted and toBlob succeeds.

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Share the PNG via the native share sheet (with the challenge text + URL) when
 * the platform can share files; otherwise fall back to a download. Returns what
 * happened so the caller can toast accordingly.
 */
export async function shareOrDownloadImage(
  blob: Blob,
  filename: string,
  meta: { title: string; text: string; url: string },
): Promise<ShareImageResult> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: meta.title, text: meta.text, url: meta.url })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      // Fall through to download on any other share failure.
    }
  }
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
  return 'downloaded'
}
