# Approved open-source source register

This register contains only systems approved for use or formalisation in the Predictor project. Versions must be selected and locked during the implementation PR rather than copied from this planning snapshot.

| System | Official source | Intended project use | Shipping boundary |
| --- | --- | --- | --- |
| Better Specs | https://github.com/betterspecs/betterspecs | Principles for readable, behaviour-led tests adapted to Vitest and Playwright | Guidance only; no package or Ruby tooling |
| flag-icons | https://github.com/lipis/flag-icons | National and UK subdivision flag SVGs through the existing generated subset | Shipped assets limited to configured teams/venues |
| Lucide | https://github.com/lucide-icons/lucide | Generic application icons behind project wrappers | Tree-shaken React imports in the application |
| Framer Motion | https://github.com/motiondivision/motion | Layout, modal, sheet and state transitions with reduced-motion handling | Application dependency already present |
| Playwright | https://github.com/microsoft/playwright | Existing browser E2E plus visual screenshot contracts | Development/CI dependency only |
| fast-check | https://github.com/dubzzz/fast-check | Property-based testing of scoring, rankings, entrants and state invariants | Development/CI dependency only |
| fast-check Vitest connector | https://github.com/dubzzz/fast-check | Vitest-aware property test integration through `@fast-check/vitest` | Development/CI dependency only |
| StrykerJS | https://github.com/stryker-mutator/stryker-js | Focused mutation testing of critical pure-domain logic | Development/scheduled CI only |
| Mock Service Worker | https://github.com/mswjs/msw | Network-level development and integration-test scenarios | Test/dev boot only; excluded from production startup |
| Knip | https://github.com/webpro-nl/knip | Detect unused files, exports, types and dependencies | Development/CI dependency only |
| Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci | Runtime performance, accessibility and best-practice budgets | Development/CI dependency only |
| Renovate | https://github.com/renovatebot/renovate | Scheduled dependency discovery and update PRs | External automation; not linked into application code |
| Dependency Review Action | https://github.com/actions/dependency-review-action | Reject newly introduced vulnerable or disallowed dependencies | GitHub Actions only |
| OpenSSF Scorecard | https://github.com/ossf/scorecard | Advisory supply-chain and workflow-practice review | Scheduled GitHub Actions/security reporting only |
| npm SBOM | https://github.com/npm/cli | Generate CycloneDX dependency inventory with `npm sbom` | Build/release artefact; no additional application package |
| Grafana k6 | https://github.com/grafana/k6 | Non-production deadline-burst and submission-load testing | External CLI/CI workload only |

## Adoption checks for every implementation PR

Before adding or updating one of these systems:

1. read the current official release notes and supported Node/React/Vite versions;
2. confirm the current licence and use it within the boundary above;
3. pin the npm package or GitHub Action consistently with repository policy;
4. record any new generated files, cache paths and CI artefacts;
5. confirm no secret, hosted mutation or production request is required for the normal PR check;
6. run the project's existing lint, tests, build and relevant security gates;
7. remove the system if the pilot does not provide reliable signal.