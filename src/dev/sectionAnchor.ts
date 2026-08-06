/**
 * A stable slug a visual contract can name a gallery section by.
 *
 * ITS OWN MODULE, DELIBERATELY. This is three lines of string handling and it
 * lives apart from `ComponentsPreview` because importing the gallery pulls in
 * the design system, the feature components it demonstrates and — through the
 * providers those reach — the Supabase client, which throws at module load
 * without configuration. A test that only wants to check a slug would have to
 * supply a database URL to do it. The same coupling caught `getRouteTitle`
 * earlier in the UI work; the fix is the same one.
 *
 * Derived from the section title rather than hand-written, so a section cannot
 * exist without an anchor. When a title is reworded its baseline is orphaned
 * and the visual suite says so, which is the right outcome: a renamed section
 * is one whose appearance should be re-reviewed, not silently matched to an
 * old image.
 */
export function sectionAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
