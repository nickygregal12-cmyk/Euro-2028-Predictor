# vNext programme review — 19 August 2026

**Audited repository:** `nickygregal12-cmyk/Euro-2028-Predictor`
**Branch:** `claude/vnext-programme-report-su2vca`
**Commit reviewed:** `0dfc6699496464e19a3cbe433b4034a020a87f88`
**Commit this report is recorded at:** `35cd87005ea74488713cf03ff885213e16491227`
**Scope:** the vNext frontend programme — its stage machinery, its lane conventions and the executable gates that enforce them
**Out of scope:** scoring, locks, reveal, settlement, progression, membership, provider truth, database lifecycle, hosted state and the legacy production UI

This is **dated evidence at the commit above, not an authority.** It decides
nothing. Where it disagrees with current code, executable tests or the canonical
task authority, they are right and this is wrong. It is not refreshed to look
current: a later review confirms or contradicts it.

Live status for the findings below lives in
[`../risk-register.md`](../risk-register.md) and
[`../deferred-decisions.md`](../deferred-decisions.md), not here. This report
says what was observed; those registers say where each item now stands.

## Why this review exists

The request was to assess how the repository could improve the running vNext
programme, using the external `nextlevelbuilder/ui-ux-pro-max-skill` design
catalogue as a reference point.

That skill was treated as a **critic, not an authority**, which is the position
[`../../../.agents/skills/predictor-ui-review/SKILL.md`](../../../.agents/skills/predictor-ui-review/SKILL.md)
already takes on it by name. Nothing in it was adopted as a product, visual or
rule authority, and no part of its catalogue was used to propose a change to a
decided vNext journey, component or game rule.

## The programme moved during the review

The review read commit `0dfc669`, where `config/vnext-programme.json` recorded
Stage 11 as `in_progress` and Stage 10 as the last merged stage. Before this
report was recorded, PR #907 merged and advanced that file to Stage 12
`in_progress`, Stage 11 `merged`.

`git diff 0dfc669..35cd870` is **one file, four lines** — the machine state and
nothing else. No evidence cited below moved. What changed is only which stage
owns which finding, and the stage column in the table below is stated at the
later commit rather than the reviewed one.

## What was inspected

| Area | Files read |
| --- | --- |
| Programme machinery | `config/vnext-programme.json`, `docs/product/vnext-programme-controller.md`, `docs/product/vnext-stage-contracts.md`, `.agents/skills/vnext-programme-runner/SKILL.md` |
| Lane authority | `docs/product/ui.md`, `docs/product/vnext-workshop.md`, `src/vnext/AGENTS.md` |
| Lane source | `src/vnext/foundations/tokens.css`, `src/vnext/player/RankChart.tsx`, directory and file inventory of `src/vnext/` |
| Executable gates | `e2e/vnext-*.spec.ts` (8 files), `playwright.vnext.config.ts`, `playwright.visual.config.ts`, `.storybook/main.ts`, `.storybook/preview.ts`, `vitest.storybook.config.ts`, `tests/design-system/tokenContrast.test.ts`, `tests/scripts/mergeGateConfiguration.test.ts` |
| CI | `.github/workflows/ci.yml`, `.github/workflows/vnext-workshop.yml`, `.github/workflows/storybook.yml`, `lighthouserc.json`, `lostpixel.config.js` |
| Production comparison | `src/app/providers/ThemeProvider.tsx`, `src/styles/tokens.css`, `src/design-system/icons.tsx` |
| External reference | `github.com/nextlevelbuilder/ui-ux-pro-max-skill` — README and repository description, fetched read-only |

## What was not inspected, and what could not be verified here

- **No hosted system was touched.** No Supabase environment, no Netlify
  environment, no provider API, no production surface. No hosted claim is made.
- **The GitHub branch ruleset could not be read from the repository.** Finding
  F5 is recorded as a question to check rather than a confirmed defect for
  exactly that reason.
- **No suite was executed.** Every count below comes from reading tracked files,
  not from a run. Runtime figures quoted in F6 are the ones
  `.github/workflows/vnext-workshop.yml` states about itself.
- **No visual review was performed.** Storybook was not booted and no screenshot
  was taken; this review is about the gates around the surfaces, not the
  surfaces themselves.

### Commands run

Read-only inspection only: `git log`, `git rev-parse`, `git diff --stat`,
`git merge-base`, and `grep`/`find`/`wc` over the working tree. The counts in
F2, F3 and F9 were produced that way and are reproducible at the reviewed
commit.

### Commands deliberately not run

`npm run test:e2e:vnext`, `npm run test:storybook`, `npm run check:lighthouse`
and every migration, deployment or provider command. The review needed no run to
reach its findings, and running the browser suite proves the code passes its own
assertions rather than saying anything about which assertions exist.

## Where the programme is already stronger than the reference

Recorded first because it bounds what follows: four of the external skill's
headline features are answered here more strongly than the skill answers them,
and none of the findings below asks for those to change.

- **The delivery checklist is executable rather than prose.** The skill states a
  pre-delivery checklist an agent is asked to honour. `e2e/vnext-*.spec.ts`
  asserts the same content in Chromium at real widths — no sideways overflow,
  exactly one `<main>`, exactly one `<h1>`, `aria-labelledby` genuinely wired,
  no clipped text, no control under 44px.
- **Palette contrast is measured, not asserted.**
  `tests/design-system/tokenContrast.test.ts` measures every text token against
  every surface token and pins the table.
- **Accessibility is blocking rather than advisory.** `.storybook/preview.ts`
  sets `a11y: { test: 'error' }`, disables only three landmark-uniqueness rules
  with a stated reason, and waits for entrance motion to settle so axe measures
  a readable frame.
- **Reduced motion is designed in pairs.** Every motion primitive ships its
  reduced pair in the same change, resolved through `useVNextMotion`, with
  `tests/vnext/vnextMotionContract.test.ts` holding it.

## Findings

Nine findings, in the order the reviewer would take them. Each names the stage
that owns it at commit `35cd870` and the closure that would satisfy it. **None
was acted on in this pass** — see *What this review changed*, below.

| ID | Finding | Owning stage | Live status |
| --- | --- | --- | --- |
| F1 | vNext has no light theme; production ships a persisted one | Stage 13, before Stage 14 | `UX-005`, [`DEC-016`](../deferred-decisions.md) |
| F2 | The surface conformance checklist is duplicated across eight specs | Stages 12, 13, 15 | `TEST-002` |
| F3 | That checklist has already drifted between surfaces | Stages 12 onward | `TEST-002` |
| F4 | The vNext palette has no contrast matrix | Lane-wide | `UX-006` |
| F5 | The vNext gates may not be required checks | Programme-wide | `OPS-012` |
| F6 | The browser suite's runtime budget collides with the remaining stages | Stage 13 | `CI-002` |
| F7 | Stage 15 must audit against primitives that are not enumerated | Stage 15 | `DOC-004` |
| F8 | Stage 12 draws a bracket with no stated rule for drawn geometry | Stage 12 | `TEST-003` |
| F9 | vNext has no icon system | Stage 13 | [`DEC-017`](../deferred-decisions.md) |

### F1 — vNext is dark-only, and production ships a persisted theme choice

`src/app/providers/ThemeProvider.tsx` states that theme "is a persisted user
setting", stores it at `euro28-theme`, applies it as `data-theme` on `<html>`,
and keeps browser-chrome colour in step. `src/styles/tokens.css` carries a full
`[data-theme="light"]` block, and the choice is reachable from `AppShell.tsx`,
`LandingPage.tsx` and `EuroLandingPage.tsx`.

`src/vnext/foundations/tokens.css` says the opposite, deliberately:

> DARK ONLY, FOR NOW. vNext starts dark because the product it is aiming at is a
> broadcast-feeling football game. A light theme is a real question and is listed
> as unresolved in docs/product/vnext-workshop.md rather than being
> half-answered here.

That was the right call for a workshop. It becomes a different thing at Stage
14, whose mission is to make vNext the production Football Hub: on the current
plan the cutover removes a preference a real user set, and it cannot be repaired
inside that stage, because
[`../../product/vnext-stage-contracts.md`](../../product/vnext-stage-contracts.md)
lists "creative redesign of already accepted vNext surfaces" under Stage 14's
**does not own**.

**Required closure:** either the light theme is answered as Stage 13 scope, or
the retirement of the stored preference is recorded as a deliberate decision in
the route-migration and cutover work. Either is defensible; discovering it during
Stage 14 is not. If the answer is to build it, the second palette needs F4's
matrix rather than an inverted dark ramp.

### F2 — The delivery checklist is duplicated rather than shared

`e2e/vnext-*.spec.ts` is 4,662 lines across eight files with no shared module
between them. Measured at the reviewed commit: `function open` appears in all
eight, `function read` in all eight, and `function expectBaseline` in four.

The `expectBaseline` core is identical in `vnext-leagues`, `vnext-lms` and
`vnext-player-profile` — `horizontalOverflow === 0`, `mainCount === 1`,
`headingCount === 1`, `headingIsWired === true`, `clipped === []`,
`smallTargets === []` — each followed by a per-surface tail that is genuinely
different work: Leagues checks the current destination, LMS checks that no form
field exists, the player profile checks all three panels are present.

The split is right and the tails are the valuable part. The problem is that the
shared six live in three or four places at once. Stages 12, 13 and 15 add at
least four more surfaces, so the current trajectory produces a dozen copies
before the final programme audit tries to assert that every surface met one bar.

**Required closure:** one shared module — a `readSurface()` and an
`expectVNextBaseline()` — with each spec keeping its own story ids and its own
tail.

### F3 — The checklist has already drifted, and nothing reports the drift

F2's cost is not hypothetical. Because each spec owns its own matrix, later
surfaces measure materially less than earlier ones and there is no place where
that is visible. Counted by `grep` over each spec at the reviewed commit:

| Spec | Reduced motion | Focus | Occurrences of `44` |
| --- | --- | --- | --- |
| `vnext-home` | present | 1 | 19 |
| `vnext-shell` | none | 15 | 36 |
| `vnext-matches` | present | 6 | 58 |
| `vnext-leagues` | none | 2 | 7 |
| `vnext-player-profile` | none | 1 | 6 |
| `vnext-lms` | none | 1 | 8 |

Width coverage drifts the same way. Across the whole vNext suite, `1440` appears
58 times, `375` 40, `430` 29 and `1920` 26 — but `768` only 10 and `1024` only
9. Those two are where a two-column composition either forms or collapses, and
Leagues, LMS and the player profile are effectively never measured there.

The sharpest instance: `src/vnext/AGENTS.md` records that LMS is "the first
vNext surface that WRITES… pressing a club there really spends it", and its
browser spec is the one with no reduced-motion assertion, one focus mention and
the second-lowest target coverage.

**Required closure:** the width matrix becomes a shared constant, and a surface
that opts out of a width declares it and says why — so an absence is a
reviewable decision rather than a silence.

### F4 — The vNext palette is the one palette nobody measures

`tests/design-system/tokenContrast.test.ts` explains in its own header why it
exists:

> `tokens.css` is the only place a colour may be defined, and nothing measured
> what those colours do when put together. The axe scans catch a bad pairing only
> where a route happens to render it — which is how `--tx3` on `--chip` shipped
> and was then found on 31 July 2026 by the first scan of `/league/:id`, at
> 4.06:1 against the 4.5:1 AA minimum.

That test reads `src/styles/tokens.css`. Nothing in the test tree references
`src/vnext/foundations/tokens.css`, so the 226-line vNext palette has no
equivalent. Its Storybook axe run is real and blocking, but it is exactly the
mechanism the note describes as insufficient — it catches a pairing where a story
happens to render it.

The vNext text ramp is three steps, with the muted step described in
`docs/product/vnext-workshop.md` as already sitting at the contrast floor. A
palette whose floor is deliberate is the palette most worth pinning.

**Required closure:** the same measuring approach pointed at the vNext palette,
with its table pinned. This becomes load-bearing the moment F1 adds a second
theme. Note the related open decision `DEC-013`, which is the legacy palette's
version of the same class of problem.

### F5 — The vNext gates may not be gating

The vNext browser suite and the Storybook accessibility run are the two checks
that enforce most of the above. Neither is inside the one always-present required
context: `.github/workflows/ci.yml` publishes `CI / Required merge gate` from a
job that is `needs: ci` and asserts `test "$CI_RESULT" = success`, aggregating the
`ci` job and nothing else. `vnext-workshop.yml` and `storybook.yml` are separate
`pull_request` workflows with `paths:` filters, outside that aggregate.

Whether the branch ruleset *separately* requires those two contexts is a hosted
setting and could not be read here, so **this is a check to perform, not a
confirmed defect.** It is recorded because the failure mode is silent and this
repository has been bitten by a ruleset/context mismatch before — the same
`ci.yml` carries a long comment about every pull request being refused while its
whole suite was green, because a required context name did not match a job name.

**Required closure:** read the ruleset. If `vNext workshop browser checks` is not
required, then the controller's stage-transition condition "exact-head required
CI is green" can be satisfied by a gate that never looked at the suite proving
the stage's layout contract.

### F6 — The browser suite's runtime budget has a stated remedy and no owner

`.github/workflows/vnext-workshop.yml` states its own arithmetic: Stage 9 took
the suite from 289 tests to 327, a local full run of the 289 already took 21
minutes, the ceiling was raised to 35, and —

> If this suite ever approaches it, the answer is to parallelise the runner or
> split the specs, not to raise it again.

It runs `workers: 1` and `fullyParallel: false` against one Storybook server,
because every spec measures laid-out geometry. Stage 11 has since added Last Man
Standing; Stage 12 adds the Championship, Stage 13 a route-matrix sweep of
supporting surfaces and Stage 15 the Euro adoption audit. Four more surfaces on a
serial suite already at 327 tests reaches the ceiling, and the next agent under
stage pressure meets exactly the choice the comment forbids.

**Required closure:** shard by spec across a matrix of runners before Stage 13,
rather than after the first timeout. F2's shared module is what makes this
cheap — with the reader extracted, each spec is independently bootable and
nothing is shared but the Storybook server, which a shard can start for itself.

### F7 — Stage 15 must audit against primitives nobody has enumerated

The external skill's one genuinely portable structural idea is *master plus page
overrides*: a global design system, with per-page files holding only deviations.
This repository already has a stronger version of the override half —
`vnext-matches.md`, `vnext-leagues.md`, `vnext-player-profiles.md` and
`vnext-lms.md` are real product authorities rather than style deltas.

The global half is the gap. It is distributed through `src/vnext/AGENTS.md`,
which now holds the shell contract, the integration contract, a directory table
and roughly thirty invariants in one file addressed to agents. That is a good
operating document and a poor audit checklist. Stage 15's own predicate requires
that "every major Euro 2028 user-facing surface has been audited against the
vNext quality/system primitives" and that "shared components are reused only
where their semantics match" — both need an enumerated list to be answerable, and
today an auditor would have to re-derive one by inferring which paragraphs are
reusable primitives and which are Home-specific or Matches-specific history.

**Required closure:** the non-stage, non-surface part extracted into one short
referenced list — surface ramp, text ramp, the motion pairs, the 44px target,
container queries rather than viewport queries including the `vh`/`vw` ban, the
no-truncation rule on club names, colour never carrying state alone, and team
colour arriving per team rather than as a token. `src/vnext/AGENTS.md` then points
at it instead of carrying it.

### F8 — Stage 12 draws a bracket, and the lane has one chart and no rule

Stage 12's completion predicate requires that "bracket layout works on phone and
desktop without becoming unreadable". The only geometric precedent in the lane is
`src/vnext/player/RankChart.tsx`, and the way it was verified is the valuable
part. `playwright.vnext.config.ts` records it:

> here the browser is doing something the other suites are not: it reads the
> plotted coordinates out of the rendered SVG. A rank chart drawn upside down is
> invisible to every assertion that cannot see geometry.

That is the right rule for anything positioned by computed geometry, and it is
currently a comment about one chart rather than a stated expectation for the
next one. A knockout bracket is harder: ordering, connectors, byes and walkovers
are all wrong in ways that render successfully.

**Required closure:** the precedent stated as the lane's rule before the bracket
is drawn — anything positioned by computed geometry is asserted by reading
coordinates back out of the rendered DOM, never by trusting the render or a
snapshot. Stage 12 is the stage this affects, and it is in progress now.

### F9 — vNext has no icon system, and Stage 13 is where one gets improvised

`src/design-system/icons.tsx` opens with the rule already held in the legacy
lane: "Shared outline icons (Tabler-style). SVG only — no emoji anywhere in the
UI". `find src/vnext -iname '*icon*'` returns nothing; the only SVG-bearing
component under `src/vnext` is `player/RankChart.tsx`.

Stage 13 owns account, onboarding, discovery, help, and the generic loading,
empty, error, not-found and access-refused states — the exact surfaces where an
icon set appears one component at a time. `src/vnext/AGENTS.md` already
anticipates the shape of an answer ("If shared infrastructure is worth reusing,
separate infrastructure reuse from visual inheritance") and forbids the lazy
alternative ("Do not add… an icon set").

**Required closure:** a recorded decision before Stage 13 opens — reuse
`src/design-system/icons.tsx` as infrastructure, or declare a small vNext set.
Both are defensible; nine components each solving it locally is the default
outcome of not deciding.

## What was assessed and deliberately not adopted

Recorded so it is not re-proposed from the reference material later.

| External capability | Assessment |
| --- | --- |
| Design-system generator (79 styles, 192 palettes, 74 font pairings) | **Rejected.** vNext has a selected identity and an approved gold-standard Home. Generating a system over it is the creative redesign Stages 14 and 15 exclude by contract. |
| Utility-class rules (for example a `cursor-pointer` class on clickables) | **Does not map.** vNext is CSS modules and adds no framework by rule. The intent already holds in the lane; only the phrasing is foreign. |
| The `search.py` CLI and its global npm installer | **Rejected.** A new language runtime and a global package for a lane whose root `AGENTS.md` requires developer tooling to stay outside application and runtime dependencies, with the toolchain already inventoried in `config/agent-tools.json`. |
| The catalogue as taste input for hierarchy, density and responsive patterns | **Kept as critic**, which is already the repository's stated position in `.agents/skills/predictor-ui-review/SKILL.md`. |

The distinction worth carrying forward: a conformance checklist is not a taste
claim, so the checklist half of such a reference may be adopted where the
generator half may not. F2 through F4 are that half.

## What this review changed

**No source, test, workflow, token, fixture or component was changed.** No stage
was advanced, no machine state was edited, no gate was weakened, no baseline was
regenerated, no hosted system was touched and no provider was called. No GitHub
Issue was opened, because opening one is authorised work rather than review work.

Recording this report added:

- this file;
- entries in [`../risk-register.md`](../risk-register.md) for F1 through F8,
  with their live status;
- `DEC-016` and `DEC-017` in [`../deferred-decisions.md`](../deferred-decisions.md)
  for the two genuinely postponed decisions;
- pointers to this report from the vNext programme controller, the programme
  runner skill and `src/vnext/AGENTS.md`, so a stage agent meets it while
  deriving its implementation brief rather than by searching for it.

`current-status.md` and `feature-baseline.md` are unchanged on purpose: no
feature, safeguard or hosted state moved. This review is about the gates around
the lane, not about what the lane currently delivers.
