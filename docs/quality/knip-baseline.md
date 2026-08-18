# Knip dead-code baseline — classified report

**Ran:** 5 August 2026, `npm run check:dead-code` (Knip 6, report-only).
**Configuration:** [`knip.json`](../../knip.json), guarded by `tests/scripts/knipConfiguration.test.ts`.
**Authority for what happens next:** [`../design/ui-modernisation-execution.md`](../design/ui-modernisation-execution.md).

This is the baseline the UI modernisation sequence asks for **before** pattern extraction begins, and it deletes nothing. Its job is to say which of the findings are real, which are artefacts of how Knip sees the repository, and which entry points must be protected from a future cleanup that reads the raw output as a to-do list.

## Read this before acting on any finding

**"Unused export" does not mean "unused code."** Knip reports an export nothing *imports*. A constant used ten lines below its own `export const`, or a component re-exported through a barrel while its consumers import it directly, is reported exactly like genuinely dead logic. Three of the first five findings triaged here were of that kind:

- `isApprovedAutoLoginUrl` is called on line 133 of the file that exports it;
- `CUP_TABLE_POINTS` is read three times inside `cupGroupTable.ts`;
- `BottomNav` is rendered by `PageShell`, which imports it from `./BottomNav` directly — it is the barrel's re-export that has no importer.

Deleting any of those on the strength of the report would have broken working code. The redundant thing is the `export` keyword, not the value.

## Category 1 — production entry points (protect)

Configured in `knip.json` so nothing below them is ever reported as unused:

`src/main.tsx` and `index.html` (browser bundle) · `vite.config.ts` · the three Playwright configs · `tests/**/*.test.{ts,tsx}` · `e2e/**/*.spec.ts` and `e2e/global-setup.ts` · `production-smoke/**/*.spec.ts` · `scripts/**/*.{mjs,js,ts}` (npm scripts, deploy gates and CI workflows invoke these directly) · `supabase/functions/*/index.ts` (Deno Edge Function; no npm importer will ever exist).

Removing one of these entries would not report a defect — it would silently mark a whole subtree unused. That is the failure this category exists to prevent, and the guard test asserts each glob still matches real files.

## Category 2 — development and test harness (not dead)

`src/dev/**` — `ComponentsPreview`, `MatchCentreScenarioPreview`, `SeasonPreview` — reports as **used**, correctly: `App.tsx` lazy-imports each behind `import.meta.env.DEV`, so the reference survives static analysis while the code stays out of the production bundle. `ComponentsPreview` is the declared component and state contract harness, and the visual-contract work depends on it.

## Category 3 — reference prototype

| Finding | Disposition |
| --- | --- |
| `src/premium/PremiumApp.tsx`, `premium.css`'s siblings `store.tsx`, `data.ts`, `types.ts` — reported as 4 unused files | **Expected and confirmed.** Independent confirmation, by a tool with no knowledge of the design decision, that the prototype is unreachable from the application. It stays as a visual reference; `tests/design/premiumPrototypeBoundary.test.ts` keeps it unreachable |
| `framer-motion`, `lucide-react` — reported as unused dependencies | **Not dead: awaiting adoption.** Both are approved go-forward systems (the only motion and icon systems allowed). They are unreferenced today only because their sole importer is the prototype. Do not remove; they get real importers in the visual-foundations work |
| `lenis` — reported as an unused dependency | **Resolved 18 August 2026.** Removed from the parked prototype and manifest. The prototype boundary now refuses any source import, so whole-page scroll hijacking cannot return as an unmeasured dependency |

## Category 4 — historical evidence (out of scope by classification)

`supabase/migrations/**` and `supabase/tests/**` are excluded in `knip.json`. Migrations are append-only after hosted application and pgTAP suites are executed by the database-parity workflow rather than imported by anything. Neither is analysable as a module graph, and reporting them would train readers to ignore the output.

## Category 5 — confirmed dead code

Small, and each verified by searching for consumers rather than trusting the report:

| Symbol | Evidence |
| --- | --- |
| `fetchLastSeen` (`services/supabase/profile.ts`) | Superseded by `fetchLastSeenRead`, which is what Home imports — the file's own comment says so. The predecessor kept its export and lost its callers |
| `fetchEntrySubmissionStatus` (`services/supabase/predictions.ts`) | No consumer anywhere in `src`, `tests` or `e2e` |
| `PredictIcon` (`design-system/icons.tsx`) | No consumer anywhere. A hand-maintained custom SVG nothing renders — directly relevant to the icon consolidation, which replaces generic custom SVGs with Lucide wrappers |

These are the only findings this baseline is willing to call dead. Removal was deliberately not part of establishing the baseline; it followed as its own change, where the deletion was the reviewable subject.

**Removed 5 August 2026.** All three are gone, and the report's unused-export count moved 27 → 24, which is the check that the deletion did what it claimed and nothing more. One of them was more than unused: `fetchEntrySubmissionStatus` called `get_entry_submission_status` from `predictions.ts` while `entrySubmissionStatus.ts` called the same RPC for the live Review workspace — a **duplicate implementation**, not merely an orphan. The RPC keeps its live caller, so `config/deployment-contract.json` and `080_function_privileges.sql` are unaffected. Removing the function also orphaned an import, which `tsc -b` caught immediately.

## Category 6 — requires investigation

- **27 unused exports.** Dominated by the two benign classes described at the top — barrel re-exports (`src/design-system/index.ts`) and module-local constants carrying a needless `export` (`e2e/*-local.ts` fixtures, `saveCoordinator` retry constants). Worth a narrowing pass eventually; worth nothing if done as a bulk delete.
- **186 unused exported types.** Concentrated in `src/domain/**` (69), `src/design-system/**` (57) and `src/services/**` (40). A design system's `Props` types and a pure domain module's input/output types are legitimate public API even with no current importer — a type can be load-bearing structurally while never being named in an import. This number should not be driven to zero.
- **One name collision worth knowing about**, surfaced incidentally: `resolveCompetitionStatus` exists in both `src/domain/competition/context.ts` (a small status-priority picker, used inside its own file) and `src/domain/competitions/resolveCompetitionStatus.ts` (the per-competition state resolver `GamesPage` uses). Different functions, near-identical names, sibling directories differing by one character. No defect today; a readability hazard worth resolving when one of them is next touched.

## Resolved while establishing the baseline

`axe-core` was an **unlisted dependency**: `axeComponentPreview.test.tsx` and `axeComponentStates.test.tsx` import it directly while it was only ever installed as a transitive dependency of `@axe-core/playwright`. The accessibility suites were relying on a package no manifest promised them — a parent bump could have moved or removed it and taken the component-level accessibility coverage with it. It is now an explicit devDependency at the resolved version.

Two other reported classes were **false positives with concrete causes**, silenced in the configuration rather than argued with:

- `@fontsource/inter` and `@fontsource/space-grotesk` are referenced by `url()` in `src/styles/fonts.css`, which Knip does not parse. The guard test asserts that reference still exists, so the ignore cannot outlive its reason;
- the `supabase` and `awk` binaries are external tools invoked by scripts and a workflow guard, not npm packages.

## What this baseline deliberately does not do

It does not delete a file, remove a dependency, narrow an export or become a merge gate. Report-only is the point: the first run of a new analyser over a repository this size produces findings whose *cause* matters more than their count, and a baseline that deleted 213 things would be unreviewable. It becomes a CI gate once the report is stable and its intentional ignores are narrow — the criteria the improvement plan sets, not this document.
