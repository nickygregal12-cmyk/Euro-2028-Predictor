# vNext frontend router

These instructions apply to `src/vnext/`. They contain only the **universal vNext boundaries** and pointers to the surface authority that owns the detailed rules. Do not turn this file back into a combined history/specification for every page.

## Start with the task, not the whole vNext programme

1. Follow root [`../../AGENTS.md`](../../AGENTS.md) and current [`../../NOW.md`](../../NOW.md).
2. When the exact implementation surface is not already known, run `npm run agent:route -- "THE TASK"`. The task packet should normally identify the relevant vNext surface, source/tests and one surface authority before you open files broadly.
3. Read [`../../docs/product/ui.md`](../../docs/product/ui.md) plus **only the matching surface authority below**. Read workshop/history/audit material only when the task genuinely needs it.
4. Inspect the exact source/tests returned by Graphify or bounded search. Use Serena after the area is known when exact symbols/callers matter.
5. For non-trivial delivery or review, load only the process/review skill selected by the task packet.

## Surface authority routing

| Surface / path | Detailed authority |
| --- | --- |
| `app/`, `integration/shell/`, competition switching/navigation | [`../../docs/product/vnext-shell-ia.md`](../../docs/product/vnext-shell-ia.md) |
| `home/`, `integration/home/` | [`../../docs/product/ui.md`](../../docs/product/ui.md); [`../../docs/product/vnext-workshop.md`](../../docs/product/vnext-workshop.md) only where the Home/workshop design hypothesis matters |
| `predictor/`, `integration/predictor/` | [`../../docs/product/ui.md`](../../docs/product/ui.md) + [`../../docs/product/vnext-workshop.md`](../../docs/product/vnext-workshop.md) + the exact application prediction contract used by the adapter |
| `matches/`, `integration/matches/` | [`../../docs/product/vnext-matches.md`](../../docs/product/vnext-matches.md) |
| `leagues/`, `integration/leagues/` | [`../../docs/product/vnext-leagues.md`](../../docs/product/vnext-leagues.md) |
| `player/`, `integration/playerProfile/` | [`../../docs/product/vnext-player-profiles.md`](../../docs/product/vnext-player-profiles.md) |
| `lms/`, `integration/lms/` | [`../../docs/product/vnext-lms.md`](../../docs/product/vnext-lms.md) |
| `championship/`, `integration/championship/` | [`../../docs/product/vnext-championship.md`](../../docs/product/vnext-championship.md) |
| `create/`, `discovery/`, `games/`, `account/`, `about/`, `publicDocument/` and their adapters | [`../../docs/product/ui.md`](../../docs/product/ui.md) + shell IA where navigation/chrome is involved + the exact feature/spec/source contract returned by the task packet |
| `foundations/`, `components/`, `models/`, `fixtures/`, `stories/`, `workshop/` | [`../../docs/product/ui.md`](../../docs/product/ui.md); use [`../../docs/product/vnext-workshop.md`](../../docs/product/vnext-workshop.md) for workshop-only design mechanics |
| `ia/` | [`../../docs/product/vnext-ia-lab.md`](../../docs/product/vnext-ia-lab.md) is historical decision evidence; accepted shell behaviour lives in `vnext-shell-ia.md` |

A task that touches several surfaces may need more than one row, but that is the exception. Do not preload Matches, Leagues, Profiles, LMS and Championship authorities for a Home-only change.

## Universal architecture boundaries

- **Product truth stays outside presentation.** Presentation may not invent scoring, locks, reveal, settlement, progression, membership, permissions, provider truth or tournament structure. If a field is unavailable, design the unavailable state rather than manufacturing a value.
- **The presentation lane consumes typed models.** Visual components do not reach Supabase, generated database types, provider clients or application feature state directly.
- **`integration/` is the application-facing boundary.** Acquisition/hooks/services live there; model mapping stays pure where the existing adapter contract says it is pure. Do not make reusable presentation components network-aware.
- **Commands use the application's existing command/service path.** Do not create a second save/write mechanism inside vNext. Success feedback follows the server/application success state, not the click or keystroke.
- **The shell owns application chrome and the single `<main>`.** Pages own their content and `<h1>`. Page-specific content must not leak into `app/`, and a host must not wrap a page in a second shell/main.
- **Home is the visual quality reference, not a page template.** Reuse foundations and proven interaction language; each surface still follows its own information hierarchy and product authority.
- **Keep football context, game and person identity separate.** Do not derive one identity/boundary from another or use display-name matching as identity/permission evidence.

## Responsive, motion and accessibility boundaries

- Layout responds to its **container**, not the browser viewport. Do not use viewport queries/units to make a workshop frame pretend to be the device being reviewed.
- Desktop may be a materially different composition from mobile; do not stretch a phone stack across a wide workspace.
- Dense rows/components measure the container that actually owns their width. Prefer wrapping/real layout over truncating football names to make a breakpoint pass.
- Every motion primitive ships with reduced-motion behaviour. Motion may explain hierarchy/state or add deliberate delight; it must not delay a navigation/application command.
- Keyboard/focus behaviour, semantic landmarks, text scaling and accessibility are part of acceptance, not cleanup.
- Anything positioned by computed coordinates (chart, bracket, connector, meter, track) needs browser evidence that reads rendered coordinates/relationships back from the document. A jsdom render proving elements exist is not geometry proof.

## Deterministic review boundaries

- Fixtures and Storybook worlds are deterministic review inputs. They do not become game rules and do not read the current clock/provider/network.
- Time-dependent presentation takes an explicit/current display instant through the sanctioned page mechanism. A presentation clock can make a label/countdown current; it cannot create permissions, results, settlement or reveal state.
- Storybook proves component/world composition. Real application journeys and route/interaction behaviour need the relevant browser tests.
- Use the repository's existing Playwright visual contracts for curated visual regression; optional screenshot tools are critics, not visual authority.

## Dependency boundary

Use the dependencies already in the repository. Do not add a router, state library, CSS framework, component library, icon set, animation library or data-fetching layer to vNext merely to solve a local presentation task. Application/runtime dependency changes require their own justification and review.

The executable dependency direction is enforced by repository tests and dependency-cruiser. In particular, vNext presentation cannot reach application services/features except through the intended integration boundary, and source cycles remain blocking.

## Context budget

A normal vNext task should usually reach useful source with roughly:

- root `NOW.md` / `AGENTS.md` routing;
- this compact file;
- `docs/product/ui.md`;
- **one** surface authority;
- the small Graphify/Serena source-and-test shortlist.

Do not read all vNext product documents, dated audits, programme history or the whole `src/vnext/` tree before starting a local task. If the task packet identifies no useful source, use bounded repository search and expand deliberately.

For a UI review, use [`.agents/skills/predictor-ui-review/SKILL.md`](../../.agents/skills/predictor-ui-review/SKILL.md). For the controlled multi-stage vNext programme, use [`.agents/skills/vnext-programme-runner/SKILL.md`](../../.agents/skills/vnext-programme-runner/SKILL.md) and its programme controller instead of reconstructing programme state from this file.
