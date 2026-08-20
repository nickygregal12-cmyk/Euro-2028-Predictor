/**
 * The device frames' own viewports, in CSS pixels.
 *
 * ============================ WHY THIS IS ITS OWN MODULE =================
 *
 * `ProductPreview` is loaded lazily — it drags four real vNext surfaces, the
 * shell and Framer Motion behind it, and none of that belongs on the critical
 * path of a page whose first job is to render a headline. But the LANDING PAGE
 * has to reserve the device's box BEFORE that chunk arrives, or the preview
 * would push the page down when it lands, which is the layout shift this whole
 * arrangement exists to avoid.
 *
 * So the two files share the numbers and nothing else. This module is a few
 * bytes of literals and stays in the eager chunk; the component that uses them
 * to render a product does not.
 */

export type ProductPreviewVariant = 'desktop' | 'phone'

export const PREVIEW_DEVICE: Readonly<
  Record<ProductPreviewVariant, { readonly width: number; readonly height: number }>
> = {
  /**
   * 1280 × 860. The width matters and is not a round number chosen for looks:
   * `@container vnext-shell (min-width: 1120px)` is where the shell's navigation
   * rail becomes real, so a narrower frame would advertise the phone
   * composition as the desktop one.
   */
  desktop: { width: 1280, height: 860 },
  /** 390 × 800 — the iPhone 14/15 logical viewport, the modal phone. */
  phone: { width: 390, height: 800 },
}

/**
 * The custom properties the stage and its placeholder are both sized from.
 *
 * ONE FUNCTION SO THE BOX CANNOT DISAGREE WITH ITSELF. The placeholder's whole
 * job is to be exactly the size of the thing that replaces it; two hand-written
 * copies of an aspect ratio is precisely how that stops being true.
 */
export function previewBoxStyle(variant: ProductPreviewVariant): Record<string, string> {
  const device = PREVIEW_DEVICE[variant]
  return {
    '--preview-w': `${device.width}`,
    '--preview-h': `${device.height}`,
  }
}
