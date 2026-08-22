# Agent UI skill architecture

## Problem and outcome

The repository needs stronger UI craft guidance without turning every frontend task into a large multi-skill context load or allowing external design projects to become competing product/design authorities.

The accepted outcome is a bounded UI skill stack in which:

- Impeccable is the primary external general UI craft source behind the repo-native `predictor-frontend-design` adapter;
- explicit motion work may add one narrow `predictor-motion-craft` specialist backed by Emil Kowalski's `animate` skill;
- UI UX Pro Max and Taste remain deliberate catalogue/reference sources only;
- `predictor-ui-review` and the routed product/UI authorities remain the acceptance layer;
- existing debugging, React performance, database and other specialist routing continues to win for its own concerns;
- the existing global context ceilings are not raised.

## Authority and boundaries

Governing repository authorities are `AGENTS.md`, `docs/architecture/developer-operating-system.md`, `docs/ops/agent-task-routing.md`, the task-selected product/UI authority, current source and executable tests.

External skills are craft/reference material only. They must not establish or overwrite product rules, navigation rules, brand rules, dependencies, runtime behaviour, `PRODUCT.md`, `DESIGN.md`, persisted design-system truth or hosted state.

No application/runtime, database, provider, hosted-environment or deployment behaviour is in scope.

## Acceptance scenarios

1. `Redesign the vNext Home page` selects Predictor general UI design/Impeccable and the relevant Predictor UI review route, but not motion craft unless motion is explicitly part of the task.
2. `The competition switcher animation feels sluggish` selects the motion specialist and does not load the general design domain skill.
3. An explicitly motion-heavy redesign can compose one design domain skill, one motion specialist and one review skill while remaining within the three-skill global ceiling.
4. `Fix Find a league — it does nothing` selects systematic debugging plus relevant UI review, not general design or motion craft.
5. `Improve Match Centre rendering performance` selects React performance plus the surface review, not general design or motion craft.
6. `Explore three visual directions for the pre-signup landing page` selects general design craft; catalogue sources remain dormant unless deliberately materialized for exploration.
7. `Improve the Matches table spacing` uses the normal surface UI route/review without loading motion or broad design catalogues.
8. Every external source is pinned to an immutable full commit with a compatible declared licence and a valid entrypoint, and every pin is materialized in CI.
9. UI UX Pro Max and Taste are absent from normal routed skill metadata.
10. Existing context benchmark ceilings remain unchanged and green.

## Verification

The change is complete when the targeted routing/materialisation tests, agent context benchmark, Agent Skills validation workflow and repository CI pass at the exact PR head. The PR must record upstream repository/commit/licence evidence and the upstream authority-creating instructions deliberately suppressed by the Predictor adapters.
